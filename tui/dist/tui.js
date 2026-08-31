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
import { getMetrics, getPlanReviewData } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";
import { loadConfig } from "../../share/config.js";
import { formatReviewFeedback } from "../../plans/parser.js";
import { loadModeState, currentMode, currentPlan } from "../../share/state.js";
import { appendMemory, replaceMemory, removeMemory, resolveTargetMemoryFile, getGlobalFile, listMemoryEntries } from "../../memory/store.js";
import { formatTokens, formatUSD } from "../../usage/format.js";
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
  const [metrics, setMetrics] = createSignal(getMetrics(props.directory));
  const unwatch = watchModeState(nextState => {
    setModeState(nextState);
    setMetrics(getMetrics(props.directory));
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
          _el$40 = _$createTextNode(`Memory: `),
          _el$46 = _$createElement("box"),
          _el$47 = _$createElement("text"),
          _el$49 = _$createElement("text"),
          _el$50 = _$createTextNode(`Pruned: `);
        _$insertNode(_el$15, _el$16);
        _$insertNode(_el$15, _el$28);
        _$insertNode(_el$15, _el$36);
        _$insertNode(_el$15, _el$46);
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
              var _el$54 = _$createElement("span");
              _$insertNode(_el$54, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$54, "style", {
                fg: redColor()
              }, _$p));
              return _el$54;
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
              var _el$56 = _$createElement("span");
              _$insertNode(_el$56, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$56, "style", {
                fg: redColor()
              }, _$p));
              return _el$56;
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
              var _el$58 = _$createElement("span");
              _$insertNode(_el$58, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$58, "style", {
                fg: redColor()
              }, _$p));
              return _el$58;
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
        _$insertNode(_el$46, _el$47);
        _$insertNode(_el$46, _el$49);
        _$setProp(_el$46, "flexDirection", "row");
        _$setProp(_el$46, "gap", 1);
        _$insertNode(_el$47, _$createTextNode(`•`));
        _$insertNode(_el$49, _el$50);
        _$insert(_el$49, _$createComponent(Show, {
          get when() {
            return metrics().compressEnabled;
          },
          get fallback() {
            return (() => {
              var _el$60 = _$createElement("span");
              _$insertNode(_el$60, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$60, "style", {
                fg: redColor()
              }, _$p));
              return _el$60;
            })();
          },
          get children() {
            var _el$52 = _$createElement("span"),
              _el$53 = _$createTextNode(` outputs`);
            _$insertNode(_el$52, _el$53);
            _$insert(_el$52, () => metrics().compress?.session?.prunedCount || 0, _el$53);
            _$insert(_el$52, (() => {
              var _c$ = _$memo(() => metrics().compress?.session?.tokensSaved > 0);
              return () => _c$() ? ` · ~${metrics().compress.session.tokensSaved.toLocaleString()} tokens` : "";
            })(), null);
            _$effect(_$p => _$setProp(_el$52, "style", {
              fg: textNormal()
            }, _$p));
            return _el$52;
          }
        }), null);
        _$effect(_p$ => {
          var _v$3 = mutedColor(),
            _v$4 = mutedColor(),
            _v$5 = mutedColor(),
            _v$6 = mutedColor(),
            _v$7 = mutedColor(),
            _v$8 = mutedColor(),
            _v$9 = mutedColor(),
            _v$0 = mutedColor();
          _v$3 !== _p$.e && (_p$.e = _$setProp(_el$17, "fg", _v$3, _p$.e));
          _v$4 !== _p$.t && (_p$.t = _$setProp(_el$19, "fg", _v$4, _p$.t));
          _v$5 !== _p$.a && (_p$.a = _$setProp(_el$29, "fg", _v$5, _p$.a));
          _v$6 !== _p$.o && (_p$.o = _$setProp(_el$31, "fg", _v$6, _p$.o));
          _v$7 !== _p$.i && (_p$.i = _$setProp(_el$37, "fg", _v$7, _p$.i));
          _v$8 !== _p$.n && (_p$.n = _$setProp(_el$39, "fg", _v$8, _p$.n));
          _v$9 !== _p$.s && (_p$.s = _$setProp(_el$47, "fg", _v$9, _p$.s));
          _v$0 !== _p$.h && (_p$.h = _$setProp(_el$49, "fg", _v$0, _p$.h));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined,
          n: undefined,
          s: undefined,
          h: undefined
        });
        return _el$15;
      }
    }), null);
    _$effect(_p$ => {
      var _v$1 = mutedColor(),
        _v$10 = textNormal(),
        _v$11 = headerBadgeColor();
      _v$1 !== _p$.e && (_p$.e = _$setProp(_el$10, "fg", _v$1, _p$.e));
      _v$10 !== _p$.t && (_p$.t = _$setProp(_el$11, "fg", _v$10, _p$.t));
      _v$11 !== _p$.a && (_p$.a = _$setProp(_el$14, "fg", _v$11, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$9;
  })();
}

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
    if (currentScope() === "global") return all.filter(e => e.scope === "global");
    if (currentScope() === "project") return all.filter(e => e.scope === "project");
    return all;
  });
  const projectName = () => props.directory.split("/").pop() || "project";
  const modalTitle = () => {
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
        var _el$62 = _$createElement("text");
        _$insert(_el$62, targetScope === "global" ? "Disimpan ke global memory" : "Disimpan ke project memory");
        _$effect(_$p => _$setProp(_el$62, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$62;
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
        category: currentScope() === "all" ? e.scope === "global" ? "GLOBAL MEMORY" : "PROJECT MEMORY" : undefined,
        footer: isDeleting ? "Tekan Ctrl+D lagi" : undefined
      };
    });
  });
  if (props.api.ui?.DialogSelect) {
    return (() => {
      var _el$63 = _$createElement("box"),
        _el$64 = _$createElement("box"),
        _el$65 = _$createElement("box"),
        _el$66 = _$createElement("text"),
        _el$67 = _$createElement("span"),
        _el$69 = _$createTextNode(` `),
        _el$70 = _$createElement("span"),
        _el$84 = _$createElement("text"),
        _el$85 = _$createTextNode(` note`);
      _$insertNode(_el$63, _el$64);
      _$setProp(_el$63, "flexDirection", "column");
      _$setProp(_el$63, "width", "100%");
      _$setProp(_el$63, "flexGrow", 1);
      _$setProp(_el$63, "justifyContent", "space-between");
      _$insert(_el$63, _$createComponent(props.api.ui.DialogSelect, {
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
      }), _el$64);
      _$insertNode(_el$64, _el$65);
      _$insertNode(_el$64, _el$84);
      _$setProp(_el$64, "flexDirection", "row");
      _$setProp(_el$64, "justifyContent", "space-between");
      _$setProp(_el$64, "width", "100%");
      _$setProp(_el$64, "paddingLeft", 4);
      _$setProp(_el$64, "paddingRight", 2);
      _$setProp(_el$64, "paddingBottom", 1);
      _$setProp(_el$64, "paddingTop", 0);
      _$setProp(_el$64, "flexShrink", 0);
      _$insertNode(_el$65, _el$66);
      _$setProp(_el$65, "flexDirection", "row");
      _$setProp(_el$65, "gap", 3);
      _$insertNode(_el$66, _el$67);
      _$insertNode(_el$66, _el$69);
      _$insertNode(_el$66, _el$70);
      _$insertNode(_el$67, _$createTextNode(`edit`));
      _$insertNode(_el$70, _$createTextNode(`enter`));
      _$insert(_el$65, _$createComponent(Show, {
        get when() {
          return currentScope() !== "all";
        },
        get children() {
          return [(() => {
            var _el$72 = _$createElement("text"),
              _el$73 = _$createElement("span"),
              _el$75 = _$createTextNode(` `),
              _el$76 = _$createElement("span");
            _$insertNode(_el$72, _el$73);
            _$insertNode(_el$72, _el$75);
            _$insertNode(_el$72, _el$76);
            _$insertNode(_el$73, _$createTextNode(`new`));
            _$insertNode(_el$76, _$createTextNode(`ctrl+a`));
            _$effect(_p$ => {
              var _v$12 = {
                  fg: props.api.theme?.current?.text
                },
                _v$13 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$12 !== _p$.e && (_p$.e = _$setProp(_el$73, "style", _v$12, _p$.e));
              _v$13 !== _p$.t && (_p$.t = _$setProp(_el$76, "style", _v$13, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$72;
          })(), (() => {
            var _el$78 = _$createElement("text"),
              _el$79 = _$createElement("span"),
              _el$81 = _$createTextNode(` `),
              _el$82 = _$createElement("span");
            _$insertNode(_el$78, _el$79);
            _$insertNode(_el$78, _el$81);
            _$insertNode(_el$78, _el$82);
            _$insertNode(_el$79, _$createTextNode(`delete`));
            _$insertNode(_el$82, _$createTextNode(`ctrl+d`));
            _$effect(_p$ => {
              var _v$14 = {
                  fg: props.api.theme?.current?.text
                },
                _v$15 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$14 !== _p$.e && (_p$.e = _$setProp(_el$79, "style", _v$14, _p$.e));
              _v$15 !== _p$.t && (_p$.t = _$setProp(_el$82, "style", _v$15, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$78;
          })()];
        }
      }), null);
      _$insertNode(_el$84, _el$85);
      _$insert(_el$84, () => entries().length, _el$85);
      _$insert(_el$84, () => entries().length === 1 ? "" : "s", null);
      _$effect(_p$ => {
        var _v$16 = {
            fg: props.api.theme?.current?.text
          },
          _v$17 = {
            fg: props.api.theme?.current?.textMuted
          },
          _v$18 = props.api.theme?.current?.textMuted;
        _v$16 !== _p$.e && (_p$.e = _$setProp(_el$67, "style", _v$16, _p$.e));
        _v$17 !== _p$.t && (_p$.t = _$setProp(_el$70, "style", _v$17, _p$.t));
        _v$18 !== _p$.a && (_p$.a = _$setProp(_el$84, "fg", _v$18, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
      return _el$63;
    })();
  }

  // Fallback simple view
  return (() => {
    var _el$86 = _$createElement("box"),
      _el$87 = _$createElement("text"),
      _el$88 = _$createElement("b");
    _$insertNode(_el$86, _el$87);
    _$setProp(_el$86, "gap", 1);
    _$setProp(_el$86, "paddingLeft", 2);
    _$setProp(_el$86, "paddingRight", 2);
    _$insertNode(_el$87, _el$88);
    _$insert(_el$88, modalTitle);
    _$insert(_el$86, _$createComponent(For, {
      get each() {
        return entries();
      },
      children: e => (() => {
        var _el$89 = _$createElement("text"),
          _el$90 = _$createTextNode(`• `),
          _el$91 = _$createTextNode(` (`),
          _el$92 = _$createTextNode(`)`);
        _$insertNode(_el$89, _el$90);
        _$insertNode(_el$89, _el$91);
        _$insertNode(_el$89, _el$92);
        _$insert(_el$89, () => e.content, _el$91);
        _$insert(_el$89, () => e.scope, _el$92);
        _$effect(_$p => _$setProp(_el$89, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$89;
      })()
    }), null);
    _$effect(_$p => _$setProp(_el$87, "fg", props.api.theme?.current?.text, _$p));
    return _el$86;
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
    var _el$93 = _$createElement("box"),
      _el$94 = _$createElement("box"),
      _el$95 = _$createElement("text"),
      _el$96 = _$createElement("b"),
      _el$98 = _$createElement("text"),
      _el$99 = _$createTextNode(` · `),
      _el$100 = _$createTextNode(` lines · `),
      _el$101 = _$createTextNode(` comment`),
      _el$103 = _$createElement("scrollbox"),
      _el$104 = _$createElement("box"),
      _el$114 = _$createElement("box"),
      _el$115 = _$createElement("text");
    _$insertNode(_el$93, _el$94);
    _$insertNode(_el$93, _el$103);
    _$insertNode(_el$93, _el$114);
    _$setProp(_el$93, "gap", 1);
    _$setProp(_el$93, "width", "100%");
    _$setProp(_el$93, "flexGrow", 1);
    _$setProp(_el$93, "paddingLeft", 2);
    _$setProp(_el$93, "paddingRight", 2);
    _$setProp(_el$93, "paddingBottom", 1);
    _$insertNode(_el$94, _el$95);
    _$insertNode(_el$94, _el$98);
    _$setProp(_el$94, "flexDirection", "row");
    _$setProp(_el$94, "justifyContent", "space-between");
    _$setProp(_el$94, "width", "100%");
    _$insertNode(_el$95, _el$96);
    _$insertNode(_el$96, _$createTextNode(`Interactive Plan Reviewer`));
    _$insertNode(_el$98, _el$99);
    _$insertNode(_el$98, _el$100);
    _$insertNode(_el$98, _el$101);
    _$insert(_el$98, () => planData().planName, _el$99);
    _$insert(_el$98, () => lines().length, _el$100);
    _$insert(_el$98, commentCount, _el$101);
    _$insert(_el$98, () => commentCount() === 1 ? "" : "s", null);
    _$insertNode(_el$103, _el$104);
    _$setProp(_el$103, "width", "100%");
    _$setProp(_el$103, "flexGrow", 1);
    _$setProp(_el$103, "minHeight", 12);
    _$setProp(_el$103, "maxHeight", 28);
    _$setProp(_el$104, "flexDirection", "column");
    _$setProp(_el$104, "gap", 0);
    _$setProp(_el$104, "width", "100%");
    _$setProp(_el$104, "minWidth", 0);
    _$insert(_el$104, _$createComponent(Show, {
      get when() {
        return lines().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$116 = _$createElement("text");
          _$insertNode(_el$116, _$createTextNode(`(Dokumen rencana kosong atau belum dimuat)`));
          _$effect(_$p => _$setProp(_el$116, "fg", theme().textMuted, _$p));
          return _el$116;
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
              var _el$118 = _$createElement("box"),
                _el$119 = _$createElement("box"),
                _el$120 = _$createElement("text"),
                _el$121 = _$createTextNode(` |`),
                _el$122 = _$createElement("text");
              _$insertNode(_el$118, _el$119);
              _$setProp(_el$118, "flexDirection", "column");
              _$setProp(_el$118, "gap", 0);
              _$setProp(_el$118, "paddingLeft", 1);
              _$setProp(_el$118, "paddingRight", 1);
              _$insertNode(_el$119, _el$120);
              _$insertNode(_el$119, _el$122);
              _$setProp(_el$119, "flexDirection", "row");
              _$setProp(_el$119, "gap", 1);
              _$insertNode(_el$120, _el$121);
              _$insert(_el$120, () => String(line.index).padStart(3, " "), _el$121);
              _$setProp(_el$122, "wrapMode", "word");
              _$setProp(_el$122, "flexGrow", 1);
              _$insert(_el$122, () => line.raw);
              _$insert(_el$119, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$123 = _$createElement("text");
                  _$insertNode(_el$123, _$createTextNode(`[comment]`));
                  _$effect(_$p => _$setProp(_el$123, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$123;
                }
              }), null);
              _$insert(_el$118, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$125 = _$createElement("box"),
                    _el$126 = _$createElement("text"),
                    _el$127 = _$createElement("i"),
                    _el$128 = _$createTextNode(`↳ `);
                  _$insertNode(_el$125, _el$126);
                  _$setProp(_el$125, "paddingLeft", 6);
                  _$setProp(_el$125, "paddingTop", 0);
                  _$setProp(_el$125, "paddingBottom", 0);
                  _$insertNode(_el$126, _el$127);
                  _$setProp(_el$126, "wrapMode", "word");
                  _$insertNode(_el$127, _el$128);
                  _$insert(_el$127, () => comments()[idx()]?.text, null);
                  _$effect(_$p => _$setProp(_el$126, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$125;
                }
              }), null);
              _$effect(_p$ => {
                var _v$26 = isSelected() ? theme().bgSelected || "#1e293b" : undefined,
                  _v$27 = isSelected() ? "single" : undefined,
                  _v$28 = isSelected() ? theme().accent || "#8b5cf6" : undefined,
                  _v$29 = isSelected() ? theme().text : theme().textMuted,
                  _v$30 = getLineTypeColor(line.type);
                _v$26 !== _p$.e && (_p$.e = _$setProp(_el$118, "backgroundColor", _v$26, _p$.e));
                _v$27 !== _p$.t && (_p$.t = _$setProp(_el$118, "borderStyle", _v$27, _p$.t));
                _v$28 !== _p$.a && (_p$.a = _$setProp(_el$118, "borderColor", _v$28, _p$.a));
                _v$29 !== _p$.o && (_p$.o = _$setProp(_el$120, "fg", _v$29, _p$.o));
                _v$30 !== _p$.i && (_p$.i = _$setProp(_el$122, "fg", _v$30, _p$.i));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined,
                i: undefined
              });
              return _el$118;
            })();
          }
        });
      }
    }));
    _$insert(_el$93, _$createComponent(Show, {
      get when() {
        return commentMode();
      },
      get children() {
        var _el$105 = _$createElement("box"),
          _el$106 = _$createElement("text"),
          _el$107 = _$createElement("b"),
          _el$108 = _$createTextNode(`Tulis Komentar untuk Baris #`),
          _el$109 = _$createTextNode(`:`),
          _el$110 = _$createElement("text"),
          _el$111 = _$createTextNode(`"`),
          _el$112 = _$createTextNode(`"`),
          _el$113 = _$createElement("text");
        _$insertNode(_el$105, _el$106);
        _$insertNode(_el$105, _el$110);
        _$insertNode(_el$105, _el$113);
        _$setProp(_el$105, "flexDirection", "column");
        _$setProp(_el$105, "gap", 0);
        _$setProp(_el$105, "borderStyle", "single");
        _$setProp(_el$105, "paddingLeft", 1);
        _$setProp(_el$105, "paddingRight", 1);
        _$insertNode(_el$106, _el$107);
        _$insertNode(_el$107, _el$108);
        _$insertNode(_el$107, _el$109);
        _$insert(_el$107, () => selectedLine()?.index, _el$109);
        _$insertNode(_el$110, _el$111);
        _$insertNode(_el$110, _el$112);
        _$insert(_el$110, () => selectedLine()?.raw, _el$112);
        _$insert(_el$113, () => commentDraft() || "(ketik komentar...)");
        _$effect(_p$ => {
          var _v$19 = theme().warning || "#f59e0b",
            _v$20 = theme().warning || "#f59e0b",
            _v$21 = theme().textMuted,
            _v$22 = theme().text;
          _v$19 !== _p$.e && (_p$.e = _$setProp(_el$105, "borderColor", _v$19, _p$.e));
          _v$20 !== _p$.t && (_p$.t = _$setProp(_el$106, "fg", _v$20, _p$.t));
          _v$21 !== _p$.a && (_p$.a = _$setProp(_el$110, "fg", _v$21, _p$.a));
          _v$22 !== _p$.o && (_p$.o = _$setProp(_el$113, "fg", _v$22, _p$.o));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined
        });
        return _el$105;
      }
    }), _el$114);
    _$insertNode(_el$114, _el$115);
    _$setProp(_el$114, "flexDirection", "row");
    _$setProp(_el$114, "justifyContent", "space-between");
    _$setProp(_el$114, "width", "100%");
    _$insert(_el$115, _$createComponent(Show, {
      get when() {
        return commentMode();
      },
      fallback: "↓/↑ pilih baris · enter komentar · ctrl+a approve · esc tutup",
      children: "ctrl+enter simpan \xB7 esc batal"
    }));
    _$effect(_p$ => {
      var _v$23 = theme().text,
        _v$24 = theme().textMuted,
        _v$25 = theme().textMuted;
      _v$23 !== _p$.e && (_p$.e = _$setProp(_el$95, "fg", _v$23, _p$.e));
      _v$24 !== _p$.t && (_p$.t = _$setProp(_el$98, "fg", _v$24, _p$.t));
      _v$25 !== _p$.a && (_p$.a = _$setProp(_el$115, "fg", _v$25, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$93;
  })();
}

/**
 * TokensTree — collapsible accordion tree for session & subagent token usage.
 *
 * Data comes from usage/tokens/tracker.js (read-only opencode.db). Each node
 * (main agent + subagents) can be expanded/collapsed independently via click.
 * Refreshes when the mode state changes (proxy for session activity).
 */
function TokensTree(props) {
  const [open, setOpen] = createSignal(true);
  const [mainOpen, setMainOpen] = createSignal(true);
  const [subOpen, setSubOpen] = createSignal(true);
  const [tree, setTree] = createSignal(null);

  // Refresh tree when session changes or mode state flips (activity proxy).
  createEffect(() => {
    const sid = props.sessionID();
    if (!sid) {
      setTree(null);
      return;
    }
    let h = null;
    try {
      openReadonly(opencodeDbPath()).then(handle => {
        h = handle;
        setTree(getAgentTree(handle.db, sid));
        handle.close();
      });
    } catch {
      setTree(null);
    }
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
  const renderNode = (node, openSignal, toggle) => [(() => {
    var _el$129 = _$createElement("box"),
      _el$130 = _$createElement("text"),
      _el$131 = _$createElement("text"),
      _el$132 = _$createElement("b"),
      _el$133 = _$createElement("text");
    _$insertNode(_el$129, _el$130);
    _$insertNode(_el$129, _el$131);
    _$insertNode(_el$129, _el$133);
    _$setProp(_el$129, "flexDirection", "row");
    _$setProp(_el$129, "gap", 1);
    _$setProp(_el$129, "onMouseDown", toggle);
    _$insert(_el$130, () => openSignal() ? "▼" : "▶");
    _$insertNode(_el$131, _el$132);
    _$insert(_el$132, () => node.agent || "agent");
    _$insert(_el$133, () => modelName(node));
    _$effect(_p$ => {
      var _v$31 = mutedColor(),
        _v$32 = accentColor(),
        _v$33 = mutedColor();
      _v$31 !== _p$.e && (_p$.e = _$setProp(_el$130, "fg", _v$31, _p$.e));
      _v$32 !== _p$.t && (_p$.t = _$setProp(_el$131, "fg", _v$32, _p$.t));
      _v$33 !== _p$.a && (_p$.a = _$setProp(_el$133, "fg", _v$33, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$129;
  })(), _$createComponent(Show, {
    get when() {
      return openSignal();
    },
    get children() {
      var _el$134 = _$createElement("box"),
        _el$135 = _$createElement("text"),
        _el$136 = _$createTextNode(`In : `),
        _el$138 = _$createElement("span"),
        _el$139 = _$createElement("text"),
        _el$140 = _$createTextNode(`Out : `),
        _el$142 = _$createElement("span"),
        _el$151 = _$createElement("text"),
        _el$152 = _$createTextNode(`Cost : `),
        _el$154 = _$createElement("span");
      _$insertNode(_el$134, _el$135);
      _$insertNode(_el$134, _el$139);
      _$insertNode(_el$134, _el$151);
      _$setProp(_el$134, "flexDirection", "column");
      _$setProp(_el$134, "gap", 0);
      _$setProp(_el$134, "paddingLeft", 2);
      _$insertNode(_el$135, _el$136);
      _$insertNode(_el$135, _el$138);
      _$insert(_el$138, () => formatTokens(node.input));
      _$insertNode(_el$139, _el$140);
      _$insertNode(_el$139, _el$142);
      _$insert(_el$142, () => formatTokens(node.output));
      _$insert(_el$134, _$createComponent(Show, {
        get when() {
          return node.reasoning > 0;
        },
        get children() {
          var _el$143 = _$createElement("text"),
            _el$144 = _$createTextNode(`Reasoning: `),
            _el$146 = _$createElement("span");
          _$insertNode(_el$143, _el$144);
          _$insertNode(_el$143, _el$146);
          _$insert(_el$146, () => formatTokens(node.reasoning));
          _$effect(_p$ => {
            var _v$34 = mutedColor(),
              _v$35 = {
                fg: textNormal()
              };
            _v$34 !== _p$.e && (_p$.e = _$setProp(_el$143, "fg", _v$34, _p$.e));
            _v$35 !== _p$.t && (_p$.t = _$setProp(_el$146, "style", _v$35, _p$.t));
            return _p$;
          }, {
            e: undefined,
            t: undefined
          });
          return _el$143;
        }
      }), _el$151);
      _$insert(_el$134, _$createComponent(Show, {
        get when() {
          return node.cacheRead > 0 || node.cacheWrite > 0;
        },
        get children() {
          var _el$147 = _$createElement("text"),
            _el$148 = _$createTextNode(`Cache R: `),
            _el$150 = _$createElement("span");
          _$insertNode(_el$147, _el$148);
          _$insertNode(_el$147, _el$150);
          _$insert(_el$150, () => formatTokens(node.cacheRead));
          _$effect(_p$ => {
            var _v$36 = mutedColor(),
              _v$37 = {
                fg: textNormal()
              };
            _v$36 !== _p$.e && (_p$.e = _$setProp(_el$147, "fg", _v$36, _p$.e));
            _v$37 !== _p$.t && (_p$.t = _$setProp(_el$150, "style", _v$37, _p$.t));
            return _p$;
          }, {
            e: undefined,
            t: undefined
          });
          return _el$147;
        }
      }), _el$151);
      _$insertNode(_el$151, _el$152);
      _$insertNode(_el$151, _el$154);
      _$insert(_el$154, () => formatUSD(node.cost));
      _$effect(_p$ => {
        var _v$38 = mutedColor(),
          _v$39 = {
            fg: textNormal()
          },
          _v$40 = mutedColor(),
          _v$41 = {
            fg: textNormal()
          },
          _v$42 = mutedColor(),
          _v$43 = {
            fg: successColor()
          };
        _v$38 !== _p$.e && (_p$.e = _$setProp(_el$135, "fg", _v$38, _p$.e));
        _v$39 !== _p$.t && (_p$.t = _$setProp(_el$138, "style", _v$39, _p$.t));
        _v$40 !== _p$.a && (_p$.a = _$setProp(_el$139, "fg", _v$40, _p$.a));
        _v$41 !== _p$.o && (_p$.o = _$setProp(_el$142, "style", _v$41, _p$.o));
        _v$42 !== _p$.i && (_p$.i = _$setProp(_el$151, "fg", _v$42, _p$.i));
        _v$43 !== _p$.n && (_p$.n = _$setProp(_el$154, "style", _v$43, _p$.n));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined,
        o: undefined,
        i: undefined,
        n: undefined
      });
      return _el$134;
    }
  })];
  return (() => {
    var _el$155 = _$createElement("box"),
      _el$156 = _$createElement("box"),
      _el$157 = _$createElement("text"),
      _el$158 = _$createElement("text"),
      _el$159 = _$createElement("b"),
      _el$161 = _$createElement("text");
    _$insertNode(_el$155, _el$156);
    _$setProp(_el$155, "flexDirection", "column");
    _$setProp(_el$155, "gap", 0);
    _$insertNode(_el$156, _el$157);
    _$insertNode(_el$156, _el$158);
    _$insertNode(_el$156, _el$161);
    _$setProp(_el$156, "flexDirection", "row");
    _$setProp(_el$156, "gap", 1);
    _$setProp(_el$156, "onMouseDown", () => setOpen(x => !x));
    _$insert(_el$157, () => open() ? "▼" : "▶");
    _$insertNode(_el$158, _el$159);
    _$insertNode(_el$159, _$createTextNode(`Tokens`));
    _$insert(_el$161, (() => {
      var _c$2 = _$memo(() => totalTokens() > 0);
      return () => _c$2() ? `(${formatTokens(totalTokens())})` : "";
    })());
    _$insert(_el$155, _$createComponent(Show, {
      get when() {
        return _$memo(() => !!open())() && tree();
      },
      get children() {
        var _el$162 = _$createElement("box");
        _$setProp(_el$162, "flexDirection", "column");
        _$setProp(_el$162, "gap", 0);
        _$setProp(_el$162, "paddingLeft", 1);
        _$insert(_el$162, () => renderNode(tree().main, mainOpen, () => setMainOpen(x => !x)), null);
        _$insert(_el$162, _$createComponent(Show, {
          get when() {
            return tree().subagents.length > 0;
          },
          get children() {
            return [(() => {
              var _el$163 = _$createElement("box"),
                _el$164 = _$createElement("text"),
                _el$165 = _$createElement("text"),
                _el$166 = _$createTextNode(`Subagents (`),
                _el$167 = _$createTextNode(`)`);
              _$insertNode(_el$163, _el$164);
              _$insertNode(_el$163, _el$165);
              _$setProp(_el$163, "flexDirection", "row");
              _$setProp(_el$163, "gap", 1);
              _$setProp(_el$163, "onMouseDown", () => setSubOpen(x => !x));
              _$insert(_el$164, () => subOpen() ? "▼" : "▶");
              _$insertNode(_el$165, _el$166);
              _$insertNode(_el$165, _el$167);
              _$insert(_el$165, () => tree().subagents.length, _el$167);
              _$effect(_p$ => {
                var _v$44 = mutedColor(),
                  _v$45 = textNormal();
                _v$44 !== _p$.e && (_p$.e = _$setProp(_el$164, "fg", _v$44, _p$.e));
                _v$45 !== _p$.t && (_p$.t = _$setProp(_el$165, "fg", _v$45, _p$.t));
                return _p$;
              }, {
                e: undefined,
                t: undefined
              });
              return _el$163;
            })(), _$createComponent(Show, {
              get when() {
                return subOpen();
              },
              get children() {
                var _el$168 = _$createElement("box");
                _$setProp(_el$168, "flexDirection", "column");
                _$setProp(_el$168, "gap", 0);
                _$setProp(_el$168, "paddingLeft", 2);
                _$insert(_el$168, _$createComponent(For, {
                  get each() {
                    return tree().subagents;
                  },
                  children: sub => (() => {
                    var _el$169 = _$createElement("box");
                    _$setProp(_el$169, "flexDirection", "column");
                    _$setProp(_el$169, "gap", 0);
                    _$setProp(_el$169, "paddingLeft", 1);
                    _$insert(_el$169, () => renderNode(sub, subOpen, () => setSubOpen(x => !x)));
                    return _el$169;
                  })()
                }));
                return _el$168;
              }
            })];
          }
        }), null);
        _$insert(_el$162, _$createComponent(LastTurnItem, {
          get api() {
            return props.api;
          },
          get sessionID() {
            return props.sessionID;
          }
        }), null);
        return _el$162;
      }
    }), null);
    _$effect(_p$ => {
      var _v$46 = mutedColor(),
        _v$47 = textNormal(),
        _v$48 = mutedColor();
      _v$46 !== _p$.e && (_p$.e = _$setProp(_el$157, "fg", _v$46, _p$.e));
      _v$47 !== _p$.t && (_p$.t = _$setProp(_el$158, "fg", _v$47, _p$.t));
      _v$48 !== _p$.a && (_p$.a = _$setProp(_el$161, "fg", _v$48, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$155;
  })();
}

/**
 * LastTurnItem — collapsible "Last Turn" node inside the Tokens tree.
 *
 * Reads reactive TUI state (api.state.session.messages) + 2s tick, shows the
 * last completed assistant turn's token breakdown. Expand/collapse via click.
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
  const fmt = n => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return `${n}`;
  };
  const fmtCost = n => {
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(4)}`;
  };
  const fmtDuration = ms => {
    if (!ms) return "";
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  };
  const turn = lastTurn();
  return (() => {
    var _el$170 = _$createElement("box"),
      _el$171 = _$createElement("box"),
      _el$172 = _$createElement("text"),
      _el$173 = _$createElement("text"),
      _el$174 = _$createElement("b");
    _$insertNode(_el$170, _el$171);
    _$setProp(_el$170, "flexDirection", "column");
    _$setProp(_el$170, "gap", 0);
    _$insertNode(_el$171, _el$172);
    _$insertNode(_el$171, _el$173);
    _$setProp(_el$171, "flexDirection", "row");
    _$setProp(_el$171, "gap", 1);
    _$setProp(_el$171, "onMouseDown", () => setOpen(x => !x));
    _$insert(_el$172, () => open() ? "▼" : "▶");
    _$insertNode(_el$173, _el$174);
    _$insertNode(_el$174, _$createTextNode(`Last Turn`));
    _$insert(_el$171, turn ? (() => {
      var _el$183 = _$createElement("text"),
        _el$184 = _$createTextNode(`(`),
        _el$185 = _$createTextNode(` in · `),
        _el$186 = _$createTextNode(` out)`);
      _$insertNode(_el$183, _el$184);
      _$insertNode(_el$183, _el$185);
      _$insertNode(_el$183, _el$186);
      _$insert(_el$183, () => fmt(turn.input), _el$185);
      _$insert(_el$183, () => fmt(turn.output), _el$186);
      _$effect(_$p => _$setProp(_el$183, "fg", mutedColor(), _$p));
      return _el$183;
    })() : null, null);
    _$insert(_el$170, _$createComponent(Show, {
      get when() {
        return open() && turn;
      },
      get children() {
        var _el$176 = _$createElement("box"),
          _el$177 = _$createElement("text"),
          _el$178 = _$createTextNode(`In : `),
          _el$179 = _$createElement("span"),
          _el$180 = _$createElement("text"),
          _el$181 = _$createTextNode(`Out : `),
          _el$182 = _$createElement("span");
        _$insertNode(_el$176, _el$177);
        _$insertNode(_el$176, _el$180);
        _$setProp(_el$176, "flexDirection", "column");
        _$setProp(_el$176, "gap", 0);
        _$setProp(_el$176, "paddingLeft", 2);
        _$insertNode(_el$177, _el$178);
        _$insertNode(_el$177, _el$179);
        _$insert(_el$179, () => fmt(turn.input));
        _$insert(_el$176, (() => {
          var _c$3 = _$memo(() => turn.cacheRead > 0);
          return () => _c$3() ? (() => {
            var _el$187 = _$createElement("text"),
              _el$188 = _$createTextNode(`Cache : `),
              _el$190 = _$createElement("span");
            _$insertNode(_el$187, _el$188);
            _$insertNode(_el$187, _el$190);
            _$insert(_el$190, () => fmt(turn.cacheRead));
            _$effect(_p$ => {
              var _v$55 = mutedColor(),
                _v$56 = {
                  fg: textNormal()
                };
              _v$55 !== _p$.e && (_p$.e = _$setProp(_el$187, "fg", _v$55, _p$.e));
              _v$56 !== _p$.t && (_p$.t = _$setProp(_el$190, "style", _v$56, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$187;
          })() : null;
        })(), _el$180);
        _$insertNode(_el$180, _el$181);
        _$insertNode(_el$180, _el$182);
        _$insert(_el$182, () => fmt(turn.output));
        _$insert(_el$176, (() => {
          var _c$4 = _$memo(() => turn.reasoning > 0);
          return () => _c$4() ? (() => {
            var _el$191 = _$createElement("text"),
              _el$192 = _$createTextNode(`Reasoning : `),
              _el$194 = _$createElement("span");
            _$insertNode(_el$191, _el$192);
            _$insertNode(_el$191, _el$194);
            _$insert(_el$194, () => fmt(turn.reasoning));
            _$effect(_p$ => {
              var _v$57 = mutedColor(),
                _v$58 = {
                  fg: textNormal()
                };
              _v$57 !== _p$.e && (_p$.e = _$setProp(_el$191, "fg", _v$57, _p$.e));
              _v$58 !== _p$.t && (_p$.t = _$setProp(_el$194, "style", _v$58, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$191;
          })() : null;
        })(), null);
        _$insert(_el$176, (() => {
          var _c$5 = _$memo(() => !!turn.durationMs);
          return () => _c$5() ? (() => {
            var _el$195 = _$createElement("text"),
              _el$196 = _$createTextNode(`Time : `),
              _el$198 = _$createElement("span");
            _$insertNode(_el$195, _el$196);
            _$insertNode(_el$195, _el$198);
            _$insert(_el$198, () => fmtDuration(turn.durationMs));
            _$effect(_p$ => {
              var _v$59 = mutedColor(),
                _v$60 = {
                  fg: textNormal()
                };
              _v$59 !== _p$.e && (_p$.e = _$setProp(_el$195, "fg", _v$59, _p$.e));
              _v$60 !== _p$.t && (_p$.t = _$setProp(_el$198, "style", _v$60, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$195;
          })() : null;
        })(), null);
        _$insert(_el$176, (() => {
          var _c$6 = _$memo(() => turn.cost > 0);
          return () => _c$6() ? (() => {
            var _el$199 = _$createElement("text"),
              _el$200 = _$createTextNode(`Cost : `),
              _el$202 = _$createElement("span");
            _$insertNode(_el$199, _el$200);
            _$insertNode(_el$199, _el$202);
            _$insert(_el$202, () => fmtCost(turn.cost));
            _$effect(_p$ => {
              var _v$61 = mutedColor(),
                _v$62 = {
                  fg: accentColor()
                };
              _v$61 !== _p$.e && (_p$.e = _$setProp(_el$199, "fg", _v$61, _p$.e));
              _v$62 !== _p$.t && (_p$.t = _$setProp(_el$202, "style", _v$62, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$199;
          })() : null;
        })(), null);
        _$effect(_p$ => {
          var _v$49 = mutedColor(),
            _v$50 = {
              fg: textNormal()
            },
            _v$51 = mutedColor(),
            _v$52 = {
              fg: textNormal()
            };
          _v$49 !== _p$.e && (_p$.e = _$setProp(_el$177, "fg", _v$49, _p$.e));
          _v$50 !== _p$.t && (_p$.t = _$setProp(_el$179, "style", _v$50, _p$.t));
          _v$51 !== _p$.a && (_p$.a = _$setProp(_el$180, "fg", _v$51, _p$.a));
          _v$52 !== _p$.o && (_p$.o = _$setProp(_el$182, "style", _v$52, _p$.o));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined
        });
        return _el$176;
      }
    }), null);
    _$effect(_p$ => {
      var _v$53 = mutedColor(),
        _v$54 = textNormal();
      _v$53 !== _p$.e && (_p$.e = _$setProp(_el$172, "fg", _v$53, _p$.e));
      _v$54 !== _p$.t && (_p$.t = _$setProp(_el$173, "fg", _v$54, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$170;
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
            var _el$203 = _$createElement("box");
            _$setProp(_el$203, "flexDirection", "column");
            _$setProp(_el$203, "gap", 1);
            _$insert(_el$203, _$createComponent(SidebarWidget, {
              api: api,
              directory: directory,
              sessionID: () => props?.session_id || ctx?.session_id || activeSessionID() || resolveActiveSessionID(api) || ""
            }), null);
            _$insert(_el$203, _$createComponent(Show, {
              get when() {
                return config?.usage?.enabled !== false;
              },
              get children() {
                return _$createComponent(TokensTree, {
                  api: api,
                  directory: directory,
                  sessionID: () => props?.session_id || ctx?.session_id || activeSessionID() || resolveActiveSessionID(api) || ""
                });
              }
            }), null);
            return _el$203;
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
