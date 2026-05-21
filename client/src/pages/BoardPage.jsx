/* eslint-disable react-hooks/refs */
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import Whiteboard from "../features/board/Whiteboard";
import { addTaskToColumn, moveTaskInBoard, removeTaskFromBoard, reorderColumns, updateTaskInBoard } from "../features/board/boardState";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { usePresence } from "../hooks/usePresence";

const COLUMN_THEMES = {
	todo: { className: "col-todo", accent: "var(--col-todo)", card: "var(--bg-surface-1)" },
	in_progress: { className: "col-progress", accent: "var(--col-inprogress)", card: "var(--bg-surface-1)" },
	review: { className: "col-review", accent: "var(--col-review)", card: "var(--bg-surface-1)" },
	done: { className: "col-done", accent: "var(--col-done)", card: "var(--bg-surface-1)" },
};

const PRIORITY_META = {
	urgent: { label: "Urgent", color: "var(--priority-urgent)", bg: "var(--red-muted)" },
	high: { label: "High", color: "var(--priority-high)", bg: "var(--orange-muted)" },
	medium: { label: "Medium", color: "var(--priority-medium)", bg: "var(--yellow-muted)" },
	low: { label: "Low", color: "var(--priority-low)", bg: "var(--green-muted)" },
};

const AVATAR_COLORS = ["#7c72ff", "#3dd68c", "#60a5fa", "#ff6b6b", "#f0c040", "#a78bfa", "#ff8c42"];

function getInitials(name = "") {
	return name
		.split(" ")
		.map((word) => word[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getAvatarColor(name = "") {
	let hash = 0;
	for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getColumnTheme(column, index) {
	const key = column.status || column.title?.toLowerCase().replace(/\s+/g, "_");
	return COLUMN_THEMES[key] || Object.values(COLUMN_THEMES)[index % 4];
}

function formatStatus(value = "") {
	if (!value) return "To Do";
	const normalized = value.replace(/_/g, " ").trim();
	return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "To Do";
}

function getDueMeta(dateValue) {
	if (!dateValue) return { label: "No due date", tone: "muted" };
	const dueDate = new Date(dateValue);
	if (Number.isNaN(dueDate.getTime())) return { label: "Invalid date", tone: "muted" };
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const diffDays = Math.round((dueDate - startOfToday) / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "danger" };
	if (diffDays === 0) return { label: "Due today", tone: "danger" };
	if (diffDays === 1) return { label: "Due tomorrow", tone: "warning" };
	return { label: `Due ${dueDate.toLocaleDateString([], { month: "short", day: "numeric" })}`, tone: "muted" };
}

function findTaskInBoard(board, taskId) {
	if (!board?.columns) return null;
	for (const column of board.columns) {
		const match = column.tasks?.find((task) => task._id?.toString() === taskId?.toString());
		if (match) return { task: match, column };
	}
	return null;
}

function PresenceStack({ users }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
			<div style={{ display: "flex", alignItems: "center" }}>
				{users.slice(0, 4).map((user, index) => (
					<div
						key={user.userId}
						className="avatar avatar-xs"
						title={user.name}
						style={{
							marginLeft: index ? -8 : 0,
							border: "2px solid var(--bg-surface-1)",
							background: "var(--bg-surface-3)",
							overflow: "hidden",
						}}
					>
						{user.avatar ? (
							<img
								src={user.avatar}
								alt={user.name}
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						) : (
							getInitials(user.name || "?")
						)}
					</div>
				))}
				{users.length > 4 && (
					<div
						className="avatar avatar-xs"
						style={{ marginLeft: -8, border: "2px solid var(--bg-surface-1)", color: "var(--text-secondary)" }}
					>
						+{users.length - 4}
					</div>
				)}
			</div>
			<span style={{ fontSize: 12, color: "var(--text-muted)" }}>{users.length} online</span>
		</div>
	);
}

function AssigneeStack({ assignees = [], max = 3 }) {
	if (!assignees.length) {
		return <span className="task-meta-muted">Unassigned</span>;
	}
	return (
		<div className="task-assignees">
			{assignees.slice(0, max).map((assignee, index) => (
				<div
					key={assignee?._id || index}
					className="avatar avatar-xs"
					title={assignee?.name || "Assignee"}
					style={{ marginLeft: index ? -6 : 0, background: getAvatarColor(assignee?.name || "") }}
				>
					{assignee?.avatar ? (
						<img
							src={assignee.avatar}
							alt={assignee?.name || "Assignee"}
							style={{ width: "100%", height: "100%", objectFit: "cover" }}
						/>
					) : (
						getInitials(assignee?.name || "?")
					)}
				</div>
			))}
			{assignees.length > max && <span className="task-meta-muted">+{assignees.length - max}</span>}
		</div>
	);
}

function TaskCard({ task, provided, snapshot, columnTheme, onOpen }) {
	const priority = PRIORITY_META[task.priority || "medium"] || PRIORITY_META.medium;
	const due = getDueMeta(task.dueDate);
	const labels = task.labels || [];
	const attachmentsCount = task.attachments?.length || 0;
	const commentsCount = task.comments?.length || 0;
	const subTasks = task.subTasks || [];
	const completedSubTasks = subTasks.filter((subTask) => subTask.isDone).length;
	const subTaskProgress = subTasks.length ? Math.round((completedSubTasks / subTasks.length) * 100) : 0;
	const isBlocked = (task.dependencies?.blockedBy || []).length > 0;
	return (
		<div
			ref={provided.innerRef}
			{...provided.draggableProps}
			{...provided.dragHandleProps}
			className={`task-card card-enter${snapshot.isDragging ? " dragging" : ""}${isBlocked ? " blocked" : ""}`}
			role="button"
			onClick={() => {
				if (!snapshot.isDragging) onOpen?.();
			}}
			style={{
				...provided.draggableProps.style,
				background: columnTheme.card,
				borderColor: snapshot.isDragging ? columnTheme.accent : "var(--border)",
				boxShadow: snapshot.isDragging ? "0 10px 30px rgba(0,0,0,0.55)" : "var(--shadow-card)",
			}}
		>
			<div className="task-card-header">
				<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					<h4 className="task-card-title">{task.title}</h4>
					{isBlocked && <span className="task-blocked">Blocked</span>}
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<span
						className="task-priority-dot"
						style={{ background: priority.color }}
					/>
					<button
						type="button"
						className="task-options"
						onClick={(event) => event.stopPropagation()}
						aria-label="Task options"
					>
						<Icon
							name="menu"
							size={14}
						/>
					</button>
				</div>
			</div>
			{labels.length > 0 && (
				<div className="task-labels">
					{labels.slice(0, 2).map((label) => (
						<span
							key={label}
							className="task-pill"
						>
							{label}
						</span>
					))}
					{labels.length > 2 && <span className="task-pill">+{labels.length - 2}</span>}
				</div>
			)}
			{subTasks.length > 0 && (
				<div className="task-subtasks">
					<div className="task-subtask-bar">
						<div style={{ width: `${subTaskProgress}%` }} />
					</div>
					<span className="task-subtask-text">
						{completedSubTasks}/{subTasks.length} sub-tasks
					</span>
				</div>
			)}
			{task.description && <p className="task-card-description">{task.description}</p>}
			<div className="task-meta">
				<div className="task-meta-left">
					<AssigneeStack assignees={task.assignees} />
					{attachmentsCount > 0 && (
						<span className="task-meta-item">
							<Icon
								name="paperclip"
								size={12}
							/>{" "}
							{attachmentsCount}
						</span>
					)}
					{commentsCount > 0 && (
						<span className="task-meta-item">
							<Icon
								name="chat"
								size={12}
							/>{" "}
							{commentsCount}
						</span>
					)}
				</div>
				<span className={`task-due ${due.tone}`}>{due.label}</span>
			</div>
		</div>
	);
}

function ListRow({ task, column, onOpen }) {
	const priority = PRIORITY_META[task.priority || "medium"] || PRIORITY_META.medium;
	const due = getDueMeta(task.dueDate);
	const assigneeName = task.assignees?.[0]?.name || "Unassigned";
	return (
		<div
			className="board-list-row"
			onClick={onOpen}
			role="button"
			tabIndex={0}
			onKeyDown={(event) => {
				if (event.key === "Enter") onOpen?.();
			}}
		>
			<span
				className="task-priority-dot"
				style={{ background: priority.color }}
			/>
			<div className="board-list-title">
				<span>{task.title}</span>
				{task.labels?.length ? <span className="task-pill">{task.labels[0]}</span> : null}
			</div>
			<span className="board-list-meta">{assigneeName}</span>
			<span className="board-list-meta">{column?.title || formatStatus(task.status)}</span>
			<span className={`task-due ${due.tone}`}>{due.label}</span>
		</div>
	);
}

function TaskPanel({ task, column, onClose, onSubTaskAdd, onSubTaskToggle, onSubTaskDelete, onDependencyAdd, onDependencyRemove, onTaskFieldUpdate, onAssigneeAdd, onAssigneeRemove, onAttachmentAdd, onAttachmentRemove, relationOptions, workspaceMembers, workspaceId, boardId }) {
	const [activeTab, setActiveTab] = useState("comments");
	const [subTaskTitle, setSubTaskTitle] = useState("");
	const [subTaskBusy, setSubTaskBusy] = useState(false);
	const [relationBusy, setRelationBusy] = useState(false);
	const [relationForm, setRelationForm] = useState({ type: "blockedBy", taskId: "" });
	const [comments, setComments] = useState([]);
	const [commentText, setCommentText] = useState("");
	const [commentBusy, setCommentBusy] = useState(false);
	const [commentsLoading, setCommentsLoading] = useState(false);
	// Inline edit state
	const [descEdit, setDescEdit] = useState(task.description || "");
	const [titleEdit, setTitleEdit] = useState(task.title || "");
	const [dueDateEdit, setDueDateEdit] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
	const [newLabel, setNewLabel] = useState("");
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef(null);
	const due = getDueMeta(task.dueDate);
	const labels = task.labels || [];
	const attachments = task.attachments || [];
	const subTasks = task.subTasks || [];
	const completedSubTasks = subTasks.filter((s) => s.isDone).length;
	const subTaskProgress = subTasks.length ? Math.round((completedSubTasks / subTasks.length) * 100) : 0;
	const dependencies = task.dependencies || { blockedBy: [], blocking: [] };
	const blockedBy = dependencies.blockedBy || [];
	const blocking = dependencies.blocking || [];

	const relationMap = useMemo(() => {
		return new Map((relationOptions || []).map((item) => [item._id?.toString(), item]));
	}, [relationOptions]);

	// Sync local edits when task changes
	useEffect(() => {
		setDescEdit(task.description || "");
		setTitleEdit(task.title || "");
		setDueDateEdit(task.dueDate ? task.dueDate.slice(0, 10) : "");
	}, [task._id, task.description, task.title, task.dueDate]);

	// Load comments when task changes
	useEffect(() => {
		setSubTaskTitle("");
		setRelationForm({ type: "blockedBy", taskId: "" });
		setCommentText("");
		setComments([]);
		if (!task._id || !workspaceId || !boardId) return;
		setCommentsLoading(true);
		api
			.get(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${task._id}/comments`)
			.then(({ data }) => setComments(Array.isArray(data) ? data : []))
			.catch(() => {})
			.finally(() => setCommentsLoading(false));
	}, [task?._id, workspaceId, boardId]);

	const availableRelationTasks = useMemo(() => {
		const list = relationOptions || [];
		const selectedIds = new Set((relationForm.type === "blockedBy" ? blockedBy : blocking).map((id) => id.toString()));
		return list.filter((item) => {
			const id = item._id?.toString();
			return id && id !== task._id?.toString() && !selectedIds.has(id);
		});
	}, [relationOptions, relationForm.type, blockedBy, blocking, task?._id]);

	const handleAddSubTask = async () => {
		const title = subTaskTitle.trim();
		if (!title || subTaskBusy) return;
		setSubTaskBusy(true);
		try {
			await onSubTaskAdd?.(task._id, title);
			setSubTaskTitle("");
		} finally {
			setSubTaskBusy(false);
		}
	};

	const handleFileSelect = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			await onAttachmentAdd?.(task._id, file);
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleAddRelation = async () => {
		if (!relationForm.taskId || relationBusy) return;
		setRelationBusy(true);
		try {
			await onDependencyAdd?.(task._id, relationForm.type, relationForm.taskId);
			setRelationForm((prev) => ({ ...prev, taskId: "" }));
		} finally {
			setRelationBusy(false);
		}
	};

	const handleStatusChange = async (e) => {
		const newStatus = e.target.value;
		try {
			await onTaskFieldUpdate?.(task._id, { status: newStatus });
		} catch { /* ignore */ }
	};

	const handlePriorityChange = async (e) => {
		const newPriority = e.target.value;
		try {
			await onTaskFieldUpdate?.(task._id, { priority: newPriority });
		} catch { /* ignore */ }
	};

	const handleAddComment = async () => {
		const content = commentText.trim();
		if (!content || commentBusy) return;
		setCommentBusy(true);
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${task._id}/comments`, { content });
			setComments((prev) => [...prev, data]);
			setCommentText("");
		} catch { /* ignore */ } finally {
			setCommentBusy(false);
		}
	};

	const handleDeleteComment = async (commentId) => {
		try {
			await api.delete(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${task._id}/comments/${commentId}`);
			setComments((prev) => prev.filter((c) => c._id !== commentId));
		} catch { /* ignore */ }
	};

	const fmtCommentTime = (iso) => {
		const d = new Date(iso);
		const now = new Date();
		const diff = Math.floor((now - d) / 1000);
		if (diff < 60) return "just now";
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return d.toLocaleDateString([], { month: "short", day: "numeric" });
	};

	return (
		<aside className="task-panel">
			<div className="task-panel-header">
				<button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
					<Icon name="close" size={14} /> Close
				</button>
			</div>
			{/* Editable title */}
			<input
				className="task-panel-title-input"
				value={titleEdit}
				onChange={(e) => setTitleEdit(e.target.value)}
				onBlur={() => { if (titleEdit.trim() && titleEdit !== task.title) onTaskFieldUpdate?.(task._id, { title: titleEdit.trim() }); }}
				style={{
					width: "100%", background: "transparent", border: "none", borderBottom: "1px solid var(--border-subtle)",
					color: "var(--text-primary)", fontSize: 18, fontWeight: 600, padding: "8px 0", marginBottom: 4, outline: "none",
				}}
			/>
			<p className="task-panel-subtitle">
				{column?.title || formatStatus(task.status)}
			</p>
			<div className="task-panel-grid">
				<div>
					<label>Status</label>
					<select className="input" value={task.status || "todo"} onChange={handleStatusChange}>
						<option value="todo">To Do</option>
						<option value="in_progress">In Progress</option>
						<option value="review">Review</option>
						<option value="done">Done</option>
					</select>
				</div>
				<div>
					<label>Priority</label>
					<select className="input" value={task.priority || "medium"} onChange={handlePriorityChange}>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="urgent">Urgent</option>
					</select>
				</div>
				<div>
					<label>Assignees</label>
					<div className="task-panel-chip" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
						{(task.assignees || []).map((a) => (
							<span key={a._id} className="task-pill" style={{ display: "flex", alignItems: "center", gap: 4 }}>
								{a.name}
								<button type="button" style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex" }} onClick={() => onAssigneeRemove?.(task._id, a._id)}>
									<Icon name="close" size={12} />
								</button>
							</span>
						))}
						<select 
							className="input" 
							style={{ width: "auto", padding: "2px 8px", fontSize: 12 }} 
							value="" 
							onChange={(e) => {
								if (e.target.value) onAssigneeAdd?.(task._id, e.target.value);
							}}
						>
							<option value="">+ Assign</option>
							{(workspaceMembers || []).filter(m => !(task.assignees || []).some(a => a._id === m.user?._id)).map(m => (
								<option key={m.user?._id} value={m.user?._id}>{m.user?.name}</option>
							))}
						</select>
					</div>
				</div>
				<div>
					<label>Due date</label>
					<input
						type="date"
						className="input"
						value={dueDateEdit}
						onChange={(e) => {
							setDueDateEdit(e.target.value);
							onTaskFieldUpdate?.(task._id, { dueDate: e.target.value || null });
						}}
						style={{ colorScheme: "dark" }}
					/>
				</div>
				<div style={{ gridColumn: "1 / -1" }}>
					<label>Labels</label>
					<div className="task-panel-chip" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
						{labels.length ? labels.map((l) => (
							<span key={l} className="task-pill" style={{ display: "flex", alignItems: "center", gap: 4 }}>
								{l}
								<button type="button" style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex" }} onClick={() => onTaskFieldUpdate?.(task._id, { labels: labels.filter(label => label !== l) })}>
									<Icon name="close" size={12} />
								</button>
							</span>
						)) : <span className="task-meta-muted">No labels</span>}
						<input 
							type="text" 
							className="input" 
							placeholder="+ Add label" 
							value={newLabel}
							onChange={(e) => setNewLabel(e.target.value)}
							style={{ width: "100px", padding: "2px 8px", fontSize: 12 }}
							onKeyDown={(e) => {
								if (e.key === "Enter" && newLabel.trim()) {
									if (!labels.includes(newLabel.trim())) {
										onTaskFieldUpdate?.(task._id, { labels: [...labels, newLabel.trim()] });
									}
									setNewLabel("");
								}
							}}
						/>
					</div>
				</div>
			</div>

			<div className="task-panel-section">
				<h3>Description</h3>
				<textarea
					className="input"
					value={descEdit}
					onChange={(e) => setDescEdit(e.target.value)}
					onBlur={() => { if (descEdit !== task.description) onTaskFieldUpdate?.(task._id, { description: descEdit }); }}
					placeholder="Add a description..."
					rows={4}
					style={{ resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
				/>
			</div>

			<div className="task-panel-section">
				<h3>Relations</h3>
				<div className="task-relations">
					<div className="task-relations-group">
						<span className="task-relations-label">Blocked by</span>
						<div className="task-relations-row">
							{blockedBy.length === 0 && <span className="task-meta-muted">None</span>}
							{blockedBy.map((id) => {
								const related = relationMap.get(id.toString());
								return (
									<span key={`blocked-${id}`} className="task-relation-chip">
										<span>{related?.title || "Unknown task"}</span>
										<button type="button" onClick={() => onDependencyRemove?.(task._id, "blockedBy", id.toString())}><Icon name="close" size={12} /></button>
									</span>
								);
							})}
						</div>
					</div>
					<div className="task-relations-group">
						<span className="task-relations-label">Blocking</span>
						<div className="task-relations-row">
							{blocking.length === 0 && <span className="task-meta-muted">None</span>}
							{blocking.map((id) => {
								const related = relationMap.get(id.toString());
								return (
									<span key={`blocking-${id}`} className="task-relation-chip">
										<span>{related?.title || "Unknown task"}</span>
										<button type="button" onClick={() => onDependencyRemove?.(task._id, "blocking", id.toString())}><Icon name="close" size={12} /></button>
									</span>
								);
							})}
						</div>
					</div>
					<div className="task-relations-form">
						<select value={relationForm.type} onChange={(e) => setRelationForm((p) => ({ ...p, type: e.target.value }))} className="input">
							<option value="blockedBy">Blocked by</option>
						</select>
						<select value={relationForm.taskId} onChange={(e) => setRelationForm((p) => ({ ...p, taskId: e.target.value }))} className="input">
							<option value="">Select task...</option>
							{availableRelationTasks.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}
						</select>
						<button type="button" className="btn btn-ghost btn-sm" onClick={handleAddRelation} disabled={!relationForm.taskId || relationBusy}>
							{relationBusy ? "Linking..." : "Add"}
						</button>
					</div>
				</div>
			</div>

			<div className="task-panel-section">
				<h3>Sub-tasks</h3>
				{subTasks.length === 0 && <p className="task-meta-muted">No sub-tasks yet.</p>}
				{subTasks.length > 0 && (
					<div className="task-subtask-list">
						{subTasks.map((s) => (
							<label key={s._id} className={`task-subtask-item${s.isDone ? " done" : ""}`}>
								<input type="checkbox" checked={s.isDone} onChange={() => onSubTaskToggle?.(task._id, s._id, !s.isDone)} />
								<span>{s.title}</span>
								<button type="button" onClick={() => onSubTaskDelete?.(task._id, s._id)}><Icon name="close" size={12} /></button>
							</label>
						))}
					</div>
				)}
				<div className="task-subtask-add">
					<input
						value={subTaskTitle}
						onChange={(e) => setSubTaskTitle(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleAddSubTask()}
						placeholder="Add sub-task…"
						className="input"
					/>
					<button type="button" className="btn btn-primary btn-sm" onClick={handleAddSubTask} disabled={!subTaskTitle.trim() || subTaskBusy}>
						{subTaskBusy ? "Adding…" : "Add"}
					</button>
				</div>
				<div className="task-progress"><div style={{ width: `${subTaskProgress}%` }} /></div>
				{subTasks.length > 0 && <p className="task-meta-muted">{completedSubTasks}/{subTasks.length} completed</p>}
			</div>

			<div className="task-panel-section">
				<h3>Attachments {attachments.length > 0 && <span className="badge badge-muted" style={{ marginLeft: 6 }}>{attachments.length}</span>}</h3>
				{attachments.length > 0 && (
					<div className="task-panel-list">
						{attachments.map((item) => (
							<div key={item._id || item.url || item.name} className="task-panel-list-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<Icon name="paperclip" size={14} />
									<span style={{ fontSize: 13 }}>{item.name}</span>
								</div>
								<div style={{ display: "flex", gap: 4 }}>
									<a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }} title="Download"><Icon name="download" size={14} /></a>
									<button type="button" className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", color: "var(--danger)" }} title="Remove" onClick={() => onAttachmentRemove?.(task._id, item._id)}><Icon name="trash" size={14} /></button>
								</div>
							</div>
						))}
					</div>
				)}
				<input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
				<button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ marginTop: attachments.length ? 8 : 0, width: "100%", borderStyle: "dashed", justifyContent: "center" }}>
					{uploading ? "Uploading..." : <><Icon name="upload" size={14} /> Attach file (drag or click)</>}
				</button>
			</div>

			<div className="task-panel-section">
				<h3>Activity & Comments</h3>
				<div className="task-panel-tabs">
					<button type="button" className={`tab-button${activeTab === "comments" ? " active" : ""}`} onClick={() => setActiveTab("comments")}>
						Comments {comments.length > 0 && <span className="badge badge-muted" style={{ marginLeft: 4 }}>{comments.length}</span>}
					</button>
					<button type="button" className={`tab-button${activeTab === "history" ? " active" : ""}`} onClick={() => setActiveTab("history")}>
						History
					</button>
				</div>

				{activeTab === "comments" && (
					<>
						{commentsLoading && <p className="task-meta-muted">Loading comments…</p>}
						{!commentsLoading && comments.length === 0 && <p className="task-meta-muted">No comments yet. Be the first!</p>}
						{!commentsLoading && comments.length > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
								{comments.map((c) => {
									const avatarBg = c.author?.name
										? ["#7c72ff","#3dd68c","#60a5fa","#ff6b6b","#f0c040"][
												[...c.author.name].reduce((h, ch) => ch.charCodeAt(0) + ((h << 5) - h), 0) % 5
											]
										: "var(--bg-surface-3)";
									return (
										<div key={c._id} style={{ display: "flex", gap: 8 }}>
											<div className="avatar avatar-xs" style={{ background: avatarBg, flexShrink: 0 }}>
												{c.author?.name ? c.author.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?"}
											</div>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
													<span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.author?.name || "User"}</span>
													<span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtCommentTime(c.createdAt)}</span>
													<button
														type="button"
														style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px" }}
														onClick={() => handleDeleteComment(c._id)}
													>
														<Icon name="trash" size={11} />
													</button>
												</div>
												<p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{c.content}</p>
											</div>
										</div>
									);
								})}
							</div>
						)}
						<div className="task-panel-comment">
							<input
								className="input"
								placeholder="Write a comment…"
								value={commentText}
								onChange={(e) => setCommentText(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
							/>
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={handleAddComment}
								disabled={!commentText.trim() || commentBusy}
							>
								{commentBusy ? "Sending…" : "Send"}
							</button>
						</div>
					</>
				)}
				{activeTab === "history" && <p className="task-meta-muted">Activity history coming soon.</p>}
			</div>
		</aside>
	);
}
const SHORTCUTS = [
	{ keys: ["C"], action: "Create task in first column" },
	{ keys: ["?"], action: "Show keyboard shortcuts" },
	{ keys: ["Esc"], action: "Close panel / dismiss modal" },
	{ keys: ["←", "→"], action: "Switch board view" },
	{ keys: ["Ctrl", "K"], action: "Quick search (coming soon)" },
];

function ShortcutsModal({ onClose }) {
	useEffect(() => {
		const h = (e) => { if (e.key === "Escape") onClose(); };
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, [onClose]);

	return (
		<div
			style={{
				position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
				zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
			}}
			onClick={onClose}
		>
			<div
				className="card fade-in"
				style={{ padding: 28, minWidth: 380, maxWidth: 460 }}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
					<h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Keyboard shortcuts</h2>
					<button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
						<Icon name="close" size={14} />
					</button>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{SHORTCUTS.map(({ keys, action }) => (
						<div key={action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
							<span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{action}</span>
							<div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
								{keys.map((k) => (
									<kbd
										key={k}
										style={{
											display: "inline-flex", alignItems: "center", justifyContent: "center",
											minWidth: 26, height: 22, padding: "0 6px",
											background: "var(--bg-surface-3)", border: "1px solid var(--border-default)",
											borderRadius: "var(--r-sm)", fontSize: 11, fontWeight: 600,
											color: "var(--text-primary)", fontFamily: "monospace",
										}}
									>
										{k}
									</kbd>
								))}
							</div>
						</div>
					))}
				</div>
				<p style={{ margin: "20px 0 0", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
					Press <kbd style={{ padding: "1px 5px", background: "var(--bg-surface-3)", border: "1px solid var(--border-default)", borderRadius: 4, fontSize: 11 }}>Esc</kbd> to close
				</p>
			</div>
		</div>
	);
}

export default function BoardPage() {

	const { workspaceId, boardId } = useParams();
	const [board, setBoard] = useState(null);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [activeView, setActiveView] = useState("board");
	const [taskForm, setTaskForm] = useState({ columnId: null, title: "", description: "", priority: "medium" });
	const [taskError, setTaskError] = useState("");
	const [creatingTask, setCreatingTask] = useState(false);
	const [selectedTask, setSelectedTask] = useState(null);
	const [columnTitle, setColumnTitle] = useState("");
	const [creatingColumn, setCreatingColumn] = useState(false);
	const [columnError, setColumnError] = useState("");
	const [showShortcuts, setShowShortcuts] = useState(false);

	// Filters
	const [filterAssignee, setFilterAssignee] = useState("");
	const [filterPriority, setFilterPriority] = useState("");
	const [filterDue, setFilterDue] = useState(""); // "overdue", "today", "week"
	const hasFilters = Boolean(filterAssignee || filterPriority || filterDue);

	// Global keyboard shortcuts
	useEffect(() => {
		const handler = (e) => {
			const tag = document.activeElement?.tagName?.toLowerCase();
			const isEditing = ["input", "textarea", "select"].includes(tag) || document.activeElement?.isContentEditable;
			if (isEditing) return;
			if (e.key === "?" || e.key === "/") {
				e.preventDefault();
				setShowShortcuts((s) => !s);
			}
			if (e.key === "Escape") {
				setShowShortcuts(false);
				setSelectedTask(null);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	useEffect(() => {
		let isActive = true;
		const loadBoard = async () => {
			setStatus("loading");
			setError("");
			try {
				const { data } = await api.get(`/workspaces/${workspaceId}/boards/${boardId}`);
				if (isActive) {
					setBoard(data);
					setStatus("ready");
				}
			} catch (err) {
				if (isActive) {
					setError(err.response?.data?.message || "Failed to load board");
					setStatus("error");
				}
			}
		};

		if (workspaceId && boardId) loadBoard();
		return () => {
			isActive = false;
		};
	}, [workspaceId, boardId]);

	useBoardSocket(boardId, {
		onTaskCreated: ({ task }) => setBoard((prev) => addTaskToColumn(prev, task)),
		onTaskMoved: ({ taskId, fromColumnId, toColumnId, newOrder, status }) =>
			setBoard((prev) => moveTaskInBoard(prev, taskId, fromColumnId, toColumnId, newOrder, status ? { status } : {})),
		onTaskUpdated: ({ taskId, changes }) => setBoard((prev) => updateTaskInBoard(prev, taskId, changes)),
		onTaskDeleted: ({ taskId }) => setBoard((prev) => removeTaskFromBoard(prev, taskId)),
		onColumnsReordered: ({ orderedColumnIds }) => setBoard((prev) => reorderColumns(prev, orderedColumnIds)),
	});

	const onlineUsers = usePresence(workspaceId, boardId);
	const relationOptions = useMemo(() => {
		if (!board?.columns) return [];
		return board.columns.flatMap((column) => column.tasks || []);
	}, [board]);

	useEffect(() => {
		if (!selectedTask || !board) return;
		const match = findTaskInBoard(board, selectedTask.task?._id);
		if (!match) {
			setSelectedTask(null);
			return;
		}
		if (selectedTask.task === match.task && selectedTask.column === match.column) return;
		setSelectedTask({ task: match.task, column: match.column });
	}, [board, selectedTask]);

	useEffect(() => {
		if (!selectedTask) return;
		if (activeView !== "board" && activeView !== "list") setSelectedTask(null);
	}, [activeView, selectedTask]);

	const handleDragEnd = async (result) => {
		const { destination, source, draggableId, type } = result;
		if (!destination || !board) return;
		if (destination.droppableId === source.droppableId && destination.index === source.index) return;

		const previousBoard = board;
		if (type === "COLUMN") {
			const orderedColumnIds = [...(board.columns || [])]
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
				.map((column) => column._id.toString());
			orderedColumnIds.splice(source.index, 1);
			orderedColumnIds.splice(destination.index, 0, draggableId);
			setBoard((prev) => reorderColumns(prev, orderedColumnIds));
			try {
				await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/columns/reorder`, { orderedColumnIds });
			} catch {
				setBoard(previousBoard);
			}
			return;
		}

		const fromColumnId = source.droppableId;
		const toColumnId = destination.droppableId;
		const newOrder = destination.index;
		setBoard((prev) => moveTaskInBoard(prev, draggableId, fromColumnId, toColumnId, newOrder));
		try {
			await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${draggableId}/move`, { targetColumnId: toColumnId, newOrder });
		} catch {
			setBoard(previousBoard);
		}
	};

	const openTaskForm = (columnId) => {
		setTaskError("");
		setTaskForm({ columnId, title: "", description: "", priority: "medium" });
	};

	const closeTaskForm = () => {
		setTaskError("");
		setTaskForm({ columnId: null, title: "", description: "", priority: "medium" });
	};

	const handleCreateTask = async (event) => {
		event.preventDefault();
		if (!taskForm.columnId || !taskForm.title.trim()) return;
		setCreatingTask(true);
		setTaskError("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks`, {
				columnId: taskForm.columnId,
				title: taskForm.title.trim(),
				description: taskForm.description.trim(),
				priority: taskForm.priority,
			});
			setBoard((prev) => addTaskToColumn(prev, data));
			closeTaskForm();
		} catch (err) {
			setTaskError(err.response?.data?.message || "Failed to create task");
		} finally {
			setCreatingTask(false);
		}
	};

	const handleCreateColumn = async (event) => {
		event.preventDefault();
		if (!columnTitle.trim()) return;
		setCreatingColumn(true);
		setColumnError("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/columns`, {
				title: columnTitle.trim(),
			});
			setBoard((prev) => {
				if (!prev) return prev;
				return { ...prev, columns: [...(prev.columns || []), { ...data, tasks: [] }] };
			});
			setColumnTitle("");
		} catch (err) {
			setColumnError(err.response?.data?.message || "Failed to add column");
		} finally {
			setCreatingColumn(false);
		}
	};

	const handleSubTaskAdd = async (taskId, title) => {
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/subtasks`, { title });
			setBoard((prev) => updateTaskInBoard(prev, taskId, { subTasks: data.subTasks }));
		} catch {
			/* ignore */
		}
	};

	const handleSubTaskToggle = async (taskId, subTaskId, isDone) => {
		try {
			const { data } = await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/subtasks/${subTaskId}`, { isDone });
			setBoard((prev) => updateTaskInBoard(prev, taskId, { subTasks: data.subTasks }));
		} catch {
			/* ignore */
		}
	};

	const handleSubTaskDelete = async (taskId, subTaskId) => {
		try {
			const { data } = await api.delete(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/subtasks/${subTaskId}`);
			setBoard((prev) => updateTaskInBoard(prev, taskId, { subTasks: data.subTasks }));
		} catch {
			/* ignore */
		}
	};

	const handleTaskFieldUpdate = async (taskId, changes) => {
		try {
			await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`, changes);
			setBoard((prev) => updateTaskInBoard(prev, taskId, changes));
		} catch {
			/* ignore */
		}
	};

	const handleDependencyAdd = async (taskId, type, relatedId) => {

		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/dependencies`, { type, taskId: relatedId });
			if (data.task) {
				setBoard((prev) => updateTaskInBoard(prev, data.task._id, { dependencies: data.task.dependencies }));
			}
			if (data.relatedTask) {
				setBoard((prev) =>
					updateTaskInBoard(prev, data.relatedTask._id, {
						dependencies: data.relatedTask.dependencies,
					}),
				);
			}
		} catch {
			/* ignore */
		}
	};

	const handleDependencyRemove = async (taskId, type, relatedId) => {
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/dependencies/remove`, {
				type,
				taskId: relatedId,
			});
			if (data.task) {
				setBoard((prev) => updateTaskInBoard(prev, data.task._id, { dependencies: data.task.dependencies }));
			}
			if (data.relatedTask) {
				setBoard((prev) =>
					updateTaskInBoard(prev, data.relatedTask._id, {
						dependencies: data.relatedTask.dependencies,
					}),
				);
			}
		} catch {
			/* ignore */
		}
	};

	const handleAssigneeAdd = async (taskId, userId) => {
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/assignees`, { userId });
			setBoard((prev) => updateTaskInBoard(prev, taskId, { assignees: data.assignees }));
		} catch { /* ignore */ }
	};

	const handleAssigneeRemove = async (taskId, userId) => {
		try {
			const { data } = await api.delete(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/assignees/${userId}`);
			setBoard((prev) => updateTaskInBoard(prev, taskId, { assignees: data.assignees }));
		} catch { /* ignore */ }
	};

	const handleAttachmentAdd = async (taskId, file) => {
		try {
			const formData = new FormData();
			formData.append("file", file);
			const { data } = await api.post(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/attachments`, formData, {
				headers: { "Content-Type": "multipart/form-data" }
			});
			setBoard((prev) => updateTaskInBoard(prev, taskId, { attachments: data.attachments }));
		} catch { /* ignore */ }
	};

	const handleAttachmentRemove = async (taskId, attachmentId) => {
		try {
			const { data } = await api.delete(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}/attachments/${attachmentId}`);
			setBoard((prev) => updateTaskInBoard(prev, taskId, { attachments: data.attachments }));
		} catch { /* ignore */ }
	};

	const [workspaceMembers, setWorkspaceMembers] = useState([]);
	useEffect(() => {
		if (!workspaceId) return;
		api.get(`/workspaces/${workspaceId}`).then(({ data }) => setWorkspaceMembers(data.members || []));
	}, [workspaceId]);

	const columns = useMemo(() => [...(board?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [board]);

	// Derive all unique assignees from board tasks (for filter dropdown)
	const boardMembers = useMemo(() => {
		const map = new Map();
		columns.forEach((col) =>
			(col.tasks || []).forEach((task) =>
				(task.assignees || []).forEach((a) => {
					if (a?._id) map.set(a._id, a);
				}),
			),
		);
		return [...map.values()];
	}, [columns]);

	// Apply filters
	const filteredColumns = useMemo(() => {
		if (!filterAssignee && !filterPriority && !filterDue) return columns;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		return columns.map((col) => ({
			...col,
			tasks: (col.tasks || []).filter((task) => {
				if (filterAssignee && !task.assignees?.some((a) => a._id === filterAssignee)) return false;
				if (filterPriority && task.priority !== filterPriority) return false;
				if (filterDue) {
					const due = task.dueDate ? new Date(task.dueDate) : null;
					if (!due) return false;
					const diff = Math.round((due - now) / (1000 * 60 * 60 * 24));
					if (filterDue === "overdue" && diff >= 0) return false;
					if (filterDue === "today" && diff !== 0) return false;
					if (filterDue === "week" && (diff < 0 || diff > 7)) return false;
				}
				return true;
			}),
		}));
	}, [columns, filterAssignee, filterPriority, filterDue]);

	if (status === "loading") {
		return (
			<div
				className="page-panel fade-in"
				style={{ padding: 24 }}
			>
				<div
					className="skeleton"
					style={{ width: 220, height: 28, marginBottom: 12 }}
				/>
				<div
					className="skeleton"
					style={{ width: 320, height: 14, marginBottom: 24 }}
				/>
				<div style={{ display: "flex", gap: 16, overflow: "hidden" }}>
					{[1, 2, 3, 4].map((item) => (
						<div
							key={item}
							className="skeleton"
							style={{ width: 280, height: 360, flexShrink: 0 }}
						/>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return <div className="message-error">{error}</div>;
	}
	const showPanel = Boolean(selectedTask) && (activeView === "board" || activeView === "list");

	return (
		<section
			className="fade-in"
			style={{ display: "flex", flexDirection: "column", gap: 18 }}
		>
			<div
				className="page-panel board-toolbar"
				style={{ padding: 20 }}
			>
				<div className="board-toolbar-top">
					<div>
						<div className="board-breadcrumb">
							<Link to={`/app/workspaces/${workspaceId}/boards`}>Boards</Link>
							<span>/</span>
							<span>{board?.name}</span>
						</div>
						<h1 className="page-title">{board?.name}</h1>
						<p className="page-subtitle">Keep the board focused, then jump to list or timeline when you need a scan.</p>
					</div>
					<div className="board-toolbar-actions">
						<PresenceStack users={onlineUsers} />
						<Link
							to={`/app/workspaces/${workspaceId}/boards`}
							className="btn btn-ghost btn-sm"
						>
							<Icon
								name="arrowLeft"
								size={14}
							/>{" "}
							Back to boards
						</Link>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => setShowShortcuts(true)}
							title="Keyboard shortcuts"
						>
							<span className="command-kbd">?</span>
						</button>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
						>
							<Icon
								name="settings"
								size={14}
							/>{" "}
							Settings
						</button>
					</div>
				</div>
				<div className="board-view-tabs">
					<button
						type="button"
						onClick={() => setActiveView("board")}
						className={`tab-button${activeView === "board" ? " active" : ""}`}
					>
						<Icon
							name="board"
							size={15}
						/>{" "}
						Board
					</button>
					<button
						type="button"
						onClick={() => setActiveView("list")}
						className={`tab-button${activeView === "list" ? " active" : ""}`}
					>
						<Icon
							name="menu"
							size={15}
						/>{" "}
						List
					</button>
					<button
						type="button"
						onClick={() => setActiveView("timeline")}
						className={`tab-button${activeView === "timeline" ? " active" : ""}`}
					>
						<Icon
							name="activity"
							size={15}
						/>{" "}
						Timeline
					</button>
					<button
						type="button"
						onClick={() => setActiveView("whiteboard")}
						className={`tab-button${activeView === "whiteboard" ? " active" : ""}`}
					>
						<Icon
							name="whiteboard"
							size={15}
						/>{" "}
						Whiteboard
					</button>
				</div>
				<div className="board-filters">
					<span>Filters:</span>
					<select
						className="input"
						value={filterAssignee}
						onChange={(e) => setFilterAssignee(e.target.value)}
						style={{ minWidth: 120 }}
					>
						<option value="">Assignee</option>
						{boardMembers.map((m) => (
							<option key={m._id} value={m._id}>{m.name}</option>
						))}
					</select>
					<select
						className="input"
						value={filterPriority}
						onChange={(e) => setFilterPriority(e.target.value)}
						style={{ minWidth: 110 }}
					>
						<option value="">Priority</option>
						<option value="urgent">Urgent</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
					<select
						className="input"
						value={filterDue}
						onChange={(e) => setFilterDue(e.target.value)}
						style={{ minWidth: 120 }}
					>
						<option value="">Due date</option>
						<option value="overdue">Overdue</option>
						<option value="today">Due today</option>
						<option value="week">Due this week</option>
					</select>
					<span className="board-filter-divider" />
					{hasFilters && (
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => { setFilterAssignee(""); setFilterPriority(""); setFilterDue(""); }}
						>
							Clear filters
						</button>
					)}
				</div>
			</div>

			<div className={`board-layout${showPanel ? " has-panel" : ""}`}>
				<div className={`board-pane${showPanel ? " compact" : ""}`}>
					{activeView === "board" && (
						<DragDropContext onDragEnd={handleDragEnd}>
							<Droppable
								droppableId="columns"
								direction="horizontal"
								type="COLUMN"
							>
								{(provided) => (
									<div
										ref={provided.innerRef}
										{...provided.droppableProps}
										style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}
									>
										{filteredColumns.map((column, index) => {
											const tasks = [...(column.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
											const theme = getColumnTheme(column, index);
											return (
												<Draggable
													key={column._id}
													draggableId={column._id.toString()}
													index={index}
												>
													{(columnProvided, columnSnapshot) => (
														<div
															ref={columnProvided.innerRef}
															{...columnProvided.draggableProps}
															className={`kanban-col ${theme.className}`}
															style={{
																...columnProvided.draggableProps.style,
																boxShadow: columnSnapshot.isDragging ? "0 14px 40px rgba(0,0,0,0.55)" : "none",
															}}
														>
															<div
																className="kanban-col-header"
																{...columnProvided.dragHandleProps}
															>
																<h2
																	style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}
																>
																	{column.title}
																</h2>
																<span
																	className="badge"
																	style={{ background: "rgba(255,255,255,0.06)", color: theme.accent }}
																>
																	{tasks.length}
																</span>
															</div>
															<Droppable
																droppableId={column._id.toString()}
																type="TASK"
															>
																{(taskProvided, taskSnapshot) => (
																	<div
																		ref={taskProvided.innerRef}
																		{...taskProvided.droppableProps}
																		className="kanban-col-body"
																		style={{
																			background: taskSnapshot.isDraggingOver
																				? "rgba(255,255,255,0.04)"
																				: "transparent",
																		}}
																	>
																		{tasks.map((task, taskIndex) => (
																			<Draggable
																				key={task._id}
																				draggableId={task._id.toString()}
																				index={taskIndex}
																			>
																				{(dragProvided, dragSnapshot) => (
																					<TaskCard
																						task={task}
																						provided={dragProvided}
																						snapshot={dragSnapshot}
																						columnTheme={theme}
																						onOpen={() => setSelectedTask({ task, column })}
																					/>
																				)}
																			</Draggable>
																		))}
																		{!tasks.length && <div className="kanban-empty">No tasks here yet</div>}
																		{taskProvided.placeholder}
																	</div>
																)}
															</Droppable>
															<div style={{ padding: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
																{taskForm.columnId === column._id.toString() ? (
																	<form
																		onSubmit={handleCreateTask}
																		className="card"
																		style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
																	>
																		<input
																			value={taskForm.title}
																			onChange={(event) =>
																				setTaskForm((prev) => ({ ...prev, title: event.target.value }))
																			}
																			placeholder="Task title"
																			autoFocus
																			className="input"
																		/>
																		<textarea
																			value={taskForm.description}
																			onChange={(event) =>
																				setTaskForm((prev) => ({ ...prev, description: event.target.value }))
																			}
																			placeholder="Description"
																			rows={2}
																			className="input"
																			style={{ resize: "none", fontFamily: "inherit" }}
																		/>
																		<select
																			value={taskForm.priority}
																			onChange={(event) =>
																				setTaskForm((prev) => ({ ...prev, priority: event.target.value }))
																			}
																			className="input"
																		>
																			<option value="low">Low priority</option>
																			<option value="medium">Medium priority</option>
																			<option value="high">High priority</option>
																			<option value="urgent">Urgent priority</option>
																		</select>
																		{taskError && (
																			<p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>
																				{taskError}
																			</p>
																		)}
																		<div style={{ display: "flex", gap: 8 }}>
																			<button
																				type="submit"
																				disabled={creatingTask || !taskForm.title.trim()}
																				className="btn btn-primary btn-sm"
																			>
																				{creatingTask ? "Adding..." : "Add task"}
																			</button>
																			<button
																				type="button"
																				onClick={closeTaskForm}
																				className="btn btn-ghost btn-sm"
																			>
																				Cancel
																			</button>
																		</div>
																	</form>
																) : (
																	<button
																		type="button"
																		onClick={() => openTaskForm(column._id.toString())}
																		className="btn btn-ghost btn-sm"
																		style={{ width: "100%", justifyContent: "flex-start", borderStyle: "dashed" }}
																	>
																		<Icon
																			name="plus"
																			size={14}
																		/>{" "}
																		Add task
																	</button>
																)}
															</div>
														</div>
													)}
												</Draggable>
											);
										})}
										<div className="kanban-col kanban-add">
											{columnTitle ? (
												<form
													onSubmit={handleCreateColumn}
													className="kanban-add-form"
												>
													<input
														value={columnTitle}
														onChange={(event) => setColumnTitle(event.target.value)}
														placeholder="Column title"
														autoFocus
														className="input"
													/>
													{columnError && <p className="message-error">{columnError}</p>}
													<div style={{ display: "flex", gap: 8 }}>
														<button
															type="submit"
															disabled={creatingColumn}
															className="btn btn-primary btn-sm"
														>
															{creatingColumn ? "Adding..." : "Add column"}
														</button>
														<button
															type="button"
															onClick={() => {
																setColumnTitle("");
																setColumnError("");
															}}
															className="btn btn-ghost btn-sm"
														>
															Cancel
														</button>
													</div>
												</form>
											) : (
												<button
													type="button"
													className="btn btn-ghost btn-sm"
													onClick={() => setColumnTitle("New column")}
												>
													<Icon
														name="plus"
														size={14}
													/>{" "}
													Add column
												</button>
											)}
										</div>
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</DragDropContext>
					)}
					{activeView === "list" && (
						<div className="board-list">
							{filteredColumns.map((column) => (
								<div
									key={column._id}
									className="board-list-group"
								>
									<div className="board-list-header">
										<span>{column.title}</span>
										<span className="badge badge-muted">{column.tasks?.length || 0}</span>
									</div>
									<div>
										{(column.tasks || []).map((task) => (
											<ListRow
												key={task._id}
												task={task}
												column={column}
												onOpen={() => setSelectedTask({ task, column })}
											/>
										))}
										{!column.tasks?.length && <div className="board-list-empty">No tasks in this column yet.</div>}
									</div>
								</div>
							))}
						</div>
					)}
					{activeView === "timeline" && (
						<div className="card" style={{ padding: 24, overflowX: "auto" }}>
							<div style={{ minWidth: 800 }}>
								<div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12, marginBottom: 16 }}>
									<div style={{ width: 220, flexShrink: 0, fontWeight: 600, color: "var(--text-secondary)", fontSize: 13 }}>Assignee</div>
									<div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
										<span>Mon 12</span><span>Tue 13</span><span>Wed 14</span><span>Thu 15</span><span>Fri 16</span><span>Sat 17</span><span>Sun 18</span>
									</div>
								</div>
								
								{/* Timeline rows based on unique task assignees */}
								{columns.flatMap(c => c.tasks || []).reduce((acc, t) => {
									t.assignees?.forEach(a => { if (!acc.find(x => x._id === a._id)) acc.push(a); });
									if (!t.assignees?.length && !acc.find(x => x._id === "unassigned")) acc.push({ _id: "unassigned", name: "Unassigned" });
									return acc;
								}, []).map((user, i) => (
									<div key={user._id} style={{ display: "flex", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
										<div style={{ width: 220, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
											<div className="avatar avatar-xs" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{user.name?.[0] || "?"}</div>
											<span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{user.name}</span>
										</div>
										<div style={{ flex: 1, position: "relative", height: 32, background: "var(--bg-surface-2)", borderRadius: "var(--r-sm)" }}>
											{/* Render bars for tasks assigned to this user (mock layout based on index) */}
											{columns.flatMap(c => c.tasks || []).filter(t => (user._id === "unassigned" ? !t.assignees?.length : t.assignees?.some(a => a._id === user._id))).map((t, taskIdx) => (
												<div key={t._id} title={t.title} style={{
													position: "absolute",
													left: `${((taskIdx * 15 + i * 20) % 70)}%`,
													width: `${15 + (t.title.length % 20)}%`,
													top: 4, bottom: 4,
													background: PRIORITY_META[t.priority || "medium"]?.color || "var(--col-todo)",
													borderRadius: "var(--r-sm)", padding: "2px 8px", fontSize: 11, color: "#fff",
													display: "flex", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
													boxShadow: "var(--shadow-sm)", cursor: "pointer"
												}} onClick={() => {
													const col = columns.find(c => c.tasks?.find(task => task._id === t._id));
													setSelectedTask({ task: t, column: col });
												}}>
													{t.title}
												</div>
											))}
										</div>
									</div>
								))}
								{columns.flatMap(c => c.tasks || []).length === 0 && (
									<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No tasks to display in timeline.</div>
								)}
							</div>
						</div>
					)}
					{activeView === "whiteboard" && (
						<Whiteboard
							workspaceId={workspaceId}
							boardId={boardId}
						/>
					)}
				</div>
				{showPanel && selectedTask && (
					<TaskPanel
						key={selectedTask.task?._id}
						task={selectedTask.task}
						column={selectedTask.column}
						onClose={() => setSelectedTask(null)}
						onSubTaskAdd={handleSubTaskAdd}
						onSubTaskToggle={handleSubTaskToggle}
						onSubTaskDelete={handleSubTaskDelete}
						onDependencyAdd={handleDependencyAdd}
						onDependencyRemove={handleDependencyRemove}
						onTaskFieldUpdate={handleTaskFieldUpdate}
						onAssigneeAdd={handleAssigneeAdd}
						onAssigneeRemove={handleAssigneeRemove}
						onAttachmentAdd={handleAttachmentAdd}
						onAttachmentRemove={handleAttachmentRemove}
						relationOptions={relationOptions}
						workspaceMembers={workspaceMembers}
						workspaceId={workspaceId}
						boardId={boardId}
					/>
				)}
			</div>
		</section>
	);
}
