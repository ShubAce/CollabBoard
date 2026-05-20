import Message from "../../models/Message.js";
import Notification from "../../models/Notification.js";
import Workspace from "../../models/Workspace.js";
import Channel from "../../models/Channel.js";
import emailQueue from "../../queues/emailQueue.js";

const MENTION_REGEX = /@([a-zA-Z0-9._-]{2,})/g;

const normalizeToken = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const extractMentionTokens = (content = "") => {
	MENTION_REGEX.lastIndex = 0;
	const tokens = new Set();
	let match;
	while ((match = MENTION_REGEX.exec(content)) !== null) {
		if (match[1]) tokens.add(match[1]);
	}
	return Array.from(tokens);
};

const buildMentionKeys = (user) => {
	const keys = new Set();
	if (user?.name) {
		const normalizedName = normalizeToken(user.name);
		if (normalizedName) keys.add(normalizedName);
		const parts = user.name.split(/\s+/).filter(Boolean);
		const first = normalizeToken(parts[0] || "");
		const last = normalizeToken(parts[parts.length - 1] || "");
		if (first) keys.add(first);
		if (last) keys.add(last);
	}
	if (user?.email) {
		const normalizedEmail = normalizeToken(user.email);
		if (normalizedEmail) keys.add(normalizedEmail);
		const localPart = user.email.split("@")[0] || "";
		const normalizedLocal = normalizeToken(localPart);
		if (normalizedLocal) keys.add(normalizedLocal);
	}
	return keys;
};

const resolveMentionTargets = (tokens, members) => {
	const normalizedTokens = tokens.map((token) => normalizeToken(token)).filter(Boolean);
	if (!normalizedTokens.length) return [];

	const targets = new Map();
	for (const member of members) {
		const user = member?.user;
		if (!user) continue;
		const keys = buildMentionKeys(user);
		if (!keys.size) continue;
		if (normalizedTokens.some((token) => keys.has(token))) {
			targets.set(user._id.toString(), user);
		}
	}
	return Array.from(targets.values());
};

export const registerChatHandlers = (io, socket) => {
	socket.on("chat:send", async ({ workspaceId, channelId, content, threadId }) => {
		if (!workspaceId || !content?.trim()) return;

		let populated;
		try {
			let channel;
			if (!channelId) {
				channel = await Channel.findOne({ workspace: workspaceId, name: "general" });
				if (!channel) {
					channel = await Channel.create({
						workspace: workspaceId,
						name: "general",
						description: "General team discussion",
						createdBy: socket.userId,
					});
				}
			} else {
				channel = await Channel.findOne({ _id: channelId, workspace: workspaceId });
				if (!channel) return;

				if (channel.isPrivate && (!channel.members || !channel.members.includes(socket.userId))) {
					return; // Unauthorized
				}

				if (channel.isReadOnly) {
					const ws = await Workspace.findById(workspaceId);
					if (!ws) return;
					const member = ws.members.find((m) => m.user.toString() === socket.userId.toString());
					if (!member || (member.role !== "admin" && member.role !== "owner")) {
						return; // Only admins and owners can post in read-only channels
					}
				}
			}

			// Persist message to MongoDB
			const message = await Message.create({
				workspace: workspaceId,
				channel: channel._id,
				sender: socket.userId,
				content,
				type: "text",
				threadId: threadId || null,
			});

			// If it's a thread reply, update parent message
			if (threadId) {
				await Message.findByIdAndUpdate(threadId, {
					$inc: { threadCount: 1 },
					lastReplyAt: new Date(),
				});
			}

			populated = await message.populate("sender", "name avatar");

			// Broadcast to workspace room
			io.to(`ws:${workspaceId}`).emit("chat:message", { message: populated });
		} catch (err) {
			console.error("Chat send error:", err.message);
			return;
		}

		const tokens = extractMentionTokens(content);
		if (!tokens.length) return;

		try {
			const workspace = await Workspace.findById(workspaceId).populate("members.user", "name email");
			if (!workspace) return;

			const targets = resolveMentionTargets(tokens, workspace.members || []).filter((user) => user._id.toString() !== socket.userId.toString());

			if (!targets.length) return;

			const chatUrl = `${process.env.CLIENT_URL}/app/workspaces/${workspace._id}/chat`;
			for (const user of targets) {
				const notification = await Notification.create({
					recipient: user._id,
					type: "chat_mention",
					payload: {
						workspaceId: workspace._id,
						workspaceName: workspace.name,
						messageId: populated?._id,
						senderName: socket.user?.name || "",
						chatUrl,
					},
					isRead: false,
				});
				io.to(`user:${user._id}`).emit("notification:new", { notification });

				await emailQueue.add("send_chat_mention", {
					to: user.email,
					userName: user.name,
					authorName: socket.user?.name || "Someone",
					workspaceName: workspace.name,
					chatUrl,
				});
			}
		} catch (err) {
			console.error("Chat mention error:", err.message);
		}
	});

	socket.on("chat:typing", ({ workspaceId, isTyping }) => {
		// Broadcast to everyone except sender
		socket.to(`ws:${workspaceId}`).emit("chat:typing", {
			userId: socket.userId,
			name: socket.user.name,
			isTyping,
		});
	});

	socket.on("chat:edit", async ({ workspaceId, messageId, content }) => {
		if (!workspaceId || !messageId || !content?.trim()) return;
		try {
			const message = await Message.findOneAndUpdate(
				{ _id: messageId, workspace: workspaceId, sender: socket.userId },
				{ content, editedAt: new Date() },
				{ new: true }
			).populate("sender", "name avatar");
			
			if (message) {
				io.to(`ws:${workspaceId}`).emit("chat:edited", { message });
			}
		} catch (err) {
			console.error("Chat edit error:", err.message);
		}
	});

	socket.on("chat:delete", async ({ workspaceId, messageId }) => {
		if (!workspaceId || !messageId) return;
		try {
			// Find and mark as deleted
			const message = await Message.findOneAndUpdate(
				{ _id: messageId, workspace: workspaceId, sender: socket.userId },
				{ isDeleted: true, deletedAt: new Date(), deletedBy: socket.userId, content: "This message was deleted." },
				{ new: true }
			);
			
			if (message) {
				io.to(`ws:${workspaceId}`).emit("chat:deleted", { messageId });
			}
		} catch (err) {
			console.error("Chat delete error:", err.message);
		}
	});

	socket.on("chat:react", async ({ workspaceId, messageId, emoji }) => {
		if (!workspaceId || !messageId || !emoji) return;
		try {
			const message = await Message.findOne({ _id: messageId, workspace: workspaceId });
			if (!message) return;

			const uid = socket.userId;
			const reactions = [...(message.reactions || [])];
			const idx = reactions.findIndex((r) => r.emoji === emoji);

			if (idx >= 0) {
				const users = reactions[idx].users || [];
				if (users.includes(uid)) {
					// Remove reaction
					reactions[idx].users = users.filter((u) => u.toString() !== uid.toString());
					if (!reactions[idx].users.length) reactions.splice(idx, 1);
				} else {
					// Add reaction
					reactions[idx].users.push(uid);
				}
			} else {
				// New emoji reaction
				reactions.push({ emoji, users: [uid] });
			}

			message.reactions = reactions;
			await message.save();

			io.to(`ws:${workspaceId}`).emit("chat:reaction_updated", { messageId, reactions: message.reactions });
		} catch (err) {
			console.error("Chat reaction error:", err.message);
		}
	});
};
