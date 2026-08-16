/**
 * mode-badge.js — pure JS component for session_prompt_right slot.
 */
import { currentMode } from "../lib/mode-watch.js";

export function createModeBadge({ api, getState, getSessionID }) {
  return function ModeBadge(props) {
    const sessionID = props?.session_id || props?.sessionID || getSessionID();
    if (!sessionID) return null;

    const state = getState();
    const mode = currentMode(state, sessionID);

    if (mode !== "plan") {
      return null;
    }

    const warningColor = api?.theme?.current?.warning || "#f59e0b";

    return {
      type: "box",
      props: {
        flexDirection: "row",
        children: {
          type: "text",
          props: {
            fg: warningColor,
            children: "🔒 [plan mode]",
          },
        },
      },
      toString() {
        return "🔒 [plan mode]";
      },
    };
  };
}
