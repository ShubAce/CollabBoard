import { io } from "socket.io-client";
import useAuthStore from "../store/authStore";

let socket = null;
let socketToken = null;

export const getSocket = (tokenOverride) => {
	const token = tokenOverride ?? useAuthStore.getState().accessToken;
	if (!token) return null;

	if (socket && socketToken === token) {
		return socket;
	}

	if (socket) {
		socket.disconnect();
		socket = null;
	}

	socketToken = token;
	socket = io(import.meta.env.VITE_SOCKET_URL, {
		auth: { token },
		transports: ["websocket"],
	});

	return socket;
};

export const disconnectSocket = () => {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
	socketToken = null;
};
