const PRESENCE_TTL = 35; // seconds — client pings every 30s

export const registerPresenceHandlers = (io, socket) => {
	socket.on("join:workspace", async ({ workspaceId }) => {
		socket.join(`ws:${workspaceId}`);
		socket.currentWorkspaceId = workspaceId;

		// Add to Redis presence hash
		await redis.hset(
			`presence:${workspaceId}`,
			socket.userId,
			JSON.stringify({
				name: socket.user.name,
				avatar: socket.user.avatar,
				boardId: null,
			}),
		);
		await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);

		// Broadcast updated presence to workspace
		const presenceData = await getPresenceList(workspaceId);
		io.to(`ws:${workspaceId}`).emit("presence:update", { users: presenceData });
	});

	socket.on("presence:active", async ({ workspaceId, boardId }) => {
		// Update which board user is currently on + refresh TTL
		await redis.hset(
			`presence:${workspaceId}`,
			socket.userId,
			JSON.stringify({
				name: socket.user.name,
				avatar: socket.user.avatar,
				boardId,
			}),
		);
		await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);
	});
};

// On disconnect:
export const handleDisconnect = async (io, socket) => {
	if (socket.currentWorkspaceId) {
		await redis.hdel(`presence:${socket.currentWorkspaceId}`, socket.userId);
		const presenceData = await getPresenceList(socket.currentWorkspaceId);
		io.to(`ws:${socket.currentWorkspaceId}`).emit("presence:update", { users: presenceData });
	}
};

const getPresenceList = async (workspaceId) => {
	const raw = await redis.hgetall(`presence:${workspaceId}`);
	if (!raw) return [];
	return Object.entries(raw).map(([userId, json]) => ({ userId, ...JSON.parse(json) }));
};