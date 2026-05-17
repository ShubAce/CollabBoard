import { io } from "socket.io-client";
import useAuthStore from "../store/authStore";

let socket = null;

export const getSocket = () => {
	if (!socket) {
		const token = useAuthStore.getState().accessToken;
		socket = io(import.meta.env.VITE_SOCKET_URL, {
			auth: { token },
			transports: ["websocket"],
		});
	}
	return socket;
};

export const disconnectSocket = () => {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
};