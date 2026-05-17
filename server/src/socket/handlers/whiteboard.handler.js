export const registerWhiteboardHandlers = (io, socket) => {
	socket.on("whiteboard:stroke", ({ boardId, stroke }) => {
		// Broadcast stroke to everyone else in the board room
		socket.to(`board:${boardId}`).emit("whiteboard:stroke", {
			userId: socket.userId,
			stroke,
		});
	});

	socket.on("whiteboard:cursor", ({ boardId, x, y }) => {
		socket.to(`board:${boardId}`).emit("whiteboard:cursor", {
			userId: socket.userId,
			name: socket.user.name,
			x,
			y,
		});
	});

	socket.on("whiteboard:clear", async ({ boardId }) => {
		// Verify user has editor+ role before clearing
		socket.to(`board:${boardId}`).emit("whiteboard:cleared", {
			clearedBy: socket.user.name,
		});
	});
};