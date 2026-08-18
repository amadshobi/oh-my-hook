/**
 * tui/src/index.tsx — OpenCode TUI Plugin for oh-my-hook.
 */
import { createSignal, Show, For } from "solid-js";
import { watchModeState, currentMode } from "./lib/mode-watch.js";
import { getMetrics, getMemoryRules } from "./lib/metrics.js";
import {
	resolveActiveSessionID,
	createSessionSubscriber,
} from "./lib/session.js";

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
		if (currentTab === "preference")
			return list.filter((r: any) => r.category === "preference");
		if (currentTab === "skill")
			return list.filter((r: any) => r.category !== "preference");
		return list;
	};

	const getTagColor = (cat: string) => {
		if (cat === "preference") return theme().accent || "#8b5cf6";
		if (cat === "project_skill") return theme().warning || "#f59e0b";
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
					{rules().length} active rule{rules().length === 1 ? "" : "s"}
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
						tab() === "preference"
							? theme().accent || "#8b5cf6"
							: theme().textMuted
					}
					onMouseDown={() => setTab("preference")}
				>
					{tab() === "preference" ? "● [Preferences]" : "○ Preferences"}
				</text>
				<text
					fg={
						tab() === "skill" ? theme().accent || "#8b5cf6" : theme().textMuted
					}
					onMouseDown={() => setTab("skill")}
				>
					{tab() === "skill" ? "● [Project Skills]" : "○ Project Skills"}
				</text>
			</box>

			<scrollbox width="100%" flexGrow={1} minHeight={8} maxHeight={28}>
				<box flexDirection="column" gap={1} width="100%" minWidth={0}>
					<Show
						when={filtered().length > 0}
						fallback={
							<text fg={theme().textMuted} wrapMode="word">
								(Belum ada memory rules tersimpan. Gunakan /remember atau
								koreksi respon agen di chat untuk merekam secara otomatis)
							</text>
						}
					>
						<For each={filtered()}>
							{(r: any) => (
								<box
									flexDirection="column"
									gap={0}
									borderStyle="single"
									borderColor={theme().border || "#374151"}
									paddingLeft={1}
									paddingRight={1}
								>
									<box flexDirection="row" gap={1}>
										<text fg={getTagColor(r.category)}>• [{r.category}]</text>
										<text fg={theme().text} wrapMode="word">
											<b>{r.content}</b>
										</text>
									</box>
									<Show when={r.rationale}>
										<text
											fg={theme().textMuted}
											wrapMode="word"
											paddingLeft={2}
										>
											<i>Alasan: {r.rationale}</i>
										</text>
									</Show>
									<Show when={r.triggers && r.triggers.length > 0}>
										<text
											fg={theme().textMuted}
											wrapMode="word"
											paddingLeft={2}
										>
											Triggers: {r.triggers.join(", ")} | Conf:{" "}
											{Math.round((r.confidence || 0.5) * 100)}%
										</text>
									</Show>
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

export const tui = async (api: any, options: any = {}) => {
	if (!api) return;

	const directory = options?.directory || process.cwd();
	let currentSessionID = resolveActiveSessionID(api) || "";

	const unsubSession = createSessionSubscriber(api, (nextSessionID) => {
		if (nextSessionID) currentSessionID = nextSessionID;
	});

	// 1. Register TUI slash command palette layer (Single source of truth for /memory)
	if (api.keymap?.registerLayer) {
		const unregisterLayer = api.keymap.registerLayer({
			commands: [
				{
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
				},
			],
			bindings: [],
		});

		if (api.lifecycle?.onDispose) {
			api.lifecycle.onDispose(unregisterLayer);
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
	id: "oh-my-hook-tui",
	tui,
};
