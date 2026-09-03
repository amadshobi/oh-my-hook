/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import {
	createSignal,
	Show,
	For,
	onMount,
	onCleanup,
	createMemo,
	createEffect,
} from "solid-js";
import { watchModeState } from "./lib/mode-watch.js";
import { watchCompressStats } from "./lib/compress-watch.js";
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
import { loadModeState, currentMode, currentPlan } from "../../share/state.js";
import {
	appendMemory,
	replaceMemory,
	removeMemory,
	resolveTargetMemoryFile,
	getGlobalFile,
	listMemoryEntries,
} from "../../memory/store.js";
import { formatTokens, formatUSD, formatDuration } from "../../usage/format.js";
import { openReadonly, opencodeDbPath } from "../../usage/store-db.js";
import { getAgentTree } from "../../usage/tokens/tracker.js";

function ModeBadge(props: { api: any; sessionID: () => string }) {
	const [modeState, setModeState] = createSignal(loadModeState() || {});

	const unwatch = watchModeState((nextState) => {
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

	return (
		<Show when={isPlan()}>
			<box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
				<box
					backgroundColor={warningColor()}
					paddingLeft={1}
					paddingRight={1}
					flexShrink={0}
				>
					<text fg="#000000" wrapMode="none">
						<b>PLAN</b>
					</text>
				</box>
				<Show when={activePlan()}>
					<text fg={warningColor()} wrapMode="none">
						({activePlan()})
					</text>
				</Show>
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
	const [metrics, setMetrics] = createSignal({} as any);

	// Load initial metrics (async: reads opencode.db for context usage)
	getMetrics(props.directory, undefined, props.sessionID()).then(setMetrics);

	const unwatch = watchModeState((nextState) => {
		setModeState(nextState);
		getMetrics(props.directory, undefined, props.sessionID()).then(setMetrics);
	});

	const theme = () => props.api?.theme?.current || {};
	const sessID = () => props.sessionID();
	const activePlan = () =>
		sessID() ? currentPlan(modeState(), sessID()) : null;

	const mode = () =>
		sessID() ? currentMode(modeState(), sessID()) : "execute";
	const isPlan = () => mode() === "plan";

	// Status & Color Resolvers (No Emojis, Pure Color Coding)
	const redColor = () => theme().error || "#ef4444";
	const greenColor = () => theme().success || "#10b981";
	const yellowColor = () => theme().warning || "#f59e0b";
	const mutedColor = () => theme().textMuted || "#6b7280";
	const textNormal = () => theme().text || "#f3f4f6";
	const accentColor = () => theme().accent || "#8b5cf6";

	const isPluginActive = () =>
		metrics().guardsActive > 0 ||
		metrics().memoryEnabled ||
		metrics().compressEnabled ||
		metrics().modeEnabled;

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

	return (
		<box flexDirection="column" gap={0}>
			{/* Collapsible Header */}
			<box
				flexDirection="row"
				justifyContent="space-between"
				width="100%"
				onMouseDown={() => setOpen((x) => !x)}
			>
				<box flexDirection="row" gap={1}>
					<text fg={mutedColor()}>{open() ? "▼" : "▶"}</text>
					<text fg={textNormal()}>
						<b>oh-my-hook</b>
					</text>
				</box>
				<text fg={headerBadgeColor()}>{headerBadgeText()}</text>
			</box>

			<Show when={open()}>
				<box flexDirection="column" gap={0} paddingLeft={1} paddingTop={0}>
					{/* 1. Mode Status */}
					<box flexDirection="row" gap={1}>
						<text fg={mutedColor()}>•</text>
						<text fg={mutedColor()}>
							Mode:{" "}
							<Show
								when={metrics().modeEnabled}
								fallback={<span style={{ fg: redColor() }}>disabled</span>}
							>
								<span style={{ fg: isPlan() ? yellowColor() : greenColor() }}>
									{isPlan() ? "plan (read-only)" : "execute"}
								</span>
							</Show>
						</text>
					</box>

					{/* 1b. Active Plan details if in plan mode */}
					<Show when={activePlan()?.file}>
						<box
							flexDirection="row"
							gap={1}
							paddingLeft={2}
							onMouseDown={() => {
								if (props.api.ui?.dialog?.replace) {
									const sess = sessID() || "default";
									props.api.ui.dialog.replace(() => (
										<PlanReviewModal
											api={props.api}
											sessionID={sess}
											directory={props.directory}
										/>
									));
									if (props.api.ui.dialog.setSize) {
										props.api.ui.dialog.setSize("large");
									}
								}
							}}
						>
							<text fg={accentColor()}>↳</text>
							<text fg={textNormal()} wrapMode="none">
								<u>{activePlan()?.name || "active plan"}</u>
							</text>
						</box>
					</Show>

					{/* 2. Security Shields */}
					<box flexDirection="row" gap={1}>
						<text fg={mutedColor()}>•</text>
						<text fg={mutedColor()}>
							Shields:{" "}
							<Show
								when={metrics().sandboxEnabled}
								fallback={<span style={{ fg: redColor() }}>disabled</span>}
							>
								<span style={{ fg: greenColor() }}>
									{metrics().guardsActive} active
								</span>
							</Show>
						</text>
					</box>

					{/* 3. Curated Memory (Click to inspect all) */}
					<box
						flexDirection="row"
						gap={1}
						onMouseDown={() => {
							if (props.api.ui?.dialog?.replace && metrics().memoryEnabled) {
								props.api.ui.dialog.replace(() => (
									<MemoryModal
										api={props.api}
										directory={props.directory}
										scope="all"
									/>
								));
								if (props.api.ui.dialog.setSize) {
									props.api.ui.dialog.setSize("large");
								}
							}
						}}
					>
						<text fg={mutedColor()}>•</text>
						<text fg={mutedColor()}>
							Memory:{" "}
							<Show
								when={metrics().memoryEnabled}
								fallback={<span style={{ fg: redColor() }}>disabled</span>}
							>
								<span style={{ fg: textNormal() }}>
									{metrics().memoryStats.global} global ·{" "}
									{metrics().memoryStats.project} project
								</span>
							</Show>
						</text>
					</box>

					{/* 4. Context Pruning & Savings removed from sidebar per user instruction */}
				</box>
			</Show>
		</box>
	);
}

const MEMORY_CATEGORY_LABELS: Record<string, string> = {
	user: "USER PROFILE",
	global: "GLOBAL MEMORY",
	project: "PROJECT MEMORY",
};

/**
 * Native OpenCode DialogSelect & DialogPrompt based Memory Inspector.
 * Supports 3 scoped views:
 *   - "all": Inspect All Memory (Edit/Replace on Enter)
 *   - "global": Inspect Global Memory (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 *   - "project": Inspect Project Rules (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 */ function MemoryModal(props: {
	api: any;
	directory: string;
	scope?: "all" | "user" | "global" | "project";
}) {
	const currentScope = () => props.scope || "all";
	const [refreshKey, setRefreshKey] = createSignal(0);
	const [toDelete, setToDelete] = createSignal<string | null>(null);
	const [currentSelected, setCurrentSelected] = createSignal<any>(null);

	const entries = createMemo(() => {
		refreshKey(); // reactive dependency
		const all = listMemoryEntries(props.directory);
		if (currentScope() === "user")
			return all.filter((e) => (e.target || e.scope) === "user");
		if (currentScope() === "global")
			return all.filter((e) => (e.target || e.scope) === "global");
		if (currentScope() === "project")
			return all.filter((e) => (e.target || e.scope) === "project");
		return all;
	});

	const projectName = () => props.directory.split("/").pop() || "project";

	const modalTitle = () => {
		if (currentScope() === "user") return "User Profile";
		if (currentScope() === "global") return "Global Memory";
		if (currentScope() === "project") return "Project Memory";
		return "Memory Inspector";
	};

	const showEdit = (item: any) => {
		if (!props.api.ui?.DialogPrompt) return;
		props.api.ui.dialog.replace(() => (
			<props.api.ui.DialogPrompt
				title={`Edit Memory (${item.scope})`}
				value={item.content}
				onConfirm={(newText: string) => {
					const trimmed = (newText || "").trim();
					if (trimmed && trimmed !== item.content) {
						replaceMemory(item.file, item.content, trimmed);
						setRefreshKey((k) => k + 1);
						if (props.api.ui?.toast) {
							props.api.ui.toast({
								variant: "success",
								message: "Memory updated",
							});
						}
					}
					props.api.ui.dialog.replace(() => (
						<MemoryModal
							api={props.api}
							directory={props.directory}
							scope={props.scope}
						/>
					));
				}}
				onCancel={() => {
					props.api.ui.dialog.replace(() => (
						<MemoryModal
							api={props.api}
							directory={props.directory}
							scope={props.scope}
						/>
					));
				}}
			/>
		));
	};

	const showAdd = (targetScope: "project" | "global" = "project") => {
		if (!props.api.ui?.DialogPrompt) return;
		props.api.ui.dialog.replace(() => (
			<props.api.ui.DialogPrompt
				title={`Tambah Memory (${targetScope === "global" ? "Global" : "Project"})`}
				placeholder="Ketik catatan memory baru..."
				description={() => (
					<text fg={props.api.theme?.current?.textMuted}>
						{targetScope === "global"
							? "Disimpan ke global memory"
							: "Disimpan ke project memory"}
					</text>
				)}
				onConfirm={(text: string) => {
					const trimmed = (text || "").trim();
					if (trimmed) {
						const targetFile =
							targetScope === "global"
								? getGlobalFile()
								: resolveTargetMemoryFile(props.directory);
						appendMemory(targetFile, trimmed);
						setRefreshKey((k) => k + 1);
						if (props.api.ui?.toast) {
							props.api.ui.toast({
								variant: "success",
								message: `Memory added (${targetScope})`,
							});
						}
					}
					props.api.ui.dialog.replace(() => (
						<MemoryModal
							api={props.api}
							directory={props.directory}
							scope={props.scope}
						/>
					));
				}}
				onCancel={() => {
					props.api.ui.dialog.replace(() => (
						<MemoryModal
							api={props.api}
							directory={props.directory}
							scope={props.scope}
						/>
					));
				}}
			/>
		));
	};

	const handleDelete = (item: any) => {
		if (!item?.file || !item?.content) return;

		// Double-trigger delete confirmation pattern (ala OpenCode session delete)
		if (toDelete() === item.content) {
			removeMemory(item.file, item.content);
			setToDelete(null);
			setRefreshKey((k) => k + 1);
			if (props.api.ui?.toast) {
				props.api.ui.toast({
					variant: "success",
					message: "Memory deleted",
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
				commands: [
					{
						name: "omh.memory.modal.new",
						title: "Tambah memory (Ctrl+A)",
						run() {
							const sc = currentScope();
							showAdd(sc === "global" ? "global" : "project");
						},
					},
					{
						name: "omh.memory.modal.delete",
						title: "Hapus memory (Ctrl+D)",
						run() {
							const item = currentSelected() || entries()[0];
							if (item) {
								handleDelete(item);
							}
						},
					},
				],
				bindings: [
					{ key: "ctrl+a", cmd: "omh.memory.modal.new" },
					{ key: "ctrl+d", cmd: "omh.memory.modal.delete" },
				],
			});
			onCleanup(unregister);
		}
	});

	const options = createMemo(() => {
		const theme = props.api.theme?.current || {};
		return entries().map((e) => {
			const isDeleting = toDelete() === e.content;
			return {
				title: isDeleting
					? "Yakin mau hapus? Tekan Ctrl+D lagi untuk konfirmasi"
					: e.content,
				value: e,
				bg: isDeleting ? theme.error || "#ef4444" : undefined,
				category:
					currentScope() === "all"
						? MEMORY_CATEGORY_LABELS[e.target || e.scope] || "PROJECT MEMORY"
						: undefined,
				footer: isDeleting ? "Tekan Ctrl+D lagi" : undefined,
			};
		});
	});

	if (props.api.ui?.DialogSelect) {
		return (
			<box
				flexDirection="column"
				width="100%"
				flexGrow={1}
				justifyContent="space-between"
			>
				<props.api.ui.DialogSelect
					title={modalTitle()}
					placeholder={
						currentScope() === "global"
							? "Cari global memory..."
							: currentScope() === "project"
								? "Cari aturan project..."
								: "Cari memory..."
					}
					options={options()}
					onMove={(opt: any) => {
						setToDelete(null); // Reset delete confirmation on cursor movement
						setCurrentSelected(opt?.value || opt);
					}}
					onSelect={(opt: any) => {
						const item = opt?.value || opt;
						if (item) {
							showEdit(item);
						}
					}}
				/>
				{/* Native OpenCode Footer Action Bar */}
				<box
					flexDirection="row"
					justifyContent="space-between"
					width="100%"
					paddingLeft={4}
					paddingRight={2}
					paddingBottom={1}
					paddingTop={0}
					flexShrink={0}
				>
					<box flexDirection="row" gap={3}>
						<text>
							<span style={{ fg: props.api.theme?.current?.text }}>edit</span>{" "}
							<span style={{ fg: props.api.theme?.current?.textMuted }}>
								enter
							</span>
						</text>
						<Show when={currentScope() !== "all"}>
							<text>
								<span style={{ fg: props.api.theme?.current?.text }}>new</span>{" "}
								<span style={{ fg: props.api.theme?.current?.textMuted }}>
									ctrl+a
								</span>
							</text>
							<text>
								<span style={{ fg: props.api.theme?.current?.text }}>
									delete
								</span>{" "}
								<span style={{ fg: props.api.theme?.current?.textMuted }}>
									ctrl+d
								</span>
							</text>
						</Show>
					</box>
					<text fg={props.api.theme?.current?.textMuted}>
						{entries().length} note{entries().length === 1 ? "" : "s"}
					</text>
				</box>
			</box>
		);
	}

	// Fallback simple view
	return (
		<box gap={1} paddingLeft={2} paddingRight={2}>
			<text fg={props.api.theme?.current?.text}>
				<b>{modalTitle()}</b>
			</text>
			<For each={entries()}>
				{(e) => (
					<text fg={props.api.theme?.current?.textMuted}>
						• {e.content} ({e.scope})
					</text>
				)}
			</For>
		</box>
	);
}
/**
 * Interactive Plan Review Modal Component for OpenCode TUI.
 */
function PlanReviewModal(props: {
	api: any;
	sessionID: string;
	directory: string;
}) {
	const theme = () => props.api?.theme?.current || {};
	const planData = () => getPlanReviewData(props.sessionID, props.directory);

	const [selectedIndex, setSelectedIndex] = createSignal<number>(-1);
	const [commentMode, setCommentMode] = createSignal(false);
	const [commentDraft, setCommentDraft] = createSignal("");
	const [comments, setComments] = createSignal<
		Record<number, { text: string; raw: string }>
	>({});

	const lines = () => planData().lines;
	const selectedLine = () =>
		selectedIndex() >= 0 && selectedIndex() < lines().length
			? lines()[selectedIndex()]
			: null;

	const handleKeyDown = (e: any) => {
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
					setComments((prev) => ({
						...prev,
						[idx]: { text: draft, raw: line?.raw || "" },
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
			setSelectedIndex((prev) => Math.min(lines().length - 1, prev + 1));
			e.preventDefault?.();
			return;
		}

		if (key === "up" || key === "k") {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
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
			const feedback = formatReviewFeedback(
				planData().planName,
				comments(),
				true,
			);
			if (props.api.session?.prompt) {
				props.api.session.prompt({
					sessionID: props.sessionID,
					text: feedback,
				});
			}
			if (props.api.ui?.dialog?.clear) {
				props.api.ui.dialog.clear();
			}
			if (props.api.ui?.toast) {
				props.api.ui.toast({
					variant: "success",
					message: "Plan approved with comments",
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

	const getLineTypeColor = (type: string) => {
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
					<b>Interactive Plan Reviewer</b>
				</text>
				<text fg={theme().textMuted}>
					{planData().planName} · {lines().length} lines · {commentCount()}{" "}
					comment{commentCount() === 1 ? "" : "s"}
				</text>
			</box>

			<scrollbox width="100%" flexGrow={1} minHeight={12} maxHeight={28}>
				<box flexDirection="column" gap={0} width="100%" minWidth={0}>
					<Show
						when={lines().length > 0}
						fallback={
							<text fg={theme().textMuted}>
								(Dokumen rencana kosong atau belum dimuat)
							</text>
						}
					>
						<For each={lines()}>
							{(line: any, idx) => {
								const isSelected = () => selectedIndex() === idx();
								const hasComment = () => Boolean(comments()[idx()]);

								return (
									<box
										flexDirection="column"
										gap={0}
										paddingLeft={1}
										paddingRight={1}
										backgroundColor={
											isSelected() ? theme().bgSelected || "#1e293b" : undefined
										}
										borderStyle={isSelected() ? "single" : undefined}
										borderColor={
											isSelected() ? theme().accent || "#8b5cf6" : undefined
										}
									>
										<box flexDirection="row" gap={1}>
											<text
												fg={isSelected() ? theme().text : theme().textMuted}
											>
												{String(line.index).padStart(3, " ")} |
											</text>
											<text
												fg={getLineTypeColor(line.type)}
												wrapMode="word"
												flexGrow={1}
											>
												{line.raw}
											</text>
											<Show when={hasComment()}>
												<text fg={theme().warning || "#f59e0b"}>[comment]</text>
											</Show>
										</box>
										<Show when={hasComment()}>
											<box paddingLeft={6} paddingTop={0} paddingBottom={0}>
												<text fg={theme().warning || "#f59e0b"} wrapMode="word">
													<i>↳ {comments()[idx()]?.text}</i>
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

			<Show when={commentMode()}>
				<box
					flexDirection="column"
					gap={0}
					borderStyle="single"
					borderColor={theme().warning || "#f59e0b"}
					paddingLeft={1}
					paddingRight={1}
				>
					<text fg={theme().warning || "#f59e0b"}>
						<b>Tulis Komentar untuk Baris #{selectedLine()?.index}:</b>
					</text>
					<text fg={theme().textMuted}>"{selectedLine()?.raw}"</text>
					<text fg={theme().text}>
						{commentDraft() || "(ketik komentar...)"}
					</text>
				</box>
			</Show>

			<box flexDirection="row" justifyContent="space-between" width="100%">
				<text fg={theme().textMuted}>
					<Show
						when={commentMode()}
						fallback={
							"↓/↑ pilih baris · enter komentar · ctrl+a approve · esc tutup"
						}
					>
						ctrl+enter simpan · esc batal
					</Show>
				</text>
			</box>
		</box>
	);
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
function TokensTree(props: {
	api: any;
	sessionID: () => string;
	directory: string;
	config?: any;
}) {
	const [open, setOpen] = createSignal(true);
	const subConfig = props.config?.tokens || {};
	const showSubs = subConfig.showSubagents !== false;
	const [subOpen, setSubOpen] = createSignal(
		subConfig.subagentsCollapsed ? false : true,
	);
	const [tree, setTree] = createSignal<{
		main: any;
		subagents: any[];
	} | null>(null);

	// Refresh tree when session changes or mode state flips (activity proxy).
	createEffect(() => {
		const sid = props.sessionID();
		if (!sid) {
			setTree(null);
			return;
		}
		let cancelled = false;
		openReadonly(opencodeDbPath())
			.then((handle) => {
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
		const subs = t.subagents.reduce(
			(s, x) => s + (x.input || 0) + (x.output || 0),
			0,
		);
		return (t.main?.input || 0) + (t.main?.output || 0) + subs;
	};

	const modelName = (m: any) => {
		if (!m?.model) return "n/a";
		return m.model.split("/").pop();
	};

	// Per-node expand state (each subagent toggles independently).
	const TreeNode = (node: any) => {
		const [nodeOpen, setNodeOpen] = createSignal(true);
		return (
			<>
				<box
					flexDirection="row"
					gap={1}
					onMouseDown={() => setNodeOpen((x) => !x)}
				>
					<text fg={mutedColor()}>{nodeOpen() ? "▼" : "▶"}</text>
					<text fg={accentColor()}>
						<b>{node.agent || "agent"}</b>
					</text>
					<text fg={mutedColor()}>{modelName(node)}</text>
				</box>
				<Show when={nodeOpen()}>
					<box flexDirection="column" gap={0} paddingLeft={2}>
						<text fg={mutedColor()}>
							In :{" "}
							<span style={{ fg: textNormal() }}>
								{formatTokens(node.input)}
							</span>
						</text>
						<text fg={mutedColor()}>
							Out :{" "}
							<span style={{ fg: textNormal() }}>
								{formatTokens(node.output)}
							</span>
						</text>
						<Show when={node.reasoning > 0}>
							<text fg={mutedColor()}>
								Reasoning:{" "}
								<span style={{ fg: textNormal() }}>
									{formatTokens(node.reasoning)}
								</span>
							</text>
						</Show>
						<Show when={node.cacheRead > 0 || node.cacheWrite > 0}>
							<text fg={mutedColor()}>
								Cache R:{" "}
								<span style={{ fg: textNormal() }}>
									{formatTokens(node.cacheRead)}
								</span>
							</text>
						</Show>
						<text fg={mutedColor()}>
							Cost :{" "}
							<span style={{ fg: successColor() }}>{formatUSD(node.cost)}</span>
						</text>
					</box>
				</Show>
			</>
		);
	};

	return (
		<box flexDirection="column" gap={0}>
			<box flexDirection="row" gap={1} onMouseDown={() => setOpen((x) => !x)}>
				<text fg={mutedColor()}>{open() ? "▼" : "▶"}</text>
				<text fg={textNormal()}>
					<b>Tokens</b>
				</text>
				<text fg={mutedColor()}>
					{totalTokens() > 0 ? `(${formatTokens(totalTokens())})` : ""}
				</text>
			</box>

			<Show when={open() && tree()}>
				<box flexDirection="column" gap={0} paddingLeft={1}>
					{TreeNode(tree()!.main)}
					<Show when={showSubs && tree()!.subagents.length > 0}>
						<box
							flexDirection="row"
							gap={1}
							onMouseDown={() => setSubOpen((x) => !x)}
						>
							<text fg={mutedColor()}>{subOpen() ? "▼" : "▶"}</text>
							<text fg={textNormal()}>
								Subagents ({tree()!.subagents.length})
							</text>
						</box>
						<Show when={subOpen()}>
							<box flexDirection="column" gap={0} paddingLeft={2}>
								<For each={tree()!.subagents}>
									{(sub) => (
										<box flexDirection="column" gap={0} paddingLeft={1}>
											{TreeNode(sub)}
										</box>
									)}
								</For>
							</box>
						</Show>
					</Show>
					<LastTurnItem api={props.api} sessionID={props.sessionID} />
				</box>
			</Show>
		</box>
	);
}

/**
 * LastTurnItem — collapsible "Last Turn" nodes inside the Tokens tree.
 *
 * Shows the last completed assistant turn for the main agent (from reactive
 * TUI state) plus, optionally, the last turn of each subagent (from the
 * opencode.db tree). Subagent nodes are collapsed by default and can be
 * hidden entirely via usage.tokens.showSubagents.
 */
function LastTurnItem(props: { api: any; sessionID: () => string }) {
	// Default expanded — mobile users shouldn't need to tap to open it.
	const [open, setOpen] = createSignal(true);
	const theme = () => props.api?.theme?.current || {};
	const mutedColor = () => theme().textMuted || "#6b7280";
	const textNormal = () => theme().text || "#f3f4f6";
	const accentColor = () => theme().accent || "#8b5cf6";

	const [tick, setTick] = createSignal(0);
	const timer = setInterval(() => setTick((t) => t + 1), 2000);
	onCleanup(() => clearInterval(timer));

	const lastTurn = createMemo(() => {
		tick();
		const sid = props.sessionID();
		if (!sid) return null;
		const state = props.api?.state?.session;
		if (!state) return null;

		let msgs: any[] = [];
		try {
			msgs = state.messages(sid) ?? [];
		} catch {
			return null;
		}

		// Last completed assistant turn with real token data.
		const last = [...msgs]
			.reverse()
			.find(
				(m: any) =>
					m.role === "assistant" && m.tokens && (m.tokens.input || 0) > 0,
			);
		if (!last) return null;

		const t = last.tokens || {};
		return {
			input: t.input || 0,
			output: t.output || 0,
			reasoning: t.reasoning || 0,
			cacheRead: t.cache?.read || 0,
			cost: last.cost || 0,
			durationMs:
				last.time?.completed && last.time?.created
					? last.time.completed - last.time.created
					: null,
		};
	});

	// NOTE: call lastTurn() INSIDE JSX (not hoisted const) so the memo stays
	// reactive to the 2s tick — a static snapshot would never update.
	const renderTurnDetails = (t: any) => (
		<box flexDirection="column" gap={0} paddingLeft={1}>
			<text fg={mutedColor()}>
				In : <span style={{ fg: textNormal() }}>{formatTokens(t.input)}</span>
			</text>
			{t.cacheRead > 0 ? (
				<text fg={mutedColor()}>
					Cache :{" "}
					<span style={{ fg: textNormal() }}>{formatTokens(t.cacheRead)}</span>
				</text>
			) : null}
			<text fg={mutedColor()}>
				Out : <span style={{ fg: textNormal() }}>{formatTokens(t.output)}</span>
			</text>
			{t.reasoning > 0 ? (
				<text fg={mutedColor()}>
					Reasoning :{" "}
					<span style={{ fg: textNormal() }}>{formatTokens(t.reasoning)}</span>
				</text>
			) : null}
			{t.durationMs ? (
				<text fg={mutedColor()}>
					Time :{" "}
					<span style={{ fg: textNormal() }}>
						{formatDuration(t.durationMs)}
					</span>
				</text>
			) : null}
			{t.cost > 0 ? (
				<text fg={mutedColor()}>
					Cost : <span style={{ fg: accentColor() }}>{formatUSD(t.cost)}</span>
				</text>
			) : null}
		</box>
	);

	return (
		<box flexDirection="column" gap={0}>
			<Show when={lastTurn()}>
				{(turn) => (
					<>
						<box
							flexDirection="row"
							gap={1}
							wrapMode="none"
							onMouseDown={() => setOpen((x) => !x)}
						>
							<text fg={mutedColor()}>{open() ? "▼" : "▶"}</text>
							<text fg={textNormal()} wrapMode="none">
								<b>Last Turn (main)</b>
							</text>
						</box>
						<Show when={open()}>{renderTurnDetails(turn())}</Show>
					</>
				)}
			</Show>
		</box>
	);
}

/**
 * OpenCode TUI surface plugin entrypoint.
 */
export const tui = async function tui(api: any, options: any, meta: any) {
	const directory = options?.directory || process.cwd();
	const { config } = loadConfig();

	const [activeSessionID, setActiveSessionID] = createSignal<string>(
		resolveActiveSessionID(api) || "",
	);

	const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
		if (nextSessionID) setActiveSessionID(nextSessionID);
	});

	// Pruning toast notifications: bridge server-side pruning events to TUI
	// Compact single-line format without title or emoji to fit mobile screens
	if (config?.compress?.pruning?.toast?.enabled !== false) {
		const unsubCompress = watchCompressStats(
			({
				tool,
				target,
				tokens,
			}: {
				tool: string;
				target?: string;
				tokens: number;
			}) => {
				if (!api.ui?.toast) return;
				const cleanTarget = (target || tool || "tool").trim().slice(0, 12);
				const tokStr = formatTokens(tokens);
				api.ui.toast({
					variant: "info",
					message: `pruned ${cleanTarget}: ~${tokStr} tok`,
					duration: 3000,
				});
			},
			{
				cooldownMs: config?.compress?.pruning?.toast?.cooldownMs ?? 30000,
			},
		);
		if (api.lifecycle?.onDispose) {
			api.lifecycle.onDispose(unsubCompress);
		}
	}

	// 1. Register TUI command palette layer based on enabled configs
	if (api.keymap?.registerLayer) {
		const commands: any[] = [];

		if (config?.memory?.enabled !== false) {
			// 1a. Inspect All Memory
			commands.push({
				namespace: "palette",
				name: "oh-my-hook.memory",
				title: "Memory: All",
				desc: "Semua memory aktif",
				category: "oh-my-hook",
				run(input?: any) {
					if (api.ui?.dialog?.replace) {
						api.ui.dialog.replace(() => (
							<MemoryModal api={api} directory={directory} scope="all" />
						));
					}
				},
			});

			// 1b. Inspect Global Memory (Add / Edit / Delete)
			commands.push({
				namespace: "palette",
				name: "oh-my-hook.memory.global",
				title: "Memory: Global",
				desc: "Global memory",
				category: "oh-my-hook",
				run(input?: any) {
					if (api.ui?.dialog?.replace) {
						api.ui.dialog.replace(() => (
							<MemoryModal api={api} directory={directory} scope="global" />
						));
					}
				},
			});

			// 1c. Inspect Project Rules (Add / Edit / Delete)
			commands.push({
				namespace: "palette",
				name: "oh-my-hook.memory.project",
				title: "Memory: Project",
				desc: "Project memory",
				category: "oh-my-hook",
				run(input?: any) {
					if (api.ui?.dialog?.replace) {
						api.ui.dialog.replace(() => (
							<MemoryModal api={api} directory={directory} scope="project" />
						));
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

	// 2. Register UI slots (Sidebar, Prompt Badge, Sidebar Footer)
	if (api.slots?.register) {
		api.slots.register({
			id: "oh-my-hook-sidebar",
			order: 99,
			slots: {
				session_prompt_right(ctx: any, props: { session_id?: string }) {
					return (
						<ModeBadge
							api={api}
							sessionID={() => props?.session_id || ctx?.session_id || ""}
						/>
					);
				},
				sidebar_content(ctx: any, props: { session_id?: string }) {
					return (
						<box flexDirection="column" gap={1}>
							<SidebarWidget
								api={api}
								directory={directory}
								sessionID={() =>
									props?.session_id ||
									ctx?.session_id ||
									activeSessionID() ||
									resolveActiveSessionID(api) ||
									""
								}
							/>
							<Show when={config?.usage?.enabled !== false}>
								<TokensTree
									api={api}
									directory={directory}
									config={config?.usage}
									sessionID={() =>
										props?.session_id ||
										ctx?.session_id ||
										activeSessionID() ||
										resolveActiveSessionID(api) ||
										""
									}
								/>
							</Show>
						</box>
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
