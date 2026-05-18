/* eslint-disable react-hooks/refs */
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import Whiteboard from "../features/board/Whiteboard";
import { addTaskToColumn, moveTaskInBoard, removeTaskFromBoard, reorderColumns, updateTaskInBoard } from "../features/board/boardState";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { usePresence } from "../hooks/usePresence";

const COLUMN_THEMES = {
	todo: { className: "col-todo", accent: "#8B8FA8", card: "#1E2235" },
	in_progress: { className: "col-progress", accent: "#60A5FA", card: "#172035" },
	review: { className: "col-review", accent: "#A78BFA", card: "#1E1B2E" },
	done: { className: "col-done", accent: "#34D399", card: "#172E24" },
};

const PRIORITY_META = {
	urgent: { label: "Urgent", color: "var(--priority-urgent)", bg: "var(--danger-muted)" },
	high: { label: "High", color: "var(--priority-high)", bg: "rgba(251,146,60,0.15)" },
	medium: { label: "Medium", color: "var(--priority-medium)", bg: "rgba(251,191,36,0.15)" },
	low: { label: "Low", color: "var(--priority-low)", bg: "rgba(52,211,153,0.15)" },
};

function getInitials(name = "") {
	return name.split(" ").map((word) => word[0]).join("").toUpperCase().slice(0, 2);
}

function getColumnTheme(column, index) {
	const key = column.status || column.title?.toLowerCase().replace(/\s+/g, "_");
	return COLUMN_THEMES[key] || Object.values(COLUMN_THEMES)[index % 4];
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
							border: "2px solid var(--bg-surface)",
							background: "var(--bg-surface-3)",
							overflow: "hidden",
						}}
					>
						{user.avatar ? <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(user.name || "?")}
					</div>
				))}
				{users.length > 4 && (
					<div className="avatar avatar-xs" style={{ marginLeft: -8, border: "2px solid var(--bg-surface)", color: "var(--text-secondary)" }}>
						+{users.length - 4}
					</div>
				)}
			</div>
			<span style={{ fontSize: 12, color: "var(--text-muted)" }}>{users.length} online</span>
		</div>
	);
}

function TaskCard({ task, provided, snapshot, columnTheme }) {
	const priority = PRIORITY_META[task.priority || "medium"] || PRIORITY_META.medium;
	return (
		<div
			ref={provided.innerRef}
			{...provided.draggableProps}
			{...provided.dragHandleProps}
			className="task-card"
			style={{
				...provided.draggableProps.style,
				background: columnTheme.card,
				borderColor: snapshot.isDragging ? columnTheme.accent : "var(--border)",
				boxShadow: snapshot.isDragging ? "0 10px 30px rgba(0,0,0,0.55)" : "var(--shadow-card)",
			}}
		>
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
				<h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, lineHeight: 1.35 }}>{task.title}</h4>
				<span style={{ width: 7, height: 7, borderRadius: "50%", background: priority.color, marginTop: 6, flexShrink: 0 }} />
			</div>
			{task.description && (
				<p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>{task.description}</p>
			)}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
				<span className="badge" style={{ background: priority.bg, color: priority.color }}>{priority.label}</span>
				{task.assignees?.length ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{task.assignees.length} assigned</span> : null}
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
		return () => { isActive = false; };
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

	if (status === "loading") {
		return (
			<div className="page-panel fade-in" style={{ padding: 24 }}>
				<div className="skeleton" style={{ width: 220, height: 28, marginBottom: 12 }} />
				<div className="skeleton" style={{ width: 320, height: 14, marginBottom: 24 }} />
				<div style={{ display: "flex", gap: 16, overflow: "hidden" }}>
					{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton" style={{ width: 280, height: 360, flexShrink: 0 }} />)}
				</div>
			</div>
		);
	}

	if (error) {
		return <div className="message-error">{error}</div>;
	}

	const columns = [...(board?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	return (
		<section className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
			<div className="page-panel" style={{ padding: 20 }}>
				<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: "var(--text-secondary)", fontSize: 13 }}>
							<Link to={`/app/workspaces/${workspaceId}/boards`} style={{ color: "var(--text-secondary)" }}>Boards</Link>
							<span>/</span>
							<span style={{ color: "var(--text-primary)" }}>{board?.name}</span>
						</div>
						<h1 className="page-title">{board?.name}</h1>
						<p className="page-subtitle">Drag tasks between columns, sketch on the whiteboard, and keep the room in sync live.</p>
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
						<PresenceStack users={onlineUsers} />
						<Link to={`/app/workspaces/${workspaceId}/boards`} className="btn btn-ghost btn-sm">
							<Icon name="arrowLeft" size={14} /> Back to boards
						</Link>
					</div>
				</div>
				<div style={{ display: "flex", gap: 8, marginTop: 18 }}>
					<button type="button" onClick={() => setActiveView("board")} className={`tab-button${activeView === "board" ? " active" : ""}`}>
						<Icon name="board" size={15} /> Board
					</button>
					<button type="button" onClick={() => setActiveView("whiteboard")} className={`tab-button${activeView === "whiteboard" ? " active" : ""}`}>
						<Icon name="whiteboard" size={15} /> Whiteboard
					</button>
				</div>
			</div>

			{activeView === "board" ? (
				<DragDropContext onDragEnd={handleDragEnd}>
					<Droppable droppableId="columns" direction="horizontal" type="COLUMN">
						{(provided) => (
							<div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
								{columns.map((column, index) => {
									const tasks = [...(column.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
									const theme = getColumnTheme(column, index);
									return (
										<Draggable key={column._id} draggableId={column._id.toString()} index={index}>
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
													<div className="kanban-col-header" {...columnProvided.dragHandleProps}>
														<h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{column.title}</h2>
														<span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: theme.accent }}>{tasks.length}</span>
													</div>
													<Droppable droppableId={column._id.toString()} type="TASK">
														{(taskProvided, taskSnapshot) => (
															<div
																ref={taskProvided.innerRef}
																{...taskProvided.droppableProps}
																className="kanban-col-body"
																style={{ background: taskSnapshot.isDraggingOver ? "rgba(255,255,255,0.04)" : "transparent" }}
															>
																{tasks.map((task, taskIndex) => (
																	<Draggable key={task._id} draggableId={task._id.toString()} index={taskIndex}>
																		{(dragProvided, dragSnapshot) => (
																			<TaskCard task={task} provided={dragProvided} snapshot={dragSnapshot} columnTheme={theme} />
																		)}
																	</Draggable>
																))}
																{!tasks.length && (
																	<div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius-md)", padding: 14, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
																		No tasks here yet
																	</div>
																)}
																{taskProvided.placeholder}
															</div>
														)}
													</Droppable>
													<div style={{ padding: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
														{taskForm.columnId === column._id.toString() ? (
															<form onSubmit={handleCreateTask} className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
																<input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Task title" autoFocus className="input" />
																<textarea value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" rows={2} className="input" style={{ resize: "none", fontFamily: "inherit" }} />
																<select value={taskForm.priority} onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value }))} className="input">
																	<option value="low">Low priority</option>
																	<option value="medium">Medium priority</option>
																	<option value="high">High priority</option>
																	<option value="urgent">Urgent priority</option>
																</select>
																{taskError && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{taskError}</p>}
																<div style={{ display: "flex", gap: 8 }}>
																	<button type="submit" disabled={creatingTask || !taskForm.title.trim()} className="btn btn-primary btn-sm">{creatingTask ? "Adding..." : "Add task"}</button>
																	<button type="button" onClick={closeTaskForm} className="btn btn-ghost btn-sm">Cancel</button>
																</div>
															</form>
														) : (
															<button type="button" onClick={() => openTaskForm(column._id.toString())} className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", borderStyle: "dashed" }}>
																<Icon name="plus" size={14} /> Add task
															</button>
														)}
													</div>
												</div>
											)}
										</Draggable>
									);
								})}
								{provided.placeholder}
							</div>
						)}
					</Droppable>
				</DragDropContext>
			) : (
				<Whiteboard workspaceId={workspaceId} boardId={boardId} />
			)}
		</section>
	);
}
