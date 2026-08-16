import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import { createSignal, Show } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import { getMetrics } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";
function ModeBadge(props) {
  const [modeState, setModeState] = createSignal({});
  const unwatch = watchModeState(nextState => {
    setModeState(nextState);
  });
  const mode = () => currentMode(modeState(), props.sessionID());
  const isPlan = () => mode() === "plan";
  const warningColor = () => props.api?.theme?.current?.warning || "#f59e0b";
  return _$createComponent(Show, {
    get when() {
      return isPlan();
    },
    get children() {
      var _el$ = _$createElement("box"),
        _el$2 = _$createElement("text");
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "flexDirection", "row");
      _$insertNode(_el$2, _$createTextNode(`🔒 [plan mode]`));
      _$effect(_$p => _$setProp(_el$2, "fg", warningColor(), _$p));
      return _el$;
    }
  });
}
function SidebarWidget(props) {
  const [open, setOpen] = createSignal(true);
  const [modeState, setModeState] = createSignal({});
  const [metrics, setMetrics] = createSignal(getMetrics(props.directory));
  const unwatch = watchModeState(nextState => {
    setModeState(nextState);
    setMetrics(getMetrics(props.directory));
  });
  const theme = () => props.api?.theme?.current || {};
  const mode = () => props.sessionID() ? currentMode(modeState(), props.sessionID()) : "execute";
  const isPlan = () => mode() === "plan";
  const modeText = () => isPlan() ? "🔒 Plan (Read-Only)" : "⚡ Execute";
  const modeColor = () => isPlan() ? theme().warning || "#f59e0b" : theme().success || "#10b981";
  return (() => {
    var _el$4 = _$createElement("box"),
      _el$5 = _$createElement("box"),
      _el$6 = _$createElement("text"),
      _el$7 = _$createElement("text"),
      _el$8 = _$createElement("b");
    _$insertNode(_el$4, _el$5);
    _$setProp(_el$4, "flexDirection", "column");
    _$insertNode(_el$5, _el$6);
    _$insertNode(_el$5, _el$7);
    _$setProp(_el$5, "flexDirection", "row");
    _$setProp(_el$5, "gap", 1);
    _$setProp(_el$5, "onMouseDown", () => setOpen(x => !x));
    _$insert(_el$6, () => open() ? "▼" : "▶");
    _$insertNode(_el$7, _el$8);
    _$insertNode(_el$8, _$createTextNode(`oh-my-hook`));
    _$insert(_el$4, _$createComponent(Show, {
      get when() {
        return open();
      },
      get children() {
        var _el$0 = _$createElement("box"),
          _el$1 = _$createElement("box"),
          _el$10 = _$createElement("text"),
          _el$12 = _$createElement("text"),
          _el$13 = _$createTextNode(`Mode: `),
          _el$14 = _$createElement("span"),
          _el$15 = _$createElement("box"),
          _el$16 = _$createElement("text"),
          _el$18 = _$createElement("text"),
          _el$19 = _$createTextNode(`Guards: `),
          _el$20 = _$createTextNode(` Active`),
          _el$21 = _$createElement("box"),
          _el$22 = _$createElement("text"),
          _el$24 = _$createElement("text"),
          _el$25 = _$createTextNode(`Memory: `),
          _el$26 = _$createTextNode(` Notes`);
        _$insertNode(_el$0, _el$1);
        _$insertNode(_el$0, _el$15);
        _$insertNode(_el$0, _el$21);
        _$setProp(_el$0, "flexDirection", "column");
        _$setProp(_el$0, "gap", 0);
        _$insertNode(_el$1, _el$10);
        _$insertNode(_el$1, _el$12);
        _$setProp(_el$1, "flexDirection", "row");
        _$setProp(_el$1, "gap", 1);
        _$insertNode(_el$10, _$createTextNode(`•`));
        _$setProp(_el$10, "flexShrink", 0);
        _$insertNode(_el$12, _el$13);
        _$insertNode(_el$12, _el$14);
        _$insert(_el$14, modeText);
        _$insertNode(_el$15, _el$16);
        _$insertNode(_el$15, _el$18);
        _$setProp(_el$15, "flexDirection", "row");
        _$setProp(_el$15, "gap", 1);
        _$insertNode(_el$16, _$createTextNode(`•`));
        _$setProp(_el$16, "flexShrink", 0);
        _$insertNode(_el$18, _el$19);
        _$insertNode(_el$18, _el$20);
        _$insert(_el$18, () => metrics().guardsActive, _el$20);
        _$insertNode(_el$21, _el$22);
        _$insertNode(_el$21, _el$24);
        _$setProp(_el$21, "flexDirection", "row");
        _$setProp(_el$21, "gap", 1);
        _$insertNode(_el$22, _$createTextNode(`•`));
        _$setProp(_el$22, "flexShrink", 0);
        _$insertNode(_el$24, _el$25);
        _$insertNode(_el$24, _el$26);
        _$insert(_el$24, () => metrics().memoryNotes, _el$26);
        _$effect(_p$ => {
          var _v$ = modeColor(),
            _v$2 = theme().textMuted,
            _v$3 = {
              fg: modeColor()
            },
            _v$4 = theme().success || "#10b981",
            _v$5 = theme().textMuted,
            _v$6 = theme().textMuted,
            _v$7 = theme().textMuted;
          _v$ !== _p$.e && (_p$.e = _$setProp(_el$10, "fg", _v$, _p$.e));
          _v$2 !== _p$.t && (_p$.t = _$setProp(_el$12, "fg", _v$2, _p$.t));
          _v$3 !== _p$.a && (_p$.a = _$setProp(_el$14, "style", _v$3, _p$.a));
          _v$4 !== _p$.o && (_p$.o = _$setProp(_el$16, "fg", _v$4, _p$.o));
          _v$5 !== _p$.i && (_p$.i = _$setProp(_el$18, "fg", _v$5, _p$.i));
          _v$6 !== _p$.n && (_p$.n = _$setProp(_el$22, "fg", _v$6, _p$.n));
          _v$7 !== _p$.s && (_p$.s = _$setProp(_el$24, "fg", _v$7, _p$.s));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined,
          n: undefined,
          s: undefined
        });
        return _el$0;
      }
    }), null);
    _$effect(_p$ => {
      var _v$8 = theme().textMuted,
        _v$9 = theme().text;
      _v$8 !== _p$.e && (_p$.e = _$setProp(_el$6, "fg", _v$8, _p$.e));
      _v$9 !== _p$.t && (_p$.t = _$setProp(_el$7, "fg", _v$9, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$4;
  })();
}
export const tui = async (api, options = {}) => {
  if (!api || !api.slots) return;
  const directory = options?.directory || process.cwd();
  let currentSessionID = resolveActiveSessionID(api) || "";
  const unsubSession = createSessionSubscriber(api, nextSessionID => {
    if (nextSessionID) currentSessionID = nextSessionID;
  });
  if (typeof api.slots.register === "function") {
    api.slots.register({
      id: "oh-my-hook-sidebar",
      order: 160,
      slots: {
        session_prompt_right(_ctx, props) {
          return _$createComponent(ModeBadge, {
            api: api,
            sessionID: () => props?.session_id || currentSessionID || resolveActiveSessionID(api) || ""
          });
        },
        sidebar_content(_ctx, props) {
          return _$createComponent(SidebarWidget, {
            api: api,
            sessionID: () => props?.session_id || currentSessionID || resolveActiveSessionID(api) || "",
            directory: directory
          });
        }
      }
    });
  }
  if (api.lifecycle?.onDispose) {
    api.lifecycle.onDispose(() => {
      unsubSession();
    });
  }
};
export default {
  id: "oh-my-hook-tui",
  tui
};
