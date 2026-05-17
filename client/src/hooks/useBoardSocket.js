import { useEffect } from "react";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

export const useBoardSocket = (boardId, { onTaskCreated, onTaskMoved, onTaskUpdated, onTaskDeleted, onColumnsReordered }) => {
	const accessToken = useAuthStore((state) => state.accessToken);

	useEffect(() => {
		if (!boardId || !accessToken) return undefined;
		const socket = getSocket(accessToken);
		if (!socket) return undefined;
		socket.emit("join:board", { boardId });

		if (onTaskCreated) socket.on("task:created", onTaskCreated);
		if (onTaskMoved) socket.on("task:moved", onTaskMoved);
		if (onTaskUpdated) socket.on("task:updated", onTaskUpdated);
		if (onTaskDeleted) socket.on("task:deleted", onTaskDeleted);
		if (onColumnsReordered) socket.on("board:columns_reordered", onColumnsReordered);

		return () => {
			socket.emit("leave:board", { boardId });
			if (onTaskCreated) socket.off("task:created", onTaskCreated);
			if (onTaskMoved) socket.off("task:moved", onTaskMoved);
			if (onTaskUpdated) socket.off("task:updated", onTaskUpdated);
			if (onTaskDeleted) socket.off("task:deleted", onTaskDeleted);
			if (onColumnsReordered) socket.off("board:columns_reordered", onColumnsReordered);
		};
	}, [boardId, accessToken, onTaskCreated, onTaskMoved, onTaskUpdated, onTaskDeleted, onColumnsReordered]);
};
