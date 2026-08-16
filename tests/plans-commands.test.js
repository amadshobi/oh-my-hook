import test from "node:test";
import assert from "node:assert/strict";
import { parsePlanningCommand, parseApproveCommand } from "../plans/commands.js";

test("parsePlanningCommand handles in-chat mode without args", () => {
  const res = parsePlanningCommand("", "plan");
  assert.equal(res.mode, "chat");
  assert.equal(res.topic, "");
  assert.equal(res.kind, "plan");
});

test("parsePlanningCommand handles in-chat mode with custom topic", () => {
  const res = parsePlanningCommand("analisis auth google oauth", "plan");
  assert.equal(res.mode, "chat");
  assert.equal(res.topic, "analisis auth google oauth");
});

test("parsePlanningCommand handles to-file with feature name and notes", () => {
  const res = parsePlanningCommand("to-file payment-gateway migrasi stripe ke midtrans", "plan");
  assert.equal(res.mode, "file");
  assert.equal(res.name, "payment-gateway");
  assert.equal(res.topic, "migrasi stripe ke midtrans");
  assert.equal(res.kind, "plan");
});

test("parsePlanningCommand handles --file flag alias", () => {
  const res = parsePlanningCommand("--file user-dashboard", "design");
  assert.equal(res.mode, "file");
  assert.equal(res.name, "user-dashboard");
  assert.equal(res.kind, "design");
});

test("parseApproveCommand captures optional notes", () => {
  const res = parseApproveCommand("fokus ke task 1 dan 2 dulu");
  assert.equal(res.notes, "fokus ke task 1 dan 2 dulu");
});
