import { z } from "zod";
import Board from "../models/Board.js";
import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import WhiteboardSnapshot from "../models/WhiteboardSnapshot.js";

const createBoardSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
});

const columnSchema = z.object({
	title: z.string().trim().min(1, "Title is required"),
	color: z.string().trim().optional(),
});

const reorderSchema = z.object({
	orderedColumnIds: z.array(z.string().min(1, "Column id required")).min(1),
});

const defaultColumns = [
	{ title: "To Do", order: 0, color: "#E2E8F0" },
	{ title: "In Progress", order: 1, color: "#FDE68A" },
	{ title: "Review", order: 2, color: "#BFDBFE" },
	{ title: "Done", order: 3, color: "#BBF7D0" },
];

const findBoard = async (workspaceId, boardId) => {
	return Board.findOne({ _id: boardId, workspace: workspaceId });
};

export const createBoard = async (req, res, next) => {
	try {
		const parsed = createBoardSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await Board.create({
			workspace: req.params.workspaceId,
			name: parsed.data.name,
			columns: defaultColumns,
			createdBy: req.user._id,
		});

		return res.status(201).json(board);
	} catch (err) {
		return next(err);
	}
};

export const listBoards = async (req, res, next) => {
	try {
		const boards = await Board.find({ workspace: req.params.workspaceId }).sort({ createdAt: -1 });
		return res.status(200).json(boards);
	} catch (err) {
		return next(err);
	}
};

export const getBoardWithTasks = async (req, res, next) => {
	try {
		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const tasks = await Task.find({ board: board._id }).populate("assignees", "name avatar email").sort({ order: 1 });

		const tasksByColumn = board.columns.reduce((acc, column) => {
			acc[column._id.toString()] = [];
			return acc;
		}, {});

		for (const task of tasks) {
			const key = task.columnId.toString();
			if (!tasksByColumn[key]) tasksByColumn[key] = [];
			tasksByColumn[key].push(task);
		}

		return res.status(200).json({
			...board.toObject(),
			columns: board.columns.map((column) => ({
				...column.toObject(),
				tasks: tasksByColumn[column._id.toString()] || [],
			})),
		});
	} catch (err) {
		return next(err);
	}
};

export const updateBoard = async (req, res, next) => {
	try {
		const parsed = createBoardSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		board.name = parsed.data.name;
		await board.save();

		return res.status(200).json(board);
	} catch (err) {
		return next(err);
	}
};

export const deleteBoard = async (req, res, next) => {
	try {
		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const tasks = await Task.find({ board: board._id }).select("_id");
		const taskIds = tasks.map((task) => task._id);

		await Promise.all([
			Comment.deleteMany({ task: { $in: taskIds } }),
			Task.deleteMany({ board: board._id }),
			WhiteboardSnapshot.deleteMany({ board: board._id }),
			Board.deleteOne({ _id: board._id }),
		]);

		return res.status(200).json({ message: "Board deleted" });
	} catch (err) {
		return next(err);
	}
};

export const addColumn = async (req, res, next) => {
	try {
		const parsed = columnSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const column = {
			title: parsed.data.title,
			color: parsed.data.color || "#E2E8F0",
			order: board.columns.length,
		};

		board.columns.push(column);
		await board.save();

		return res.status(201).json(board.columns[board.columns.length - 1]);
	} catch (err) {
		return next(err);
	}
};

export const updateColumn = async (req, res, next) => {
	try {
		const parsed = columnSchema.partial().safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const column = board.columns.id(req.params.columnId);
		if (!column) {
			return res.status(404).json({ message: "Column not found" });
		}

		if (parsed.data.title) column.title = parsed.data.title;
		if (parsed.data.color) column.color = parsed.data.color;

		await board.save();
		return res.status(200).json(column);
	} catch (err) {
		return next(err);
	}
};

export const deleteColumn = async (req, res, next) => {
	try {
		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const columnId = req.params.columnId;
		const column = board.columns.id(columnId);
		if (!column) {
			return res.status(404).json({ message: "Column not found" });
		}

		await Task.deleteMany({ board: board._id, columnId });

		board.columns = board.columns.filter((entry) => entry._id.toString() !== columnId);
		board.columns.forEach((entry, index) => {
			entry.order = index;
		});

		await board.save();
		return res.status(200).json({ message: "Column deleted" });
	} catch (err) {
		return next(err);
	}
};

export const reorderColumns = async (req, res, next) => {
	try {
		const parsed = reorderSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const board = await findBoard(req.params.workspaceId, req.params.boardId);
		if (!board) {
			return res.status(404).json({ message: "Board not found" });
		}

		const orderedIds = parsed.data.orderedColumnIds;
		const existingIds = board.columns.map((column) => column._id.toString());
		const missing = orderedIds.some((id) => !existingIds.includes(id));
		if (missing || orderedIds.length !== existingIds.length) {
			return res.status(400).json({ message: "Invalid column order list" });
		}

		const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
		board.columns.forEach((column) => {
			column.order = orderMap.get(column._id.toString());
		});
		board.columns.sort((a, b) => a.order - b.order);

		await board.save();
		return res.status(200).json({ orderedColumnIds: orderedIds });
	} catch (err) {
		return next(err);
	}
};
