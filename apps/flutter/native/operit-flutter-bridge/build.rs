// Android's NDK ships the C++ standard library as two static archives:
// libc++_static.a (libc++ itself) and libc++abi.a (the ABI layer that defines the
// RTTI/typeinfo symbols for the standard exception classes, for example
// _ZTISt13runtime_error, plus __cxa_throw and friends).
//
// operit-local-models links both from its own build script, but those directives only
// apply while building that crate's rlib; they are not replayed when the final
// cdylib (liboperit_flutter_bridge.so) is linked. The resulting shared object keeps
// _ZTISt13runtime_error and __cxa_throw undefined, and dlopen then fails with
// "cannot locate symbol _ZTISt13runtime_error".
//
// Link the NDK's libc++.a linker script at the cdylib layer instead of naming the
// archives by hand. libc++.a selects libc++_static + libc++abi + libunwind in the
// order the NDK expects. -Bstatic keeps the linker on the static script: a bare -lc++
// would prefer libc++.so when one is present.
fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg-cdylib=-Wl,-Bstatic");
        println!("cargo:rustc-link-arg-cdylib=-lc++");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-Bdynamic");
    }
}
