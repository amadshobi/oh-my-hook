import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchModeState } from "../tui/src/lib/mode-watch.js";
import { saveModeState, loadModeState } from "../share/state.js";

test("watchModeState triggers immediate callback with initial state", (t) => {
  let called = false;
  let receivedState = null;

  const dispose = watchModeState((state) => {
    called = true;
    receivedState = state;
  }, { immediate: true });

  assert.equal(called, true);
  assert.equal(typeof receivedState, "object");
  dispose();
});

test("watchModeState reacts to saveModeState updates after debounce", async (t) => {
  const originalState = loadModeState();
  const testSession = "test-tui-watch-" + Date.now();

  let updates = [];
  const dispose = watchModeState((state) => {
    if (state[testSession]) {
      updates.push(state[testSession]);
    }
  }, { immediate: false, debounceMs: 20 });

  try {
    const newState = {
      ...originalState,
      [testSession]: { mode: "plan", updatedAt: new Date().toISOString() },
    };
    saveModeState(newState);

    // Wait for debounce tick
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(updates.length >= 1, "Expected at least 1 update callback");
    assert.equal(updates[updates.length - 1].mode, "plan");
  } finally {
    dispose();
    saveModeState(originalState);
  }
});

test("watchModeState dispose stops listening", async (t) => {
  const originalState = loadModeState();
  const testSession = "test-tui-dispose-" + Date.now();

  let updateCount = 0;
  const dispose = watchModeState((state) => {
    if (state[testSession]) updateCount++;
  }, { immediate: false, debounceMs: 20 });

  dispose();

  saveModeState({
    ...originalState,
    [testSession]: { mode: "plan", updatedAt: new Date().toISOString() },
  });

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(updateCount, 0, "No updates should fire after dispose");

  saveModeState(originalState);
});
