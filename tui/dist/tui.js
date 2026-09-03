import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import { createSignal, Show, For, onMount, onCleanup, createMemo, createEffect } from "solid-js";
import { watchModeState } from "./lib/mode-watch.js";
import { watchCompressStats } from "./lib/compress-watch.js";
import { getMetrics, getPlanReviewData } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";
import { loadConfig } from "../../share/config.js";
import { formatReviewFeedback } from "../../plans/parser.js";
import { loadModeState, currentMode, currentPlan } from "../../share/state.js";
import { appendMemory, replaceMemory, removeMemory, resolveTargetMemoryFile, getGlobalFile, listMemoryEntries } from "../../memory/store.js";
import { formatTokens, formatUSD, formatDuration } from "../../usage/format.js";
import { openReadonly, opencodeDbPath } from "../../usage/store-db.js";
import { getAgentTree } from "../../usage/tokens/tracker.js";
function ModeBadge(props) {
  const [modeState, setModeState] = createSignal(loadModeState() || {});
  const unwatch = watchModeState(nextState => {
    setModeState(nextState || {});
  });
  onCleanup(() => {
    unwatch();
  });
  const mode = () => {
    const sid = props.sessionID();
    if (sid && modeState()[sid]?.mode) return modeState()[sid].mode;
    return "execute";
  };
  const isPlan = () => mode() === "plan";
  const warningColor = () => props.api?.theme?.current?.warning || "#f59e0b";
  const activePlan = () => {
    const sid = props.sessionID();
    if (sid && modeState()[sid]?.planName) return modeState()[sid].planName;
    return null;
  };
  return _$createComponent(Show, {
    get when() {
      return isPlan();
    },
    get children() {
      var _el$ = _$createElement("box"),
        _el$2 = _$createElement("box"),
        _el$3 = _$createElement("text"),
        _el$4 = _$createElement("b");
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "flexDirection", "row");
      _$setProp(_el$, "gap", 1);
      _$setProp(_el$, "alignItems", "center");
      _$setProp(_el$, "flexShrink", 0);
      _$insertNode(_el$2, _el$3);
      _$setProp(_el$2, "paddingLeft", 1);
      _$setProp(_el$2, "paddingRight", 1);
      _$setProp(_el$2, "flexShrink", 0);
      _$insertNode(_el$3, _el$4);
      _$setProp(_el$3, "fg", "#000000");
      _$setProp(_el$3, "wrapMode", "none");
      _$insertNode(_el$4, _$createTextNode(`PLAN`));
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return activePlan();
        },
        get children() {
          var _el$6 = _$createElement("text"),
            _el$7 = _$createTextNode(`(`),
            _el$8 = _$createTextNode(`)`);
          _$insertNode(_el$6, _el$7);
          _$insertNode(_el$6, _el$8);
          _$setProp(_el$6, "wrapMode", "none");
          _$insert(_el$6, activePlan, _el$8);
          _$effect(_$p => _$setProp(_el$6, "fg", warningColor(), _$p));
          return _el$6;
        }
      }), null);
      _$effect(_$p => _$setProp(_el$2, "backgroundColor", warningColor(), _$p));
      return _el$;
    }
  });
}
function SidebarWidget(props) {
  const [open, setOpen] = createSignal(true);
  const [modeState, setModeState] = createSignal({});
  const [metrics, setMetrics] = createSignal({});

  // Load initial metrics (async: reads opencode.db for context usage)
  getMetrics(props.directory, undefined, props.sessionID()).then(setMetrics);
  const unwatch = watchModeState(nextState => {
    setModeState(nextState);
    getMetrics(props.directory, undefined, props.sessionID()).then(setMetrics);
  });
  const theme = () => props.api?.theme?.current || {};
  const sessID = () => props.sessionID();
  const activePlan = () => sessID() ? currentPlan(modeState(), sessID()) : null;
  const mode = () => sessID() ? currentMode(modeState(), sessID()) : "execute";
  const isPlan = () => mode() === "plan";

  // Status & Color Resolvers (No Emojis, Pure Color Coding)
  const redColor = () => theme().error || "#ef4444";
  const greenColor = () => theme().success || "#10b981";
  const yellowColor = () => theme().warning || "#f59e0b";
  const mutedColor = () => theme().textMuted || "#6b7280";
  const textNormal = () => theme().text || "#f3f4f6";
  const accentColor = () => theme().accent || "#8b5cf6";
  const isPluginActive = () => metrics().guardsActive > 0 || metrics().memoryEnabled || metrics().compressEnabled || metrics().modeEnabled;
  const headerBadgeText = () => {
    if (metrics().modeEnabled) {
      return isPlan() ? "● PLAN" : "● EXEC";
    }
    if (isPluginActive()) {
      return "● ACTIVE";
    }
    return "○ OFF";
  };
  const headerBadgeColor = () => {
    if (metrics().modeEnabled) {
      return isPlan() ? yellowColor() : greenColor();
    }
    return isPluginActive() ? greenColor() : redColor();
  };
  return (() => {
    var _el$9 = _$createElement("box"),
      _el$0 = _$createElement("box"),
      _el$1 = _$createElement("box"),
      _el$10 = _$createElement("text"),
      _el$11 = _$createElement("text"),
      _el$12 = _$createElement("b"),
      _el$14 = _$createElement("text");
    _$insertNode(_el$9, _el$0);
    _$setProp(_el$9, "flexDirection", "column");
    _$setProp(_el$9, "gap", 0);
    _$insertNode(_el$0, _el$1);
    _$insertNode(_el$0, _el$14);
    _$setProp(_el$0, "flexDirection", "row");
    _$setProp(_el$0, "justifyContent", "space-between");
    _$setProp(_el$0, "width", "100%");
    _$setProp(_el$0, "onMouseDown", () => setOpen(x => !x));
    _$insertNode(_el$1, _el$10);
    _$insertNode(_el$1, _el$11);
    _$setProp(_el$1, "flexDirection", "row");
    _$setProp(_el$1, "gap", 1);
    _$insert(_el$10, () => open() ? "▼" : "▶");
    _$insertNode(_el$11, _el$12);
    _$insertNode(_el$12, _$createTextNode(`oh-my-hook`));
    _$insert(_el$14, headerBadgeText);
    _$insert(_el$9, _$createComponent(Show, {
      get when() {
        return open();
      },
      get children() {
        var _el$15 = _$createElement("box"),
          _el$16 = _$createElement("box"),
          _el$17 = _$createElement("text"),
          _el$19 = _$createElement("text"),
          _el$20 = _$createTextNode(`Mode: `),
          _el$28 = _$createElement("box"),
          _el$29 = _$createElement("text"),
          _el$31 = _$createElement("text"),
          _el$32 = _$createTextNode(`Shields: `),
          _el$36 = _$createElement("box"),
          _el$37 = _$createElement("text"),
          _el$39 = _$createElement("text"),
          _el$40 = _$createTextNode(`Memory: `);
        _$insertNode(_el$15, _el$16);
        _$insertNode(_el$15, _el$28);
        _$insertNode(_el$15, _el$36);
        _$setProp(_el$15, "flexDirection", "column");
        _$setProp(_el$15, "gap", 0);
        _$setProp(_el$15, "paddingLeft", 1);
        _$setProp(_el$15, "paddingTop", 0);
        _$insertNode(_el$16, _el$17);
        _$insertNode(_el$16, _el$19);
        _$setProp(_el$16, "flexDirection", "row");
        _$setProp(_el$16, "gap", 1);
        _$insertNode(_el$17, _$createTextNode(`•`));
        _$insertNode(_el$19, _el$20);
        _$insert(_el$19, _$createComponent(Show, {
          get when() {
            return metrics().modeEnabled;
          },
          get fallback() {
            return (() => {
              var _el$46 = _$createElement("span");
              _$insertNode(_el$46, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$46, "style", {
                fg: redColor()
              }, _$p));
              return _el$46;
            })();
          },
          get children() {
            var _el$22 = _$createElement("span");
            _$insert(_el$22, () => isPlan() ? "plan (read-only)" : "execute");
            _$effect(_$p => _$setProp(_el$22, "style", {
              fg: isPlan() ? yellowColor() : greenColor()
            }, _$p));
            return _el$22;
          }
        }), null);
        _$insert(_el$15, _$createComponent(Show, {
          get when() {
            return activePlan()?.file;
          },
          get children() {
            var _el$23 = _$createElement("box"),
              _el$24 = _$createElement("text"),
              _el$26 = _$createElement("text"),
              _el$27 = _$createElement("u");
            _$insertNode(_el$23, _el$24);
            _$insertNode(_el$23, _el$26);
            _$setProp(_el$23, "flexDirection", "row");
            _$setProp(_el$23, "gap", 1);
            _$setProp(_el$23, "paddingLeft", 2);
            _$setProp(_el$23, "onMouseDown", () => {
              if (props.api.ui?.dialog?.replace) {
                const sess = sessID() || "default";
                props.api.ui.dialog.replace(() => _$createComponent(PlanReviewModal, {
                  get api() {
                    return props.api;
                  },
                  sessionID: sess,
                  get directory() {
                    return props.directory;
                  }
                }));
                if (props.api.ui.dialog.setSize) {
                  props.api.ui.dialog.setSize("large");
                }
              }
            });
            _$insertNode(_el$24, _$createTextNode(`↳`));
            _$insertNode(_el$26, _el$27);
            _$setProp(_el$26, "wrapMode", "none");
            _$insert(_el$27, () => activePlan()?.name || "active plan");
            _$effect(_p$ => {
              var _v$ = accentColor(),
                _v$2 = textNormal();
              _v$ !== _p$.e && (_p$.e = _$setProp(_el$24, "fg", _v$, _p$.e));
              _v$2 !== _p$.t && (_p$.t = _$setProp(_el$26, "fg", _v$2, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$23;
          }
        }), _el$28);
        _$insertNode(_el$28, _el$29);
        _$insertNode(_el$28, _el$31);
        _$setProp(_el$28, "flexDirection", "row");
        _$setProp(_el$28, "gap", 1);
        _$insertNode(_el$29, _$createTextNode(`•`));
        _$insertNode(_el$31, _el$32);
        _$insert(_el$31, _$createComponent(Show, {
          get when() {
            return metrics().sandboxEnabled;
          },
          get fallback() {
            return (() => {
              var _el$48 = _$createElement("span");
              _$insertNode(_el$48, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$48, "style", {
                fg: redColor()
              }, _$p));
              return _el$48;
            })();
          },
          get children() {
            var _el$34 = _$createElement("span"),
              _el$35 = _$createTextNode(` active`);
            _$insertNode(_el$34, _el$35);
            _$insert(_el$34, () => metrics().guardsActive, _el$35);
            _$effect(_$p => _$setProp(_el$34, "style", {
              fg: greenColor()
            }, _$p));
            return _el$34;
          }
        }), null);
        _$insertNode(_el$36, _el$37);
        _$insertNode(_el$36, _el$39);
        _$setProp(_el$36, "flexDirection", "row");
        _$setProp(_el$36, "gap", 1);
        _$setProp(_el$36, "onMouseDown", () => {
          if (props.api.ui?.dialog?.replace && metrics().memoryEnabled) {
            props.api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
              get api() {
                return props.api;
              },
              get directory() {
                return props.directory;
              },
              scope: "all"
            }));
            if (props.api.ui.dialog.setSize) {
              props.api.ui.dialog.setSize("large");
            }
          }
        });
        _$insertNode(_el$37, _$createTextNode(`•`));
        _$insertNode(_el$39, _el$40);
        _$insert(_el$39, _$createComponent(Show, {
          get when() {
            return metrics().memoryEnabled;
          },
          get fallback() {
            return (() => {
              var _el$50 = _$createElement("span");
              _$insertNode(_el$50, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$50, "style", {
                fg: redColor()
              }, _$p));
              return _el$50;
            })();
          },
          get children() {
            var _el$42 = _$createElement("span"),
              _el$43 = _$createTextNode(` global · `),
              _el$45 = _$createTextNode(` project`);
            _$insertNode(_el$42, _el$43);
            _$insertNode(_el$42, _el$45);
            _$insert(_el$42, () => metrics().memoryStats.global, _el$43);
            _$insert(_el$42, () => metrics().memoryStats.project, _el$45);
            _$effect(_$p => _$setProp(_el$42, "style", {
              fg: textNormal()
            }, _$p));
            return _el$42;
          }
        }), null);
        _$effect(_p$ => {
          var _v$3 = mutedColor(),
            _v$4 = mutedColor(),
            _v$5 = mutedColor(),
            _v$6 = mutedColor(),
            _v$7 = mutedColor(),
            _v$8 = mutedColor();
          _v$3 !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$3, _p$.e));
          _v$4 !== _p$.t && (_p$.t = _$setProp(_el$19, "fg", _v$4, _p$.t));
          _v$5 !== _p$.a && (_p$.a = _$setProp(_el$29, "fg", _v$5, _p$.a));
          _v$6 !== _p$.o && (_p$.o = _$setProp(_el$31, "fg", _v$6, _p$.o));
          _v$7 !== _p$.i && (_p$.i = _$setProp(_el$37, "fg", _v$7, _p$.i));
          _v$8 !== _p$.n && (_p$.n = _$setProp(_el$39, "fg", _v$8, _p$.n));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined,
          n: undefined
        });
        return _el$15;
      }
    }), null);
    _$effect(_p$ => {
      var _v$9 = mutedColor(),
        _v$0 = textNormal(),
        _v$1 = headerBadgeColor();
      _v$9 !== _p$.e && (_p$.e = _$setProp(_el$10, "fg", _v$9, _p$.e));
      _v$0 !== _p$.t && (_p$.t = _$setProp(_el$11, "fg", _v$0, _p$.t));
      _v$1 !== _p$.a && (_p$.a = _$setProp(_el$14, "fg", _v$1, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$9;
  })();
}
const MEMORY_CATEGORY_LABELS = {
  user: "USER PROFILE",
  global: "GLOBAL MEMORY",
  project: "PROJECT MEMORY"
};

/**
 * Native OpenCode DialogSelect & DialogPrompt based Memory Inspector.
 * Supports 3 scoped views:
 *   - "all": Inspect All Memory (Edit/Replace on Enter)
 *   - "global": Inspect Global Memory (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 *   - "project": Inspect Project Rules (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 */
function MemoryModal(props) {
  const currentScope = () => props.scope || "all";
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [toDelete, setToDelete] = createSignal(null);
  const [currentSelected, setCurrentSelected] = createSignal(null);
  const entries = createMemo(() => {
    refreshKey(); // reactive dependency
    const all = listMemoryEntries(props.directory);
    if (currentScope() === "user") return all.filter(e => (e.target || e.scope) === "user");
    if (currentScope() === "global") return all.filter(e => (e.target || e.scope) === "global");
    if (currentScope() === "project") return all.filter(e => (e.target || e.scope) === "project");
    return all;
  });
  const projectName = () => props.directory.split("/").pop() || "project";
  const modalTitle = () => {
    if (currentScope() === "user") return "User Profile";
    if (currentScope() === "global") return "Global Memory";
    if (currentScope() === "project") return "Project Memory";
    return "Memory Inspector";
  };
  const showEdit = item => {
    if (!props.api.ui?.DialogPrompt) return;
    props.api.ui.dialog.replace(() => _$createComponent(props.api.ui.DialogPrompt, {
      get title() {
        return `Edit Memory (${item.scope})`;
      },
      get value() {
        return item.content;
      },
      onConfirm: newText => {
        const trimmed = (newText || "").trim();
        if (trimmed && trimmed !== item.content) {
          replaceMemory(item.file, item.content, trimmed);
          setRefreshKey(k => k + 1);
          if (props.api.ui?.toast) {
            props.api.ui.toast({
              variant: "success",
              message: "Memory updated"
            });
          }
        }
        props.api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
          get api() {
            return props.api;
          },
          get directory() {
            return props.directory;
          },
          get scope() {
            return props.scope;
          }
        }));
      },
      onCancel: () => {
        props.api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
          get api() {
            return props.api;
          },
          get directory() {
            return props.directory;
          },
          get scope() {
            return props.scope;
          }
        }));
      }
    }));
  };
  const showAdd = (targetScope = "project") => {
    if (!props.api.ui?.DialogPrompt) return;
    props.api.ui.dialog.replace(() => _$createComponent(props.api.ui.DialogPrompt, {
      title: `Tambah Memory (${targetScope === "global" ? "Global" : "Project"})`,
      placeholder: "Ketik catatan memory baru...",
      description: () => (() => {
        var _el$52 = _$createElement("text");
        _$insert(_el$52, targetScope === "global" ? "Disimpan ke global memory" : "Disimpan ke project memory");
        _$effect(_$p => _$setProp(_el$52, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$52;
      })(),
      onConfirm: text => {
        const trimmed = (text || "").trim();
        if (trimmed) {
          const targetFile = targetScope === "global" ? getGlobalFile() : resolveTargetMemoryFile(props.directory);
          appendMemory(targetFile, trimmed);
          setRefreshKey(k => k + 1);
          if (props.api.ui?.toast) {
            props.api.ui.toast({
              variant: "success",
              message: `Memory added (${targetScope})`
            });
          }
        }
        props.api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
          get api() {
            return props.api;
          },
          get directory() {
            return props.directory;
          },
          get scope() {
            return props.scope;
          }
        }));
      },
      onCancel: () => {
        props.api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
          get api() {
            return props.api;
          },
          get directory() {
            return props.directory;
          },
          get scope() {
            return props.scope;
          }
        }));
      }
    }));
  };
  const handleDelete = item => {
    if (!item?.file || !item?.content) return;

    // Double-trigger delete confirmation pattern (ala OpenCode session delete)
    if (toDelete() === item.content) {
      removeMemory(item.file, item.content);
      setToDelete(null);
      setRefreshKey(k => k + 1);
      if (props.api.ui?.toast) {
        props.api.ui.toast({
          variant: "success",
          message: "Memory deleted"
        });
      }
    } else {
      setToDelete(item.content);
    }
  };

  // Register modal-specific keybindings (Ctrl+A for add, Ctrl+D for delete)
  onMount(() => {
    if (props.api.keymap?.registerLayer) {
      const unregister = props.api.keymap.registerLayer({
        commands: [{
          name: "omh.memory.modal.new",
          title: "Tambah memory (Ctrl+A)",
          run() {
            const sc = currentScope();
            showAdd(sc === "global" ? "global" : "project");
          }
        }, {
          name: "omh.memory.modal.delete",
          title: "Hapus memory (Ctrl+D)",
          run() {
            const item = currentSelected() || entries()[0];
            if (item) {
              handleDelete(item);
            }
          }
        }],
        bindings: [{
          key: "ctrl+a",
          cmd: "omh.memory.modal.new"
        }, {
          key: "ctrl+d",
          cmd: "omh.memory.modal.delete"
        }]
      });
      onCleanup(unregister);
    }
  });
  const options = createMemo(() => {
    const theme = props.api.theme?.current || {};
    return entries().map(e => {
      const isDeleting = toDelete() === e.content;
      return {
        title: isDeleting ? "Yakin mau hapus? Tekan Ctrl+D lagi untuk konfirmasi" : e.content,
        value: e,
        bg: isDeleting ? theme.error || "#ef4444" : undefined,
        category: currentScope() === "all" ? MEMORY_CATEGORY_LABELS[e.target || e.scope] || "PROJECT MEMORY" : undefined,
        footer: isDeleting ? "Tekan Ctrl+D lagi" : undefined
      };
    });
  });
  if (props.api.ui?.DialogSelect) {
    return (() => {
      var _el$53 = _$createElement("box"),
        _el$54 = _$createElement("box"),
        _el$55 = _$createElement("box"),
        _el$56 = _$createElement("text"),
        _el$57 = _$createElement("span"),
        _el$59 = _$createTextNode(` `),
        _el$60 = _$createElement("span"),
        _el$74 = _$createElement("text"),
        _el$75 = _$createTextNode(` note`);
      _$insertNode(_el$53, _el$54);
      _$setProp(_el$53, "flexDirection", "column");
      _$setProp(_el$53, "width", "100%");
      _$setProp(_el$53, "flexGrow", 1);
      _$setProp(_el$53, "justifyContent", "space-between");
      _$insert(_el$53, _$createComponent(props.api.ui.DialogSelect, {
        get title() {
          return modalTitle();
        },
        get placeholder() {
          return _$memo(() => currentScope() === "global")() ? "Cari global memory..." : currentScope() === "project" ? "Cari aturan project..." : "Cari memory...";
        },
        get options() {
          return options();
        },
        onMove: opt => {
          setToDelete(null); // Reset delete confirmation on cursor movement
          setCurrentSelected(opt?.value || opt);
        },
        onSelect: opt => {
          const item = opt?.value || opt;
          if (item) {
            showEdit(item);
          }
        }
      }), _el$54);
      _$insertNode(_el$54, _el$55);
      _$insertNode(_el$54, _el$74);
      _$setProp(_el$54, "flexDirection", "row");
      _$setProp(_el$54, "justifyContent", "space-between");
      _$setProp(_el$54, "width", "100%");
      _$setProp(_el$54, "paddingLeft", 4);
      _$setProp(_el$54, "paddingRight", 2);
      _$setProp(_el$54, "paddingBottom", 1);
      _$setProp(_el$54, "paddingTop", 0);
      _$setProp(_el$54, "flexShrink", 0);
      _$insertNode(_el$55, _el$56);
      _$setProp(_el$55, "flexDirection", "row");
      _$setProp(_el$55, "gap", 3);
      _$insertNode(_el$56, _el$57);
      _$insertNode(_el$56, _el$59);
      _$insertNode(_el$56, _el$60);
      _$insertNode(_el$57, _$createTextNode(`edit`));
      _$insertNode(_el$60, _$createTextNode(`enter`));
      _$insert(_el$55, _$createComponent(Show, {
        get when() {
          return currentScope() !== "all";
        },
        get children() {
          return [(() => {
            var _el$62 = _$createElement("text"),
              _el$63 = _$createElement("span"),
              _el$65 = _$createTextNode(` `),
              _el$66 = _$createElement("span");
            _$insertNode(_el$62, _el$63);
            _$insertNode(_el$62, _el$65);
            _$insertNode(_el$62, _el$66);
            _$insertNode(_el$63, _$createTextNode(`new`));
            _$insertNode(_el$66, _$createTextNode(`ctrl+a`));
            _$effect(_p$ => {
              var _v$10 = {
                  fg: props.api.theme?.current?.text
                },
                _v$11 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$10 !== _p$.e && (_p$.e = _$setProp(_el$63, "style", _v$10, _p$.e));
              _v$11 !== _p$.t && (_p$.t = _$setProp(_el$66, "style", _v$11, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$62;
          })(), (() => {
            var _el$68 = _$createElement("text"),
              _el$69 = _$createElement("span"),
              _el$71 = _$createTextNode(` `),
              _el$72 = _$createElement("span");
            _$insertNode(_el$68, _el$69);
            _$insertNode(_el$68, _el$71);
            _$insertNode(_el$68, _el$72);
            _$insertNode(_el$69, _$createTextNode(`delete`));
            _$insertNode(_el$72, _$createTextNode(`ctrl+d`));
            _$effect(_p$ => {
              var _v$12 = {
                  fg: props.api.theme?.current?.text
                },
                _v$13 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$12 !== _p$.e && (_p$.e = _$setProp(_el$69, "style", _v$12, _p$.e));
              _v$13 !== _p$.t && (_p$.t = _$setProp(_el$72, "style", _v$13, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$68;
          })()];
        }
      }), null);
      _$insertNode(_el$74, _el$75);
      _$insert(_el$74, () => entries().length, _el$75);
      _$insert(_el$74, () => entries().length === 1 ? "" : "s", null);
      _$effect(_p$ => {
        var _v$14 = {
            fg: props.api.theme?.current?.text
          },
          _v$15 = {
            fg: props.api.theme?.current?.textMuted
          },
          _v$16 = props.api.theme?.current?.textMuted;
        _v$14 !== _p$.e && (_p$.e = _$setProp(_el$57, "style", _v$14, _p$.e));
        _v$15 !== _p$.t && (_p$.t = _$setProp(_el$60, "style", _v$15, _p$.t));
        _v$16 !== _p$.a && (_p$.a = _$setProp(_el$74, "fg", _v$16, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
      return _el$53;
    })();
  }

  // Fallback simple view
  return (() => {
    var _el$76 = _$createElement("box"),
      _el$77 = _$createElement("text"),
      _el$78 = _$createElement("b");
    _$insertNode(_el$76, _el$77);
    _$setProp(_el$76, "gap", 1);
    _$setProp(_el$76, "paddingLeft", 2);
    _$setProp(_el$76, "paddingRight", 2);
    _$insertNode(_el$77, _el$78);
    _$insert(_el$78, modalTitle);
    _$insert(_el$76, _$createComponent(For, {
      get each() {
        return entries();
      },
      children: e => (() => {
        var _el$79 = _$createElement("text"),
          _el$80 = _$createTextNode(`• `),
          _el$81 = _$createTextNode(` (`),
          _el$82 = _$createTextNode(`)`);
        _$insertNode(_el$79, _el$80);
        _$insertNode(_el$79, _el$81);
        _$insertNode(_el$79, _el$82);
        _$insert(_el$79, () => e.content, _el$81);
        _$insert(_el$79, () => e.scope, _el$82);
        _$effect(_$p => _$setProp(_el$79, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$79;
      })()
    }), null);
    _$effect(_$p => _$setProp(_el$77, "fg", props.api.theme?.current?.text, _$p));
    return _el$76;
  })();
}
/**
 * Interactive Plan Review Modal Component for OpenCode TUI.
 */
function PlanReviewModal(props) {
  const theme = () => props.api?.theme?.current || {};
  const planData = () => getPlanReviewData(props.sessionID, props.directory);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [commentMode, setCommentMode] = createSignal(false);
  const [commentDraft, setCommentDraft] = createSignal("");
  const [comments, setComments] = createSignal({});
  const lines = () => planData().lines;
  const selectedLine = () => selectedIndex() >= 0 && selectedIndex() < lines().length ? lines()[selectedIndex()] : null;
  const handleKeyDown = e => {
    const key = e.name || e.key;
    if (commentMode()) {
      if (key === "escape") {
        setCommentMode(false);
        setCommentDraft("");
        e.preventDefault?.();
        return;
      }
      if (key === "return" && (e.ctrl || e.meta)) {
        const idx = selectedIndex();
        const draft = commentDraft().trim();
        if (idx >= 0 && draft) {
          const line = lines()[idx];
          setComments(prev => ({
            ...prev,
            [idx]: {
              text: draft,
              raw: line?.raw || ""
            }
          }));
        }
        setCommentMode(false);
        setCommentDraft("");
        e.preventDefault?.();
        return;
      }
      return;
    }
    if (key === "escape") {
      if (props.api.ui?.dialog?.clear) {
        props.api.ui.dialog.clear();
      }
      e.preventDefault?.();
      return;
    }
    if (key === "down" || key === "j") {
      setSelectedIndex(prev => Math.min(lines().length - 1, prev + 1));
      e.preventDefault?.();
      return;
    }
    if (key === "up" || key === "k") {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      e.preventDefault?.();
      return;
    }
    if (key === "return") {
      if (selectedIndex() >= 0) {
        setCommentMode(true);
        const existing = comments()[selectedIndex()];
        setCommentDraft(existing ? existing.text : "");
        e.preventDefault?.();
      }
      return;
    }
    if (key === "a" && (e.ctrl || e.meta)) {
      const feedback = formatReviewFeedback(planData().planName, comments(), true);
      if (props.api.session?.prompt) {
        props.api.session.prompt({
          sessionID: props.sessionID,
          text: feedback
        });
      }
      if (props.api.ui?.dialog?.clear) {
        props.api.ui.dialog.clear();
      }
      if (props.api.ui?.toast) {
        props.api.ui.toast({
          variant: "success",
          message: "Plan approved with comments"
        });
      }
      e.preventDefault?.();
      return;
    }
  };
  onMount(() => {
    if (props.api.terminal?.onKeyDown) {
      const unbind = props.api.terminal.onKeyDown(handleKeyDown);
      onCleanup(unbind);
    }
  });
  const getLineTypeColor = type => {
    switch (type) {
      case "heading":
        return theme().accent || "#8b5cf6";
      case "list":
        return theme().warning || "#f59e0b";
      case "code":
        return theme().textMuted || "#6b7280";
      default:
        return theme().text || "#f3f4f6";
    }
  };
  const commentCount = () => Object.keys(comments()).length;
  return (() => {
    var _el$83 = _$createElement("box"),
      _el$84 = _$createElement("box"),
      _el$85 = _$createElement("text"),
      _el$86 = _$createElement("b"),
      _el$88 = _$createElement("text"),
      _el$89 = _$createTextNode(` · `),
      _el$90 = _$createTextNode(` lines · `),
      _el$91 = _$createTextNode(` comment`),
      _el$93 = _$createElement("scrollbox"),
      _el$94 = _$createElement("box"),
      _el$104 = _$createElement("box"),
      _el$105 = _$createElement("text");
    _$insertNode(_el$83, _el$84);
    _$insertNode(_el$83, _el$93);
    _$insertNode(_el$83, _el$104);
    _$setProp(_el$83, "gap", 1);
    _$setProp(_el$83, "width", "100%");
    _$setProp(_el$83, "flexGrow", 1);
    _$setProp(_el$83, "paddingLeft", 2);
    _$setProp(_el$83, "paddingRight", 2);
    _$setProp(_el$83, "paddingBottom", 1);
    _$insertNode(_el$84, _el$85);
    _$insertNode(_el$84, _el$88);
    _$setProp(_el$84, "flexDirection", "row");
    _$setProp(_el$84, "justifyContent", "space-between");
    _$setProp(_el$84, "width", "100%");
    _$insertNode(_el$85, _el$86);
    _$insertNode(_el$86, _$createTextNode(`Interactive Plan Reviewer`));
    _$insertNode(_el$88, _el$89);
    _$insertNode(_el$88, _el$90);
    _$insertNode(_el$88, _el$91);
    _$insert(_el$88, () => planData().planName, _el$89);
    _$insert(_el$88, () => lines().length, _el$90);
    _$insert(_el$88, commentCount, _el$91);
    _$insert(_el$88, () => commentCount() === 1 ? "" : "s", null);
    _$insertNode(_el$93, _el$94);
    _$setProp(_el$93, "width", "100%");
    _$setProp(_el$93, "flexGrow", 1);
    _$setProp(_el$93, "minHeight", 12);
    _$setProp(_el$93, "maxHeight", 28);
    _$setProp(_el$94, "flexDirection", "column");
    _$setProp(_el$94, "gap", 0);
    _$setProp(_el$94, "width", "100%");
    _$setProp(_el$94, "minWidth", 0);
    _$insert(_el$94, _$createComponent(Show, {
      get when() {
        return lines().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$106 = _$createElement("text");
          _$insertNode(_el$106, _$createTextNode(`(Dokumen rencana kosong atau belum dimuat)`));
          _$effect(_$p => _$setProp(_el$106, "fg", theme().textMuted, _$p));
          return _el$106;
        })();
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return lines();
          },
          children: (line, idx) => {
            const isSelected = () => selectedIndex() === idx();
            const hasComment = () => Boolean(comments()[idx()]);
            return (() => {
              var _el$108 = _$createElement("box"),
                _el$109 = _$createElement("box"),
                _el$110 = _$createElement("text"),
                _el$111 = _$createTextNode(` |`),
                _el$112 = _$createElement("text");
              _$insertNode(_el$108, _el$109);
              _$setProp(_el$108, "flexDirection", "column");
              _$setProp(_el$108, "gap", 0);
              _$setProp(_el$108, "paddingLeft", 1);
              _$setProp(_el$108, "paddingRight", 1);
              _$insertNode(_el$109, _el$110);
              _$insertNode(_el$109, _el$112);
              _$setProp(_el$109, "flexDirection", "row");
              _$setProp(_el$109, "gap", 1);
              _$insertNode(_el$110, _el$111);
              _$insert(_el$110, () => String(line.index).padStart(3, " "), _el$111);
              _$setProp(_el$112, "wrapMode", "word");
              _$setProp(_el$112, "flexGrow", 1);
              _$insert(_el$112, () => line.raw);
              _$insert(_el$109, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$113 = _$createElement("text");
                  _$insertNode(_el$113, _$createTextNode(`[comment]`));
                  _$effect(_$p => _$setProp(_el$113, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$113;
                }
              }), null);
              _$insert(_el$108, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$115 = _$createElement("box"),
                    _el$116 = _$createElement("text"),
                    _el$117 = _$createElement("i"),
                    _el$118 = _$createTextNode(`↳ `);
                  _$insertNode(_el$115, _el$116);
                  _$setProp(_el$115, "paddingLeft", 6);
                  _$setProp(_el$115, "paddingTop", 0);
                  _$setProp(_el$115, "paddingBottom", 0);
                  _$insertNode(_el$116, _el$117);
                  _$setProp(_el$116, "wrapMode", "word");
                  _$insertNode(_el$117, _el$118);
                  _$insert(_el$117, () => comments()[idx()]?.text, null);
                  _$effect(_$p => _$setProp(_el$116, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$115;
                }
              }), null);
              _$effect(_p$ => {
                var _v$24 = isSelected() ? theme().bgSelected || "#1e293b" : undefined,
                  _v$25 = isSelected() ? "single" : undefined,
                  _v$26 = isSelected() ? theme().accent || "#8b5cf6" : undefined,
                  _v$27 = isSelected() ? theme().text : theme().textMuted,
                  _v$28 = getLineTypeColor(line.type);
                _v$24 !== _p$.e && (_p$.e = _$setProp(_el$108, "backgroundColor", _v$24, _p$.e));
                _v$25 !== _p$.t && (_p$.t = _$setProp(_el$108, "borderStyle", _v$25, _p$.t));
                _v$26 !== _p$.a && (_p$.a = _$setProp(_el$108, "borderColor", _v$26, _p$.a));
                _v$27 !== _p$.o && (_p$.o = _$setProp(_el$110, "fg", _v$27, _p$.o));
                _v$28 !== _p$.i && (_p$.i = _$setProp(_el$112, "fg", _v$28, _p$.i));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined,
                i: undefined
              });
              return _el$108;
            })();
          }
        });
      }
    }));
    _$insert(_el$83, _$createComponent(Show, {
      get when() {
        return commentMode();
      },
      get children() {
        var _el$95 = _$createElement("box"),
          _el$96 = _$createElement("text"),
          _el$97 = _$createElement("b"),
          _el$98 = _$createTextNode(`Tulis Komentar untuk Baris #`),
          _el$99 = _$createTextNode(`:`),
          _el$100 = _$createElement("text"),
          _el$101 = _$createTextNode(`"`),
          _el$102 = _$createTextNode(`"`),
          _el$103 = _$createElement("text");
        _$insertNode(_el$95, _el$96);
        _$insertNode(_el$95, _el$100);
        _$insertNode(_el$95, _el$103);
        _$setProp(_el$95, "flexDirection", "column");
        _$setProp(_el$95, "gap", 0);
        _$setProp(_el$95, "borderStyle", "single");
        _$setProp(_el$95, "paddingLeft", 1);
        _$setProp(_el$95, "paddingRight", 1);
        _$insertNode(_el$96, _el$97);
        _$insertNode(_el$97, _el$98);
        _$insertNode(_el$97, _el$99);
        _$insert(_el$97, () => selectedLine()?.index, _el$99);
        _$insertNode(_el$100, _el$101);
        _$insertNode(_el$100, _el$102);
        _$insert(_el$100, () => selectedLine()?.raw, _el$102);
        _$insert(_el$103, () => commentDraft() || "(ketik komentar...)");
        _$effect(_p$ => {
          var _v$17 = theme().warning || "#f59e0b",
            _v$18 = theme().warning || "#f59e0b",
            _v$19 = theme().textMuted,
            _v$20 = theme().text;
          _v$17 !== _p$.e && (_p$.e = _$setProp(_el$95, "borderColor", _v$17, _p$.e));
          _v$18 !== _p$.t && (_p$.t = _$setProp(_el$96, "fg", _v$18, _p$.t));
          _v$19 !== _p$.a && (_p$.a = _$setProp(_el$100, "fg", _v$19, _p$.a));
          _v$20 !== _p$.o && (_p$.o = _$setProp(_el$103, "fg", _v$20, _p$.o));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined
        });
        return _el$95;
      }
    }), _el$104);
    _$insertNode(_el$104, _el$105);
    _$setProp(_el$104, "flexDirection", "row");
    _$setProp(_el$104, "justifyContent", "space-between");
    _$setProp(_el$104, "width", "100%");
    _$insert(_el$105, _$createComponent(Show, {
      get when() {
        return commentMode();
      },
      fallback: "↓/↑ pilih baris · enter komentar · ctrl+a approve · esc tutup",
      children: "ctrl+enter simpan \xB7 esc batal"
    }));
    _$effect(_p$ => {
      var _v$21 = theme().text,
        _v$22 = theme().textMuted,
        _v$23 = theme().textMuted;
      _v$21 !== _p$.e && (_p$.e = _$setProp(_el$85, "fg", _v$21, _p$.e));
      _v$22 !== _p$.t && (_p$.t = _$setProp(_el$88, "fg", _v$22, _p$.t));
      _v$23 !== _p$.a && (_p$.a = _$setProp(_el$105, "fg", _v$23, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$83;
  })();
}

/**
 * TokensTree — collapsible accordion tree for session & subagent token usage.
 *
 * Data comes from usage/tokens/tracker.js (read-only opencode.db). Each node
 * (main agent + subagents) can be expanded/collapsed independently via click.
 * Subagent visibility & default state are configurable:
 *   usage.tokens.showSubagents (false hides subagent section)
 *   usage.tokens.subagentsCollapsed (true collapses subagent nodes by default)
 */
function TokensTree(props) {
  const [open, setOpen] = createSignal(true);
  const subConfig = props.config?.tokens || {};
  const showSubs = subConfig.showSubagents !== false;
  const [subOpen, setSubOpen] = createSignal(subConfig.subagentsCollapsed ? false : true);
  const [tree, setTree] = createSignal(null);

  // Refresh tree when session changes or mode state flips (activity proxy).
  createEffect(() => {
    const sid = props.sessionID();
    if (!sid) {
      setTree(null);
      return;
    }
    let cancelled = false;
    openReadonly(opencodeDbPath()).then(handle => {
      if (cancelled) {
        handle.close();
        return;
      }
      try {
        setTree(getAgentTree(handle.db, sid));
      } finally {
        handle.close();
      }
    })
    // Async rejection must be caught — otherwise TUI crashes on
    // unhandled promise rejection when the DB is missing.
    .catch(() => setTree(null));
    return () => {
      cancelled = true;
    };
  });
  const theme = () => props.api?.theme?.current || {};
  const mutedColor = () => theme().textMuted || "#6b7280";
  const textNormal = () => theme().text || "#f3f4f6";
  const accentColor = () => theme().accent || "#8b5cf6";
  const successColor = () => theme().success || "#10b981";
  const totalTokens = () => {
    const t = tree();
    if (!t) return 0;
    const subs = t.subagents.reduce((s, x) => s + (x.input || 0) + (x.output || 0), 0);
    return (t.main?.input || 0) + (t.main?.output || 0) + subs;
  };
  const modelName = m => {
    if (!m?.model) return "n/a";
    return m.model.split("/").pop();
  };

  // Per-node expand state (each subagent toggles independently).
  const TreeNode = node => {
    const [nodeOpen, setNodeOpen] = createSignal(true);
    return [(() => {
      var _el$119 = _$createElement("box"),
        _el$120 = _$createElement("text"),
        _el$121 = _$createElement("text"),
        _el$122 = _$createElement("b"),
        _el$123 = _$createElement("text");
      _$insertNode(_el$119, _el$120);
      _$insertNode(_el$119, _el$121);
      _$insertNode(_el$119, _el$123);
      _$setProp(_el$119, "flexDirection", "row");
      _$setProp(_el$119, "gap", 1);
      _$setProp(_el$119, "onMouseDown", () => setNodeOpen(x => !x));
      _$insert(_el$120, () => nodeOpen() ? "▼" : "▶");
      _$insertNode(_el$121, _el$122);
      _$insert(_el$122, () => node.agent || "agent");
      _$insert(_el$123, () => modelName(node));
      _$effect(_p$ => {
        var _v$29 = mutedColor(),
          _v$30 = accentColor(),
          _v$31 = mutedColor();
        _v$29 !== _p$.e && (_p$.e = _$setProp(_el$120, "fg", _v$29, _p$.e));
        _v$30 !== _p$.t && (_p$.t = _$setProp(_el$121, "fg", _v$30, _p$.t));
        _v$31 !== _p$.a && (_p$.a = _$setProp(_el$123, "fg", _v$31, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
      return _el$119;
    })(), _$createComponent(Show, {
      get when() {
        return nodeOpen();
      },
      get children() {
        var _el$124 = _$createElement("box"),
          _el$125 = _$createElement("text"),
          _el$126 = _$createTextNode(`In : `),
          _el$128 = _$createElement("span"),
          _el$129 = _$createElement("text"),
          _el$130 = _$createTextNode(`Out : `),
          _el$132 = _$createElement("span"),
          _el$141 = _$createElement("text"),
          _el$142 = _$createTextNode(`Cost : `),
          _el$144 = _$createElement("span");
        _$insertNode(_el$124, _el$125);
        _$insertNode(_el$124, _el$129);
        _$insertNode(_el$124, _el$141);
        _$setProp(_el$124, "flexDirection", "column");
        _$setProp(_el$124, "gap", 0);
        _$setProp(_el$124, "paddingLeft", 2);
        _$insertNode(_el$125, _el$126);
        _$insertNode(_el$125, _el$128);
        _$insert(_el$128, () => formatTokens(node.input));
        _$insertNode(_el$129, _el$130);
        _$insertNode(_el$129, _el$132);
        _$insert(_el$132, () => formatTokens(node.output));
        _$insert(_el$124, _$createComponent(Show, {
          get when() {
            return node.reasoning > 0;
          },
          get children() {
            var _el$133 = _$createElement("text"),
              _el$134 = _$createTextNode(`Reasoning: `),
              _el$136 = _$createElement("span");
            _$insertNode(_el$133, _el$134);
            _$insertNode(_el$133, _el$136);
            _$insert(_el$136, () => formatTokens(node.reasoning));
            _$effect(_p$ => {
              var _v$32 = mutedColor(),
                _v$33 = {
                  fg: textNormal()
                };
              _v$32 !== _p$.e && (_p$.e = _$setProp(_el$133, "fg", _v$32, _p$.e));
              _v$33 !== _p$.t && (_p$.t = _$setProp(_el$136, "style", _v$33, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$133;
          }
        }), _el$141);
        _$insert(_el$124, _$createComponent(Show, {
          get when() {
            return node.cacheRead > 0 || node.cacheWrite > 0;
          },
          get children() {
            var _el$137 = _$createElement("text"),
              _el$138 = _$createTextNode(`Cache R: `),
              _el$140 = _$createElement("span");
            _$insertNode(_el$137, _el$138);
            _$insertNode(_el$137, _el$140);
            _$insert(_el$140, () => formatTokens(node.cacheRead));
            _$effect(_p$ => {
              var _v$34 = mutedColor(),
                _v$35 = {
                  fg: textNormal()
                };
              _v$34 !== _p$.e && (_p$.e = _$setProp(_el$137, "fg", _v$34, _p$.e));
              _v$35 !== _p$.t && (_p$.t = _$setProp(_el$140, "style", _v$35, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$137;
          }
        }), _el$141);
        _$insertNode(_el$141, _el$142);
        _$insertNode(_el$141, _el$144);
        _$insert(_el$144, () => formatUSD(node.cost));
        _$effect(_p$ => {
          var _v$36 = mutedColor(),
            _v$37 = {
              fg: textNormal()
            },
            _v$38 = mutedColor(),
            _v$39 = {
              fg: textNormal()
            },
            _v$40 = mutedColor(),
            _v$41 = {
              fg: successColor()
            };
          _v$36 !== _p$.e && (_p$.e = _$setProp(_el$125, "fg", _v$36, _p$.e));
          _v$37 !== _p$.t && (_p$.t = _$setProp(_el$128, "style", _v$37, _p$.t));
          _v$38 !== _p$.a && (_p$.a = _$setProp(_el$129, "fg", _v$38, _p$.a));
          _v$39 !== _p$.o && (_p$.o = _$setProp(_el$132, "style", _v$39, _p$.o));
          _v$40 !== _p$.i && (_p$.i = _$setProp(_el$141, "fg", _v$40, _p$.i));
          _v$41 !== _p$.n && (_p$.n = _$setProp(_el$144, "style", _v$41, _p$.n));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined,
          n: undefined
        });
        return _el$124;
      }
    })];
  };
  return (() => {
    var _el$145 = _$createElement("box"),
      _el$146 = _$createElement("box"),
      _el$147 = _$createElement("text"),
      _el$148 = _$createElement("text"),
      _el$149 = _$createElement("b"),
      _el$151 = _$createElement("text");
    _$insertNode(_el$145, _el$146);
    _$setProp(_el$145, "flexDirection", "column");
    _$setProp(_el$145, "gap", 0);
    _$insertNode(_el$146, _el$147);
    _$insertNode(_el$146, _el$148);
    _$insertNode(_el$146, _el$151);
    _$setProp(_el$146, "flexDirection", "row");
    _$setProp(_el$146, "gap", 1);
    _$setProp(_el$146, "onMouseDown", () => setOpen(x => !x));
    _$insert(_el$147, () => open() ? "▼" : "▶");
    _$insertNode(_el$148, _el$149);
    _$insertNode(_el$149, _$createTextNode(`Tokens`));
    _$insert(_el$151, (() => {
      var _c$ = _$memo(() => totalTokens() > 0);
      return () => _c$() ? `(${formatTokens(totalTokens())})` : "";
    })());
    _$insert(_el$145, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!open())() && tree();
      },
      get children() {
        var _el$152 = _$createElement("box");
        _$setProp(_el$152, "flexDirection", "column");
        _$setProp(_el$152, "gap", 0);
        _$setProp(_el$152, "paddingLeft", 1);
        _$insert(_el$152, () => TreeNode(tree().main), null);
        _$insert(_el$152, _$createComponent(Show, {
          get when() {
            return showSubs && tree().subagents.length > 0;
          },
          get children() {
            return [(() => {
              var _el$153 = _$createElement("box"),
                _el$154 = _$createElement("text"),
                _el$155 = _$createElement("text"),
                _el$156 = _$createTextNode(`Subagents (`),
                _el$157 = _$createTextNode(`)`);
              _$insertNode(_el$153, _el$154);
              _$insertNode(_el$153, _el$155);
              _$setProp(_el$153, "flexDirection", "row");
              _$setProp(_el$153, "gap", 1);
              _$setProp(_el$153, "onMouseDown", () => setSubOpen(x => !x));
              _$insert(_el$154, () => subOpen() ? "▼" : "▶");
              _$insertNode(_el$155, _el$156);
              _$insertNode(_el$155, _el$157);
              _$insert(_el$155, () => tree().subagents.length, _el$157);
              _$effect(_p$ => {
                var _v$42 = mutedColor(),
                  _v$43 = textNormal();
                _v$42 !== _p$.e && (_p$.e = _$setProp(_el$154, "fg", _v$42, _p$.e));
                _v$43 !== _p$.t && (_p$.t = _$setProp(_el$155, "fg", _v$43, _p$.t));
                return _p$;
              }, {
                e: undefined,
                t: undefined
              });
              return _el$153;
            })(), _$createComponent(Show, {
              get when() {
                return subOpen();
              },
              get children() {
                var _el$158 = _$createElement("box");
                _$setProp(_el$158, "flexDirection", "column");
                _$setProp(_el$158, "gap", 0);
                _$setProp(_el$158, "paddingLeft", 2);
                _$insert(_el$158, _$createComponent(For, {
                  get each() {
                    return tree().subagents;
                  },
                  children: sub => (() => {
                    var _el$159 = _$createElement("box");
                    _$setProp(_el$159, "flexDirection", "column");
                    _$setProp(_el$159, "gap", 0);
                    _$setProp(_el$159, "paddingLeft", 1);
                    _$insert(_el$159, () => TreeNode(sub));
                    return _el$159;
                  })()
                }));
                return _el$158;
              }
            })];
          }
        }), null);
        _$insert(_el$152, _$createComponent(LastTurnItem, {
          get api() {
            return props.api;
          },
          get sessionID() {
            return props.sessionID;
          }
        }), null);
        return _el$152;
      }
    }), null);
    _$effect(_p$ => {
      var _v$44 = mutedColor(),
        _v$45 = textNormal(),
        _v$46 = mutedColor();
      _v$44 !== _p$.e && (_p$.e = _$setProp(_el$147, "fg", _v$44, _p$.e));
      _v$45 !== _p$.t && (_p$.t = _$setProp(_el$148, "fg", _v$45, _p$.t));
      _v$46 !== _p$.a && (_p$.a = _$setProp(_el$151, "fg", _v$46, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$145;
  })();
}

/**
 * LastTurnItem — collapsible "Last Turn" nodes inside the Tokens tree.
 *
 * Shows the last completed assistant turn for the main agent (from reactive
 * TUI state) plus, optionally, the last turn of each subagent (from the
 * opencode.db tree). Subagent nodes are collapsed by default and can be
 * hidden entirely via usage.tokens.showSubagents.
 */
function LastTurnItem(props) {
  // Default expanded — mobile users shouldn't need to tap to open it.
  const [open, setOpen] = createSignal(true);
  const theme = () => props.api?.theme?.current || {};
  const mutedColor = () => theme().textMuted || "#6b7280";
  const textNormal = () => theme().text || "#f3f4f6";
  const accentColor = () => theme().accent || "#8b5cf6";
  const [tick, setTick] = createSignal(0);
  const timer = setInterval(() => setTick(t => t + 1), 2000);
  onCleanup(() => clearInterval(timer));
  const lastTurn = createMemo(() => {
    tick();
    const sid = props.sessionID();
    if (!sid) return null;
    const state = props.api?.state?.session;
    if (!state) return null;
    let msgs = [];
    try {
      msgs = state.messages(sid) ?? [];
    } catch {
      return null;
    }

    // Last completed assistant turn with real token data.
    const last = [...msgs].reverse().find(m => m.role === "assistant" && m.tokens && (m.tokens.input || 0) > 0);
    if (!last) return null;
    const t = last.tokens || {};
    return {
      input: t.input || 0,
      output: t.output || 0,
      reasoning: t.reasoning || 0,
      cacheRead: t.cache?.read || 0,
      cost: last.cost || 0,
      durationMs: last.time?.completed && last.time?.created ? last.time.completed - last.time.created : null
    };
  });

  // NOTE: call lastTurn() INSIDE JSX (not hoisted const) so the memo stays
  // reactive to the 2s tick — a static snapshot would never update.
  const renderTurnDetails = t => (() => {
    var _el$160 = _$createElement("box"),
      _el$161 = _$createElement("text"),
      _el$162 = _$createTextNode(`In : `),
      _el$163 = _$createElement("span"),
      _el$164 = _$createElement("text"),
      _el$165 = _$createTextNode(`Out : `),
      _el$166 = _$createElement("span");
    _$insertNode(_el$160, _el$161);
    _$insertNode(_el$160, _el$164);
    _$setProp(_el$160, "flexDirection", "column");
    _$setProp(_el$160, "gap", 0);
    _$setProp(_el$160, "paddingLeft", 1);
    _$insertNode(_el$161, _el$162);
    _$insertNode(_el$161, _el$163);
    _$insert(_el$163, () => formatTokens(t.input));
    _$insert(_el$160, (() => {
      var _c$2 = _$memo(() => t.cacheRead > 0);
      return () => _c$2() ? (() => {
        var _el$167 = _$createElement("text"),
          _el$168 = _$createTextNode(`Cache : `),
          _el$170 = _$createElement("span");
        _$insertNode(_el$167, _el$168);
        _$insertNode(_el$167, _el$170);
        _$insert(_el$170, () => formatTokens(t.cacheRead));
        _$effect(_p$ => {
          var _v$51 = mutedColor(),
            _v$52 = {
              fg: textNormal()
            };
          _v$51 !== _p$.e && (_p$.e = _$setProp(_el$167, "fg", _v$51, _p$.e));
          _v$52 !== _p$.t && (_p$.t = _$setProp(_el$170, "style", _v$52, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$167;
      })() : null;
    })(), _el$164);
    _$insertNode(_el$164, _el$165);
    _$insertNode(_el$164, _el$166);
    _$insert(_el$166, () => formatTokens(t.output));
    _$insert(_el$160, (() => {
      var _c$3 = _$memo(() => t.reasoning > 0);
      return () => _c$3() ? (() => {
        var _el$171 = _$createElement("text"),
          _el$172 = _$createTextNode(`Reasoning : `),
          _el$174 = _$createElement("span");
        _$insertNode(_el$171, _el$172);
        _$insertNode(_el$171, _el$174);
        _$insert(_el$174, () => formatTokens(t.reasoning));
        _$effect(_p$ => {
          var _v$53 = mutedColor(),
            _v$54 = {
              fg: textNormal()
            };
          _v$53 !== _p$.e && (_p$.e = _$setProp(_el$171, "fg", _v$53, _p$.e));
          _v$54 !== _p$.t && (_p$.t = _$setProp(_el$174, "style", _v$54, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$171;
      })() : null;
    })(), null);
    _$insert(_el$160, (() => {
      var _c$4 = _$memo(() => !!t.durationMs);
      return () => _c$4() ? (() => {
        var _el$175 = _$createElement("text"),
          _el$176 = _$createTextNode(`Time : `),
          _el$178 = _$createElement("span");
        _$insertNode(_el$175, _el$176);
        _$insertNode(_el$175, _el$178);
        _$insert(_el$178, () => formatDuration(t.durationMs));
        _$effect(_p$ => {
          var _v$55 = mutedColor(),
            _v$56 = {
              fg: textNormal()
            };
          _v$55 !== _p$.e && (_p$.e = _$setProp(_el$175, "fg", _v$55, _p$.e));
          _v$56 !== _p$.t && (_p$.t = _$setProp(_el$178, "style", _v$56, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$175;
      })() : null;
    })(), null);
    _$insert(_el$160, (() => {
      var _c$5 = _$memo(() => t.cost > 0);
      return () => _c$5() ? (() => {
        var _el$179 = _$createElement("text"),
          _el$180 = _$createTextNode(`Cost : `),
          _el$181 = _$createElement("span");
        _$insertNode(_el$179, _el$180);
        _$insertNode(_el$179, _el$181);
        _$insert(_el$181, () => formatUSD(t.cost));
        _$effect(_p$ => {
          var _v$57 = mutedColor(),
            _v$58 = {
              fg: accentColor()
            };
          _v$57 !== _p$.e && (_p$.e = _$setProp(_el$179, "fg", _v$57, _p$.e));
          _v$58 !== _p$.t && (_p$.t = _$setProp(_el$181, "style", _v$58, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$179;
      })() : null;
    })(), null);
    _$effect(_p$ => {
      var _v$47 = mutedColor(),
        _v$48 = {
          fg: textNormal()
        },
        _v$49 = mutedColor(),
        _v$50 = {
          fg: textNormal()
        };
      _v$47 !== _p$.e && (_p$.e = _$setProp(_el$161, "fg", _v$47, _p$.e));
      _v$48 !== _p$.t && (_p$.t = _$setProp(_el$163, "style", _v$48, _p$.t));
      _v$49 !== _p$.a && (_p$.a = _$setProp(_el$164, "fg", _v$49, _p$.a));
      _v$50 !== _p$.o && (_p$.o = _$setProp(_el$166, "style", _v$50, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$160;
  })();
  return (() => {
    var _el$182 = _$createElement("box");
    _$setProp(_el$182, "flexDirection", "column");
    _$setProp(_el$182, "gap", 0);
    _$insert(_el$182, _$createComponent(Show, {
      get when() {
        return lastTurn();
      },
      children: turn => [(() => {
        var _el$183 = _$createElement("box"),
          _el$184 = _$createElement("text"),
          _el$185 = _$createElement("text"),
          _el$186 = _$createElement("b");
        _$insertNode(_el$183, _el$184);
        _$insertNode(_el$183, _el$185);
        _$setProp(_el$183, "flexDirection", "row");
        _$setProp(_el$183, "gap", 1);
        _$setProp(_el$183, "wrapMode", "none");
        _$setProp(_el$183, "onMouseDown", () => setOpen(x => !x));
        _$insert(_el$184, () => open() ? "▼" : "▶");
        _$insertNode(_el$185, _el$186);
        _$setProp(_el$185, "wrapMode", "none");
        _$insertNode(_el$186, _$createTextNode(`Last Turn (main)`));
        _$effect(_p$ => {
          var _v$59 = mutedColor(),
            _v$60 = textNormal();
          _v$59 !== _p$.e && (_p$.e = _$setProp(_el$184, "fg", _v$59, _p$.e));
          _v$60 !== _p$.t && (_p$.t = _$setProp(_el$185, "fg", _v$60, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$183;
      })(), _$createComponent(Show, {
        get when() {
          return open();
        },
        get children() {
          return renderTurnDetails(turn());
        }
      })]
    }));
    return _el$182;
  })();
}

/**
 * OpenCode TUI surface plugin entrypoint.
 */
export const tui = async function tui(api, options, meta) {
  const directory = options?.directory || process.cwd();
  const {
    config
  } = loadConfig();
  const [activeSessionID, setActiveSessionID] = createSignal(resolveActiveSessionID(api) || "");
  const unsubSession = createSessionSubscriber(api, nextSessionID => {
    if (nextSessionID) setActiveSessionID(nextSessionID);
  });

  // Pruning toast notifications: bridge server-side pruning events to TUI
  // Compact single-line format without title or emoji to fit mobile screens
  if (config?.compress?.pruning?.toast?.enabled !== false) {
    const unsubCompress = watchCompressStats(({
      tool,
      target,
      tokens
    }) => {
      if (!api.ui?.toast) return;
      const cleanTarget = (target || tool || "tool").trim().slice(0, 12);
      const tokStr = formatTokens(tokens);
      api.ui.toast({
        variant: "info",
        message: `pruned ${cleanTarget}: ~${tokStr} tok`,
        duration: 3000
      });
    }, {
      cooldownMs: config?.compress?.pruning?.toast?.cooldownMs ?? 30000
    });
    if (api.lifecycle?.onDispose) {
      api.lifecycle.onDispose(unsubCompress);
    }
  }

  // 1. Register TUI command palette layer based on enabled configs
  if (api.keymap?.registerLayer) {
    const commands = [];
    if (config?.memory?.enabled !== false) {
      // 1a. Inspect All Memory
      commands.push({
        namespace: "palette",
        name: "oh-my-hook.memory",
        title: "Memory: All",
        desc: "Semua memory aktif",
        category: "oh-my-hook",
        run(input) {
          if (api.ui?.dialog?.replace) {
            api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
              api: api,
              directory: directory,
              scope: "all"
            }));
          }
        }
      });

      // 1b. Inspect Global Memory (Add / Edit / Delete)
      commands.push({
        namespace: "palette",
        name: "oh-my-hook.memory.global",
        title: "Memory: Global",
        desc: "Global memory",
        category: "oh-my-hook",
        run(input) {
          if (api.ui?.dialog?.replace) {
            api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
              api: api,
              directory: directory,
              scope: "global"
            }));
          }
        }
      });

      // 1c. Inspect Project Rules (Add / Edit / Delete)
      commands.push({
        namespace: "palette",
        name: "oh-my-hook.memory.project",
        title: "Memory: Project",
        desc: "Project memory",
        category: "oh-my-hook",
        run(input) {
          if (api.ui?.dialog?.replace) {
            api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
              api: api,
              directory: directory,
              scope: "project"
            }));
          }
        }
      });
    }
    if (config?.plans?.enabled !== false) {
      commands.push({
        namespace: "palette",
        name: "oh-my-hook.plan.review",
        title: "Plan Reviewer",
        desc: "Buka modal interaktif review baris dokumen rencana",
        category: "oh-my-hook",
        slashName: "plan-review",
        run() {
          if (api.ui?.dialog?.replace) {
            const sess = currentSessionID || resolveActiveSessionID(api) || "default";
            api.ui.dialog.replace(() => _$createComponent(PlanReviewModal, {
              api: api,
              sessionID: sess,
              directory: directory
            }));
            if (api.ui.dialog.setSize) {
              api.ui.dialog.setSize("large");
            }
          }
        }
      });
    }
    if (commands.length > 0) {
      const unregisterLayer = api.keymap.registerLayer({
        commands,
        bindings: []
      });
      if (api.lifecycle?.onDispose) {
        api.lifecycle.onDispose(unregisterLayer);
      }
    }
  }

  // 2. Register UI slots (Sidebar, Prompt Badge, Sidebar Footer)
  if (api.slots?.register) {
    api.slots.register({
      id: "oh-my-hook-sidebar",
      order: 99,
      slots: {
        session_prompt_right(ctx, props) {
          return _$createComponent(ModeBadge, {
            api: api,
            sessionID: () => props?.session_id || ctx?.session_id || ""
          });
        },
        sidebar_content(ctx, props) {
          return (() => {
            var _el$188 = _$createElement("box");
            _$setProp(_el$188, "flexDirection", "column");
            _$setProp(_el$188, "gap", 1);
            _$insert(_el$188, _$createComponent(SidebarWidget, {
              api: api,
              directory: directory,
              sessionID: () => props?.session_id || ctx?.session_id || activeSessionID() || resolveActiveSessionID(api) || ""
            }), null);
            _$insert(_el$188, _$createComponent(Show, {
              get when() {
                return config?.usage?.enabled !== false;
              },
              get children() {
                return _$createComponent(TokensTree, {
                  api: api,
                  directory: directory,
                  get config() {
                    return config?.usage;
                  },
                  sessionID: () => props?.session_id || ctx?.session_id || activeSessionID() || resolveActiveSessionID(api) || ""
                });
              }
            }), null);
            return _el$188;
          })();
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
  id: "oh-my-hook",
  tui
};
