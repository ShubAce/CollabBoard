import { useEffect } from "react";
import { getSocket } from "../socket";

export const useBoardSocket = (boardId, { onTaskCreated, onTaskMoved, onTaskUpdated, onTaskDeleted, onColumnsReordered }) => {
	useEffect(() => {
		if (!boardId) return;
		const socket = getSocket();
		socket.emit("join:board", { boardId });

		socket.on("task:created", onTaskCreated);
		socket.on("task:moved", onTaskMoved);
		socket.on("task:updated", onTaskUpdated);
		socket.on("task:deleted", onTaskDeleted);
		socket.on("board:columns_reordered", onColumnsReordered);

		return () => {
			socket.emit("leave:board", { boardId });
			socket.off("task:created");
			socket.off("task:moved");
			socket.off("task:updated");
			socket.off("task:deleted");
			socket.off("board:columns_reordered");
		};
	}, [boardId]);
};