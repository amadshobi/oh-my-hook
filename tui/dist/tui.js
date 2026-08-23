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
import { createSignal, Show, For, onMount, onCleanup, createMemo } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import { getMetrics, getPlanReviewData } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";
import { loadConfig } from "../../share/config.js";
import { formatReviewFeedback } from "../../plans/parser.js";
import { currentPlan } from "../../share/state.js";
import { appendMemory, replaceMemory, removeMemory, resolveTargetMemoryFile, getGlobalFile, listMemoryEntries } from "../../memory/store.js";
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
      _$insertNode(_el$2, _$createTextNode(`PLAN MODE`));
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
  const headerBadgeText = () => {
    if (!metrics().modeEnabled) return "OFF";
    return isPlan() ? "PLAN" : "EXEC";
  };
  const headerBadgeColor = () => {
    if (!metrics().modeEnabled) return redColor();
    return isPlan() ? yellowColor() : greenColor();
  };
  return (() => {
    var _el$4 = _$createElement("box"),
      _el$5 = _$createElement("box"),
      _el$6 = _$createElement("box"),
      _el$7 = _$createElement("text"),
      _el$8 = _$createElement("text"),
      _el$9 = _$createElement("b"),
      _el$1 = _$createElement("text");
    _$insertNode(_el$4, _el$5);
    _$setProp(_el$4, "flexDirection", "column");
    _$setProp(_el$4, "gap", 0);
    _$insertNode(_el$5, _el$6);
    _$insertNode(_el$5, _el$1);
    _$setProp(_el$5, "flexDirection", "row");
    _$setProp(_el$5, "justifyContent", "space-between");
    _$setProp(_el$5, "width", "100%");
    _$setProp(_el$5, "onMouseDown", () => setOpen(x => !x));
    _$insertNode(_el$6, _el$7);
    _$insertNode(_el$6, _el$8);
    _$setProp(_el$6, "flexDirection", "row");
    _$setProp(_el$6, "gap", 1);
    _$insert(_el$7, () => open() ? "▼" : "▶");
    _$insertNode(_el$8, _el$9);
    _$insertNode(_el$9, _$createTextNode(`oh-my-hook`));
    _$insert(_el$1, headerBadgeText);
    _$insert(_el$4, _$createComponent(Show, {
      get when() {
        return open();
      },
      get children() {
        var _el$10 = _$createElement("box"),
          _el$11 = _$createElement("box"),
          _el$12 = _$createElement("text"),
          _el$14 = _$createElement("text"),
          _el$15 = _$createTextNode(`Mode: `),
          _el$23 = _$createElement("box"),
          _el$24 = _$createElement("text"),
          _el$26 = _$createElement("text"),
          _el$27 = _$createTextNode(`Shields: `),
          _el$31 = _$createElement("box"),
          _el$32 = _$createElement("text"),
          _el$34 = _$createElement("text"),
          _el$35 = _$createTextNode(`Memory: `),
          _el$41 = _$createElement("box"),
          _el$42 = _$createElement("text"),
          _el$44 = _$createElement("text"),
          _el$45 = _$createTextNode(`Pruned: `);
        _$insertNode(_el$10, _el$11);
        _$insertNode(_el$10, _el$23);
        _$insertNode(_el$10, _el$31);
        _$insertNode(_el$10, _el$41);
        _$setProp(_el$10, "flexDirection", "column");
        _$setProp(_el$10, "gap", 0);
        _$setProp(_el$10, "paddingLeft", 1);
        _$setProp(_el$10, "paddingTop", 0);
        _$insertNode(_el$11, _el$12);
        _$insertNode(_el$11, _el$14);
        _$setProp(_el$11, "flexDirection", "row");
        _$setProp(_el$11, "gap", 1);
        _$insertNode(_el$12, _$createTextNode(`•`));
        _$insertNode(_el$14, _el$15);
        _$insert(_el$14, _$createComponent(Show, {
          get when() {
            return metrics().modeEnabled;
          },
          get fallback() {
            return (() => {
              var _el$49 = _$createElement("span");
              _$insertNode(_el$49, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$49, "style", {
                fg: redColor()
              }, _$p));
              return _el$49;
            })();
          },
          get children() {
            var _el$17 = _$createElement("span");
            _$insert(_el$17, () => isPlan() ? "plan (read-only)" : "execute");
            _$effect(_$p => _$setProp(_el$17, "style", {
              fg: isPlan() ? yellowColor() : greenColor()
            }, _$p));
            return _el$17;
          }
        }), null);
        _$insert(_el$10, _$createComponent(Show, {
          get when() {
            return activePlan()?.file;
          },
          get children() {
            var _el$18 = _$createElement("box"),
              _el$19 = _$createElement("text"),
              _el$21 = _$createElement("text"),
              _el$22 = _$createElement("u");
            _$insertNode(_el$18, _el$19);
            _$insertNode(_el$18, _el$21);
            _$setProp(_el$18, "flexDirection", "row");
            _$setProp(_el$18, "gap", 1);
            _$setProp(_el$18, "paddingLeft", 2);
            _$setProp(_el$18, "onMouseDown", () => {
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
            _$insertNode(_el$19, _$createTextNode(`↳`));
            _$insertNode(_el$21, _el$22);
            _$setProp(_el$21, "wrapMode", "none");
            _$insert(_el$22, () => activePlan()?.name || "active plan");
            _$effect(_p$ => {
              var _v$ = accentColor(),
                _v$2 = textNormal();
              _v$ !== _p$.e && (_p$.e = _$setProp(_el$19, "fg", _v$, _p$.e));
              _v$2 !== _p$.t && (_p$.t = _$setProp(_el$21, "fg", _v$2, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$18;
          }
        }), _el$23);
        _$insertNode(_el$23, _el$24);
        _$insertNode(_el$23, _el$26);
        _$setProp(_el$23, "flexDirection", "row");
        _$setProp(_el$23, "gap", 1);
        _$insertNode(_el$24, _$createTextNode(`•`));
        _$insertNode(_el$26, _el$27);
        _$insert(_el$26, _$createComponent(Show, {
          get when() {
            return metrics().sandboxEnabled;
          },
          get fallback() {
            return (() => {
              var _el$51 = _$createElement("span");
              _$insertNode(_el$51, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$51, "style", {
                fg: redColor()
              }, _$p));
              return _el$51;
            })();
          },
          get children() {
            var _el$29 = _$createElement("span"),
              _el$30 = _$createTextNode(` active`);
            _$insertNode(_el$29, _el$30);
            _$insert(_el$29, () => metrics().guardsActive, _el$30);
            _$effect(_$p => _$setProp(_el$29, "style", {
              fg: greenColor()
            }, _$p));
            return _el$29;
          }
        }), null);
        _$insertNode(_el$31, _el$32);
        _$insertNode(_el$31, _el$34);
        _$setProp(_el$31, "flexDirection", "row");
        _$setProp(_el$31, "gap", 1);
        _$setProp(_el$31, "onMouseDown", () => {
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
        _$insertNode(_el$32, _$createTextNode(`•`));
        _$insertNode(_el$34, _el$35);
        _$insert(_el$34, _$createComponent(Show, {
          get when() {
            return metrics().memoryEnabled;
          },
          get fallback() {
            return (() => {
              var _el$53 = _$createElement("span");
              _$insertNode(_el$53, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$53, "style", {
                fg: redColor()
              }, _$p));
              return _el$53;
            })();
          },
          get children() {
            var _el$37 = _$createElement("span"),
              _el$38 = _$createTextNode(` global · `),
              _el$40 = _$createTextNode(` project`);
            _$insertNode(_el$37, _el$38);
            _$insertNode(_el$37, _el$40);
            _$insert(_el$37, () => metrics().memoryStats.global, _el$38);
            _$insert(_el$37, () => metrics().memoryStats.project, _el$40);
            _$effect(_$p => _$setProp(_el$37, "style", {
              fg: textNormal()
            }, _$p));
            return _el$37;
          }
        }), null);
        _$insertNode(_el$41, _el$42);
        _$insertNode(_el$41, _el$44);
        _$setProp(_el$41, "flexDirection", "row");
        _$setProp(_el$41, "gap", 1);
        _$insertNode(_el$42, _$createTextNode(`•`));
        _$insertNode(_el$44, _el$45);
        _$insert(_el$44, _$createComponent(Show, {
          get when() {
            return metrics().compressEnabled;
          },
          get fallback() {
            return (() => {
              var _el$55 = _$createElement("span");
              _$insertNode(_el$55, _$createTextNode(`disabled`));
              _$effect(_$p => _$setProp(_el$55, "style", {
                fg: redColor()
              }, _$p));
              return _el$55;
            })();
          },
          get children() {
            var _el$47 = _$createElement("span"),
              _el$48 = _$createTextNode(` outputs`);
            _$insertNode(_el$47, _el$48);
            _$insert(_el$47, () => metrics().compress?.session?.prunedCount || 0, _el$48);
            _$insert(_el$47, (() => {
              var _c$ = _$memo(() => metrics().compress?.session?.tokensSaved > 0);
              return () => _c$() ? ` · ~${metrics().compress.session.tokensSaved.toLocaleString()} tokens` : "";
            })(), null);
            _$effect(_$p => _$setProp(_el$47, "style", {
              fg: textNormal()
            }, _$p));
            return _el$47;
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
          _v$3 !== _p$.e && (_p$.e = _$setProp(_el$12, "fg", _v$3, _p$.e));
          _v$4 !== _p$.t && (_p$.t = _$setProp(_el$14, "fg", _v$4, _p$.t));
          _v$5 !== _p$.a && (_p$.a = _$setProp(_el$24, "fg", _v$5, _p$.a));
          _v$6 !== _p$.o && (_p$.o = _$setProp(_el$26, "fg", _v$6, _p$.o));
          _v$7 !== _p$.i && (_p$.i = _$setProp(_el$32, "fg", _v$7, _p$.i));
          _v$8 !== _p$.n && (_p$.n = _$setProp(_el$34, "fg", _v$8, _p$.n));
          _v$9 !== _p$.s && (_p$.s = _$setProp(_el$42, "fg", _v$9, _p$.s));
          _v$0 !== _p$.h && (_p$.h = _$setProp(_el$44, "fg", _v$0, _p$.h));
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
        return _el$10;
      }
    }), null);
    _$effect(_p$ => {
      var _v$1 = mutedColor(),
        _v$10 = textNormal(),
        _v$11 = headerBadgeColor();
      _v$1 !== _p$.e && (_p$.e = _$setProp(_el$7, "fg", _v$1, _p$.e));
      _v$10 !== _p$.t && (_p$.t = _$setProp(_el$8, "fg", _v$10, _p$.t));
      _v$11 !== _p$.a && (_p$.a = _$setProp(_el$1, "fg", _v$11, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$4;
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
        var _el$57 = _$createElement("text");
        _$insert(_el$57, targetScope === "global" ? "Disimpan ke global memory" : "Disimpan ke project memory");
        _$effect(_$p => _$setProp(_el$57, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$57;
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
      var _el$58 = _$createElement("box"),
        _el$59 = _$createElement("box"),
        _el$60 = _$createElement("box"),
        _el$61 = _$createElement("text"),
        _el$62 = _$createElement("span"),
        _el$64 = _$createTextNode(` `),
        _el$65 = _$createElement("span"),
        _el$79 = _$createElement("text"),
        _el$80 = _$createTextNode(` note`);
      _$insertNode(_el$58, _el$59);
      _$setProp(_el$58, "flexDirection", "column");
      _$setProp(_el$58, "width", "100%");
      _$setProp(_el$58, "flexGrow", 1);
      _$setProp(_el$58, "justifyContent", "space-between");
      _$insert(_el$58, _$createComponent(props.api.ui.DialogSelect, {
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
      }), _el$59);
      _$insertNode(_el$59, _el$60);
      _$insertNode(_el$59, _el$79);
      _$setProp(_el$59, "flexDirection", "row");
      _$setProp(_el$59, "justifyContent", "space-between");
      _$setProp(_el$59, "width", "100%");
      _$setProp(_el$59, "paddingLeft", 4);
      _$setProp(_el$59, "paddingRight", 2);
      _$setProp(_el$59, "paddingBottom", 1);
      _$setProp(_el$59, "paddingTop", 0);
      _$setProp(_el$59, "flexShrink", 0);
      _$insertNode(_el$60, _el$61);
      _$setProp(_el$60, "flexDirection", "row");
      _$setProp(_el$60, "gap", 3);
      _$insertNode(_el$61, _el$62);
      _$insertNode(_el$61, _el$64);
      _$insertNode(_el$61, _el$65);
      _$insertNode(_el$62, _$createTextNode(`edit`));
      _$insertNode(_el$65, _$createTextNode(`enter`));
      _$insert(_el$60, _$createComponent(Show, {
        get when() {
          return currentScope() !== "all";
        },
        get children() {
          return [(() => {
            var _el$67 = _$createElement("text"),
              _el$68 = _$createElement("span"),
              _el$70 = _$createTextNode(` `),
              _el$71 = _$createElement("span");
            _$insertNode(_el$67, _el$68);
            _$insertNode(_el$67, _el$70);
            _$insertNode(_el$67, _el$71);
            _$insertNode(_el$68, _$createTextNode(`new`));
            _$insertNode(_el$71, _$createTextNode(`ctrl+a`));
            _$effect(_p$ => {
              var _v$12 = {
                  fg: props.api.theme?.current?.text
                },
                _v$13 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$12 !== _p$.e && (_p$.e = _$setProp(_el$68, "style", _v$12, _p$.e));
              _v$13 !== _p$.t && (_p$.t = _$setProp(_el$71, "style", _v$13, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$67;
          })(), (() => {
            var _el$73 = _$createElement("text"),
              _el$74 = _$createElement("span"),
              _el$76 = _$createTextNode(` `),
              _el$77 = _$createElement("span");
            _$insertNode(_el$73, _el$74);
            _$insertNode(_el$73, _el$76);
            _$insertNode(_el$73, _el$77);
            _$insertNode(_el$74, _$createTextNode(`delete`));
            _$insertNode(_el$77, _$createTextNode(`ctrl+d`));
            _$effect(_p$ => {
              var _v$14 = {
                  fg: props.api.theme?.current?.text
                },
                _v$15 = {
                  fg: props.api.theme?.current?.textMuted
                };
              _v$14 !== _p$.e && (_p$.e = _$setProp(_el$74, "style", _v$14, _p$.e));
              _v$15 !== _p$.t && (_p$.t = _$setProp(_el$77, "style", _v$15, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$73;
          })()];
        }
      }), null);
      _$insertNode(_el$79, _el$80);
      _$insert(_el$79, () => entries().length, _el$80);
      _$insert(_el$79, () => entries().length === 1 ? "" : "s", null);
      _$effect(_p$ => {
        var _v$16 = {
            fg: props.api.theme?.current?.text
          },
          _v$17 = {
            fg: props.api.theme?.current?.textMuted
          },
          _v$18 = props.api.theme?.current?.textMuted;
        _v$16 !== _p$.e && (_p$.e = _$setProp(_el$62, "style", _v$16, _p$.e));
        _v$17 !== _p$.t && (_p$.t = _$setProp(_el$65, "style", _v$17, _p$.t));
        _v$18 !== _p$.a && (_p$.a = _$setProp(_el$79, "fg", _v$18, _p$.a));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined
      });
      return _el$58;
    })();
  }

  // Fallback simple view
  return (() => {
    var _el$81 = _$createElement("box"),
      _el$82 = _$createElement("text"),
      _el$83 = _$createElement("b");
    _$insertNode(_el$81, _el$82);
    _$setProp(_el$81, "gap", 1);
    _$setProp(_el$81, "paddingLeft", 2);
    _$setProp(_el$81, "paddingRight", 2);
    _$insertNode(_el$82, _el$83);
    _$insert(_el$83, modalTitle);
    _$insert(_el$81, _$createComponent(For, {
      get each() {
        return entries();
      },
      children: e => (() => {
        var _el$84 = _$createElement("text"),
          _el$85 = _$createTextNode(`• `),
          _el$86 = _$createTextNode(` (`),
          _el$87 = _$createTextNode(`)`);
        _$insertNode(_el$84, _el$85);
        _$insertNode(_el$84, _el$86);
        _$insertNode(_el$84, _el$87);
        _$insert(_el$84, () => e.content, _el$86);
        _$insert(_el$84, () => e.scope, _el$87);
        _$effect(_$p => _$setProp(_el$84, "fg", props.api.theme?.current?.textMuted, _$p));
        return _el$84;
      })()
    }), null);
    _$effect(_$p => _$setProp(_el$82, "fg", props.api.theme?.current?.text, _$p));
    return _el$81;
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
    var _el$88 = _$createElement("box"),
      _el$89 = _$createElement("box"),
      _el$90 = _$createElement("text"),
      _el$91 = _$createElement("b"),
      _el$93 = _$createElement("text"),
      _el$94 = _$createTextNode(` · `),
      _el$95 = _$createTextNode(` lines · `),
      _el$96 = _$createTextNode(` comment`),
      _el$98 = _$createElement("scrollbox"),
      _el$99 = _$createElement("box"),
      _el$109 = _$createElement("box"),
      _el$110 = _$createElement("text");
    _$insertNode(_el$88, _el$89);
    _$insertNode(_el$88, _el$98);
    _$insertNode(_el$88, _el$109);
    _$setProp(_el$88, "gap", 1);
    _$setProp(_el$88, "width", "100%");
    _$setProp(_el$88, "flexGrow", 1);
    _$setProp(_el$88, "paddingLeft", 2);
    _$setProp(_el$88, "paddingRight", 2);
    _$setProp(_el$88, "paddingBottom", 1);
    _$insertNode(_el$89, _el$90);
    _$insertNode(_el$89, _el$93);
    _$setProp(_el$89, "flexDirection", "row");
    _$setProp(_el$89, "justifyContent", "space-between");
    _$setProp(_el$89, "width", "100%");
    _$insertNode(_el$90, _el$91);
    _$insertNode(_el$91, _$createTextNode(`Interactive Plan Reviewer`));
    _$insertNode(_el$93, _el$94);
    _$insertNode(_el$93, _el$95);
    _$insertNode(_el$93, _el$96);
    _$insert(_el$93, () => planData().planName, _el$94);
    _$insert(_el$93, () => lines().length, _el$95);
    _$insert(_el$93, commentCount, _el$96);
    _$insert(_el$93, () => commentCount() === 1 ? "" : "s", null);
    _$insertNode(_el$98, _el$99);
    _$setProp(_el$98, "width", "100%");
    _$setProp(_el$98, "flexGrow", 1);
    _$setProp(_el$98, "minHeight", 12);
    _$setProp(_el$98, "maxHeight", 28);
    _$setProp(_el$99, "flexDirection", "column");
    _$setProp(_el$99, "gap", 0);
    _$setProp(_el$99, "width", "100%");
    _$setProp(_el$99, "minWidth", 0);
    _$insert(_el$99, _$createComponent(Show, {
      get when() {
        return lines().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$111 = _$createElement("text");
          _$insertNode(_el$111, _$createTextNode(`(Dokumen rencana kosong atau belum dimuat)`));
          _$effect(_$p => _$setProp(_el$111, "fg", theme().textMuted, _$p));
          return _el$111;
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
              var _el$113 = _$createElement("box"),
                _el$114 = _$createElement("box"),
                _el$115 = _$createElement("text"),
                _el$116 = _$createTextNode(` |`),
                _el$117 = _$createElement("text");
              _$insertNode(_el$113, _el$114);
              _$setProp(_el$113, "flexDirection", "column");
              _$setProp(_el$113, "gap", 0);
              _$setProp(_el$113, "paddingLeft", 1);
              _$setProp(_el$113, "paddingRight", 1);
              _$insertNode(_el$114, _el$115);
              _$insertNode(_el$114, _el$117);
              _$setProp(_el$114, "flexDirection", "row");
              _$setProp(_el$114, "gap", 1);
              _$insertNode(_el$115, _el$116);
              _$insert(_el$115, () => String(line.index).padStart(3, " "), _el$116);
              _$setProp(_el$117, "wrapMode", "word");
              _$setProp(_el$117, "flexGrow", 1);
              _$insert(_el$117, () => line.raw);
              _$insert(_el$114, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$118 = _$createElement("text");
                  _$insertNode(_el$118, _$createTextNode(`[comment]`));
                  _$effect(_$p => _$setProp(_el$118, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$118;
                }
              }), null);
              _$insert(_el$113, _$createComponent(Show, {
                get when() {
                  return hasComment();
                },
                get children() {
                  var _el$120 = _$createElement("box"),
                    _el$121 = _$createElement("text"),
                    _el$122 = _$createElement("i"),
                    _el$123 = _$createTextNode(`↳ `);
                  _$insertNode(_el$120, _el$121);
                  _$setProp(_el$120, "paddingLeft", 6);
                  _$setProp(_el$120, "paddingTop", 0);
                  _$setProp(_el$120, "paddingBottom", 0);
                  _$insertNode(_el$121, _el$122);
                  _$setProp(_el$121, "wrapMode", "word");
                  _$insertNode(_el$122, _el$123);
                  _$insert(_el$122, () => comments()[idx()]?.text, null);
                  _$effect(_$p => _$setProp(_el$121, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$120;
                }
              }), null);
              _$effect(_p$ => {
                var _v$26 = isSelected() ? theme().bgSelected || "#1e293b" : undefined,
                  _v$27 = isSelected() ? "single" : undefined,
                  _v$28 = isSelected() ? theme().accent || "#8b5cf6" : undefined,
                  _v$29 = isSelected() ? theme().text : theme().textMuted,
                  _v$30 = getLineTypeColor(line.type);
                _v$26 !== _p$.e && (_p$.e = _$setProp(_el$113, "backgroundColor", _v$26, _p$.e));
                _v$27 !== _p$.t && (_p$.t = _$setProp(_el$113, "borderStyle", _v$27, _p$.t));
                _v$28 !== _p$.a && (_p$.a = _$setProp(_el$113, "borderColor", _v$28, _p$.a));
                _v$29 !== _p$.o && (_p$.o = _$setProp(_el$115, "fg", _v$29, _p$.o));
                _v$30 !== _p$.i && (_p$.i = _$setProp(_el$117, "fg", _v$30, _p$.i));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined,
                i: undefined
              });
              return _el$113;
            })();
          }
        });
      }
    }));
    _$insert(_el$88, _$createComponent(Show, {
      get when() {
        return commentMode();
      },
      get children() {
        var _el$100 = _$createElement("box"),
          _el$101 = _$createElement("text"),
          _el$102 = _$createElement("b"),
          _el$103 = _$createTextNode(`Tulis Komentar untuk Baris #`),
          _el$104 = _$createTextNode(`:`),
          _el$105 = _$createElement("text"),
          _el$106 = _$createTextNode(`"`),
          _el$107 = _$createTextNode(`"`),
          _el$108 = _$createElement("text");
        _$insertNode(_el$100, _el$101);
        _$insertNode(_el$100, _el$105);
        _$insertNode(_el$100, _el$108);
        _$setProp(_el$100, "flexDirection", "column");
        _$setProp(_el$100, "gap", 0);
        _$setProp(_el$100, "borderStyle", "single");
        _$setProp(_el$100, "paddingLeft", 1);
        _$setProp(_el$100, "paddingRight", 1);
        _$insertNode(_el$101, _el$102);
        _$insertNode(_el$102, _el$103);
        _$insertNode(_el$102, _el$104);
        _$insert(_el$102, () => selectedLine()?.index, _el$104);
        _$insertNode(_el$105, _el$106);
        _$insertNode(_el$105, _el$107);
        _$insert(_el$105, () => selectedLine()?.raw, _el$107);
        _$insert(_el$108, () => commentDraft() || "(ketik komentar...)");
        _$effect(_p$ => {
          var _v$19 = theme().warning || "#f59e0b",
            _v$20 = theme().warning || "#f59e0b",
            _v$21 = theme().textMuted,
            _v$22 = theme().text;
          _v$19 !== _p$.e && (_p$.e = _$setProp(_el$100, "borderColor", _v$19, _p$.e));
          _v$20 !== _p$.t && (_p$.t = _$setProp(_el$101, "fg", _v$20, _p$.t));
          _v$21 !== _p$.a && (_p$.a = _$setProp(_el$105, "fg", _v$21, _p$.a));
          _v$22 !== _p$.o && (_p$.o = _$setProp(_el$108, "fg", _v$22, _p$.o));
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined
        });
        return _el$100;
      }
    }), _el$109);
    _$insertNode(_el$109, _el$110);
    _$setProp(_el$109, "flexDirection", "row");
    _$setProp(_el$109, "justifyContent", "space-between");
    _$setProp(_el$109, "width", "100%");
    _$insert(_el$110, _$createComponent(Show, {
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
      _v$23 !== _p$.e && (_p$.e = _$setProp(_el$90, "fg", _v$23, _p$.e));
      _v$24 !== _p$.t && (_p$.t = _$setProp(_el$93, "fg", _v$24, _p$.t));
      _v$25 !== _p$.a && (_p$.a = _$setProp(_el$110, "fg", _v$25, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$88;
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
  let currentSessionID = resolveActiveSessionID(api) || "";
  const unsubSession = createSessionSubscriber(api, nextSessionID => {
    if (nextSessionID) currentSessionID = nextSessionID;
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

  // 2. Register UI slots (Sidebar & Prompt Badge)
  if (api.slots?.register) {
    api.slots.register({
      id: "oh-my-hook-sidebar",
      order: 160,
      slots: {
        session_prompt_right(_ctx, props) {
          return _$createComponent(ModeBadge, {
            api: api,
            sessionID: () => props?.session_id || currentSessionID
          });
        },
        sidebar_content(_ctx, props) {
          return _$createComponent(SidebarWidget, {
            api: api,
            directory: directory,
            sessionID: () => props?.session_id || currentSessionID
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
  id: "oh-my-hook",
  tui
};
