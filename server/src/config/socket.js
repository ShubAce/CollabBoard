import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
	registerBoardHandlers,
	registerChatHandlers,
	registerPresenceHandlers,
	registerWhiteboardHandlers,
	handleDisconnect,
} from "../socket/index.js";

const ADAPTER_CONNECT_TIMEOUT_MS = 15_000;

/**
 * Redis adapter — only needed to scale across several server instances. Managed Redis
 * (Upstash) routinely drops idle/long-lived connections, so the clients must reconnect
 * and must have an 'error' listener: node-redis turns an unhandled 'error' event into an
 * uncaught exception that kills the process ("SocketClosedUnexpectedlyError").
 * If Redis is unreachable at boot we keep running on the in-memory adapter.
 */
const attachRedisAdapter = async (io) => {
	const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
	const pubClient = createClient({
		url,
		pingInterval: 4 * 60 * 1000, // keep the connection warm without burning Upstash's command quota
		socket: {
			connectTimeout: 10_000,
			keepAlive: true,
			reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 10_000),
		},
	});
	const subClient = pubClient.duplicate();
	for (const [role, client] of [["pub", pubClient], ["sub", subClient]]) {
		client.on("error", (err) => console.error(`[socket.io redis ${role}] ${err.message}`));
		client.on("reconnecting", () => console.warn(`[socket.io redis ${role}] reconnecting…`));
	}

	let timer;
	try {
		// With a never-give-up reconnect strategy, connect() would wait forever if Redis is down.
		const timeout = new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(`timed out after ${ADAPTER_CONNECT_TIMEOUT_MS / 1000}s`)), ADAPTER_CONNECT_TIMEOUT_MS);
		});
		await Promise.race([Promise.all([pubClient.connect(), subClient.connect()]), timeout]);
		io.adapter(createAdapter(pubClient, subClient));
		console.log("Socket.io using Redis adapter");
	} catch (err) {
		console.warn(`Socket.io Redis adapter unavailable (${err.message}) — using the in-memory adapter, which is fine for a single instance.`);
		// destroy() throws on a client that isn't open, so only stop the ones still retrying.
		for (const client of [pubClient, subClient]) if (client.isOpen) client.destroy();
	} finally {
		clearTimeout(timer);
	}
};

export const initSocket = async (httpServer) => {
	const io = new Server(httpServer, {
		cors: { origin: process.env.CLIENT_URL, credentials: true },
	});

	await attachRedisAdapter(io);

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
