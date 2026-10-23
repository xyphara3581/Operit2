import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

/** Loads the shipped panel with an observable routed collector and composition lifecycle. */
async function panelHarness() {
  const source = await readFile(new URL("../packages/buildin/goal_mode/dist/ui/goal_panel/index.ui.js", import.meta.url), "utf8");
  const exports = {}, timers = new Map(), effects = new Map(), refs = new Map();
  const state = new Map([["chatId", "layout-test"]]);
  let nextTimer = 0, reads = 0, closed = 0, pending = null;
  /** Completes the currently pending stream read and drains its consumer continuation. */
  async function change(value) {
    assert.ok(pending, "A routed state collector must be waiting");
    const resolve = pending; pending = null;
    resolve({ done: false, value });
    await new Promise(resolve => setImmediate(resolve));
  }
  runInNewContext(source, {
    exports,
    /** Supplies the implemented route service without a second persistence implementation. */
    require(name) {
      assert.equal(name, "../../shared/goal_mode_ipc.js");
      return {
        GoalService: {
          /** Delivers the durable deletion through the same subscription. */
          async clear() { await change(null); },
          /** Publishes status actions through the same routed state collector. */
          async status(chatId, status) { assert.equal(chatId, "layout-test"); await change({ ...state.get("goal"), status }); },
          /** Exposes the routed watch as a standard async iterator. */
          watch() {
            reads++;
            return {
              /** Returns the collector identity. */
              [Symbol.asyncIterator]() { return this; },
              /** Waits for the next synchronized value. */
              next() { return new Promise(resolve => { pending = resolve; }); },
              /** Cancels its pending read and releases the collector. */
              async return() { closed++; if (pending) { pending({ done: true }); pending = null; } return { done: true }; },
            };
          },
        },
      };
    },
    /** Retains timer ownership for lifecycle assertions. */
    setInterval(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    /** Releases exactly the timer owned by this context. */
    clearInterval(id) { timers.delete(id); },
  });
  const ctx = {
    /** Supplies ordinary keyed Compose state. */
    useState(key, initial) { if (!state.has(key)) state.set(key, initial); return [state.get(key), value => state.set(key, value)]; },
    /** Retains one context-owned reference across renders. */
    useRef(key, initial) { if (!refs.has(key)) refs.set(key, { current: initial }); return refs.get(key); },
    /** Runs keyed effects and releases the previous dependency owner. */
    useEffect(key, setup, dependencies) {
      const previous = effects.get(key);
      if (previous && dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) return;
      if (previous) previous.cleanup();
      effects.set(key, { cleanup: setup(), dependencies: [...dependencies] });
    },
    /** Escalates unexpected asynchronous errors to the test. */
    reportError(error) { throw error; },
    UI: new Proxy({}, { /** Builds inspectable nodes with the production screen's props. */ get(_target, type) { return (props, children = []) => ({ type, props, children }); } }),
    MaterialTheme: { colorScheme: { surfaceVariant: { /** Preserves color arguments used by the screen. */ copy(value) { return value; } } } },
  };
  return { timers, state, change,
    /** Renders the actual shipped UI entry. */
    render() { return exports.default(ctx); },
    /** Releases all effects as a discarded composition would. */
    dispose() { for (const effect of effects.values()) effect.cleanup(); effects.clear(); },
    get reads() { return reads; }, get closed() { return closed; },
  };
}

/** Verifies that the empty goal slot introduces no transcript spacing. */
function expectZeroHeightPanel(node) {
  assert.equal(node.type, "Column");
  assert.equal(node.children.length, 0);
  assert.equal(node.props.padding, undefined);
  assert.equal(node.props.height, undefined);
}

/** Visits all nodes constructed by the real screen entry. */
function descendants(node) { return [node, ...[node.children].flat().filter(Boolean).flatMap(descendants)]; }

/** Keeps the empty panel subscribed without allocating a refresh timer. */
test("empty goal panels consume routed state without reserving height", async () => {
  const panel = await panelHarness();
  expectZeroHeightPanel(panel.render());
  assert.equal(panel.reads, 1);
  await panel.change(null);
  expectZeroHeightPanel(panel.render());
  assert.equal(panel.timers.size, 0);
  panel.dispose();
  assert.equal(panel.closed, 1);
});

for (const status of ["active", "paused", "completed"]) {
  /** Exercises persisted goal presentation and synchronized deletion. */
  test(`${status} goals retain the card until the routed deletion arrives`, async () => {
    const panel = await panelHarness();
    panel.render();
    await panel.change({ objective: "Keep the goal card visible", status, startedAt: 1000, pausedDurationMs: 0 });
    const card = panel.render();
    assert.equal(card.props.paddingHorizontal, 0);
    assert.equal(card.props.paddingBottom, 8);
    const surface = descendants(card).find(node => node.props.key === "goal.surface");
    assert.equal(surface.props.containerColor, "surfaceContainer");
    assert.equal(surface.props.shape.cornerRadius, 8);
    assert.equal(surface.props.themeSurface, "card");
    assert.equal(descendants(card).find(node => node.props.key === "goal.title").props.style, "labelMedium");
    assert.ok(!descendants(card).some(node => node.props.key === "goal.details"));
    assert.equal(panel.timers.size, 0, "a hidden clock must not allocate a timer");
    descendants(card).find(node => node.props.key === "goal.expand").props.onClick();
    assert.ok(descendants(panel.render()).some(node => node.props.key === "goal.details"));
    assert.ok(descendants(card).some(node => node.props.text === "Keep the goal card visible"));
    assert.equal(panel.timers.size, status === "active" ? 1 : 0);
    const remove = descendants(card).find(node => node.props.key === "goal.clear");
    await remove.props.onClick();
    expectZeroHeightPanel(panel.render());
    assert.equal(panel.timers.size, 0);
    panel.dispose();
  });
}

/** Clears the previous pending collector and clock when chat identity or page ownership changes. */
test("goal subscriptions and timers belong to the exact composition context", async () => {
  const panel = await panelHarness();
  panel.render();
  await panel.change({ objective: "Remote goal", status: "active", startedAt: 1000, pausedDurationMs: 0 });
  const collapsed = panel.render();
  assert.equal(panel.timers.size, 0);
  descendants(collapsed).find(node => node.props.key === "goal.expand").props.onClick();
  panel.render();
  assert.equal(panel.timers.size, 1);
  assert.equal(panel.reads, 1);
  panel.state.set("chatId", "another-chat");
  panel.render();
  assert.equal(panel.closed, 1);
  assert.equal(panel.reads, 2);
  panel.dispose();
  assert.equal(panel.closed, 2);
  assert.equal(panel.timers.size, 0);
});

/** Verifies icon controls preserve routed pause/resume semantics and collapse releases only the UI clock. */
test("goal icon controls retain observation while collapsed clocks stay idle", async () => {
  const panel = await panelHarness();
  panel.render();
  await panel.change({ objective: "Mobile goal", status: "active", startedAt: 1000, pausedDurationMs: 0 });
  let tree = panel.render();
  descendants(tree).find(node => node.props.key === "goal.expand").props.onClick();
  tree = panel.render();
  assert.equal(panel.timers.size, 1);
  await descendants(tree).find(node => node.props.key === "goal.pause").props.onClick();
  tree = panel.render();
  assert.equal(panel.timers.size, 0);
  await descendants(tree).find(node => node.props.key === "goal.resume").props.onClick();
  tree = panel.render();
  assert.equal(panel.timers.size, 1);
  descendants(tree).find(node => node.props.key === "goal.expand").props.onClick();
  panel.render();
  assert.equal(panel.timers.size, 0);
  assert.equal(panel.reads, 1);
  assert.equal(panel.closed, 0);
  panel.dispose();
  assert.equal(panel.closed, 1);
});
