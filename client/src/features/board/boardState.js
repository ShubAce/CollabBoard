const toId = (value) => (value?.toString ? value.toString() : String(value));

const cloneBoard = (board) => ({
	...board,
	columns: (board.columns || []).map((column) => ({
		...column,
		tasks: (column.tasks || []).map((task) => ({ ...task })),
	})),
});

const resolveOrder = (value, fallback) => {
	const parsed = Number.isFinite(value) ? value : Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) return fallback;
	return Math.max(0, parsed);
};

const reindexTasks = (tasks) => tasks.map((task, index) => ({ ...task, order: index }));

export const addTaskToColumn = (board, task) => {
	if (!board) return board;
	const nextBoard = cloneBoard(board);
	const column = nextBoard.columns.find((entry) => toId(entry._id) === toId(task.columnId || task.column));
	if (!column) return board;
	if ((column.tasks || []).some((entry) => toId(entry._id) === toId(task._id))) return board;

	const tasks = [...(column.tasks || [])];
	const insertIndex = Math.min(resolveOrder(task.order, tasks.length), tasks.length);
	tasks.splice(insertIndex, 0, { ...task });
	column.tasks = reindexTasks(tasks);

	return nextBoard;
};

export const updateTaskInBoard = (board, taskId, changes) => {
	if (!board) return board;
	const nextBoard = cloneBoard(board);

	for (const column of nextBoard.columns) {
		const index = column.tasks.findIndex((task) => toId(task._id) === toId(taskId));
		if (index !== -1) {
			const updated = { ...column.tasks[index], ...changes };
			column.tasks = column.tasks.map((task, taskIndex) => (taskIndex === index ? updated : task));
			return nextBoard;
		}
	}

	return board;
};

export const removeTaskFromBoard = (board, taskId) => {
	if (!board) return board;
	const nextBoard = cloneBoard(board);

	for (const column of nextBoard.columns) {
		const hasTask = column.tasks.some((task) => toId(task._id) === toId(taskId));
		if (hasTask) {
			const filtered = column.tasks.filter((task) => toId(task._id) !== toId(taskId));
			column.tasks = reindexTasks(filtered);
			return nextBoard;
		}
	}

	return board;
};

export const moveTaskInBoard = (board, taskId, fromColumnId, toColumnId, newOrder, changes = {}) => {
	if (!board) return board;
	const nextBoard = cloneBoard(board);
	const fromColumn = nextBoard.columns.find((entry) => toId(entry._id) === toId(fromColumnId));
	const toColumn = nextBoard.columns.find((entry) => toId(entry._id) === toId(toColumnId));
	if (!fromColumn || !toColumn) return board;

	const fromIndex = fromColumn.tasks.findIndex((task) => toId(task._id) === toId(taskId));
	if (fromIndex === -1) return board;

	if (toId(fromColumnId) === toId(toColumnId)) {
		const tasks = [...fromColumn.tasks];
		const [task] = tasks.splice(fromIndex, 1);
		const insertIndex = Math.min(resolveOrder(newOrder, tasks.length), tasks.length);
		tasks.splice(insertIndex, 0, { ...task, ...changes, order: insertIndex });
		fromColumn.tasks = reindexTasks(tasks);
		return nextBoard;
	}

	const fromTasks = [...fromColumn.tasks];
	const [task] = fromTasks.splice(fromIndex, 1);
	const toTasks = [...toColumn.tasks];
	const insertIndex = Math.min(resolveOrder(newOrder, toTasks.length), toTasks.length);
	toTasks.splice(insertIndex, 0, { ...task, ...changes, columnId: toColumnId, order: insertIndex });

	fromColumn.tasks = reindexTasks(fromTasks);
	toColumn.tasks = reindexTasks(toTasks);

	return nextBoard;
};

export const reorderColumns = (board, orderedColumnIds) => {
	if (!board) return board;
	const nextBoard = cloneBoard(board);
	const orderMap = new Map(orderedColumnIds.map((id, index) => [toId(id), index]));
	const columns = [...nextBoard.columns].map((column) => ({
		...column,
		order: orderMap.has(toId(column._id)) ? orderMap.get(toId(column._id)) : column.order,
	}));
	columns.sort((a, b) => {
		const orderA = orderMap.get(toId(a._id));
		const orderB = orderMap.get(toId(b._id));
		return (orderA ?? 0) - (orderB ?? 0);
	});

	return { ...nextBoard, columns };
};
