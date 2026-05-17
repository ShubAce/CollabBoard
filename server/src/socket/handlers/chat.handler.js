import Message from "../../models/Message.js";

export const registerChatHandlers = (io, socket) => {
	socket.on("chat:send", async ({ workspaceId, content }) => {
		// Persist message to MongoDB
		const message = await Message.create({
			workspace: workspaceId,
			sender: socket.userId,
			content,
			type: "text",
		});

		const populated = await message.populate("sender", "name avatar");

		// Broadcast to workspace room
		io.to(`ws:${workspaceId}`).emit("chat:message", { message: populated });
	});

	socket.on("chat:typing", ({ workspaceId, isTyping }) => {
		// Broadcast to everyone except sender
		socket.to(`ws:${workspaceId}`).emit("chat:typing", {
			userId: socket.userId,
			name: socket.user.name,
			isTyping,
		});
	});
};
