/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import { createSignal, Show } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import { getMetrics } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";

function ModeBadge(props: { api: any; sessionID: () => string }) {
  const [modeState, setModeState] = createSignal({});

  const unwatch = watchModeState((nextState) => {
    setModeState(nextState);
  });

  const mode = () => currentMode(modeState(), props.sessionID());
  const isPlan = () => mode() === "plan";
  const warningColor = () => props.api?.theme?.current?.warning || "#f59e0b";

  return (
    <Show when={isPlan()}>
      <box flexDirection="row">
        <text fg={warningColor()}>🔒 [plan mode]</text>
      </box>
    </Show>
  );
}

function SidebarWidget(props: { api: any; sessionID: () => string; directory: string }) {
  const [open, setOpen] = createSignal(true);
  const [modeState, setModeState] = createSignal({});
  const [metrics, setMetrics] = createSignal(getMetrics(props.directory));

  const unwatch = watchModeState((nextState) => {
    setModeState(nextState);
    setMetrics(getMetrics(props.directory));
  });

  const theme = () => props.api?.theme?.current || {};
  const mode = () => (props.sessionID() ? currentMode(modeState(), props.sessionID()) : "execute");
  const isPlan = () => mode() === "plan";
  const modeText = () => (isPlan() ? "🔒 Plan (Read-Only)" : "⚡ Execute");
  const modeColor = () => (isPlan() ? theme().warning || "#f59e0b" : theme().success || "#10b981");

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1} onMouseDown={() => setOpen((x) => !x)}>
        <text fg={theme().textMuted}>{open() ? "▼" : "▶"}</text>
        <text fg={theme().text}>
          <b>oh-my-hook</b>
        </text>
      </box>
      <Show when={open()}>
        <box flexDirection="column" gap={0}>
          <box flexDirection="row" gap={1}>
            <text flexShrink={0} fg={modeColor()}>
              •
            </text>
            <text fg={theme().textMuted}>
              Mode: <span style={{ fg: modeColor() }}>{modeText()}</span>
            </text>
          </box>
          <box flexDirection="row" gap={1}>
            <text flexShrink={0} fg={theme().success || "#10b981"}>
              •
            </text>
            <text fg={theme().textMuted}>Guards: {metrics().guardsActive} Active</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text flexShrink={0} fg={theme().textMuted}>
              •
            </text>
            <text fg={theme().textMuted}>Memory: {metrics().memoryNotes} Notes</text>
          </box>
        </box>
      </Show>
    </box>
  );
}

export const tui = async (api: any, options: any = {}) => {
  if (!api || !api.slots) return;

  const directory = options?.directory || process.cwd();
  let currentSessionID = resolveActiveSessionID(api) || "";

  const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
    if (nextSessionID) currentSessionID = nextSessionID;
  });

  if (typeof api.slots.register === "function") {
    api.slots.register({
      id: "oh-my-hook-sidebar",
      order: 160,
      slots: {
        session_prompt_right(_ctx: any, props: { session_id?: string }) {
          return (
            <ModeBadge
              api={api}
              sessionID={() => props?.session_id || currentSessionID || resolveActiveSessionID(api) || ""}
            />
          );
        },
        sidebar_content(_ctx: any, props: { session_id?: string }) {
          return (
            <SidebarWidget
              api={api}
              sessionID={() => props?.session_id || currentSessionID || resolveActiveSessionID(api) || ""}
              directory={directory}
            />
          );
        },
      },
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
  tui,
};
