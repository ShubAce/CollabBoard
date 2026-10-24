/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import SegmentedTabs from "../components/ui/SegmentedTabs.jsx";
import { fadeUp, MOBILE_QUERY, staggerContainer } from "../lib/motion";
import useAuthStore from "../store/authStore";

const DAY_MS = 1000 * 60 * 60 * 24;

const STATUS_COLORS = {
	todo: "var(--col-todo)",
	in_progress: "var(--col-inprogress)",
	review: "var(--col-review)",
	done: "var(--col-done)",
};

const SECTIONS = [
	{ id: "overdue", label: "Overdue" },
	{ id: "today", label: "Due today" },
	{ id: "week", label: "Due this week" },
	{ id: "nodue", label: "No due date" },
];

const TAB_EMPTY = {
	all: { icon: "checkCircle", text: "Everything assigned to you is done." },
	week: { icon: "clock", text: "Nothing due this week." },
	overdue: { icon: "checkCircle", text: "No overdue tasks. Nice work." },
	done: { icon: "check", text: "No completed tasks yet." },
};

const GROUP_HEADER_STYLE = {
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "10px 16px 6px",
	fontSize: 11,
	fontWeight: 600,
	color: "var(--text-muted)",
	textTransform: "uppercase",
	letterSpacing: "0.08em",
	background: "var(--bg-surface-2)",
	borderBottom: "1px solid var(--border-subtle)",
};

const formatStatus = (value = "") => {
	const normalized = value.replace(/_/g, " ").trim();
	return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "To Do";
};

const getDueMeta = (dateValue) => {
	if (!dateValue) return { label: "No due date", tone: "muted" };
	const dueDate = new Date(dateValue);
	if (Number.isNaN(dueDate.getTime())) return { label: "Invalid date", tone: "muted" };
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const diffDays = Math.round((dueDate - startOfToday) / DAY_MS);
	if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "danger" };
	if (diffDays === 0) return { label: "Due today", tone: "danger" };
	if (diffDays === 1) return { label: "Due tomorrow", tone: "warning" };
	return { label: `Due ${dueDate.toLocaleDateString([], { weekday: "short" })}`, tone: "muted" };
};

const categorizeTasks = (tasks) => {
	const grouped = { overdue: [], today: [], week: [], nodue: [], done: [] };
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	tasks.forEach((task) => {
		if (task.status === "done") {
			grouped.done.push(task);
			return;
		}
		if (!task.dueDate) {
			grouped.nodue.push(task);
			return;
		}
		const dueDate = new Date(task.dueDate);
		if (Number.isNaN(dueDate.getTime())) {
			grouped.nodue.push(task);
			return;
		}
		const diffDays = Math.round((dueDate - startOfToday) / DAY_MS);
		if (diffDays < 0) grouped.overdue.push(task);
		else if (diffDays === 0) grouped.today.push(task);
		else if (diffDays <= 7) grouped.week.push(task);
		else grouped.nodue.push(task);
	});

	return grouped;
};

function StatusPill({ status }) {
	const color = STATUS_COLORS[status] || "var(--col-todo)";
	return (
		<span
			className="badge"
			style={{
				gap: 6,
				background: `color-mix(in srgb, ${color} 14%, transparent)`,
				color: status === "todo" || !STATUS_COLORS[status] ? "var(--text-secondary)" : color,
				whiteSpace: "nowrap",
			}}
		>
			<span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
			{formatStatus(status)}
		</span>
	);
}

function TaskRow({ task, compact }) {
	const due = getDueMeta(task.dueDate);
	const toneColor = due.tone === "danger" ? "var(--red)" : due.tone === "warning" ? "var(--orange)" : "var(--text-secondary)";
	const isDone = task.status === "done";
	return (
		<motion.div
			variants={fadeUp}
			className="row-hover"
			style={{
				display: "grid",
				gridTemplateColumns: compact ? "10px minmax(0, 1fr) auto" : "10px minmax(0, 1fr) 132px 110px",
				alignItems: "center",
				columnGap: compact ? 12 : 16,
				padding: compact ? "12px 14px" : "12px 16px",
				minHeight: compact ? 60 : 56,
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<span
				title={task.priority ? `${task.priority} priority` : undefined}
				style={{
					width: 8,
					height: 8,
					borderRadius: "50%",
					background: task.priorityColor || "var(--text-muted)",
					boxShadow: `0 0 0 3px color-mix(in srgb, ${task.priorityColor || "var(--text-muted)"} 18%, transparent)`,
				}}
			/>
			<div style={{ minWidth: 0 }}>
				<p
					style={{
						margin: 0,
						fontSize: 14,
						fontWeight: 500,
						color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
						textDecoration: isDone ? "line-through" : "none",
						textDecorationColor: "var(--text-muted)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{task.title}
				</p>
				<p
					style={{
						margin: "4px 0 0",
						fontSize: 12,
						color: "var(--text-muted)",
						display: "flex",
						alignItems: "center",
						gap: 6,
						minWidth: 0,
					}}
				>
					<Icon
						name="kanban"
						size={12}
					/>
					<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.boardName}</span>
					{compact && (
						<>
							<span aria-hidden="true">·</span>
							<span style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{formatStatus(task.status)}</span>
						</>
					)}
				</p>
			</div>
			{!compact && (
				<span>
					<StatusPill status={task.status} />
				</span>
			)}
			<span
				style={{
					fontSize: 12,
					color: toneColor,
					fontWeight: 600,
					whiteSpace: "nowrap",
					textAlign: compact ? "right" : "left",
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{due.label}
			</span>
		</motion.div>
	);
}

function SkeletonRows({ compact }) {
	return (
		<div aria-hidden="true">
			<div style={GROUP_HEADER_STYLE}>
				<div
					className="skeleton"
					style={{ height: 10, width: 64, margin: "2px 0" }}
				/>
			</div>
			{[0.62, 0.45, 0.55, 0.38].map((width, index) => (
				<div
					key={index}
					style={{
						display: "grid",
						gridTemplateColumns: compact ? "10px minmax(0, 1fr) 64px" : "10px minmax(0, 1fr) 132px 110px",
						alignItems: "center",
						columnGap: 16,
						padding: "14px 16px",
						borderBottom: "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="skeleton"
						style={{ width: 8, height: 8, borderRadius: "50%" }}
					/>
					<div>
						<div
							className="skeleton"
							style={{ height: 13, width: `${width * 100}%`, marginBottom: 8 }}
						/>
						<div
							className="skeleton"
							style={{ height: 10, width: 72 }}
						/>
					</div>
					{!compact && (
						<div
							className="skeleton"
							style={{ height: 20, width: 84, borderRadius: 999 }}
						/>
					)}
					<div
						className="skeleton"
						style={{ height: 12, width: 64 }}
					/>
				</div>
			))}
		</div>
	);
}

export default function MyWorkPage() {
	const currentUser = useAuthStore((s) => s.user);
	const fallbackWorkspaceId = typeof window !== "undefined" ? localStorage.getItem("cb:last_workspace") : null;
	const workspaceId = fallbackWorkspaceId;
	const [workspace, setWorkspace] = useState(null);
	const [tasks, setTasks] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("all");
	const compact = useMediaQuery(MOBILE_QUERY);

	useEffect(() => {
		if (!workspaceId) {
			setStatus("empty");
			return;
		}
		let active = true;
		setStatus("loading");
		setError("");
		Promise.all([api.get(`/workspaces/${workspaceId}`), api.get(`/workspaces/${workspaceId}/boards`)])
			.then(async ([wsRes, boardsRes]) => {
				if (!active) return;
				setWorkspace(wsRes.data);
				const boards = boardsRes.data || [];
				if (!boards.length) {
					setTasks([]);
					setStatus("ready");
					return;
				}
				const boardResponses = await Promise.all(boards.map((board) => api.get(`/workspaces/${workspaceId}/boards/${board._id}`)));
				if (!active) return;
				const userId = currentUser?._id;
				const collected = [];
				boardResponses.forEach((res) => {
					const board = res.data;
					board.columns?.forEach((column) => {
						(column.tasks || []).forEach((task) => {
							const assigneeIds = (task.assignees || []).map((assignee) =>
								assignee?._id ? assignee._id.toString() : assignee?.toString?.(),
							);
							if (userId && !assigneeIds.includes(userId.toString())) return;
							collected.push({
								...task,
								boardName: board.name,
								priorityColor:
									task.priority === "urgent"
										? "var(--red)"
										: task.priority === "high"
											? "var(--orange)"
											: task.priority === "medium"
												? "var(--yellow)"
												: "var(--green)",
							});
						});
					});
				});
				setTasks(collected);
				setStatus("ready");
			})
			.catch((err) => {
				if (!active) return;
				setError(err.response?.data?.message || "Failed to load tasks");
				setStatus("error");
			});

		return () => {
			active = false;
		};
	}, [workspaceId, currentUser?._id]);

	const grouped = useMemo(() => categorizeTasks(tasks), [tasks]);

	const isReady = status === "ready";
	const tabItems = [
		{ value: "all", label: compact ? "All" : "All tasks", count: isReady ? tasks.length : undefined },
		{ value: "week", label: compact ? "This week" : "Due this week", count: isReady ? grouped.week.length : undefined },
		{ value: "overdue", label: "Overdue", count: isReady ? grouped.overdue.length : undefined },
		{ value: "done", label: "Done", count: isReady ? grouped.done.length : undefined },
	];

	if (status === "empty") {
		return (
			<motion.div
				variants={fadeUp}
				initial="hidden"
				animate="show"
				className="card"
				style={{ maxWidth: 520, margin: "48px auto 0", padding: "48px 24px", textAlign: "center" }}
			>
				<div className="icon-box icon-box-accent empty-state-icon empty-float">
					<Icon
						name="briefcase"
						size={22}
					/>
				</div>
				<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>No workspace selected</h2>
				<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Select a workspace to view your tasks.</p>
				<Link
					to="/app/workspaces"
					className="btn btn-primary btn-sm"
					style={{ marginTop: 20 }}
				>
					Go to workspaces
					<Icon
						name="arrowRight"
						size={12}
					/>
				</Link>
			</motion.div>
		);
	}

	const visibleSections =
		activeTab === "all"
			? SECTIONS.filter((section) => grouped[section.id].length > 0).map((section) => ({ ...section, tasks: grouped[section.id] }))
			: [{ id: activeTab, label: null, tasks: grouped[activeTab] || [] }];
	const tabEmpty = visibleSections.every((section) => section.tasks.length === 0) ? TAB_EMPTY[activeTab] : null;

	return (
		<motion.div
			variants={staggerContainer(0.08)}
			initial="hidden"
			animate="show"
			style={{ maxWidth: 960, margin: "0 auto" }}
		>
			<motion.div
				variants={fadeUp}
				style={{ marginBottom: 20 }}
			>
				<h1 className="page-title">My Work</h1>
				<p
					className="page-subtitle"
					style={{ marginTop: 6 }}
				>
					Everything assigned to you across {workspace?.name || "this workspace"}.
				</p>
			</motion.div>

			<motion.div
				variants={fadeUp}
				style={{ marginBottom: 16 }}
			>
				<SegmentedTabs
					id="my-work-tabs"
					items={tabItems}
					value={activeTab}
					onChange={setActiveTab}
				/>
			</motion.div>

			{status === "loading" && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					<SkeletonRows compact={compact} />
				</motion.div>
			)}

			{status === "error" && (
				<motion.div
					variants={fadeUp}
					className="message-error"
				>
					{error}
				</motion.div>
			)}

			{status === "ready" && tasks.length === 0 && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: "56px 24px", textAlign: "center" }}
				>
					<div className="icon-box icon-box-accent empty-state-icon empty-float">
						<Icon
							name="check"
							size={22}
						/>
					</div>
					<p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No tasks assigned yet.</p>
					<p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Tasks assigned to you on any board will show up here.</p>
				</motion.div>
			)}

			{status === "ready" && tasks.length > 0 && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{!compact && !tabEmpty && (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "10px minmax(0, 1fr) 132px 110px",
								columnGap: 16,
								padding: "10px 16px",
								fontSize: 11,
								fontWeight: 500,
								color: "var(--text-muted)",
								borderBottom: "1px solid var(--border-subtle)",
							}}
						>
							<span />
							<span>Task</span>
							<span>Status</span>
							<span>Due</span>
						</div>
					)}
					{tabEmpty ? (
						<motion.div
							key={`empty-${activeTab}`}
							variants={fadeUp}
							initial="hidden"
							animate="show"
							style={{ padding: "48px 24px", textAlign: "center" }}
						>
							<div className="icon-box icon-box-accent empty-state-icon empty-float">
								<Icon
									name={tabEmpty.icon}
									size={22}
								/>
							</div>
							<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>{tabEmpty.text}</p>
						</motion.div>
					) : (
						<motion.div
							key={activeTab}
							variants={staggerContainer(0.035, 0.05)}
							initial="hidden"
							animate="show"
						>
							{visibleSections.map((section) => (
								<div key={section.id}>
									{section.label && (
										<motion.div
											variants={fadeUp}
											style={GROUP_HEADER_STYLE}
										>
											<span style={section.id === "overdue" ? { color: "var(--red)" } : undefined}>{section.label}</span>
											<span style={{ color: "var(--text-muted)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{section.tasks.length}</span>
										</motion.div>
									)}
									{section.tasks.map((task) => (
										<TaskRow
											key={task._id}
											task={task}
											compact={compact}
										/>
									))}
								</div>
							))}
						</motion.div>
					)}
				</motion.div>
			)}
		</motion.div>
	);
}
