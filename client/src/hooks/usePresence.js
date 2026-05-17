import { useEffect, useState } from "react";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

export const usePresence = (workspaceId, boardId) => {
	const accessToken = useAuthStore((state) => state.accessToken);
	const [onlineUsers, setOnlineUsers] = useState([]);

	useEffect(() => {
		if (!workspaceId || !accessToken) return undefined;
		const socket = getSocket(accessToken);
		if (!socket) return undefined;

		socket.emit("join:workspace", { workspaceId });
		socket.on("presence:update", ({ users }) => {
			setOnlineUsers(Array.isArray(users) ? users : []);
		});

		socket.emit("presence:active", { workspaceId, boardId });
		const heartbeat = setInterval(() => {
			socket.emit("presence:active", { workspaceId, boardId });
		}, 30000);

		return () => {
			clearInterval(heartbeat);
			socket.off("presence:update");
		};
	}, [workspaceId, boardId, accessToken]);

	return onlineUsers;
};
