import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useBoardSocket } from "../hooks/useBoardSocket";
import { usePresence } from "../hooks/usePresence";
import { addTaskToColumn, moveTaskInBoard, removeTaskFromBoard, reorderColumns, updateTaskInBoard } from "../features/board/boardState";
import Whiteboard from "../features/board/Whiteboard";

export default function BoardPage() {
	const { workspaceId, boardId } = useParams();
	const [board, setBoard] = useState(null);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [activeView, setActiveView] = useState("board");

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

		if (workspaceId && boardId) {
			loadBoard();
		}
		return () => {
			isActive = false;
		};
	}, [workspaceId, boardId]);

	useBoardSocket(boardId, {
		onTaskCreated: ({ task }) => setBoard((prev) => addTaskToColumn(prev, task)),
		onTaskMoved: ({ taskId, fromColumnId, toColumnId, newOrder }) =>
			setBoard((prev) => moveTaskInBoard(prev, taskId, fromColumnId, toColumnId, newOrder)),
		onTaskUpdated: ({ taskId, changes }) => setBoard((prev) => updateTaskInBoard(prev, taskId, changes)),
		onTaskDeleted: ({ taskId }) => setBoard((prev) => removeTaskFromBoard(prev, taskId)),
		onColumnsReordered: ({ orderedColumnIds }) => setBoard((prev) => reorderColumns(prev, orderedColumnIds)),
	});

	const onlineUsers = usePresence(workspaceId, boardId);

	const handleDragEnd = async (result) => {
		const { destination, source, draggableId, type } = result;
		if (!destination || !board) return;
		if (destination.droppableId === source.droppableId && destination.index === source.index) return;

		if (type === "COLUMN") {
			const previousBoard = board;
			const orderedColumnIds = [...(board.columns || [])]
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
				.map((column) => column._id.toString());

			orderedColumnIds.splice(source.index, 1);
			orderedColumnIds.splice(destination.index, 0, draggableId);

			setBoard((prev) => reorderColumns(prev, orderedColumnIds));
			try {
				await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/columns/reorder`, {
					orderedColumnIds,
				});
			} catch (err) {
				console.error("Failed to reorder columns:", err);
				if (previousBoard) {
					setBoard(previousBoard);
				}
			}
			return;
		}

		const previousBoard = board;
		const fromColumnId = source.droppableId;
		const toColumnId = destination.droppableId;
		const newOrder = destination.index;

		setBoard((prev) => moveTaskInBoard(prev, draggableId, fromColumnId, toColumnId, newOrder));

		try {
			await api.patch(`/workspaces/${workspaceId}/boards/${boardId}/tasks/${draggableId}/move`, {
				targetColumnId: toColumnId,
				newOrder,
			});
		} catch (err) {
			console.error("Failed to move task:", err);
			if (previousBoard) {
				setBoard(previousBoard);
			}
		}
	};

	if (status === "loading") {
		return (
			<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
				<p className="text-sm text-jet-black-500">Loading board...</p>
			</section>
		);
	}

	if (error) {
		return (
			<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
				<p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
			</section>
		);
	}

	const columns = [...(board?.columns || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	return (
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-jet-black-900 font-display">{board?.name}</h2>
					<p className="mt-1 text-sm text-jet-black-500">Real-time updates and drag-and-drop are live.</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center -space-x-2">
						{onlineUsers.slice(0, 4).map((user) => (
							<div
								key={user.userId}
								className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ghost-white-200 text-xs font-semibold text-jet-black-700"
								title={user.name}
							>
								{user.avatar ? (
									<img
										src={user.avatar}
										alt={user.name}
										className="h-full w-full rounded-full object-cover"
									/>
								) : (
									(user.name || "?").slice(0, 1).toUpperCase()
								)}
							</div>
						))}
						{onlineUsers.length > 4 && (
							<div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ghost-white-200 text-xs font-semibold text-jet-black-700">
								+{onlineUsers.length - 4}
							</div>
						)}
					</div>
					<span className="text-xs text-jet-black-500">{onlineUsers.length} online</span>
					<Link
						to={`/app/workspaces/${workspaceId}/boards`}
						className="inline-flex items-center justify-center rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
					>
						Back to boards
					</Link>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				<button
					onClick={() => setActiveView("board")}
					className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
						activeView === "board"
							? "bg-space-indigo-500 text-white"
							: "border border-ghost-white-200 text-jet-black-700 hover:bg-ghost-white-100"
					}`}
					type="button"
				>
					Board
				</button>
				<button
					onClick={() => setActiveView("whiteboard")}
					className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
						activeView === "whiteboard"
							? "bg-space-indigo-500 text-white"
							: "border border-ghost-white-200 text-jet-black-700 hover:bg-ghost-white-100"
					}`}
					type="button"
				>
					Whiteboard
				</button>
			</div>

			{activeView === "board" ? (
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
								className="mt-6 flex gap-4 overflow-x-auto pb-2"
							>
								{columns.map((column, index) => {
									const tasks = [...(column.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
													className={`w-72 shrink-0 rounded-2xl border border-ghost-white-200 bg-ghost-white-100/70 p-3 transition ${
														columnSnapshot.isDragging ? "ring-2 ring-space-indigo-300" : ""
													}`}
												>
													<div
														className="flex items-center justify-between cursor-grab active:cursor-grabbing"
														{...columnProvided.dragHandleProps}
													>
														<h3 className="text-sm font-semibold text-jet-black-900">{column.title}</h3>
														<span className="rounded-full bg-space-indigo-500 px-2.5 py-1 text-xs font-semibold text-white">
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
																className={`mt-3 min-h-[32px] space-y-3 transition ${
																	taskSnapshot.isDraggingOver ? "bg-white/60" : ""
																}`}
															>
																{tasks.length ? (
																	tasks.map((task, taskIndex) => (
																		<Draggable
																			key={task._id}
																			draggableId={task._id.toString()}
																			index={taskIndex}
																		>
																			{(dragProvided, dragSnapshot) => (
																				<div
																					ref={dragProvided.innerRef}
																					{...dragProvided.draggableProps}
																					{...dragProvided.dragHandleProps}
																					className={`rounded-xl border border-ghost-white-200 bg-white p-3 shadow-sm transition ${
																						dragSnapshot.isDragging ? "ring-2 ring-space-indigo-300" : ""
																					}`}
																				>
																					<h4 className="text-sm font-semibold text-jet-black-900">
																						{task.title}
																					</h4>
																					{task.description && (
																						<p className="mt-1 text-xs text-jet-black-500">
																							{task.description}
																						</p>
																					)}
																					{task.assignees?.length ? (
																						<p className="mt-2 text-xs text-jet-black-500">
																							Assignees:{" "}
																							{task.assignees
																								.map((assignee) => assignee.name)
																								.join(", ")}
																						</p>
																					) : null}
																				</div>
																			)}
																		</Draggable>
																	))
																) : (
																	<p className="text-xs text-jet-black-500">No tasks yet.</p>
																)}
																{taskProvided.placeholder}
															</div>
														)}
													</Droppable>
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
				<div className="mt-6">
					<Whiteboard
						workspaceId={workspaceId}
						boardId={boardId}
					/>
				</div>
			)}
		</section>
	);
}
