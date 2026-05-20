import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

const DAY_MS = 1000 * 60 * 60 * 24;

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

function TaskRow({ task }) {
	const due = getDueMeta(task.dueDate);
	const toneColor = due.tone === "danger" ? "var(--red)" : due.tone === "warning" ? "var(--orange)" : "var(--text-secondary)";
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "16px minmax(0, 1fr) 140px 120px",
				alignItems: "center",
				gap: 12,
				padding: "10px 12px",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<span
				style={{
					width: 8,
					height: 8,
					borderRadius: "50%",
					background: task.priorityColor || "var(--text-muted)",
				}}
			/>
			<div style={{ minWidth: 0 }}>
				<p
					style={{
						margin: 0,
						fontSize: 14,
						fontWeight: 500,
						color: "var(--text-primary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{task.title}
				</p>
				<p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{task.boardName}</p>
			</div>
			<span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatStatus(task.status)}</span>
			<span style={{ fontSize: 12, color: toneColor, fontWeight: 600 }}>{due.label}</span>
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

	const tabItems = [
		{ id: "all", label: `All tasks (${tasks.length})` },
		{ id: "week", label: `Due this week (${grouped.week.length})` },
		{ id: "overdue", label: `Overdue (${grouped.overdue.length})` },
		{ id: "done", label: `Done (${grouped.done.length})` },
	];

	if (status === "empty") {
		return (
			<div
				className="card"
				style={{ padding: 24, textAlign: "center" }}
			>
				<div
					className="icon-box icon-box-accent"
					style={{ width: 44, height: 44, margin: "0 auto 12px" }}
				>
					<Icon
						name="briefcase"
						size={20}
					/>
				</div>
				<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Select a workspace to view your tasks.</p>
				<Link
					to="/app/workspaces"
					className="btn btn-primary btn-sm"
					style={{ marginTop: 16 }}
				>
					Go to workspaces
				</Link>
			</div>
		);
	}

	return (
		<div
			className="fade-in"
			style={{ maxWidth: 960, margin: "0 auto" }}
		>
			<div style={{ marginBottom: 24 }}>
				<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>My Work</h1>
				<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
					Everything assigned to you across {workspace?.name || "this workspace"}.
				</p>
			</div>

			<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
				{tabItems.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={`tab-button${activeTab === tab.id ? " active" : ""}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{status === "loading" && (
				<div
					className="card"
					style={{ padding: 24 }}
				>
					{[1, 2, 3].map((item) => (
						<div
							key={item}
							className="skeleton"
							style={{ height: 24, marginBottom: 12 }}
						/>
					))}
				</div>
			)}

			{status === "error" && <div className="message-error">{error}</div>}

			{status === "ready" && tasks.length === 0 && (
				<div
					className="card"
					style={{ padding: 24, textAlign: "center" }}
				>
					<div
						className="icon-box icon-box-accent"
						style={{ width: 44, height: 44, margin: "0 auto 12px" }}
					>
						<Icon
							name="check"
							size={20}
						/>
					</div>
					<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>No tasks assigned yet.</p>
				</div>
			)}

			{status === "ready" && tasks.length > 0 && (
				<div
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{activeTab === "all" && (
						<>
							{grouped.overdue.length > 0 && (
								<>
									<div
										style={{
											padding: "10px 12px",
											fontSize: 11,
											color: "var(--text-muted)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										Overdue
									</div>
									{grouped.overdue.map((task) => (
										<TaskRow
											key={task._id}
											task={task}
										/>
									))}
								</>
							)}
							{grouped.today.length > 0 && (
								<>
									<div
										style={{
											padding: "10px 12px",
											fontSize: 11,
											color: "var(--text-muted)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										Due today
									</div>
									{grouped.today.map((task) => (
										<TaskRow
											key={task._id}
											task={task}
										/>
									))}
								</>
							)}
							{grouped.week.length > 0 && (
								<>
									<div
										style={{
											padding: "10px 12px",
											fontSize: 11,
											color: "var(--text-muted)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										Due this week
									</div>
									{grouped.week.map((task) => (
										<TaskRow
											key={task._id}
											task={task}
										/>
									))}
								</>
							)}
							{grouped.nodue.length > 0 && (
								<>
									<div
										style={{
											padding: "10px 12px",
											fontSize: 11,
											color: "var(--text-muted)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										No due date
									</div>
									{grouped.nodue.map((task) => (
										<TaskRow
											key={task._id}
											task={task}
										/>
									))}
								</>
							)}
						</>
					)}
					{activeTab === "week" &&
						grouped.week.map((task) => (
							<TaskRow
								key={task._id}
								task={task}
							/>
						))}
					{activeTab === "overdue" &&
						grouped.overdue.map((task) => (
							<TaskRow
								key={task._id}
								task={task}
							/>
						))}
					{activeTab === "done" &&
						grouped.done.map((task) => (
							<TaskRow
								key={task._id}
								task={task}
							/>
						))}
				</div>
			)}
		</div>
	);
}
