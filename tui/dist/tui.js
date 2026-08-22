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
import { createSignal, Show, For } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import { getMetrics, getMemoryRules, getPlanReviewData } from "./lib/metrics.js";
import { resolveActiveSessionID, createSessionSubscriber } from "./lib/session.js";
import { formatReviewFeedback } from "../../plans/parser.js";
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
          _el$26 = _$createTextNode(` Rules`);
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

/**
 * OpenCode standard dialog popup for Memory Rules.
 * Matching native OpenCode / opencode-quota UI layout & styling.
 */
function MemoryModal(props) {
  const theme = () => props.api?.theme?.current || {};
  const rules = () => getMemoryRules(props.directory);
  const [tab, setTab] = createSignal("all");
  const filtered = () => {
    const list = rules();
    const currentTab = tab();
    if (currentTab === "preference") return list.filter(r => r.category === "preference");
    if (currentTab === "skill") return list.filter(r => r.category !== "preference");
    return list;
  };
  const getTagColor = cat => {
    if (cat === "preference") return theme().accent || "#8b5cf6";
    if (cat === "project_skill") return theme().warning || "#f59e0b";
    return theme().success || "#10b981";
  };
  return (() => {
    var _el$27 = _$createElement("box"),
      _el$28 = _$createElement("box"),
      _el$29 = _$createElement("text"),
      _el$30 = _$createElement("b"),
      _el$32 = _$createElement("text"),
      _el$33 = _$createTextNode(` active rule`),
      _el$34 = _$createElement("box"),
      _el$35 = _$createElement("text"),
      _el$36 = _$createElement("text"),
      _el$37 = _$createElement("text"),
      _el$38 = _$createElement("scrollbox"),
      _el$39 = _$createElement("box"),
      _el$40 = _$createElement("text");
    _$insertNode(_el$27, _el$28);
    _$insertNode(_el$27, _el$34);
    _$insertNode(_el$27, _el$38);
    _$insertNode(_el$27, _el$40);
    _$setProp(_el$27, "gap", 1);
    _$setProp(_el$27, "width", "100%");
    _$setProp(_el$27, "flexGrow", 1);
    _$setProp(_el$27, "paddingLeft", 2);
    _$setProp(_el$27, "paddingRight", 2);
    _$setProp(_el$27, "paddingBottom", 1);
    _$insertNode(_el$28, _el$29);
    _$insertNode(_el$28, _el$32);
    _$setProp(_el$28, "flexDirection", "row");
    _$setProp(_el$28, "justifyContent", "space-between");
    _$setProp(_el$28, "width", "100%");
    _$insertNode(_el$29, _el$30);
    _$insertNode(_el$30, _$createTextNode(`🧠 OpenCode Memory Inspector`));
    _$insertNode(_el$32, _el$33);
    _$insert(_el$32, () => rules().length, _el$33);
    _$insert(_el$32, () => rules().length === 1 ? "" : "s", null);
    _$insertNode(_el$34, _el$35);
    _$insertNode(_el$34, _el$36);
    _$insertNode(_el$34, _el$37);
    _$setProp(_el$34, "flexDirection", "row");
    _$setProp(_el$34, "gap", 2);
    _$setProp(_el$35, "onMouseDown", () => setTab("all"));
    _$insert(_el$35, () => tab() === "all" ? "● [Semua]" : "○ Semua");
    _$setProp(_el$36, "onMouseDown", () => setTab("preference"));
    _$insert(_el$36, () => tab() === "preference" ? "● [Preferences]" : "○ Preferences");
    _$setProp(_el$37, "onMouseDown", () => setTab("skill"));
    _$insert(_el$37, () => tab() === "skill" ? "● [Project Skills]" : "○ Project Skills");
    _$insertNode(_el$38, _el$39);
    _$setProp(_el$38, "width", "100%");
    _$setProp(_el$38, "flexGrow", 1);
    _$setProp(_el$38, "minHeight", 8);
    _$setProp(_el$38, "maxHeight", 28);
    _$setProp(_el$39, "flexDirection", "column");
    _$setProp(_el$39, "gap", 1);
    _$setProp(_el$39, "width", "100%");
    _$setProp(_el$39, "minWidth", 0);
    _$insert(_el$39, _$createComponent(Show, {
      get when() {
        return filtered().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$42 = _$createElement("text");
          _$insertNode(_el$42, _$createTextNode(`(Belum ada memory rules tersimpan. Gunakan /remember atau koreksi respon agen di chat untuk merekam secara otomatis)`));
          _$setProp(_el$42, "wrapMode", "word");
          _$effect(_$p => _$setProp(_el$42, "fg", theme().textMuted, _$p));
          return _el$42;
        })();
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return filtered();
          },
          children: r => (() => {
            var _el$44 = _$createElement("box"),
              _el$45 = _$createElement("box"),
              _el$46 = _$createElement("text"),
              _el$47 = _$createTextNode(`• [`),
              _el$48 = _$createTextNode(`]`),
              _el$49 = _$createElement("text"),
              _el$50 = _$createElement("b");
            _$insertNode(_el$44, _el$45);
            _$setProp(_el$44, "flexDirection", "column");
            _$setProp(_el$44, "gap", 0);
            _$setProp(_el$44, "borderStyle", "single");
            _$setProp(_el$44, "paddingLeft", 1);
            _$setProp(_el$44, "paddingRight", 1);
            _$insertNode(_el$45, _el$46);
            _$insertNode(_el$45, _el$49);
            _$setProp(_el$45, "flexDirection", "row");
            _$setProp(_el$45, "gap", 1);
            _$insertNode(_el$46, _el$47);
            _$insertNode(_el$46, _el$48);
            _$insert(_el$46, () => r.category, _el$48);
            _$insertNode(_el$49, _el$50);
            _$setProp(_el$49, "wrapMode", "word");
            _$insert(_el$50, () => r.content);
            _$insert(_el$44, _$createComponent(Show, {
              get when() {
                return r.rationale;
              },
              get children() {
                var _el$51 = _$createElement("text"),
                  _el$52 = _$createElement("i"),
                  _el$53 = _$createTextNode(`Alasan: `);
                _$insertNode(_el$51, _el$52);
                _$setProp(_el$51, "wrapMode", "word");
                _$setProp(_el$51, "paddingLeft", 2);
                _$insertNode(_el$52, _el$53);
                _$insert(_el$52, () => r.rationale, null);
                _$effect(_$p => _$setProp(_el$51, "fg", theme().textMuted, _$p));
                return _el$51;
              }
            }), null);
            _$insert(_el$44, _$createComponent(Show, {
              get when() {
                return _$memo(() => !!r.triggers)() && r.triggers.length > 0;
              },
              get children() {
                var _el$54 = _$createElement("text"),
                  _el$55 = _$createTextNode(`Triggers: `),
                  _el$56 = _$createTextNode(` | Conf: `),
                  _el$58 = _$createTextNode(`%`);
                _$insertNode(_el$54, _el$55);
                _$insertNode(_el$54, _el$56);
                _$insertNode(_el$54, _el$58);
                _$setProp(_el$54, "wrapMode", "word");
                _$setProp(_el$54, "paddingLeft", 2);
                _$insert(_el$54, () => r.triggers.join(", "), _el$56);
                _$insert(_el$54, () => Math.round((r.confidence || 0.5) * 100), _el$58);
                _$effect(_$p => _$setProp(_el$54, "fg", theme().textMuted, _$p));
                return _el$54;
              }
            }), null);
            _$effect(_p$ => {
              var _v$14 = theme().border || "#374151",
                _v$15 = getTagColor(r.category),
                _v$16 = theme().text;
              _v$14 !== _p$.e && (_p$.e = _$setProp(_el$44, "borderColor", _v$14, _p$.e));
              _v$15 !== _p$.t && (_p$.t = _$setProp(_el$46, "fg", _v$15, _p$.t));
              _v$16 !== _p$.a && (_p$.a = _$setProp(_el$49, "fg", _v$16, _p$.a));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined
            });
            return _el$44;
          })()
        });
      }
    }));
    _$insertNode(_el$40, _$createTextNode(`esc closes`));
    _$effect(_p$ => {
      var _v$0 = theme().text,
        _v$1 = theme().textMuted,
        _v$10 = tab() === "all" ? theme().accent || "#8b5cf6" : theme().textMuted,
        _v$11 = tab() === "preference" ? theme().accent || "#8b5cf6" : theme().textMuted,
        _v$12 = tab() === "skill" ? theme().accent || "#8b5cf6" : theme().textMuted,
        _v$13 = theme().textMuted;
      _v$0 !== _p$.e && (_p$.e = _$setProp(_el$29, "fg", _v$0, _p$.e));
      _v$1 !== _p$.t && (_p$.t = _$setProp(_el$32, "fg", _v$1, _p$.t));
      _v$10 !== _p$.a && (_p$.a = _$setProp(_el$35, "fg", _v$10, _p$.a));
      _v$11 !== _p$.o && (_p$.o = _$setProp(_el$36, "fg", _v$11, _p$.o));
      _v$12 !== _p$.i && (_p$.i = _$setProp(_el$37, "fg", _v$12, _p$.i));
      _v$13 !== _p$.n && (_p$.n = _$setProp(_el$40, "fg", _v$13, _p$.n));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined
    });
    return _el$27;
  })();
}

/**
 * OpenCode standard dialog popup for Interactive Line-Level Plan Review.
 */
function PlanReviewModal(props) {
  const theme = () => props.api?.theme?.current || {};
  const plan = () => getPlanReviewData(props.sessionID, props.directory);
  const lines = () => plan().lines;
  const [selectedIdx, setSelectedIdx] = createSignal(null);
  const [editingIdx, setEditingIdx] = createSignal(null);
  const [commentInput, setCommentInput] = createSignal("");
  const [comments, setComments] = createSignal({});
  const activeCommentsList = () => {
    const res = [];
    const rawMap = comments();
    for (const [lineStr, text] of Object.entries(rawMap)) {
      const lineNum = parseInt(lineStr, 10);
      const lineObj = lines().find(l => l.index === lineNum);
      if (text && text.trim()) {
        res.push({
          line: lineNum,
          lineText: lineObj?.raw || "",
          comment: text.trim()
        });
      }
    }
    return res;
  };

  // Save comment for current editing line
  const saveCurrentComment = () => {
    const idx = editingIdx();
    if (idx === null) return;
    const lineObj = lines()[idx];
    if (!lineObj) return;
    const lineNum = lineObj.index;
    const text = commentInput().trim();
    const next = {
      ...comments()
    };
    if (text) {
      next[lineNum] = text;
    } else {
      delete next[lineNum];
    }
    setComments(next);
    setEditingIdx(null);
  };
  const submitReview = async (approved = true) => {
    const formatted = formatReviewFeedback({
      planName: plan().planName,
      planFile: plan().planFile,
      comments: activeCommentsList(),
      approved
    });
    try {
      if (props.api?.client?.session?.prompt) {
        await props.api.client.session.prompt({
          sessionID: props.sessionID,
          parts: [{
            type: "text",
            text: formatted
          }]
        });
      }
    } catch {}
    if (props.onClose) {
      props.onClose();
    } else if (props.api?.ui?.dialog?.close) {
      props.api.ui.dialog.close();
    }
  };

  // Dynamic Navigation Hint Footer
  const navHint = () => {
    if (editingIdx() !== null) {
      return "⌨️ [Enter] Simpan Koreksi • [Ctrl+A] Approve & Kirim • [Esc] Batal Komentar";
    }
    if (selectedIdx() !== null) {
      return "⌨️ [↑/↓] Pindah Baris • [Enter] Bantah/Luruskan Baris Ini • [Ctrl+A] Approve Plan • [Esc] Batal Sorot";
    }
    return "⌨️ [↓] Mulai Sorot Baris • [Scroll] Baca • [Ctrl+A] Approve Plan • [Esc] Tutup";
  };
  return (() => {
    var _el$59 = _$createElement("box"),
      _el$60 = _$createElement("box"),
      _el$61 = _$createElement("text"),
      _el$62 = _$createElement("b"),
      _el$63 = _$createTextNode(`📋 Plan Line Reviewer: `),
      _el$64 = _$createElement("text"),
      _el$65 = _$createTextNode(` baris • `),
      _el$66 = _$createTextNode(` koreksi`),
      _el$70 = _$createElement("scrollbox"),
      _el$71 = _$createElement("box"),
      _el$72 = _$createElement("box"),
      _el$73 = _$createElement("text"),
      _el$74 = _$createElement("box"),
      _el$75 = _$createElement("text");
    _$insertNode(_el$59, _el$60);
    _$insertNode(_el$59, _el$70);
    _$insertNode(_el$59, _el$72);
    _$setProp(_el$59, "gap", 1);
    _$setProp(_el$59, "width", "100%");
    _$setProp(_el$59, "flexGrow", 1);
    _$setProp(_el$59, "paddingLeft", 2);
    _$setProp(_el$59, "paddingRight", 2);
    _$setProp(_el$59, "paddingBottom", 1);
    _$insertNode(_el$60, _el$61);
    _$insertNode(_el$60, _el$64);
    _$setProp(_el$60, "flexDirection", "row");
    _$setProp(_el$60, "justifyContent", "space-between");
    _$setProp(_el$60, "width", "100%");
    _$insertNode(_el$61, _el$62);
    _$insertNode(_el$62, _el$63);
    _$insert(_el$62, () => plan().planName, null);
    _$insertNode(_el$64, _el$65);
    _$insertNode(_el$64, _el$66);
    _$insert(_el$64, () => lines().length, _el$65);
    _$insert(_el$64, () => activeCommentsList().length, _el$66);
    _$insert(_el$59, _$createComponent(Show, {
      get when() {
        return plan().planFile;
      },
      get children() {
        var _el$67 = _$createElement("text"),
          _el$68 = _$createTextNode(`File: `),
          _el$69 = _$createElement("i");
        _$insertNode(_el$67, _el$68);
        _$insertNode(_el$67, _el$69);
        _$setProp(_el$67, "wrapMode", "word");
        _$insert(_el$69, () => plan().planFile);
        _$effect(_$p => _$setProp(_el$67, "fg", theme().textMuted, _$p));
        return _el$67;
      }
    }), _el$70);
    _$insertNode(_el$70, _el$71);
    _$setProp(_el$70, "width", "100%");
    _$setProp(_el$70, "flexGrow", 1);
    _$setProp(_el$70, "minHeight", 12);
    _$setProp(_el$70, "maxHeight", 30);
    _$setProp(_el$71, "flexDirection", "column");
    _$setProp(_el$71, "gap", 0);
    _$setProp(_el$71, "width", "100%");
    _$setProp(_el$71, "minWidth", 0);
    _$insert(_el$71, _$createComponent(Show, {
      get when() {
        return lines().length > 0;
      },
      get fallback() {
        return (() => {
          var _el$77 = _$createElement("text");
          _$insertNode(_el$77, _$createTextNode(`(Dokumen rencana belum memiliki isi teks. Gunakan /plan to-file &lt;nama&gt; terlebih dahulu)`));
          _$setProp(_el$77, "wrapMode", "word");
          _$effect(_$p => _$setProp(_el$77, "fg", theme().textMuted, _$p));
          return _el$77;
        })();
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return lines();
          },
          children: (line, idx) => {
            const isSelected = () => selectedIdx() === idx();
            const isEditing = () => editingIdx() === idx();
            const hasComment = () => Boolean(comments()[line.index]);
            return (() => {
              var _el$79 = _$createElement("box"),
                _el$80 = _$createElement("box"),
                _el$81 = _$createElement("text"),
                _el$82 = _$createTextNode(` |`),
                _el$83 = _$createElement("text");
              _$insertNode(_el$79, _el$80);
              _$setProp(_el$79, "flexDirection", "column");
              _$setProp(_el$79, "gap", 0);
              _$setProp(_el$79, "paddingLeft", 1);
              _$setProp(_el$79, "paddingRight", 1);
              _$insertNode(_el$80, _el$81);
              _$insertNode(_el$80, _el$83);
              _$setProp(_el$80, "flexDirection", "row");
              _$setProp(_el$80, "gap", 1);
              _$setProp(_el$80, "onMouseDown", () => {
                setSelectedIdx(idx());
              });
              _$insertNode(_el$81, _el$82);
              _$setProp(_el$81, "flexShrink", 0);
              _$insert(_el$81, () => String(line.index).padStart(3, " "), _el$82);
              _$setProp(_el$83, "wrapMode", "word");
              _$insert(_el$83, (() => {
                var _c$ = _$memo(() => line.type === "heading");
                return () => _c$() ? (() => {
                  var _el$92 = _$createElement("b");
                  _$insert(_el$92, () => line.raw);
                  return _el$92;
                })() : line.raw;
              })());
              _$insert(_el$79, _$createComponent(Show, {
                get when() {
                  return _$memo(() => !!hasComment())() && !isEditing();
                },
                get children() {
                  var _el$84 = _$createElement("box"),
                    _el$85 = _$createElement("text"),
                    _el$86 = _$createTextNode(`↳ 💬 Koreksi: `),
                    _el$87 = _$createElement("b");
                  _$insertNode(_el$84, _el$85);
                  _$setProp(_el$84, "flexDirection", "row");
                  _$setProp(_el$84, "gap", 1);
                  _$setProp(_el$84, "paddingLeft", 6);
                  _$setProp(_el$84, "paddingBottom", 0);
                  _$insertNode(_el$85, _el$86);
                  _$insertNode(_el$85, _el$87);
                  _$insert(_el$87, () => comments()[line.index]);
                  _$effect(_$p => _$setProp(_el$85, "fg", theme().warning || "#f59e0b", _$p));
                  return _el$84;
                }
              }), null);
              _$insert(_el$79, _$createComponent(Show, {
                get when() {
                  return isEditing();
                },
                get children() {
                  var _el$88 = _$createElement("box"),
                    _el$89 = _$createElement("text"),
                    _el$91 = _$createElement("text");
                  _$insertNode(_el$88, _el$89);
                  _$insertNode(_el$88, _el$91);
                  _$setProp(_el$88, "flexDirection", "column");
                  _$setProp(_el$88, "gap", 0);
                  _$setProp(_el$88, "paddingLeft", 6);
                  _$setProp(_el$88, "borderStyle", "single");
                  _$insertNode(_el$89, _$createTextNode(`💬 Masukkan arahan / koreksi untuk baris ini:`));
                  _$insert(_el$91, () => commentInput() || "<i>(Ketik koreksi...)</i>");
                  _$effect(_p$ => {
                    var _v$21 = theme().warning || "#f59e0b",
                      _v$22 = theme().warning || "#f59e0b",
                      _v$23 = theme().text;
                    _v$21 !== _p$.e && (_p$.e = _$setProp(_el$88, "borderColor", _v$21, _p$.e));
                    _v$22 !== _p$.t && (_p$.t = _$setProp(_el$89, "fg", _v$22, _p$.t));
                    _v$23 !== _p$.a && (_p$.a = _$setProp(_el$91, "fg", _v$23, _p$.a));
                    return _p$;
                  }, {
                    e: undefined,
                    t: undefined,
                    a: undefined
                  });
                  return _el$88;
                }
              }), null);
              _$effect(_p$ => {
                var _v$24 = isSelected() ? "single" : undefined,
                  _v$25 = isSelected() ? theme().accent || "#8b5cf6" : undefined,
                  _v$26 = isSelected() ? theme().accent || "#8b5cf6" : theme().textMuted,
                  _v$27 = isSelected() ? theme().text : line.type === "heading" ? theme().accent || "#8b5cf6" : line.type === "checkbox" || line.type === "bullet" ? theme().warning || "#f59e0b" : theme().textMuted;
                _v$24 !== _p$.e && (_p$.e = _$setProp(_el$79, "borderStyle", _v$24, _p$.e));
                _v$25 !== _p$.t && (_p$.t = _$setProp(_el$79, "borderColor", _v$25, _p$.t));
                _v$26 !== _p$.a && (_p$.a = _$setProp(_el$81, "fg", _v$26, _p$.a));
                _v$27 !== _p$.o && (_p$.o = _$setProp(_el$83, "fg", _v$27, _p$.o));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined
              });
              return _el$79;
            })();
          }
        });
      }
    }));
    _$insertNode(_el$72, _el$73);
    _$insertNode(_el$72, _el$74);
    _$setProp(_el$72, "flexDirection", "row");
    _$setProp(_el$72, "justifyContent", "space-between");
    _$setProp(_el$72, "width", "100%");
    _$setProp(_el$72, "paddingTop", 1);
    _$insert(_el$73, navHint);
    _$insertNode(_el$74, _el$75);
    _$setProp(_el$74, "flexDirection", "row");
    _$setProp(_el$74, "gap", 2);
    _$insertNode(_el$75, _$createTextNode(`[✔ Approve & Submit]`));
    _$setProp(_el$75, "onMouseDown", () => submitReview(true));
    _$effect(_p$ => {
      var _v$17 = theme().text,
        _v$18 = theme().textMuted,
        _v$19 = theme().textMuted,
        _v$20 = theme().success || "#10b981";
      _v$17 !== _p$.e && (_p$.e = _$setProp(_el$61, "fg", _v$17, _p$.e));
      _v$18 !== _p$.t && (_p$.t = _$setProp(_el$64, "fg", _v$18, _p$.t));
      _v$19 !== _p$.a && (_p$.a = _$setProp(_el$73, "fg", _v$19, _p$.a));
      _v$20 !== _p$.o && (_p$.o = _$setProp(_el$75, "fg", _v$20, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$59;
  })();
}
export const tui = async (api, options = {}) => {
  if (!api) return;
  const directory = options?.directory || process.cwd();
  const {
    config
  } = loadConfig();
  let currentSessionID = resolveActiveSessionID(api) || "";
  const unsubSession = createSessionSubscriber(api, nextSessionID => {
    if (nextSessionID) currentSessionID = nextSessionID;
  });

  // 1. Register TUI slash command palette layer (/memory and /plan review) based on enabled configs
  if (api.keymap?.registerLayer) {
    const commands = [];
    if (config?.memory?.enabled !== false) {
      commands.push({
        namespace: "palette",
        name: "oh-my-hook.memory",
        title: "Memory Inspector",
        desc: "Tampilkan popup modal memory rules",
        category: "oh-my-hook",
        slashName: "memory",
        run() {
          if (api.ui?.dialog?.replace) {
            api.ui.dialog.replace(() => _$createComponent(MemoryModal, {
              api: api,
              directory: directory
            }));
            if (api.ui.dialog.setSize) {
              api.ui.dialog.setSize("large");
            }
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
