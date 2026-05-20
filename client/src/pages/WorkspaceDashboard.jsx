/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#7c72ff", "#60a5fa", "#3dd68c", "#ff6b6b", "#f0c040", "#a78bfa", "#ff8c42", "#f472b6"];
const DAY_MS = 1000 * 60 * 60 * 24;

function getInitials(name = "") {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getColor(name = "") {
	let hash = 0;
	for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
	return WS_COLORS[Math.abs(hash) % WS_COLORS.length];
}

const getGreeting = (name) => {
	const hour = new Date().getHours();
	if (hour < 12) return `Good morning${name ? `, ${name}` : ""}`;
	if (hour < 17) return `Good afternoon${name ? `, ${name}` : ""}`;
	return `Good evening${name ? `, ${name}` : ""}`;
};

const formatFullDate = (value) => {
	return value.toLocaleDateString([], {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
};

const formatRelativeTime = (value) => {
	if (!value) return "";
	const diff = Date.now() - new Date(value).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
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

const withinWindow = (dateValue, days = 7) => {
	if (!dateValue) return false;
	const dueDate = new Date(dateValue);
	if (Number.isNaN(dueDate.getTime())) return false;
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const diffDays = Math.round((dueDate - startOfToday) / DAY_MS);
	return diffDays <= days && diffDays >= -days;
};

function SectionHeader({ title, action }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
			<span
				style={{
					fontSize: 12,
					fontWeight: 600,
					color: "var(--text-muted)",
					textTransform: "uppercase",
					letterSpacing: "0.08em",
					whiteSpace: "nowrap",
				}}
			>
				{title}
			</span>
			<div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
			{action}
		</div>
	);
}

function CreateBoardModal({ workspaceId, onClose, onCreated }) {
	const [name, setName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!name.trim()) return;
		setIsSubmitting(true);
		setError("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards`, { name: name.trim() });
			onCreated(data);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create board");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="modal-overlay"
			onClick={(event) => event.target === event.currentTarget && onClose()}
		>
			<div
				className="modal fade-in"
				style={{ maxWidth: 420 }}
			>
				<div className="modal-header">
					<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Create board</h2>
					<button
						type="button"
						onClick={onClose}
						style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
					>
						<Icon
							name="close"
							size={18}
						/>
					</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div
						className="modal-body"
						style={{ display: "flex", flexDirection: "column", gap: 14 }}
					>
						{error && <div className="message-error">{error}</div>}
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
								Board name
							</label>
							<input
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Sprint 4"
								required
								autoFocus
								className="input"
							/>
						</div>
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>
								Starts with default columns
							</label>
							<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
								{[
									{ label: "To Do", color: "var(--col-todo)" },
									{ label: "In Progress", color: "var(--col-inprogress)" },
									{ label: "Review", color: "var(--col-review)" },
									{ label: "Done", color: "var(--col-done)" },
								].map((c) => (
									<span
										key={c.label}
										className="badge"
										style={{ background: `${c.color}22`, color: c.color }}
									>
										{c.label}
									</span>
								))}
							</div>
						</div>
					</div>
					<div className="modal-footer">
						<button
							type="button"
							onClick={onClose}
							className="btn btn-ghost btn-sm"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting || !name.trim()}
							className="btn btn-primary btn-sm"
						>
							{isSubmitting ? "Creating..." : "Create board"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function TaskRow({ task }) {
	const due = getDueMeta(task.dueDate);
	const toneColor = due.tone === "danger" ? "var(--red)" : due.tone === "warning" ? "var(--orange)" : "var(--text-secondary)";
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "16px minmax(0, 1fr) auto",
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
			<span style={{ fontSize: 12, color: toneColor, fontWeight: 600 }}>{due.label}</span>
		</div>
	);
}

function BoardCard({ summary }) {
	return (
		<div
			className="card"
			style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
		>
			<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{summary.name}</p>
			<div
				style={{
					height: 8,
					borderRadius: 999,
					background: "var(--border-default)",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: `${summary.progress}%`,
						height: "100%",
						background: "var(--green)",
					}}
				/>
			</div>
			<div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--text-secondary)" }}>
				<span>{summary.counts.todo} To Do</span>
				<span>{summary.counts.inProgress} In Progress</span>
				<span>{summary.counts.review} Review</span>
			</div>
			<span style={{ fontSize: 11, color: "var(--text-muted)" }}>Updated {summary.updatedLabel}</span>
		</div>
	);
}

function TeamRow({ member }) {
	const avatarColor = getColor(member.user?.name || "");
	const online = Boolean(member.isOnline);
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "40px minmax(0, 1fr) auto",
				alignItems: "center",
				gap: 12,
				padding: "10px 12px",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div style={{ position: "relative" }}>
				<div
					style={{
						width: 36,
						height: 36,
						borderRadius: "50%",
						background: avatarColor,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "#fff",
						fontWeight: 600,
						fontSize: 12,
					}}
				>
					{getInitials(member.user?.name || "?")}
				</div>
				<div
					style={{
						position: "absolute",
						bottom: 0,
						right: 0,
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: online ? "var(--green)" : "var(--text-muted)",
						border: "2px solid var(--bg-surface-1)",
					}}
				/>
			</div>
			<div style={{ minWidth: 0 }}>
				<p
					style={{
						margin: 0,
						fontSize: 13,
						fontWeight: 600,
						color: "var(--text-primary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{member.user?.name || "Unknown"}
				</p>
				<p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{online ? "Available" : "Offline"}</p>
			</div>
			<span
				className="badge badge-muted"
				style={{ textTransform: "capitalize" }}
			>
				{member.role || "member"}
			</span>
		</div>
	);
}

export default function WorkspaceDashboard() {
	const { workspaceId } = useParams();
	const currentUser = useAuthStore((s) => s.user);
	const [workspace, setWorkspace] = useState(null);
	const [boards, setBoards] = useState([]);
	const [activity, setActivity] = useState([]);
	const [dueTasks, setDueTasks] = useState([]);
	const [boardSummaries, setBoardSummaries] = useState([]);
	const [summaryStatus, setSummaryStatus] = useState("idle");
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	useEffect(() => {
		if (!workspaceId) return;
		let active = true;
		setStatus("loading");
		setError("");
		setBoardSummaries([]);
		setDueTasks([]);
		setSummaryStatus("loading");
		Promise.all([
			api.get(`/workspaces/${workspaceId}`),
			api.get(`/workspaces/${workspaceId}/boards`),
			api.get(`/workspaces/${workspaceId}/activity?limit=5`),
		])
			.then(([wsRes, bRes, aRes]) => {
				if (!active) return;
				setWorkspace(wsRes.data);
				setBoards(bRes.data || []);
				setActivity(aRes.data.activity || []);
				setStatus("ready");

				const boardList = bRes.data || [];
				if (!boardList.length) {
					setBoardSummaries([]);
					setDueTasks([]);
					setSummaryStatus("empty");
					return;
				}

				Promise.all(boardList.map((board) => api.get(`/workspaces/${workspaceId}/boards/${board._id}`)))
					.then((responses) => {
						if (!active) return;
						const detailedBoards = responses.map((res) => res.data);
						const summaries = detailedBoards.map((board) => {
							const counts = { todo: 0, inProgress: 0, review: 0, done: 0 };
							let total = 0;
							let done = 0;
							board.columns?.forEach((column) => {
								const tasks = column.tasks || [];
								const title = column.title?.toLowerCase() || "";
								if (title.includes("done")) {
									counts.done += tasks.length;
									done += tasks.length;
								} else if (title.includes("progress")) {
									counts.inProgress += tasks.length;
								} else if (title.includes("review")) {
									counts.review += tasks.length;
								} else {
									counts.todo += tasks.length;
								}
								total += tasks.length;
							});
							const progress = total ? Math.round((done / total) * 100) : 0;
							return {
								id: board._id,
								name: board.name,
								counts,
								progress,
								updatedLabel: formatRelativeTime(board.updatedAt || board.createdAt),
							};
						});

						const userId = currentUser?._id;
						const tasks = [];
						detailedBoards.forEach((board) => {
							board.columns?.forEach((column) => {
								(column.tasks || []).forEach((task) => {
									const assigneeIds = (task.assignees || []).map((assignee) =>
										assignee?._id ? assignee._id.toString() : assignee?.toString?.(),
									);
									if (userId && !assigneeIds.includes(userId.toString())) return;
									if (!withinWindow(task.dueDate, 7)) return;
									tasks.push({
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

						const sorted = tasks
							.filter((task) => task.dueDate)
							.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
							.slice(0, 5);

						setBoardSummaries(summaries);
						setDueTasks(sorted);
						setSummaryStatus("ready");
					})
					.catch(() => {
						if (!active) return;
						setSummaryStatus("error");
					});
			})
			.catch((err) => {
				if (!active) return;
				setError(err.response?.data?.message || "Failed to load workspace");
				setStatus("error");
			});

		return () => {
			active = false;
		};
	}, [workspaceId, currentUser?._id]);

	if (status === "loading") {
		return (
			<div className="fade-in">
				<div
					className="skeleton"
					style={{ height: 28, width: 220, marginBottom: 10 }}
				/>
				<div
					className="skeleton"
					style={{ height: 14, width: 160, marginBottom: 28 }}
				/>
				<div
					className="skeleton"
					style={{ height: 120, marginBottom: 24 }}
				/>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="skeleton"
							style={{ height: 140 }}
						/>
					))}
				</div>
			</div>
		);
	}

	if (status === "error") return <div className="message-error">{error}</div>;

	const members = workspace?.members || [];
	const greeting = getGreeting(currentUser?.name || "");
	const todayLabel = formatFullDate(new Date());

	return (
		<section
			className="fade-in"
			style={{ display: "flex", flexDirection: "column", gap: 32 }}
		>
			<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
				<div>
					<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{greeting}</h1>
					<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
						Here is what is happening in {workspace?.name || "your workspace"}.
					</p>
				</div>
				<span
					className="badge badge-muted"
					style={{ alignSelf: "flex-start" }}
				>
					{todayLabel}
				</span>
			</div>

			<div>
				<SectionHeader
					title="My tasks due this week"
					action={
						<Link
							to="/app/my-work"
							style={{ fontSize: 12, color: "var(--accent)" }}
						>
							View all my tasks
						</Link>
					}
				/>
				<div
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{summaryStatus === "loading" && (
						<div style={{ padding: 16 }}>
							{[1, 2, 3].map((item) => (
								<div
									key={item}
									className="skeleton"
									style={{ height: 24, marginBottom: 10 }}
								/>
							))}
						</div>
					)}
					{summaryStatus === "error" && (
						<div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
							Unable to load task summary right now.
						</div>
					)}
					{summaryStatus !== "loading" && dueTasks.length === 0 && (
						<div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
							<div
								className="icon-box icon-box-accent"
								style={{ width: 42, height: 42, margin: "0 auto 12px" }}
							>
								<Icon
									name="check"
									size={18}
								/>
							</div>
							<p style={{ margin: 0, fontSize: 13 }}>No upcoming due tasks in the next week.</p>
						</div>
					)}
					{dueTasks.length > 0 && (
						<div>
							{dueTasks.map((task, index) => (
								<TaskRow
									key={`${task._id}-${index}`}
									task={task}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			<div>
				<SectionHeader
					title="Boards"
					action={
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => setShowCreate(true)}
						>
							+ New board
						</button>
					}
				/>
				{summaryStatus === "loading" && boardSummaries.length === 0 && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
						{[1, 2, 3].map((item) => (
							<div
								key={item}
								className="skeleton"
								style={{ height: 140 }}
							/>
						))}
					</div>
				)}
				{summaryStatus !== "loading" && boardSummaries.length === 0 && (
					<div
						className="card"
						style={{ padding: 24, textAlign: "center" }}
					>
						<div
							className="icon-box icon-box-accent"
							style={{ width: 44, height: 44, margin: "0 auto 12px" }}
						>
							<Icon
								name="board"
								size={20}
							/>
						</div>
						<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Create your first board to get started.</p>
					</div>
				)}
				{boardSummaries.length > 0 && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
						{boardSummaries.map((summary) => (
							<Link
								key={summary.id}
								to={`/app/workspaces/${workspaceId}/boards/${summary.id}`}
								style={{ textDecoration: "none" }}
							>
								<BoardCard summary={summary} />
							</Link>
						))}
					</div>
				)}
			</div>

			<div>
				<SectionHeader
					title="Recent activity"
					action={
						<Link
							to={`/app/workspaces/${workspaceId}/activity`}
							style={{ fontSize: 12, color: "var(--accent)" }}
						>
							View all activity
						</Link>
					}
				/>
				<div
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{activity.length === 0 && (
						<div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-secondary)" }}>No recent activity yet.</div>
					)}
					{activity.map((log, index) => (
						<div
							key={log._id}
							style={{
								display: "grid",
								gridTemplateColumns: "32px minmax(0, 1fr) auto",
								gap: 12,
								padding: "12px 16px",
								borderBottom: index < activity.length - 1 ? "1px solid var(--border-subtle)" : "none",
							}}
						>
							<div
								style={{
									width: 28,
									height: 28,
									borderRadius: "50%",
									background: getColor(log.actor?.name || ""),
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 10,
									fontWeight: 700,
									color: "#fff",
								}}
							>
								{getInitials(log.actor?.name || "?")}
							</div>
							<div style={{ minWidth: 0 }}>
								<p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
									<span style={{ fontWeight: 600 }}>{log.actor?.name || "Unknown"}</span>{" "}
									{log.action?.replace(/[_\.]/g, " ") || "updated"}
								</p>
								{log.taskTitle && (
									<p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Task: {log.taskTitle}</p>
								)}
							</div>
							<span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatRelativeTime(log.createdAt)}</span>
						</div>
					))}
				</div>
			</div>

			<div>
				<SectionHeader title={`Team status (${members.length})`} />
				<div
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{members.map((member) => (
						<TeamRow
							key={member.user?._id || member.user}
							member={member}
						/>
					))}
				</div>
				<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
					<Link
						to={`/app/workspaces/${workspaceId}/settings`}
						style={{ fontSize: 12, color: "var(--accent)" }}
					>
						Manage members
					</Link>
				</div>
			</div>

			{showCreate && (
				<CreateBoardModal
					workspaceId={workspaceId}
					onClose={() => setShowCreate(false)}
					onCreated={(board) => {
						setBoards((prev) => [board, ...prev]);
						setBoardSummaries((prev) => [
							{
								id: board._id,
								name: board.name,
								counts: { todo: 0, inProgress: 0, review: 0, done: 0 },
								progress: 0,
								updatedLabel: "Just now",
							},
							...prev,
						]);
						setShowCreate(false);
					}}
				/>
			)}
		</section>
	);
}
