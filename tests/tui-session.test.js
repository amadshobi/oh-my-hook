import test from "node:test";
import assert from "node:assert/strict";
import { resolveActiveSessionID, createSessionSubscriber } from "../tui/src/lib/session.js";

test("resolveActiveSessionID extracts sessionID from api.route.current", () => {
  const mockApi = {
    route: {
      current: {
        name: "session",
        params: { sessionID: "ses_12345" },
      },
    },
  };
  assert.equal(resolveActiveSessionID(mockApi), "ses_12345");
});

test("resolveActiveSessionID falls back to api.state.session.id", () => {
  const mockApi = {
    route: {
      current: { name: "home" },
    },
    state: {
      session: { id: "ses_fallback_99" },
    },
  };
  assert.equal(resolveActiveSessionID(mockApi), "ses_fallback_99");
});

test("createSessionSubscriber notifies initially and on tui.session.select event", () => {
  let listeners = {};
  const mockApi = {
    route: {
      current: { name: "session", params: { sessionID: "ses_initial" } },
    },
    event: {
      on(name, cb) {
        listeners[name] = cb;
        return () => { delete listeners[name]; };
      },
    },
  };

  const sessions = [];
  const dispose = createSessionSubscriber(mockApi, (sid) => {
    sessions.push(sid);
  });

  assert.deepEqual(sessions, ["ses_initial"]);

  // Emit event
  listeners["tui.session.select"]({ sessionID: "ses_switched" });
  assert.deepEqual(sessions, ["ses_initial", "ses_switched"]);

  dispose();
  assert.equal(Object.keys(listeners).length, 0);
});
