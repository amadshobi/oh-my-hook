/**
 * sidebar-widget.js — pure JS component for sidebar_content slot.
 */
import { currentMode } from "../lib/mode-watch.js";
import { getMetrics } from "../lib/metrics.js";

export function createSidebarWidget({ api, getState, getSessionID, directory }) {
  let open = true;

  return function SidebarWidget(props) {
    const sessionID = props?.session_id || props?.sessionID || getSessionID();
    const state = getState();
    const mode = sessionID ? currentMode(state, sessionID) : "execute";
    const metrics = getMetrics(directory);

    const theme = api?.theme?.current || {};
    const isPlan = mode === "plan";
    const modeText = isPlan ? "🔒 Plan (Read-Only)" : "⚡ Execute";
    const modeColor = isPlan ? theme.warning || "#f59e0b" : theme.success || "#10b981";
    const textMuted = theme.textMuted || "#6b7280";

    return {
      type: "box",
      props: {
        flexDirection: "column",
        children: [
          {
            type: "box",
            props: {
              flexDirection: "row",
              gap: 1,
              children: [
                { type: "text", props: { fg: textMuted, children: open ? "▼" : "▶" } },
                { type: "text", props: { fg: theme.text || "#ffffff", children: "oh-my-hook" } },
              ],
            },
          },
          open
            ? {
                type: "box",
                props: {
                  flexDirection: "column",
                  gap: 0,
                  children: [
                    {
                      type: "box",
                      props: {
                        flexDirection: "row",
                        gap: 1,
                        children: [
                          { type: "text", props: { fg: modeColor, children: "•" } },
                          { type: "text", props: { fg: textMuted, children: `Mode: ${modeText}` } },
                        ],
                      },
                    },
                    {
                      type: "box",
                      props: {
                        flexDirection: "row",
                        gap: 1,
                        children: [
                          { type: "text", props: { fg: theme.success || "#10b981", children: "•" } },
                          { type: "text", props: { fg: textMuted, children: `Guards: ${metrics.guardsActive} Active` } },
                        ],
                      },
                    },
                    {
                      type: "box",
                      props: {
                        flexDirection: "row",
                        gap: 1,
                        children: [
                          { type: "text", props: { fg: textMuted, children: "•" } },
                          { type: "text", props: { fg: textMuted, children: `Memory: ${metrics.memoryNotes} Notes` } },
                        ],
                      },
                    },
                  ],
                },
              }
            : null,
        ].filter(Boolean),
      },
      toString() {
        return `▼ oh-my-hook\n  • Mode  : ${modeText}\n  • Guards: ${metrics.guardsActive} Active\n  • Memory: ${metrics.memoryNotes} Notes`;
      },
    };
  };
}
