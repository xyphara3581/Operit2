use crate::javascript_values::{self, JsonIntrinsics};
use operit_host_api::{
    HostError, HostJavaScriptAsyncJsonCallback, HostJavaScriptBootstrap, HostJavaScriptCodeCache,
    HostJavaScriptExecutionInterrupt, HostJavaScriptInterruptHandler, HostJavaScriptJsonCallback,
    HostJavaScriptRuntime, HostJavaScriptRuntimeHost, HostJavaScriptRuntimeStateAsyncTask,
    HostJavaScriptRuntimeStateFactory, HostJavaScriptRuntimeStateHandle,
    HostJavaScriptRuntimeStateOutput, HostJavaScriptRuntimeStateOutputFuture,
    HostJavaScriptRuntimeStateTask, HostResult,
};
use rquickjs::function::Rest;
use rquickjs::{qjs, Ctx};
use rquickjs::{
    CatchResultExt, Context, Error as QuickJsError, Exception, Function, Persistent, Promise,
    Runtime, Value,
};
use serde_json::Value as JsonValue;
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::rc::{Rc, Weak};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

// Keep the engine limit below the reserved worker stack to leave room for Rust/Host calls.
const JAVASCRIPT_STATE_ENGINE_STACK_BYTES: usize = 4 * 1024 * 1024;

enum NativeJavaScriptStateRequest {
    Enqueue {
        task: HostJavaScriptRuntimeStateTask,
        interrupt: HostJavaScriptExecutionInterrupt,
    },
    Execute {
        task: HostJavaScriptRuntimeStateTask,
        interrupt: HostJavaScriptExecutionInterrupt,
        response: mpsc::Sender<HostResult<HostJavaScriptRuntimeStateOutput>>,
    },
    ExecuteAsync {
        task: HostJavaScriptRuntimeStateAsyncTask,
        interrupt: HostJavaScriptExecutionInterrupt,
        response: tokio::sync::oneshot::Sender<HostResult<HostJavaScriptRuntimeStateOutput>>,
    },
    Shutdown,
}

struct NativePendingPromise {
    scope: String,
    resolve: Persistent<Function<'static>>,
    reject: Persistent<Function<'static>>,
}

const MAX_PENDING_PROMISES: usize = 4096;

type NativePromises = Rc<RefCell<BTreeMap<u64, NativePendingPromise>>>;

struct NativeHostJavaScriptRuntime {
    bootstrap: Arc<HostJavaScriptBootstrap>,
    codeCache: Arc<HostJavaScriptCodeCache>,
    runtime: Runtime,
    context: Context,
    promises: NativePromises,
    nextPromiseId: Rc<Cell<u64>>,
    // Initialized once at creation; None is used only to release persistent JS
    // handles explicitly before the context/runtime during Drop.
    jsonIntrinsics: Rc<RefCell<Option<JsonIntrinsics>>>,
}

impl NativeHostJavaScriptRuntime {
    /// Captures engine intrinsics and installs the required boundary before any script runs.
    fn new(
        bootstrap: Arc<HostJavaScriptBootstrap>,
        codeCache: Arc<HostJavaScriptCodeCache>,
    ) -> HostResult<Self> {
        let runtime =
            Runtime::new_with_alloc(crate::javascript_allocator::JavaScriptAllocator::default())
                .map_err(|error| HostError::new(error.to_string()))?;
        // Only managed workers have the known 16 MiB reservation; caller-owned threads
        // retain QuickJS's default bound rather than assuming their available stack.
        if crate::runtime_task_scheduler::hasManagedWorkerStack() {
            runtime.set_max_stack_size(JAVASCRIPT_STATE_ENGINE_STACK_BYTES);
        }
        let context = Context::full(&runtime).map_err(|error| HostError::new(error.to_string()))?;
        let jsonIntrinsics = Rc::new(RefCell::new(None));
        context
            .with(|ctx| {
                *jsonIntrinsics.borrow_mut() = Some(JsonIntrinsics::new(&ctx)?);
                javascript_values::install_owned_snapshot(&ctx, Rc::downgrade(&jsonIntrinsics))
            })
            .map_err(|error| HostError::new(error.to_string()))?;
        Ok(Self {
            bootstrap,
            codeCache,
            runtime,
            context,
            promises: Rc::new(RefCell::new(BTreeMap::new())),
            nextPromiseId: Rc::new(Cell::new(0)),
            jsonIntrinsics,
        })
    }
}

impl Drop for NativeHostJavaScriptRuntime {
    /// Releases engine-owned persistent handles before the runtime is destroyed.
    fn drop(&mut self) {
        // Persistent handles must be released before the context/runtime. This
        // also breaks the registry -> resolver -> runtime -> binding -> registry cycle.
        self.promises.borrow_mut().clear();
        self.jsonIntrinsics.borrow_mut().take();
    }
}

impl HostJavaScriptRuntime for NativeHostJavaScriptRuntime {
    /// Compiles the trusted bootstrap once per host and executes it in an isolated context.
    fn evaluateHostJavaScriptBootstrap(&mut self, source: &'static str) -> HostResult<()> {
        self.context.with(|ctx| {
            let bytes = self
                .bootstrap
                .bytecode(source, || compileBootstrap(&ctx, source))?;
            // The bytes originate from this host's QuickJS build and never cross a storage or plugin boundary.
            let raw = unsafe {
                qjs::JS_ReadObject(
                    ctx.as_raw().as_ptr(),
                    bytes.as_ptr(),
                    bytes.len() as _,
                    qjs::JS_READ_OBJ_BYTECODE as _,
                )
            };
            if unsafe { qjs::JS_IsException(raw) } {
                return Err(bootstrapException(&ctx));
            }
            // JS_EvalFunction consumes the deserialized function, including on failure.
            let result = unsafe { qjs::JS_EvalFunction(ctx.as_raw().as_ptr(), raw) };
            if unsafe { qjs::JS_IsException(result) } {
                return Err(bootstrapException(&ctx));
            }
            drop(unsafe { Value::from_raw(ctx.clone(), result) });
            Ok(())
        })
    }

    /// Reuses immutable module bytecode while materializing a new function in this realm.
    fn registerHostJavaScriptFunctionConstructor(
        &mut self,
        name: &str,
        parameters: &[&str],
    ) -> HostResult<()> {
        let prefix = format!("(function({}){{\n", parameters.join(","));
        let cache = self.codeCache.clone();
        self.context
            .with(|ctx| {
                let function = moduleFunctionConstructor(ctx.clone(), prefix, cache)?;
                ctx.globals().set(name, function)
            })
            .map_err(|error| HostError::new(error.to_string()))
    }

    /// Evaluates one native QuickJS script without reading its return value.
    fn evaluateHostJavaScriptVoid(&mut self, _scriptName: &str, script: &str) -> HostResult<()> {
        self.context.with(|ctx| {
            ctx.eval::<(), _>(script)
                .catch(&ctx)
                .map_err(|error| HostError::new(error.to_string()))
        })
    }

    /// Evaluates one native QuickJS script and converts its return value to a string.
    fn evaluateHostJavaScriptString(
        &mut self,
        _scriptName: &str,
        script: &str,
    ) -> HostResult<String> {
        self.context.with(|ctx| {
            ctx.eval::<String, _>(script)
                .catch(&ctx)
                .map_err(|error| HostError::new(error.to_string()))
        })
    }

    /// Executes every native QuickJS job currently ready in this runtime.
    fn executePendingHostJavaScriptJobs(&mut self) -> HostResult<()> {
        while self.context.with(|ctx| ctx.execute_pending_job()) {}
        Ok(())
    }

    /// Replaces the native QuickJS interrupt predicate.
    fn setHostJavaScriptInterruptHandler(
        &mut self,
        handler: Option<HostJavaScriptInterruptHandler>,
    ) -> HostResult<()> {
        self.runtime.set_interrupt_handler(
            handler
                .map(|handler| Box::new(move || handler()) as Box<dyn FnMut() -> bool + 'static>),
        );
        Ok(())
    }

    /// Calls a required lifecycle function using captured structured argument and result conversion.
    fn callHostJavaScriptFunction(
        &mut self,
        name: &str,
        arguments: &[JsonValue],
    ) -> HostResult<JsonValue> {
        let intrinsics = self.jsonIntrinsics.clone();
        self.context.with(|ctx| {
            let result = (|| {
                let function: Function = ctx.globals().get(name)?;
                let profile = name == "__operitExecuteScriptFunction" && arguments.get(6) == Some(&JsonValue::Bool(true)) && std::env::var_os("OPERIT_PROFILE_COMPOSE_STAGES").is_some();
                let started = profile.then(std::time::Instant::now);
                let values = arguments
                    .iter()
                    .map(|arg| javascript_values::to_js(&ctx, arg))
                    .collect::<rquickjs::Result<Vec<_>>>()?;
                if let Some(started) = started {
                    let line = format!("event=compose_pipeline_stage stage=rust-to-js-input durationMs={:.3} wallMicros={} call={}\n",
                        started.elapsed().as_secs_f64() * 1000.0,
                        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_micros(),
                        arguments.first().and_then(JsonValue::as_str).unwrap_or(""));
                    let _ = std::io::Write::write_all(&mut std::io::stderr().lock(), line.as_bytes());
                }
                let result: Value = function.call((Rest(values),))?;
                if result.is_undefined() {
                    return Ok(JsonValue::Null);
                }
                intrinsics
                    .borrow()
                    .as_ref()
                    .ok_or(QuickJsError::Unknown)?
                    .from_js(&ctx, result)?
                    .ok_or_else(|| {
                        Exception::throw_type(
                            &ctx,
                            "Host lifecycle result must be a JSON-compatible value",
                        )
                    })
            })();
            result
                .catch(&ctx)
                .map_err(|error| HostError::new(error.to_string()))
        })
    }

    /// Registers one native structured Promise binding on the owning executor.
    fn registerHostJavaScriptAsyncJsonFunction(
        &mut self,
        name: &str,
        callback: HostJavaScriptAsyncJsonCallback,
    ) -> HostResult<()> {
        let promises = self.promises.clone();
        let nextId = self.nextPromiseId.clone();
        let intrinsics = self.jsonIntrinsics.clone();
        self.context
            .with(|ctx| {
                let function = structuredFunction(
                    ctx.clone(),
                    promises,
                    nextId,
                    Rc::downgrade(&intrinsics),
                    callback,
                )?;
                ctx.globals().set(name, function)?;
                Ok::<_, QuickJsError>(())
            })
            .map_err(|error| HostError::new(error.to_string()))
    }

    /// Settles one native Promise and releases both persistent completion handles.
    fn settleHostJavaScriptPromise(
        &mut self,
        id: u64,
        value: JsonValue,
        reject: bool,
    ) -> HostResult<()> {
        let pending = self.promises.borrow_mut().remove(&id);
        let Some(pending) = pending else {
            return Ok(());
        };
        let mut converted = false;
        let result = self
            .context
            .with(|ctx| {
                // A failed result conversion must still settle the Promise rather
                // than removing its handle and leaving the JS await pending forever.
                let value = match javascript_values::to_js(&ctx, &value).catch(&ctx) {
                    Ok(value) => {
                        converted = true;
                        value
                    }
                    Err(error) => {
                        pending
                            .reject
                            .restore(&ctx)?
                            .call::<_, ()>((error.to_string(),))?;
                        return Ok(());
                    }
                };
                let function = if reject {
                    pending.reject
                } else {
                    pending.resolve
                };
                function.restore(&ctx)?.call::<_, ()>((value,))
            })
            .map_err(|error| HostError::new(error.to_string()));
        if converted {
            if let Some(intrinsics) = self.jsonIntrinsics.borrow().as_ref() {
                intrinsics.recycle_result(value);
            }
        }
        result
    }

    /// Rejects cancelled requests so suspended JavaScript can release shared resources.
    fn cancelHostJavaScriptPromises(&mut self, scope: &str) -> HostResult<()> {
        let ids = self
            .promises
            .borrow()
            .iter()
            .filter_map(|(id, pending)| (pending.scope == scope).then_some(*id))
            .collect::<Vec<_>>();
        for id in ids {
            self.settleHostJavaScriptPromise(
                id,
                JsonValue::String("JavaScript execution was cancelled".to_string()),
                true,
            )?;
        }
        Ok(())
    }

    /// Converts synchronous native host requests and results through captured value intrinsics.
    fn registerHostJavaScriptJsonFunction(
        &mut self,
        name: &str,
        callback: HostJavaScriptJsonCallback,
    ) -> HostResult<()> {
        let intrinsics = self.jsonIntrinsics.clone();
        self.context
            .with(|ctx| {
                let intrinsics = Rc::downgrade(&intrinsics);
                let profile = name == "__operitNativeSendStructuredIntermediate"
                    && std::env::var_os("OPERIT_PROFILE_COMPOSE_STAGES").is_some();
                let function = synchronousFunction(ctx.clone(), intrinsics, callback, profile)?;
                ctx.globals().set(name, function)?;
                Ok::<_, QuickJsError>(())
            })
            .map_err(|error| HostError::new(error.to_string()))
    }
}

/// Captures the current QuickJS exception without replacing its message.
fn bootstrapException(ctx: &Ctx<'_>) -> HostError {
    let failure: Result<(), rquickjs::Error> = Err(rquickjs::Error::Exception);
    HostError::new(failure.catch(ctx).unwrap_err().to_string())
}

/// Serializes source on its owning executor without executing it or retaining heap handles.
fn compileProgram(ctx: &Ctx<'_>, source: &str, strict: bool) -> Result<Vec<u8>, QuickJsError> {
    let mut sourceBytes = Vec::with_capacity(source.len() + 1);
    sourceBytes.extend_from_slice(source.as_bytes());
    sourceBytes.push(0);
    let flags = qjs::JS_EVAL_TYPE_GLOBAL
        | qjs::JS_EVAL_FLAG_COMPILE_ONLY
        | if strict { qjs::JS_EVAL_FLAG_STRICT } else { 0 };
    let raw = unsafe {
        qjs::JS_Eval(
            ctx.as_raw().as_ptr(),
            sourceBytes.as_ptr().cast(),
            source.len() as _,
            c"operit.compiled.js".as_ptr(),
            flags as _,
        )
    };
    if unsafe { qjs::JS_IsException(raw) } {
        return Err(QuickJsError::Exception);
    }
    let compiled = unsafe { Value::from_raw(ctx.clone(), raw) };
    let mut length = 0;
    let buffer = unsafe {
        qjs::JS_WriteObject(
            ctx.as_raw().as_ptr(),
            &mut length,
            compiled.as_raw(),
            qjs::JS_WRITE_OBJ_BYTECODE as _,
        )
    };
    if buffer.is_null() {
        return Err(QuickJsError::Exception);
    }
    let bytes = unsafe { std::slice::from_raw_parts(buffer, length as usize).to_vec() };
    unsafe { qjs::js_free(ctx.as_raw().as_ptr(), buffer.cast()) };
    Ok(bytes)
}

/// Preserves exact bootstrap errors and the existing strict bootstrap semantics.
fn compileBootstrap(ctx: &Ctx<'_>, source: &str) -> HostResult<Vec<u8>> {
    compileProgram(ctx, source, true).map_err(|_| bootstrapException(ctx))
}

/// Owns native QuickJS runtimes and their dedicated affine state threads.
#[derive(Clone, Default)]
pub struct NativeHostJavaScriptRuntimeHost {
    bootstrap: Arc<HostJavaScriptBootstrap>,
    codeCache: Arc<HostJavaScriptCodeCache>,
    nextStateId: Arc<AtomicU64>,
    stateWorkers:
        Arc<Mutex<BTreeMap<u64, tokio::sync::mpsc::UnboundedSender<NativeJavaScriptStateRequest>>>>,
}

impl NativeHostJavaScriptRuntimeHost {
    /// Creates the native JavaScript runtime host.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the worker sender for one exact JavaScript runtime state.
    fn stateWorker(
        &self,
        handle: HostJavaScriptRuntimeStateHandle,
    ) -> HostResult<tokio::sync::mpsc::UnboundedSender<NativeJavaScriptStateRequest>> {
        self.stateWorkers
            .lock()
            .expect("native JavaScript state registry mutex poisoned")
            .get(&handle.id)
            .cloned()
            .ok_or_else(|| {
                HostError::new(format!(
                    "JavaScript runtime state does not exist: {}",
                    handle.id
                ))
            })
    }
}

impl HostJavaScriptRuntimeHost for NativeHostJavaScriptRuntimeHost {
    /// Creates one native QuickJS runtime on its owning thread.
    fn createHostJavaScriptRuntime(&self) -> HostResult<Box<dyn HostJavaScriptRuntime>> {
        Ok(Box::new(NativeHostJavaScriptRuntime::new(
            self.bootstrap.clone(),
            self.codeCache.clone(),
        )?))
    }

    /// Creates one affine JavaScript state on the shared Host engine executor.
    fn createHostJavaScriptRuntimeState(
        &self,
        taskName: &str,
        kind: operit_host_api::HostJavaScriptRuntimeStateKind,
        factory: HostJavaScriptRuntimeStateFactory,
    ) -> HostResult<HostJavaScriptRuntimeStateHandle> {
        let stateId = self.nextStateId.fetch_add(1, Ordering::Relaxed) + 1;
        let (requestSender, mut requestReceiver) =
            tokio::sync::mpsc::unbounded_channel::<NativeJavaScriptStateRequest>();
        let (createdSender, createdReceiver) = mpsc::channel::<HostResult<()>>();
        crate::NativeHostRuntimeTaskSchedulerHost::new().scheduleJavaScriptStateTask(
            taskName,
            kind,
            Box::new(move || {
                Box::pin(async move {
                    let mut state = match factory() {
                        Ok(state) => {
                            let _ = createdSender.send(Ok(()));
                            state
                        }
                        Err(error) => {
                            let _ = createdSender.send(Err(error));
                            return;
                        }
                    };
                    while let Some(request) = requestReceiver.recv().await {
                        match request {
                            NativeJavaScriptStateRequest::Enqueue { task, interrupt } => {
                                if let Err(error) = task(state.as_mut(), interrupt) {
                                    operit_host_api::logHostError(
                                        "JavaScriptRuntime",
                                        &error.to_string(),
                                    );
                                }
                            }
                            NativeJavaScriptStateRequest::Execute {
                                task,
                                interrupt,
                                response,
                            } => {
                                let _ = response.send(task(state.as_mut(), interrupt));
                            }
                            NativeJavaScriptStateRequest::ExecuteAsync {
                                task,
                                interrupt,
                                response,
                            } => {
                                let result = task(state.as_mut(), interrupt).await;
                                let _ = response.send(result);
                            }
                            NativeJavaScriptStateRequest::Shutdown => break,
                        }
                    }
                })
            }),
        )?;
        createdReceiver.recv().map_err(|error| {
            HostError::new(format!(
                "JavaScript runtime state creation disconnected: {error}"
            ))
        })??;
        self.stateWorkers
            .lock()
            .expect("native JavaScript state registry mutex poisoned")
            .insert(stateId, requestSender);
        Ok(HostJavaScriptRuntimeStateHandle { id: stateId })
    }

    /// Executes one blocking operation on a native JavaScript state thread.
    fn executeHostJavaScriptRuntimeStateTask(
        &self,
        handle: HostJavaScriptRuntimeStateHandle,
        interrupt: HostJavaScriptExecutionInterrupt,
        task: HostJavaScriptRuntimeStateTask,
    ) -> HostResult<HostJavaScriptRuntimeStateOutput> {
        let worker = self.stateWorker(handle)?;
        let (response, receiver) = mpsc::channel();
        worker
            .send(NativeJavaScriptStateRequest::Execute {
                task,
                interrupt: interrupt.clone(),
                response,
            })
            .map_err(|error| HostError::new(error.to_string()))?;
        receiver
            .recv()
            .map_err(|_| HostError::new("JavaScript runtime state worker disconnected"))?
    }

    /// Posts directly to the existing affine owner without a pool task or completion channel.
    fn enqueueHostJavaScriptRuntimeStateTask(
        &self,
        handle: HostJavaScriptRuntimeStateHandle,
        interrupt: HostJavaScriptExecutionInterrupt,
        task: HostJavaScriptRuntimeStateTask,
    ) -> HostResult<()> {
        let worker = self.stateWorker(handle)?;
        worker
            .send(NativeJavaScriptStateRequest::Enqueue { task, interrupt })
            .map_err(|error| HostError::new(error.to_string()))
    }

    /// Executes one asynchronous operation on a native JavaScript state thread.
    fn executeHostJavaScriptRuntimeStateAsyncTask(
        &self,
        handle: HostJavaScriptRuntimeStateHandle,
        interrupt: HostJavaScriptExecutionInterrupt,
        task: HostJavaScriptRuntimeStateAsyncTask,
    ) -> HostJavaScriptRuntimeStateOutputFuture {
        let worker = self.stateWorker(handle);
        Box::pin(async move {
            let worker = worker?;
            let (response, receiver) = tokio::sync::oneshot::channel();
            worker
                .send(NativeJavaScriptStateRequest::ExecuteAsync {
                    task,
                    interrupt,
                    response,
                })
                .map_err(|error| HostError::new(error.to_string()))?;
            receiver
                .await
                .map_err(|_| HostError::new("JavaScript runtime state worker disconnected"))?
        })
    }

    /// Destroys one native JavaScript state and stops its owning thread.
    fn destroyHostJavaScriptRuntimeState(
        &self,
        handle: HostJavaScriptRuntimeStateHandle,
    ) -> HostResult<()> {
        let worker = self
            .stateWorkers
            .lock()
            .expect("native JavaScript state registry mutex poisoned")
            .remove(&handle.id)
            .ok_or_else(|| {
                HostError::new(format!(
                    "JavaScript runtime state does not exist: {}",
                    handle.id
                ))
            })?;
        worker
            .send(NativeJavaScriptStateRequest::Shutdown)
            .map_err(|error| HostError::new(error.to_string()))
    }
}

/// Creates realm-local functions without capturing a JavaScript context in the host cache.
fn moduleFunctionConstructor<'js>(
    ctx: Ctx<'js>,
    prefix: String,
    cache: Arc<HostJavaScriptCodeCache>,
) -> rquickjs::Result<Function<'js>> {
    Function::new(ctx, move |ctx: Ctx<'js>, body: String| {
        let source = format!("{prefix}{body}\n}})");
        let bytes = cache.getOrCompile(&source, || compileProgram(&ctx, &source, false))?;
        let raw = unsafe {
            qjs::JS_ReadObject(
                ctx.as_raw().as_ptr(),
                bytes.as_ptr(),
                bytes.len() as _,
                qjs::JS_READ_OBJ_BYTECODE as _,
            )
        };
        if unsafe { qjs::JS_IsException(raw) } {
            return Err(QuickJsError::Exception);
        }
        let raw = unsafe { qjs::JS_EvalFunction(ctx.as_raw().as_ptr(), raw) };
        if unsafe { qjs::JS_IsException(raw) } {
            return Err(QuickJsError::Exception);
        }
        let value = unsafe { Value::from_raw(ctx.clone(), raw) };
        value.as_object().unwrap().prop(
            "name",
            rquickjs::object::Property::from("anonymous").configurable(),
        )?;
        Ok::<_, QuickJsError>(value)
    })
}

/// Creates a synchronous value binding whose engine handles stay on the owning executor.
fn synchronousFunction<'js>(
    ctx: rquickjs::Ctx<'js>,
    intrinsics: Weak<RefCell<Option<JsonIntrinsics>>>,
    callback: HostJavaScriptJsonCallback,
    profile: bool,
) -> rquickjs::Result<Function<'js>> {
    Function::new(
        ctx.clone(),
        move |ctx: rquickjs::Ctx<'js>, args: Rest<Value<'js>>| {
            let intrinsics = intrinsics.upgrade().ok_or(QuickJsError::Unknown)?;
            let guard = intrinsics.borrow();
            let converter = guard.as_ref().ok_or(QuickJsError::Unknown)?;
            let started = profile.then(std::time::Instant::now);
            let values = converter.arguments_from_js(&ctx, args.0)?;
            if let Some(started) = started {
                let duration = started.elapsed().as_secs_f64() * 1000.0;
                let call = values.first().and_then(JsonValue::as_str).unwrap_or("");
                let revision = values
                    .get(1)
                    .and_then(|value| value.pointer("/response/update/revision"))
                    .and_then(JsonValue::as_u64)
                    .unwrap_or(0);
                let line = format!("event=compose_pipeline_stage stage=js-to-rust durationMs={duration:.3} wallMicros={} call={call} revision={revision}\n",
                    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_micros());
                let _ = std::io::Write::write_all(&mut std::io::stderr().lock(), line.as_bytes());
            }
            drop(guard);
            let result = callback(values)
                .map_err(|error| Exception::throw_message(&ctx, &error.to_string()))?;
            javascript_values::to_js(&ctx, &result)
        },
    )
}

/// Creates a scoped native Promise from owned JSON-compatible request arguments.
fn structuredFunction<'js>(
    ctx: rquickjs::Ctx<'js>,
    promises: NativePromises,
    nextId: Rc<Cell<u64>>,
    intrinsics: Weak<RefCell<Option<JsonIntrinsics>>>,
    callback: HostJavaScriptAsyncJsonCallback,
) -> rquickjs::Result<Function<'js>> {
    Function::new(
        ctx.clone(),
        move |ctx: rquickjs::Ctx<'js>, scope: String, args: Rest<Value<'js>>| {
            if promises.borrow().len() >= MAX_PENDING_PROMISES {
                return Err(Exception::throw_range(
                    &ctx,
                    "Too many pending structured tool calls",
                ));
            }
            let intrinsics = intrinsics.upgrade().ok_or(QuickJsError::Unknown)?;
            let intrinsicsGuard = intrinsics.borrow();
            let intrinsics = intrinsicsGuard.as_ref().ok_or(QuickJsError::Unknown)?;
            let values = intrinsics.arguments_from_js(&ctx, args.0)?;
            drop(intrinsicsGuard);
            // Getters/toJSON may re-enter this binding and create more requests.
            // Recheck after conversion before retaining another pair of handles.
            if promises.borrow().len() >= MAX_PENDING_PROMISES {
                return Err(Exception::throw_range(
                    &ctx,
                    "Too many pending structured tool calls",
                ));
            }
            let id = nextId
                .get()
                .checked_add(1)
                .ok_or_else(|| Exception::throw_range(&ctx, "Structured request id exhausted"))?;
            nextId.set(id);
            let (promise, resolve, reject) = Promise::new(&ctx)?;
            promises.borrow_mut().insert(
                id,
                NativePendingPromise {
                    scope,
                    resolve: Persistent::save(&ctx, resolve),
                    reject: Persistent::save(&ctx, reject),
                },
            );
            // No RefCell borrow is held across a callback that can re-enter JS.
            if let Err(error) = callback(id, values) {
                let pending = promises
                    .borrow_mut()
                    .remove(&id)
                    .expect("just inserted promise");
                pending
                    .reject
                    .restore(&ctx)?
                    .call::<_, ()>((error.to_string(),))?;
            }
            Ok::<_, QuickJsError>(promise)
        },
    )
}

#[cfg(test)]
mod bridge_tests {
    use super::*;
    use std::sync::Mutex;

    /// Creates an isolated native runtime for the required host contract tests.
    fn runtime() -> NativeHostJavaScriptRuntime {
        NativeHostJavaScriptRuntime::new(
            Arc::new(HostJavaScriptBootstrap::default()),
            Arc::new(HostJavaScriptCodeCache::default()),
        )
        .unwrap()
    }

    /// Keeps mutable globals and host bindings independent across contexts sharing compiled bytes.
    #[test]
    fn shared_bootstrap_preserves_runtime_isolation_and_host_binding_ownership() {
        let host = NativeHostJavaScriptRuntimeHost::new();
        let mut first = host.createHostJavaScriptRuntime().unwrap();
        let mut second = host.createHostJavaScriptRuntime().unwrap();
        for (runtime, owner) in [(&mut first, "first"), (&mut second, "second")] {
            runtime
                .registerHostJavaScriptJsonFunction(
                    "readOwner",
                    Arc::new(move |_| Ok(JsonValue::String(owner.into()))),
                )
                .unwrap();
            runtime.evaluateHostJavaScriptBootstrap(
                "var owned = { count: 0 }; function next() { return readOwner() + ':' + (++owned.count); }").unwrap();
        }
        assert_eq!(
            first
                .evaluateHostJavaScriptString("probe", "next()")
                .unwrap(),
            "first:1"
        );
        assert_eq!(
            first
                .evaluateHostJavaScriptString("probe", "next()")
                .unwrap(),
            "first:2"
        );
        assert_eq!(
            second
                .evaluateHostJavaScriptString("probe", "next()")
                .unwrap(),
            "second:1"
        );
    }

    /// Deserialized functions resolve globals and callbacks in their own runtime.
    #[test]
    fn shared_module_bytecode_keeps_globals_exports_and_host_bindings_local() {
        let host = NativeHostJavaScriptRuntimeHost::new();
        for owner in ["first", "second"] {
            let mut runtime = host.createHostJavaScriptRuntime().unwrap();
            runtime
                .registerHostJavaScriptJsonFunction(
                    "readOwner",
                    Arc::new(move |_| Ok(JsonValue::String(owner.into()))),
                )
                .unwrap();
            runtime
                .registerHostJavaScriptFunctionConstructor(
                    "compileModule",
                    &["module", "exports", "require", "runtime"],
                )
                .unwrap();
            runtime.evaluateHostJavaScriptVoid("test", r#"
                var count = 0;
                var module = {exports:{}};
                var factory = compileModule('exports.next = () => readOwner() + ":" + (++count); module.exports.required = require(runtime);');
                factory(module, module.exports, value => value + ':required', 'context');
            "#).unwrap();
            assert_eq!(runtime.evaluateHostJavaScriptString("probe", "module.exports.next() + ':' + module.exports.next() + ':' + module.exports.required").unwrap(),
                format!("{owner}:1:{owner}:2:context:required"));
        }
    }

    /// A bytecode hit still creates a fresh function and preserves Function body strictness.
    #[test]
    fn module_constructor_preserves_function_scope_and_recovers_after_syntax_errors() {
        let mut runtime = runtime();
        runtime
            .registerHostJavaScriptFunctionConstructor("compileModule", &["value"])
            .unwrap();
        let result = runtime.evaluateHostJavaScriptString("probe", r#"
            (function() {
                var local = 'lexical';
                var a = compileModule('return [this === globalThis, typeof local, typeof anonymous, value];');
                var b = compileModule('return [this === globalThis, typeof local, typeof anonymous, value];');
                var strict = compileModule('"use strict"; return this === undefined;');
                var syntax;
                try { compileModule('return ('); } catch (e) { syntax = e instanceof SyntaxError; }
                return JSON.stringify([a !== b, a.name, a(7), strict(), syntax, compileModule('return value + 1;')(9)]);
            })()
        "#).unwrap();
        assert_eq!(
            result,
            r#"[true,"anonymous",[true,"undefined","undefined",7],true,true,10]"#
        );
    }

    /// Rejects a changed host bootstrap instead of executing bytes for another source.
    #[test]
    fn shared_bootstrap_rejects_source_changes() {
        let host = NativeHostJavaScriptRuntimeHost::new();
        let mut first = host.createHostJavaScriptRuntime().unwrap();
        first
            .evaluateHostJavaScriptBootstrap("var version = 1;")
            .unwrap();
        let mut second = host.createHostJavaScriptRuntime().unwrap();
        let failure = second
            .evaluateHostJavaScriptBootstrap("var version = 2;")
            .unwrap_err();
        assert_eq!(
            failure.message,
            "A JavaScript host cannot change its bootstrap source"
        );
        assert_eq!(
            second
                .evaluateHostJavaScriptString("probe", "typeof version")
                .unwrap(),
            "undefined"
        );
    }

    /// Preserves a compilation failure across contexts without recompiling or replacing it.
    #[test]
    fn shared_bootstrap_keeps_exact_compilation_errors() {
        let host = NativeHostJavaScriptRuntimeHost::new();
        let mut first = host.createHostJavaScriptRuntime().unwrap();
        let failure = first
            .evaluateHostJavaScriptBootstrap("function {")
            .unwrap_err();
        let mut second = host.createHostJavaScriptRuntime().unwrap();
        assert_eq!(
            second
                .evaluateHostJavaScriptBootstrap("function {")
                .unwrap_err(),
            failure
        );
    }

    /// Rejects absent lifecycle bindings instead of silently ignoring a required engine contract.
    #[test]
    fn lifecycle_callbacks_require_a_callable_binding() {
        let mut runtime = runtime();
        assert!(runtime.callHostJavaScriptFunction("missing", &[]).is_err());
        runtime
            .evaluateHostJavaScriptVoid("test", "globalThis.callback=42;")
            .unwrap();
        assert!(runtime.callHostJavaScriptFunction("callback", &[]).is_err());
        runtime
            .evaluateHostJavaScriptVoid(
                "test",
                "globalThis.callback=function(value){globalThis.delivered=value;};",
            )
            .unwrap();
        runtime
            .callHostJavaScriptFunction("callback", &[JsonValue::String("data".to_string())])
            .unwrap();
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "delivered")
                .unwrap(),
            "data"
        );
    }

    /// Uses the same structured contract for synchronous arguments, direct results and host exceptions.
    #[test]
    fn synchronous_bindings_preserve_values_and_throw_errors_without_json_text() {
        let mut runtime = runtime();
        runtime
            .registerHostJavaScriptJsonFunction("echo", Arc::new(|mut args| Ok(args.remove(0))))
            .unwrap();
        runtime
            .registerHostJavaScriptJsonFunction(
                "literal",
                Arc::new(|_| {
                    Ok(JsonValue::String(
                        r#"{"success":false,"message":"literal"}"#.to_string(),
                    ))
                }),
            )
            .unwrap();
        runtime
            .registerHostJavaScriptJsonFunction(
                "fail",
                Arc::new(|_| Err(HostError::new("operation denied"))),
            )
            .unwrap();
        runtime.evaluateHostJavaScriptVoid("test", r#"
            JSON.parse = JSON.stringify = function() { throw Error('JSON text used'); };
            globalThis.copied = echo({ nested: {value:7}, array:[undefined, , NaN], ['__proto__']:{safe:true} });
            globalThis.literalValue = literal();
            try { fail(); } catch (error) { globalThis.failureMessage = error.message; }
        "#).unwrap();
        assert_eq!(runtime.evaluateHostJavaScriptString("test", "String(copied.nested.value===7 && copied.array.every(value=>value===null) && Object.hasOwn(copied,'__proto__') && copied.safe===undefined)").unwrap(), "true");
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "literalValue")
                .unwrap(),
            r#"{"success":false,"message":"literal"}"#
        );
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "failureMessage")
                .unwrap(),
            "operation denied"
        );
        assert!(runtime.promises.borrow().is_empty());
    }

    /// Rejects unsupported top-level values before retaining a native Promise handle.
    #[test]
    fn structured_bindings_reject_non_json_arguments() {
        let mut runtime = runtime();
        runtime
            .registerHostJavaScriptAsyncJsonFunction("request", Arc::new(|_, _| Ok(())))
            .unwrap();
        runtime
            .evaluateHostJavaScriptVoid(
                "test",
                r#"
            globalThis.failures=0;
            for (const value of [undefined, function(){}, Symbol('value')]) {
                try { request('scope', value); } catch (error) { failures++; }
            }
        "#,
            )
            .unwrap();
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "String(failures)")
                .unwrap(),
            "3"
        );
        assert!(runtime.promises.borrow().is_empty());
    }

    /// Cancellation rejects only its scope, runs cleanup once, and ignores late host results.
    #[test]
    fn structured_promises_settle_once_and_cancellation_is_scoped() {
        let mut runtime = runtime();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let received = requests.clone();
        runtime
            .registerHostJavaScriptAsyncJsonFunction(
                "request",
                Arc::new(move |id, args| {
                    received.lock().unwrap().push((id, args));
                    Ok(())
                }),
            )
            .unwrap();
        runtime
            .evaluateHostJavaScriptVoid(
                "test",
                r#"
            globalThis.results=[];
            globalThis.cancelledReason='';
            globalThis.cleaned=0;
            request('first',{i:7}).then(
                value=>results.push(value),
                reason=>{cancelledReason=reason;},
            ).finally(()=>{cleaned++;});
            request('second',{i:8}).then(value=>results.push(value));
        "#,
            )
            .unwrap();
        let requests = requests.lock().unwrap();
        assert_eq!(requests[0].1, vec![serde_json::json!({"i":7})]);
        assert_eq!(runtime.promises.borrow().len(), 2);
        runtime.cancelHostJavaScriptPromises("first").unwrap();
        assert_eq!(runtime.promises.borrow().len(), 1);
        runtime
            .settleHostJavaScriptPromise(
                requests[0].0,
                serde_json::json!({"cancelled":true}),
                false,
            )
            .unwrap();
        runtime
            .settleHostJavaScriptPromise(
                requests[1].0,
                serde_json::json!({"success":false,"message":"business"}),
                false,
            )
            .unwrap();
        runtime
            .settleHostJavaScriptPromise(
                requests[1].0,
                serde_json::json!({"duplicate":true}),
                false,
            )
            .unwrap();
        runtime.executePendingHostJavaScriptJobs().unwrap();
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "JSON.stringify(results)")
                .unwrap(),
            "[{\"message\":\"business\",\"success\":false}]"
        );
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "cancelledReason")
                .unwrap(),
            "JavaScript execution was cancelled"
        );
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "String(cleaned)")
                .unwrap(),
            "1"
        );
        assert!(runtime.promises.borrow().is_empty());
    }

    #[test]
    fn pending_limit_survives_reentrant_parameter_getters() {
        let mut runtime = runtime();
        runtime
            .registerHostJavaScriptAsyncJsonFunction("request", Arc::new(|_, _| Ok(())))
            .unwrap();
        runtime.evaluateHostJavaScriptVoid("test", "for(let i=0;i<4095;i++)request('scope',{}); globalThis.limitFailure=false; try { request('scope',{get x(){request('scope',{});return 7;}}); } catch(e) {limitFailure=e instanceof RangeError;}").unwrap();
        assert_eq!(runtime.promises.borrow().len(), MAX_PENDING_PROMISES);
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "String(limitFailure)")
                .unwrap(),
            "true"
        );
        runtime.cancelHostJavaScriptPromises("scope").unwrap();
        assert!(runtime.promises.borrow().is_empty());
        runtime
            .evaluateHostJavaScriptVoid("test", "request('next',{})")
            .unwrap();
        assert_eq!(runtime.promises.borrow().len(), 1);
    }

    #[test]
    fn oversized_result_rejects_instead_of_leaving_a_pending_promise() {
        let mut runtime = runtime();
        let id = Arc::new(AtomicU64::new(0));
        let received = id.clone();
        runtime
            .registerHostJavaScriptAsyncJsonFunction(
                "request",
                Arc::new(move |id, _| {
                    received.store(id, Ordering::Relaxed);
                    Ok(())
                }),
            )
            .unwrap();
        runtime
            .evaluateHostJavaScriptVoid(
                "test",
                "globalThis.failure=''; request('scope',{}).catch(e=>failure=String(e));",
            )
            .unwrap();
        let mut result = JsonValue::Null;
        for _ in 0..140 {
            result = serde_json::json!({"child":result});
        }
        runtime
            .settleHostJavaScriptPromise(id.load(Ordering::Relaxed), result, false)
            .unwrap();
        runtime.executePendingHostJavaScriptJobs().unwrap();
        assert!(runtime
            .evaluateHostJavaScriptString("test", "failure")
            .unwrap()
            .contains("limit"));
        assert!(runtime.promises.borrow().is_empty());
    }

    #[test]
    fn submission_failure_rejects_and_drop_releases_pending_handles() {
        let mut runtime = runtime();
        runtime
            .registerHostJavaScriptAsyncJsonFunction(
                "request",
                Arc::new(|_, _| Err(HostError::new("submission failure"))),
            )
            .unwrap();
        runtime
            .evaluateHostJavaScriptVoid(
                "test",
                "globalThis.failure=''; request('scope',{}).catch(e=>failure=String(e));",
            )
            .unwrap();
        runtime.executePendingHostJavaScriptJobs().unwrap();
        assert_eq!(
            runtime
                .evaluateHostJavaScriptString("test", "failure")
                .unwrap(),
            "submission failure"
        );
        assert!(runtime.promises.borrow().is_empty());
        runtime
            .registerHostJavaScriptAsyncJsonFunction("pending", Arc::new(|_, _| Ok(())))
            .unwrap();
        runtime
            .evaluateHostJavaScriptVoid("test", "pending('scope',{});")
            .unwrap();
        assert_eq!(runtime.promises.borrow().len(), 1);
        // Dropping here must not abort QuickJS due to live Persistent handles.
    }
}
