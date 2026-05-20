import { z } from "zod";
import Board from "../models/Board.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import redis from "../config/redis.js";
import emailQueue from "../queues/emailQueue.js";
import activityQueue from "../queues/activityQueue.js";

const emitNotification = (req, userId, notification) => {
	const io = req.app.get("io");
	if (io) io.to(`user:${userId}`).emit("notification:new", { notification });
};

const createTaskSchema = z.object({
	title: z.string().trim().min(1, "Title is required"),
	description: z.string().trim().optional(),
	columnId: z.string().min(1, "Column is required"),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	assignees: z.array(z.string()).optional(),
	dueDate: z.string().optional(),
	labels: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
	title: z.string().trim().min(1).optional(),
	description: z.string().trim().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
	labels: z.array(z.string()).optional(),
	dueDate: z.string().optional(),
});

const moveTaskSchema = z.object({
	targetColumnId: z.string().min(1, "Target column is required"),
	newOrder: z.number().int().nonnegative().optional(),
});

const commentSchema = z.object({
	content: z.string().trim().min(1, "Comment cannot be empty"),
	mentions: z.array(z.string()).optional(),
});

const subTaskCreateSchema = z.object({
	title: z.string().trim().min(1, "Title is required"),
});

const subTaskUpdateSchema = z.object({
	title: z.string().trim().min(1).optional(),
	isDone: z.boolean().optional(),
	order: z.number().int().nonnegative().optional(),
});

const dependencySchema = z.object({
	type: z.enum(["blockedBy", "blocking"]),
	taskId: z.string().min(1, "Task id is required"),
});

const parseDueDate = (value) => {
	if (!value) return undefined;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
};

const normalizeOrder = (value) => {
	const parsed = Number.isFinite(value) ? value : 0;
	return parsed < 0 ? 0 : Math.floor(parsed);
};

const statusByColumnTitle = {
	"to do": "todo",
	"in progress": "in_progress",
	review: "review",
	done: "done",
};

const getStatusForColumn = (column) => statusByColumnTitle[column?.title?.trim().toLowerCase()] || "todo";

const ensureBoard = async (workspaceId, boardId) => {
	return Board.findOne({ _id: boardId, workspace: workspaceId });
};

const ensureTask = async (workspaceId, boardId, taskId) => {
	return Task.findOne({ _id: taskId, board: boardId, workspace: workspaceId });
};

const emitToBoard = (req, boardId, event, payload) => {
	const io = req.app.get("io");
	if (io) {
		io.to(`board:${boardId}`).emit(event, payload);
	}
};

const emitTaskUpdate = (req, taskId, boardId, changes) => {
	emitToBoard(req, boardId, "task:updated", { taskId, changes });
};

const normalizeSubTaskOrder = (task) => {
	task.subTasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	task.subTasks.forEach((subTask, index) => {
		subTask.order = index;
	});
};

const addUniqueId = (list, value) => {
	if (!list.some((id) => id.toString() === value.toString())) list.push(value);
};

const removeId = (list, value) => list.filter((id) => id.toString() !== value.toString());

const invalidateBoardCache = async (boardId) => {
	try {
		await redis.del(`board:${boardId}:tasks`);
	} catch (err) {
		console.warn("Failed to invalidate board cache:", err.message);
	}
};

export const createTask = async (req, res, next) => {
	try {
		const parsed = createTaskSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await ensureBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const column = board.columns.id(parsed.data.columnId);
		if (!column) {
			return res.status(400).json({ message: "Column not found" });
		}

		const dueDate = parseDueDate(parsed.data.dueDate);
		if (parsed.data.dueDate && dueDate === null) {
			return res.status(400).json({ message: "Invalid due date" });
		}

		const maxTask = await Task.find({ board: board._id, columnId: parsed.data.columnId }).sort({ order: -1 }).limit(1);
		const order = maxTask.length ? maxTask[0].order + 1 : 0;

		const task = await Task.create({
			board: board._id,
			workspace: req.params.workspaceId,
			columnId: parsed.data.columnId,
			title: parsed.data.title,
			description: parsed.data.description || "",
			order,
			priority: parsed.data.priority || "medium",
			status: getStatusForColumn(column),
			assignees: parsed.data.assignees || [],
			labels: parsed.data.labels || [],
			dueDate,
			createdBy: req.user._id,
		});

		const populated = await task.populate("assignees", "name avatar email");
		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:created", { task: populated });

		// Async: activity log + notifications for assignees
		try {
			await activityQueue.add("log_task_created", {
				workspaceId: task.workspace,
				actorId: req.user._id,
				taskId: task._id,
				taskTitle: task.title,
			});

			for (const assignee of populated.assignees) {
				const notification = await Notification.create({
					recipient: assignee._id,
					type: "task_assigned",
					payload: { taskId: task._id, taskTitle: task.title, boardId: task.board, workspaceId: task.workspace },
					isRead: false,
				});
				emitNotification(req, assignee._id, notification);
				await emailQueue.add("send_task_assigned", {
					to: assignee.email,
					userName: assignee.name,
					taskTitle: task.title,
					boardName: (await Board.findById(task.board).select("name"))?.name || "",
					workspaceName: "",
					taskUrl: `${process.env.CLIENT_URL}/app/workspaces/${task.workspace}/boards/${task.board}`,
				});
			}
		} catch (queueErr) {
			console.error("Queue error in createTask:", queueErr.message);
		}

		return res.status(201).json(populated);
	} catch (err) {
		return next(err);
	}
};

export const getTask = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		await task.populate("assignees", "name avatar email");
		return res.status(200).json(task);
	} catch (err) {
		return next(err);
	}
};

export const updateTask = async (req, res, next) => {
	try {
		const parsed = updateTaskSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		if (Object.keys(parsed.data).length === 0) {
			return res.status(400).json({ message: "No fields to update" });
		}

		if (parsed.data.dueDate !== undefined) {
			const dueDate = parseDueDate(parsed.data.dueDate);
			if (parsed.data.dueDate && dueDate === null) {
				return res.status(400).json({ message: "Invalid due date" });
			}
			parsed.data.dueDate = dueDate;
		}

		const task = await Task.findOneAndUpdate(
			{ _id: req.params.taskId, board: req.params.boardId, workspace: req.params.workspaceId },
			parsed.data,
			{ new: true },
		);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		await task.populate("assignees", "name avatar email");
		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:updated", { taskId: task._id, changes: parsed.data });
		return res.status(200).json(task);
	} catch (err) {
		return next(err);
	}
};

export const deleteTask = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		await Task.deleteOne({ _id: task._id });
		await Comment.deleteMany({ task: task._id });
		await Task.updateMany({ board: task.board, columnId: task.columnId, order: { $gt: task.order } }, { $inc: { order: -1 } });

		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:deleted", { taskId: task._id });

		try {
			await activityQueue.add("log_task_deleted", {
				workspaceId: task.workspace,
				actorId: req.user._id,
				taskId: task._id,
				taskTitle: task.title,
			});
		} catch (queueErr) {
			console.error("Queue error in deleteTask:", queueErr.message);
		}

		return res.status(200).json({ message: "Task deleted" });
	} catch (err) {
		return next(err);
	}
};

export const moveTask = async (req, res, next) => {
	try {
		const parsed = moveTaskSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}
		const fromColumnId = task.columnId.toString();

		const board = await ensureBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const targetColumnId = parsed.data.targetColumnId;
		const targetColumn = board.columns.id(targetColumnId);
		if (!targetColumn) {
			return res.status(400).json({ message: "Target column not found" });
		}
		const targetStatus = getStatusForColumn(targetColumn);

		const sameColumn = task.columnId.toString() === targetColumnId;
		const columnCount = await Task.countDocuments({ board: task.board, columnId: targetColumnId });
		const newOrder = Math.min(normalizeOrder(parsed.data.newOrder ?? columnCount), sameColumn ? columnCount - 1 : columnCount);

		if (sameColumn) {
			if (newOrder === task.order) {
				return res.status(200).json({
					taskId: task._id,
					fromColumnId,
					toColumnId: targetColumnId,
					newOrder: task.order,
				});
			}

			if (newOrder > task.order) {
				await Task.updateMany(
					{ board: task.board, columnId: task.columnId, order: { $gt: task.order, $lte: newOrder } },
					{ $inc: { order: -1 } },
				);
			} else {
				await Task.updateMany(
					{ board: task.board, columnId: task.columnId, order: { $gte: newOrder, $lt: task.order } },
					{ $inc: { order: 1 } },
				);
			}

			task.order = newOrder;
			task.status = targetStatus;
			await task.save();
			await invalidateBoardCache(task.board);
			emitToBoard(req, task.board, "task:moved", {
				taskId: task._id,
				fromColumnId,
				toColumnId: targetColumnId,
				newOrder: task.order,
				status: task.status,
			});

			return res.status(200).json({
				taskId: task._id,
				fromColumnId,
				toColumnId: targetColumnId,
				newOrder: task.order,
				status: task.status,
			});
		}

		await Task.updateMany({ board: task.board, columnId: task.columnId, order: { $gt: task.order } }, { $inc: { order: -1 } });
		await Task.updateMany({ board: task.board, columnId: targetColumnId, order: { $gte: newOrder } }, { $inc: { order: 1 } });

		task.columnId = targetColumnId;
		task.order = newOrder;
		task.status = targetStatus;
		await task.save();
		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:moved", {
			taskId: task._id,
			fromColumnId,
			toColumnId: targetColumnId,
			newOrder: task.order,
			status: task.status,
		});

		try {
			await activityQueue.add("log_task_moved", {
				workspaceId: task.workspace,
				actorId: req.user._id,
				taskId: task._id,
				taskTitle: task.title,
				fromColumnId,
				toColumnId: targetColumnId,
			});
		} catch (queueErr) {
			console.error("Queue error in moveTask:", queueErr.message);
		}

		return res.status(200).json({
			taskId: task._id,
			fromColumnId,
			toColumnId: targetColumnId,
			newOrder: task.order,
			status: task.status,
		});
	} catch (err) {
		return next(err);
	}
};

export const addAssignee = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const user = await User.findById(req.params.userId).select("_id");
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const exists = task.assignees.some((id) => id.toString() === req.params.userId);
		if (!exists) {
			task.assignees.push(user._id);
			await task.save();
		}

		await task.populate("assignees", "name avatar email");
		return res.status(200).json(task);
	} catch (err) {
		return next(err);
	}
};

export const removeAssignee = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		task.assignees = task.assignees.filter((id) => id.toString() !== req.params.userId);
		await task.save();

		await task.populate("assignees", "name avatar email");
		return res.status(200).json(task);
	} catch (err) {
		return next(err);
	}
};

export const addComment = async (req, res, next) => {
	try {
		const parsed = commentSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const comment = await Comment.create({
			task: task._id,
			author: req.user._id,
			content: parsed.data.content,
			mentions: parsed.data.mentions || [],
		});

		task.comments.push(comment._id);
		await task.save();

		await comment.populate("author", "name avatar email");

		// Emit real-time event to board
		emitToBoard(req, task.board, "task:comment_added", { taskId: task._id, comment });

		// Async: activity log + mention notifications
		try {
			await activityQueue.add("log_comment_added", {
				workspaceId: task.workspace,
				actorId: req.user._id,
				taskId: task._id,
				taskTitle: task.title,
			});

			const mentions = parsed.data.mentions || [];
			for (const mentionedUserId of mentions) {
				const mentionedUser = await User.findById(mentionedUserId).select("name email");
				if (!mentionedUser) continue;
				const notification = await Notification.create({
					recipient: mentionedUser._id,
					type: "comment_mention",
					payload: { taskId: task._id, taskTitle: task.title, boardId: task.board, workspaceId: task.workspace },
					isRead: false,
				});
				emitNotification(req, mentionedUser._id, notification);
				await emailQueue.add("send_comment_mention", {
					to: mentionedUser.email,
					userName: mentionedUser.name,
					authorName: req.user.name,
					taskTitle: task.title,
					taskUrl: `${process.env.CLIENT_URL}/app/workspaces/${task.workspace}/boards/${task.board}`,
				});
			}
		} catch (queueErr) {
			console.error("Queue error in addComment:", queueErr.message);
		}

		return res.status(201).json(comment);
	} catch (err) {
		return next(err);
	}
};

export const listComments = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const comments = await Comment.find({ task: task._id }).populate("author", "name avatar email").sort({ createdAt: 1 });

		return res.status(200).json(comments);
	} catch (err) {
		return next(err);
	}
};

export const addSubTask = async (req, res, next) => {
	try {
		const parsed = subTaskCreateSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const nextOrder = task.subTasks.length ? Math.max(...task.subTasks.map((subTask) => subTask.order ?? 0)) + 1 : 0;
		task.subTasks.push({ title: parsed.data.title, order: nextOrder });
		normalizeSubTaskOrder(task);
		await task.save();

		await invalidateBoardCache(task.board);
		emitTaskUpdate(req, task._id, task.board, { subTasks: task.subTasks });

		return res.status(201).json({ taskId: task._id, subTasks: task.subTasks });
	} catch (err) {
		return next(err);
	}
};

export const updateSubTask = async (req, res, next) => {
	try {
		const parsed = subTaskUpdateSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const subTask = task.subTasks.id(req.params.subTaskId);
		if (!subTask) {
			return res.status(404).json({ message: "Sub-task not found" });
		}

		if (parsed.data.title !== undefined) subTask.title = parsed.data.title;
		if (parsed.data.isDone !== undefined) subTask.isDone = parsed.data.isDone;
		if (parsed.data.order !== undefined) subTask.order = parsed.data.order;
		normalizeSubTaskOrder(task);
		await task.save();

		await invalidateBoardCache(task.board);
		emitTaskUpdate(req, task._id, task.board, { subTasks: task.subTasks });

		return res.status(200).json({ taskId: task._id, subTasks: task.subTasks });
	} catch (err) {
		return next(err);
	}
};

export const deleteSubTask = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const subTask = task.subTasks.id(req.params.subTaskId);
		if (!subTask) {
			return res.status(404).json({ message: "Sub-task not found" });
		}

		subTask.deleteOne();
		normalizeSubTaskOrder(task);
		await task.save();

		await invalidateBoardCache(task.board);
		emitTaskUpdate(req, task._id, task.board, { subTasks: task.subTasks });

		return res.status(200).json({ taskId: task._id, subTasks: task.subTasks });
	} catch (err) {
		return next(err);
	}
};

export const addDependency = async (req, res, next) => {
	try {
		const parsed = dependencySchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		if (task._id.toString() === parsed.data.taskId) {
			return res.status(400).json({ message: "Cannot relate a task to itself" });
		}

		const relatedTask = await Task.findOne({
			_id: parsed.data.taskId,
			workspace: req.params.workspaceId,
		});
		if (!relatedTask) {
			return res.status(404).json({ message: "Related task not found" });
		}

		task.dependencies = task.dependencies || { blockedBy: [], blocking: [] };
		relatedTask.dependencies = relatedTask.dependencies || { blockedBy: [], blocking: [] };

		const isBlockedBy = parsed.data.type === "blockedBy";
		const primaryField = isBlockedBy ? "blockedBy" : "blocking";
		const relatedField = isBlockedBy ? "blocking" : "blockedBy";

		addUniqueId(task.dependencies[primaryField], relatedTask._id);
		addUniqueId(relatedTask.dependencies[relatedField], task._id);

		await Promise.all([task.save(), relatedTask.save()]);
		await invalidateBoardCache(task.board);
		if (task.board.toString() !== relatedTask.board.toString()) {
			await invalidateBoardCache(relatedTask.board);
		}

		emitTaskUpdate(req, task._id, task.board, { dependencies: task.dependencies });
		if (task.board.toString() !== relatedTask.board.toString()) {
			emitTaskUpdate(req, relatedTask._id, relatedTask.board, { dependencies: relatedTask.dependencies });
		} else {
			emitTaskUpdate(req, relatedTask._id, task.board, { dependencies: relatedTask.dependencies });
		}

		return res.status(200).json({
			task: { _id: task._id, dependencies: task.dependencies },
			relatedTask: { _id: relatedTask._id, dependencies: relatedTask.dependencies, board: relatedTask.board },
		});
	} catch (err) {
		return next(err);
	}
};

export const removeDependency = async (req, res, next) => {
	try {
		const parsed = dependencySchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const relatedTask = await Task.findOne({
			_id: parsed.data.taskId,
			workspace: req.params.workspaceId,
		});
		if (!relatedTask) {
			return res.status(404).json({ message: "Related task not found" });
		}

		task.dependencies = task.dependencies || { blockedBy: [], blocking: [] };
		relatedTask.dependencies = relatedTask.dependencies || { blockedBy: [], blocking: [] };

		const isBlockedBy = parsed.data.type === "blockedBy";
		const primaryField = isBlockedBy ? "blockedBy" : "blocking";
		const relatedField = isBlockedBy ? "blocking" : "blockedBy";

		task.dependencies[primaryField] = removeId(task.dependencies[primaryField], relatedTask._id);
		relatedTask.dependencies[relatedField] = removeId(relatedTask.dependencies[relatedField], task._id);

		await Promise.all([task.save(), relatedTask.save()]);
		await invalidateBoardCache(task.board);
		if (task.board.toString() !== relatedTask.board.toString()) {
			await invalidateBoardCache(relatedTask.board);
		}

		emitTaskUpdate(req, task._id, task.board, { dependencies: task.dependencies });
		if (task.board.toString() !== relatedTask.board.toString()) {
			emitTaskUpdate(req, relatedTask._id, relatedTask.board, { dependencies: relatedTask.dependencies });
		} else {
			emitTaskUpdate(req, relatedTask._id, task.board, { dependencies: relatedTask.dependencies });
		}

		return res.status(200).json({
			task: { _id: task._id, dependencies: task.dependencies },
			relatedTask: { _id: relatedTask._id, dependencies: relatedTask.dependencies, board: relatedTask.board },
		});
	} catch (err) {
		return next(err);
	}
};

export const deleteComment = async (req, res, next) => {
	try {
		const task = await ensureTask(req.params.workspaceId, req.params.boardId, req.params.taskId);
		if (!task) {
			return res.status(404).json({ message: "Task not found" });
		}

		const comment = await Comment.findOne({ _id: req.params.commentId, task: task._id });
		if (!comment) {
			return res.status(404).json({ message: "Comment not found" });
		}

		const canDelete = comment.author.toString() === req.user._id.toString() || ["admin", "owner"].includes(req.memberRole);
		if (!canDelete) {
			return res.status(403).json({ message: "Not allowed to delete this comment" });
		}

		await Comment.deleteOne({ _id: comment._id });
		task.comments = task.comments.filter((id) => id.toString() !== comment._id.toString());
		await task.save();

		return res.status(200).json({ message: "Comment deleted" });
	} catch (err) {
		return next(err);
	}
};
