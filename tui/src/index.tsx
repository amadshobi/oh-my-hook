/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import { createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import {
	getMetrics,
	getMemoryRules,
	getPlanReviewData,
} from "./lib/metrics.js";
import {
	resolveActiveSessionID,
	createSessionSubscriber,
} from "./lib/session.js";
import { loadConfig } from "../../share/config.js";
import { formatReviewFeedback } from "../../plans/parser.js";

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

function SidebarWidget(props: {
	api: any;
	sessionID: () => string;
	directory: string;
}) {
	const [open, setOpen] = createSignal(true);
	const [modeState, setModeState] = createSignal({});
	const [metrics, setMetrics] = createSignal(getMetrics(props.directory));

	const unwatch = watchModeState((nextState) => {
		setModeState(nextState);
		setMetrics(getMetrics(props.directory));
	});

	const theme = () => props.api?.theme?.current || {};
	const mode = () =>
		props.sessionID() ? currentMode(modeState(), props.sessionID()) : "execute";
	const isPlan = () => mode() === "plan";
	const modeText = () => (isPlan() ? "🔒 Plan (Read-Only)" : "⚡ Execute");
	const modeColor = () =>
		isPlan() ? theme().warning || "#f59e0b" : theme().success || "#10b981";

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
						<text fg={theme().textMuted}>
							Guards: {metrics().guardsActive} Active
						</text>
					</box>
					<box flexDirection="row" gap={1}>
						<text flexShrink={0} fg={theme().textMuted}>
							•
						</text>
						<text fg={theme().textMuted}>
							Memory: {metrics().memoryNotes} Rules
						</text>
					</box>
				</box>
			</Show>
		</box>
	);
}

/**
 * OpenCode standard dialog popup for Memory Rules.
 * Matching native OpenCode / opencode-quota UI layout & styling.
 */
function MemoryModal(props: { api: any; directory: string }) {
	const theme = () => props.api?.theme?.current || {};
	const rules = () => getMemoryRules(props.directory);
	const [tab, setTab] = createSignal<"all" | "preference" | "skill">("all");

	const filtered = () => {
		const list = rules();
		const currentTab = tab();
		if (currentTab === "global")
			return list.filter((r: any) => r.scope === "global");
		if (currentTab === "project")
			return list.filter((r: any) => r.scope === "project");
		return list;
	};

	const getTagColor = (scope: string) => {
		if (scope === "global") return theme().accent || "#8b5cf6";
		return theme().success || "#10b981";
	};

	return (
		<box
			gap={1}
			width="100%"
			flexGrow={1}
			paddingLeft={2}
			paddingRight={2}
			paddingBottom={1}
		>
			<box flexDirection="row" justifyContent="space-between" width="100%">
				<text fg={theme().text}>
					<b>🧠 OpenCode Memory Inspector</b>
				</text>
				<text fg={theme().textMuted}>
					{rules().length} memory bullet{rules().length === 1 ? "" : "s"}
				</text>
			</box>

			{/* Tabs */}
			<box flexDirection="row" gap={2}>
				<text
					fg={tab() === "all" ? theme().accent || "#8b5cf6" : theme().textMuted}
					onMouseDown={() => setTab("all")}
				>
					{tab() === "all" ? "● [Semua]" : "○ Semua"}
				</text>
				<text
					fg={
						tab() === "global" ? theme().accent || "#8b5cf6" : theme().textMuted
					}
					onMouseDown={() => setTab("global")}
				>
					{tab() === "global" ? "● [Global]" : "○ Global"}
				</text>
				<text
					fg={
						tab() === "project"
							? theme().accent || "#8b5cf6"
							: theme().textMuted
					}
					onMouseDown={() => setTab("project")}
				>
					{tab() === "project" ? "● [Project]" : "○ Project"}
				</text>
			</box>

			<scrollbox width="100%" flexGrow={1} minHeight={8} maxHeight={28}>
				<box flexDirection="column" gap={1} width="100%" minWidth={0}>
					<Show
						when={filtered().length > 0}
						fallback={
							<text fg={theme().textMuted} wrapMode="word">
								(Belum ada memory tersimpan. Gunakan /remember atau tool memory
								untuk mencatat)
							</text>
						}
					>
						<For each={filtered()}>
							{(r: any) => (
								<box
									flexDirection="row"
									gap={1}
									borderStyle="single"
									borderColor={theme().border || "#374151"}
									paddingLeft={1}
									paddingRight={1}
								>
									<text fg={getTagColor(r.scope)}>• [{r.scope}]</text>
									<text fg={theme().text} wrapMode="word">
										{r.content}
									</text>
								</box>
							)}
						</For>
					</Show>
				</box>
			</scrollbox>
			<text fg={theme().textMuted}>esc closes</text>
		</box>
	);
}

/**
 * OpenCode standard dialog popup for Interactive Line-Level Plan Review.
 */
function PlanReviewModal(props: {
	api: any;
	sessionID: string;
	directory: string;
	onClose?: () => void;
}) {
	const theme = () => props.api?.theme?.current || {};
	const plan = () => getPlanReviewData(props.sessionID, props.directory);
	const lines = () => plan().lines;

	const [selectedIdx, setSelectedIdx] = createSignal<number | null>(null);
	const [editingIdx, setEditingIdx] = createSignal<number | null>(null);
	const [commentInput, setCommentInput] = createSignal<string>("");
	const [comments, setComments] = createSignal<Record<number, string>>({});

	const activeCommentsList = () => {
		const res: Array<{ line: number; lineText: string; comment: string }> = [];
		const rawMap = comments();
		for (const [lineStr, text] of Object.entries(rawMap)) {
			const lineNum = parseInt(lineStr, 10);
			const lineObj = lines().find((l: any) => l.index === lineNum);
			if (text && text.trim()) {
				res.push({
					line: lineNum,
					lineText: lineObj?.raw || "",
					comment: text.trim(),
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
		const next = { ...comments() };
		if (text) {
			next[lineNum] = text;
		} else {
			delete next[lineNum];
		}
		setComments(next);
		setEditingIdx(null);
	};

	const submitReview = async (approved: boolean = true) => {
		const formatted = formatReviewFeedback({
			planName: plan().planName,
			planFile: plan().planFile,
			comments: activeCommentsList(),
			approved,
		});

		try {
			if (props.api?.client?.session?.prompt) {
				await props.api.client.session.prompt({
					sessionID: props.sessionID,
					parts: [{ type: "text", text: formatted }],
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

	return (
		<box
			gap={1}
			width="100%"
			flexGrow={1}
			paddingLeft={2}
			paddingRight={2}
			paddingBottom={1}
		>
			<box flexDirection="row" justifyContent="space-between" width="100%">
				<text fg={theme().text}>
					<b>📋 Plan Line Reviewer: {plan().planName}</b>
				</text>
				<text fg={theme().textMuted}>
					{lines().length} baris • {activeCommentsList().length} koreksi
				</text>
			</box>

			<Show when={plan().planFile}>
				<text fg={theme().textMuted} wrapMode="word">
					File: <i>{plan().planFile}</i>
				</text>
			</Show>

			<scrollbox width="100%" flexGrow={1} minHeight={12} maxHeight={30}>
				<box flexDirection="column" gap={0} width="100%" minWidth={0}>
					<Show
						when={lines().length > 0}
						fallback={
							<text fg={theme().textMuted} wrapMode="word">
								(Dokumen rencana belum memiliki isi teks. Gunakan /plan to-file
								&lt;nama&gt; terlebih dahulu)
							</text>
						}
					>
						<For each={lines()}>
							{(line: any, idx) => {
								const isSelected = () => selectedIdx() === idx();
								const isEditing = () => editingIdx() === idx();
								const hasComment = () => Boolean(comments()[line.index]);

								return (
									<box
										flexDirection="column"
										gap={0}
										paddingLeft={1}
										paddingRight={1}
										borderStyle={isSelected() ? "single" : undefined}
										borderColor={
											isSelected() ? theme().accent || "#8b5cf6" : undefined
										}
									>
										<box
											flexDirection="row"
											gap={1}
											onMouseDown={() => {
												setSelectedIdx(idx());
											}}
										>
											<text
												flexShrink={0}
												fg={
													isSelected()
														? theme().accent || "#8b5cf6"
														: theme().textMuted
												}
											>
												{String(line.index).padStart(3, " ")} |
											</text>
											<text
												fg={
													isSelected()
														? theme().text
														: line.type === "heading"
															? theme().accent || "#8b5cf6"
															: line.type === "checkbox" ||
																	line.type === "bullet"
																? theme().warning || "#f59e0b"
																: theme().textMuted
												}
												wrapMode="word"
											>
												{line.type === "heading" ? <b>{line.raw}</b> : line.raw}
											</text>
										</box>

										{/* Inline comment display */}
										<Show when={hasComment() && !isEditing()}>
											<box
												flexDirection="row"
												gap={1}
												paddingLeft={6}
												paddingBottom={0}
											>
												<text fg={theme().warning || "#f59e0b"}>
													↳ 💬 Koreksi: <b>{comments()[line.index]}</b>
												</text>
											</box>
										</Show>

										{/* Inline editor box */}
										<Show when={isEditing()}>
											<box
												flexDirection="column"
												gap={0}
												paddingLeft={6}
												borderStyle="single"
												borderColor={theme().warning || "#f59e0b"}
											>
												<text fg={theme().warning || "#f59e0b"}>
													💬 Masukkan arahan / koreksi untuk baris ini:
												</text>
												<text fg={theme().text}>
													{commentInput() || "<i>(Ketik koreksi...)</i>"}
												</text>
											</box>
										</Show>
									</box>
								);
							}}
						</For>
					</Show>
				</box>
			</scrollbox>

			<box
				flexDirection="row"
				justifyContent="space-between"
				width="100%"
				paddingTop={1}
			>
				<text fg={theme().textMuted}>{navHint()}</text>
				<box flexDirection="row" gap={2}>
					<text
						fg={theme().success || "#10b981"}
						onMouseDown={() => submitReview(true)}
					>
						[✔ Approve & Submit]
					</text>
				</box>
			</box>
		</box>
	);
}

export const tui = async (api: any, options: any = {}) => {
	if (!api) return;

	const directory = options?.directory || process.cwd();
	const { config } = loadConfig();
	let currentSessionID = resolveActiveSessionID(api) || "";

	const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
		if (nextSessionID) currentSessionID = nextSessionID;
	});

	// 1. Register TUI slash command palette layer (/memory and /plan review) based on enabled configs
	if (api.keymap?.registerLayer) {
		const commands: any[] = [];

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
						api.ui.dialog.replace(() => (
							<MemoryModal api={api} directory={directory} />
						));
						if (api.ui.dialog.setSize) {
							api.ui.dialog.setSize("large");
						}
					}
				},
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
						const sess =
							currentSessionID || resolveActiveSessionID(api) || "default";
						api.ui.dialog.replace(() => (
							<PlanReviewModal
								api={api}
								sessionID={sess}
								directory={directory}
							/>
						));
						if (api.ui.dialog.setSize) {
							api.ui.dialog.setSize("large");
						}
					}
				},
			});
		}

		if (commands.length > 0) {
			const unregisterLayer = api.keymap.registerLayer({
				commands,
				bindings: [],
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
				session_prompt_right(_ctx: any, props: { session_id?: string }) {
					return (
						<ModeBadge
							api={api}
							sessionID={() =>
								props?.session_id ||
								currentSessionID ||
								resolveActiveSessionID(api) ||
								""
							}
						/>
					);
				},
				sidebar_content(_ctx: any, props: { session_id?: string }) {
					return (
						<SidebarWidget
							api={api}
							sessionID={() =>
								props?.session_id ||
								currentSessionID ||
								resolveActiveSessionID(api) ||
								""
							}
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
	id: "oh-my-hook",
	tui,
};
