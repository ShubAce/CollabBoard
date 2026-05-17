import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const initSocket = async (httpServer) => {
	const io = new Server(httpServer, {
		cors: { origin: process.env.CLIENT_URL, credentials: true },
	});

	// Redis adapter — critical for horizontal scaling
	// Two separate Redis clients required (pub + sub)
	const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` });
	const subClient = pubClient.duplicate();
	await Promise.all([pubClient.connect(), subClient.connect()]);
	io.adapter(createAdapter(pubClient, subClient));
	console.log("Socket.io using Redis adapter");

	// Auth middleware for socket connections
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth?.token || socket.handshake.query?.token;
			if (!token) return next(new Error("Authentication error"));
			const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
			socket.userId = decoded.userId;
			socket.user = await User.findById(decoded.userId).select("name avatar email");
			next();
		} catch {
			next(new Error("Invalid token"));
		}
	});

	// Register event handlers
	io.on("connection", (socket) => {
		console.log(`Socket connected: ${socket.userId}`);

		// Join a personal room for user-specific events (notifications)
		socket.join(`user:${socket.userId}`);

		// Register all handlers
		registerBoardHandlers(io, socket);
		registerPresenceHandlers(io, socket);
		registerWhiteboardHandlers(io, socket);
		registerChatHandlers(io, socket);

		socket.on("disconnect", () => handleDisconnect(io, socket));
	});

	return io;
};