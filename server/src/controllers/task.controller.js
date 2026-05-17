import { z } from "zod";
import Board from "../models/Board.js";
import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import redis from "../config/redis.js";

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
			assignees: parsed.data.assignees || [],
			labels: parsed.data.labels || [],
			dueDate,
			createdBy: req.user._id,
		});

		const populated = await task.populate("assignees", "name avatar email");
		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:created", { task: populated });
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
		if (!board.columns.id(targetColumnId)) {
			return res.status(400).json({ message: "Target column not found" });
		}

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
			await task.save();
			await invalidateBoardCache(task.board);
			emitToBoard(req, task.board, "task:moved", {
				taskId: task._id,
				fromColumnId,
				toColumnId: targetColumnId,
				newOrder: task.order,
			});

			return res.status(200).json({
				taskId: task._id,
				fromColumnId,
				toColumnId: targetColumnId,
				newOrder: task.order,
			});
		}

		await Task.updateMany({ board: task.board, columnId: task.columnId, order: { $gt: task.order } }, { $inc: { order: -1 } });
		await Task.updateMany({ board: task.board, columnId: targetColumnId, order: { $gte: newOrder } }, { $inc: { order: 1 } });

		task.columnId = targetColumnId;
		task.order = newOrder;
		await task.save();
		await invalidateBoardCache(task.board);
		emitToBoard(req, task.board, "task:moved", {
			taskId: task._id,
			fromColumnId,
			toColumnId: targetColumnId,
			newOrder: task.order,
		});

		return res.status(200).json({
			taskId: task._id,
			fromColumnId,
			toColumnId: targetColumnId,
			newOrder: task.order,
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
