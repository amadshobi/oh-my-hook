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
} from "solid-js";
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
import { currentPlan } from "../../share/state.js";
import {
	appendMemory,
	replaceMemory,
	removeMemory,
	resolveTargetMemoryFile,
	getGlobalFile,
	listMemoryEntries,
} from "../../memory/store.js";

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
				<text fg={warningColor()}>PLAN MODE</text>
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

	const headerBadgeText = () => {
		if (!metrics().modeEnabled) return "OFF";
		return isPlan() ? "PLAN" : "EXEC";
	};

	const headerBadgeColor = () => {
		if (!metrics().modeEnabled) return redColor();
		return isPlan() ? yellowColor() : greenColor();
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

					{/* 4. Context Pruning & Savings */}
					<box flexDirection="row" gap={1}>
						<text fg={mutedColor()}>•</text>
						<text fg={mutedColor()}>
							Pruned:{" "}
							<Show
								when={metrics().compressEnabled}
								fallback={<span style={{ fg: redColor() }}>disabled</span>}
							>
								<span style={{ fg: textNormal() }}>
									{metrics().compress?.session?.prunedCount || 0} outputs
									{metrics().compress?.session?.tokensSaved > 0
										? ` · ~${metrics().compress.session.tokensSaved.toLocaleString()} tokens`
										: ""}
								</span>
							</Show>
						</text>
					</box>
				</box>
			</Show>
		</box>
	);
}

/**
 * Native OpenCode DialogSelect & DialogPrompt based Memory Inspector.
 * Supports 3 scoped views:
 *   - "all": Inspect All Memory (Edit/Replace on Enter)
 *   - "global": Inspect Global Memory (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 *   - "project": Inspect Project Rules (Add via Ctrl+N, Delete via Ctrl+D 2x, Edit on Enter)
 */
function MemoryModal(props: {
	api: any;
	directory: string;
	scope?: "all" | "global" | "project";
}) {
	const currentScope = () => props.scope || "all";
	const [refreshKey, setRefreshKey] = createSignal(0);
	const [toDelete, setToDelete] = createSignal<string | null>(null);
	const [currentSelected, setCurrentSelected] = createSignal<any>(null);

	const entries = createMemo(() => {
		refreshKey(); // reactive dependency
		const all = listMemoryEntries(props.directory);
		if (currentScope() === "global")
			return all.filter((e) => e.scope === "global");
		if (currentScope() === "project")
			return all.filter((e) => e.scope === "project");
		return all;
	});

	const projectName = () => props.directory.split("/").pop() || "project";

	const modalTitle = () => {
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
						? e.scope === "global"
							? "GLOBAL MEMORY"
							: "PROJECT MEMORY"
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
 * OpenCode TUI surface plugin entrypoint.
 */
export const tui = async function tui(api: any, options: any, meta: any) {
	const directory = options?.directory || process.cwd();
	const { config } = loadConfig();

	let currentSessionID = resolveActiveSessionID(api) || "";

	const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
		if (nextSessionID) currentSessionID = nextSessionID;
	});

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
							sessionID={() => props?.session_id || currentSessionID}
						/>
					);
				},
				sidebar_content(_ctx: any, props: { session_id?: string }) {
					return (
						<SidebarWidget
							api={api}
							directory={directory}
							sessionID={() => props?.session_id || currentSessionID}
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
