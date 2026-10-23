import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

/** Loads the shipped hook module with observable goal state and no host side effects. */
async function goalInputHarness(enabled = false) {
  const source = await readFile(new URL("../packages/buildin/goal_mode/dist/plugin/goal_mode_plugin.js", import.meta.url), "utf8");
  const exports = {}, writes = [];
  const state = { enabled };
  const service = {
    /** Reads the same chat-local toggle regardless of the requested language. */
    async inputEnabled(chatId) { assert.equal(chatId, "parent"); return state.enabled; },
    /** Preserves the existing durable toggle operation. */
    async setInput(chatId, value) { assert.equal(chatId, "parent"); state.enabled = value; writes.push(["input", value]); },
    /** Records objective creation so validation cannot silently commit a goal. */
    async set(chatId, objective) { assert.equal(chatId, "parent"); writes.push(["goal", objective]); },
  };
  runInNewContext(source, {
    exports,
    Icons: { Assignment: "assignment" },
    /** Supplies only the module dependencies used by these input hooks. */
    require(name) {
      switch (name) {
        case "../ui/goal_panel/index.ui.js": return {};
        case "../shared/goal_mode_ipc.js": return {
          GoalService: service,
          /** Registers no runtime service while the test observes only input hooks. */
          registerGoalModeIpc() {},
        };
        case "../shared/goal_mode_state.js": return {};
        default: throw new Error(`Unexpected module: ${name}`);
      }
    },
  });
  return { exports, state, writes };
}

/** Builds the host-provided event payload for the current language and chat. */
function event(eventName, useEnglish, payload = {}) {
  return { eventName, eventPayload: { chatId: "parent", useEnglish, ...payload } };
}

test("input menu follows each host language request without resetting its checked state", async () => {
  const h = await goalInputHarness(true);
  for (const useEnglish of [false, true, false]) {
    const result = await h.exports.onInputMenuToggle(event("input_menu", useEnglish, { action: "create" }));
    assert.equal(result.toggles.length, 1);
    const toggle = result.toggles[0];
    assert.equal(toggle.id, "goal_mode_input_slot");
    assert.equal(toggle.title, useEnglish ? "Task goal" : "任务目标");
    assert.equal(toggle.description, useEnglish ? "Use the next message as this chat's task goal." : "将下一条消息作为当前聊天的任务目标。");
    assert.equal(toggle.isChecked, true);
    assert.equal(toggle.slot, "general");
  }
  assert.equal(h.writes.length, 0);
});

test("localized menu toggles still update the exact chat-owned input flag", async () => {
  const h = await goalInputHarness();
  for (const useEnglish of [true, false]) {
    await h.exports.onInputMenuToggle(event("input_menu", useEnglish, { action: "toggle", toggleId: "goal_mode_input_slot" }));
    const menu = await h.exports.onInputMenuToggle(event("input_menu", useEnglish, { action: "create" }));
    assert.equal(menu.toggles[0].isChecked, h.state.enabled);
  }
  assert.deepEqual(h.writes, [["input", true], ["input", false]]);
});

for (const useEnglish of [false, true]) {
  test(`${useEnglish ? "English" : "Chinese"} goal input rejects an empty objective in the host language`, async () => {
    const h = await goalInputHarness(true);
    const result = await h.exports.onChatInput(event("submit_requested", useEnglish, { text: "   " }));
    assert.equal(result.action, "Block");
    assert.equal(result.message, useEnglish ? "A task goal requires message text." : "请填写任务目标。");
    assert.equal(h.writes.length, 0);
  });

  test(`${useEnglish ? "English" : "Chinese"} goal input explains the objective length limit`, async () => {
    const h = await goalInputHarness(true);
    const result = await h.exports.onChatInput(event("submit_requested", useEnglish, { text: "x".repeat(4001) }));
    assert.equal(result.action, "Block");
    assert.equal(result.message, useEnglish ? "Task goal exceeds 4000 characters." : "任务目标不能超过 4000 个字符。");
    assert.equal(h.writes.length, 0);
  });

  test(`${useEnglish ? "English" : "Chinese"} valid goal input keeps its one-message submission lifecycle`, async () => {
    const h = await goalInputHarness(true);
    assert.equal(await h.exports.onChatInput(event("submit_requested", useEnglish, { text: "  Finish this task  " })), null);
    assert.equal(h.writes.length, 0);
    assert.equal(await h.exports.onChatInput(event("submitted", useEnglish, { text: "  Finish this task  " })), null);
    assert.deepEqual(h.writes, [["goal", "Finish this task"], ["input", false]]);
  });
}
