import crypto from "crypto";
import { z } from "zod";
import ActivityLog from "../models/ActivityLog.js";
import Board from "../models/Board.js";
import Channel from "../models/Channel.js";
import Comment from "../models/Comment.js";
import Message from "../models/Message.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import WhiteboardSnapshot from "../models/WhiteboardSnapshot.js";
import Workspace from "../models/Workspace.js";
import emailQueue from "../queues/emailQueue.js";
import activityQueue from "../queues/activityQueue.js";

const createWorkspaceSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	description: z.string().trim().optional(),
});

const updateWorkspaceSchema = z.object({
	name: z.string().trim().min(1, "Name is required").optional(),
	description: z.string().trim().optional(),
});

const inviteMemberSchema = z.object({
	email: z.string().trim().email("Invalid email"),
	role: z.enum(["admin", "editor", "viewer"]).optional(),
});

const roleSchema = z.object({
	role: z.enum(["admin", "editor", "viewer"]),
});

const slugify = (value) => {
	const base = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
	return base || "workspace";
};

const buildUniqueSlug = async (name) => {
	const base = slugify(name);
	let slug = base;
	let attempts = 0;
	while (await Workspace.exists({ slug })) {
		slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
		attempts += 1;
		if (attempts > 5) break;
	}
	return slug;
};

const createDefaultChannels = async (workspaceId, userId) => {
	const channels = [
		{
			workspace: workspaceId,
			name: "general",
			description: "General team discussion",
			isPrivate: false,
			isArchived: false,
			isReadOnly: false,
			createdBy: userId,
		},
		{
			workspace: workspaceId,
			name: "announcements",
			description: "Announcements for the workspace",
			isPrivate: false,
			isArchived: false,
			isReadOnly: true,
			createdBy: userId,
		},
	];
	await Channel.insertMany(channels);
};

const loadWorkspace = async (req) => {
	if (req.workspace) return req.workspace;
	return Workspace.findById(req.params.workspaceId);
};

const attachViewerMeta = (workspace, userId) => {
	const doc = typeof workspace.toObject === "function" ? workspace.toObject() : workspace;
	const member = doc.members?.find((entry) => {
		const memberUserId = entry.user?._id || entry.user;
		return memberUserId?.toString() === userId.toString();
	});

	return {
		...doc,
		currentUserRole: member?.role || null,
		isOwner: doc.owner?._id?.toString ? doc.owner._id.toString() === userId.toString() : doc.owner?.toString() === userId.toString(),
	};
};

export const createWorkspace = async (req, res, next) => {
	try {
		const parsed = createWorkspaceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const { name, description } = parsed.data;
		const slug = await buildUniqueSlug(name);

		const workspace = await Workspace.create({
			name,
			slug,
			description: description || "",
			owner: req.user._id,
			members: [{ user: req.user._id, role: "owner", joinedAt: new Date() }],
		});

		await createDefaultChannels(workspace._id, req.user._id);

		await workspace.populate("owner", "name email avatar");
		return res.status(201).json(attachViewerMeta(workspace, req.user._id));
	} catch (err) {
		return next(err);
	}
};

export const listWorkspaces = async (req, res, next) => {
	try {
		const workspaces = await Workspace.find({ "members.user": req.user._id })
			.populate("members.user", "name email avatar")
			.populate("owner", "name email avatar")
			.sort({ createdAt: -1 });

		return res.status(200).json(workspaces.map((workspace) => attachViewerMeta(workspace, req.user._id)));
	} catch (err) {
		return next(err);
	}
};

export const getWorkspace = async (req, res, next) => {
	try {
		const workspace = await Workspace.findById(req.params.workspaceId)
			.populate("members.user", "name email avatar")
			.populate("owner", "name email avatar");
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		return res.status(200).json(attachViewerMeta(workspace, req.user._id));
	} catch (err) {
		return next(err);
	}
};

export const updateWorkspace = async (req, res, next) => {
	try {
		const parsed = updateWorkspaceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		if (Object.keys(parsed.data).length === 0) {
			return res.status(400).json({ message: "No fields to update" });
		}

		const workspace = await loadWorkspace(req);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		if (parsed.data.name) workspace.name = parsed.data.name;
		if (parsed.data.description !== undefined) workspace.description = parsed.data.description;

		await workspace.save();
		await workspace.populate([
			{ path: "members.user", select: "name email avatar" },
			{ path: "owner", select: "name email avatar" },
		]);
		return res.status(200).json(attachViewerMeta(workspace, req.user._id));
	} catch (err) {
		return next(err);
	}
};

export const deleteWorkspace = async (req, res, next) => {
	try {
		const workspace = await Workspace.findById(req.params.workspaceId);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const boards = await Board.find({ workspace: workspace._id }).select("_id");
		const boardIds = boards.map((board) => board._id);
		const tasks = await Task.find({ workspace: workspace._id }).select("_id");
		const taskIds = tasks.map((task) => task._id);

		await Promise.all([
			Comment.deleteMany({ task: { $in: taskIds } }),
			Task.deleteMany({ workspace: workspace._id }),
			Board.deleteMany({ workspace: workspace._id }),
			Channel.deleteMany({ workspace: workspace._id }),
			Message.deleteMany({ workspace: workspace._id }),
			ActivityLog.deleteMany({ workspace: workspace._id }),
			WhiteboardSnapshot.deleteMany({ board: { $in: boardIds } }),
			Workspace.deleteOne({ _id: workspace._id }),
		]);

		return res.status(200).json({ message: "Workspace deleted" });
	} catch (err) {
		return next(err);
	}
};

export const inviteMember = async (req, res, next) => {
	try {
		const parsed = inviteMemberSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const workspace = await loadWorkspace(req);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const email = parsed.data.email.toLowerCase();
		const role = parsed.data.role || "viewer";
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const existing = workspace.members.find((member) => member.user.toString() === user._id.toString());
		if (existing) {
			return res.status(409).json({ message: "User already a member" });
		}

		workspace.members.push({ user: user._id, role, joinedAt: new Date() });
		await workspace.save();

		// Queue invite email + activity log asynchronously
		try {
			await emailQueue.add("send_workspace_invite", {
				to: user.email,
				userName: user.name,
				workspaceName: workspace.name,
				inviterName: req.user.name,
			});
			await activityQueue.add("log_member_invited", {
				workspaceId: workspace._id,
				actorId: req.user._id,
				taskId: null,
				meta: { invitedUserId: user._id, role },
			});
		} catch (queueErr) {
			console.error("Queue error in inviteMember:", queueErr.message);
		}

		return res.status(200).json({ message: "Invitation sent." });
	} catch (err) {
		return next(err);
	}
};

export const changeMemberRole = async (req, res, next) => {
	try {
		const parsed = roleSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const workspace = await loadWorkspace(req);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const member = workspace.members.find((entry) => entry.user.toString() === req.params.userId);
		if (!member) {
			return res.status(404).json({ message: "Member not found" });
		}

		if (member.role === "owner") {
			return res.status(400).json({ message: "Owner role cannot be changed" });
		}

		member.role = parsed.data.role;
		await workspace.save();

		return res.status(200).json({ message: "Role updated" });
	} catch (err) {
		return next(err);
	}
};

export const removeMember = async (req, res, next) => {
	try {
		const workspace = await loadWorkspace(req);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const member = workspace.members.find((entry) => entry.user.toString() === req.params.userId);
		if (!member) {
			return res.status(404).json({ message: "Member not found" });
		}

		if (member.role === "owner") {
			return res.status(400).json({ message: "Owner cannot be removed" });
		}

		workspace.members = workspace.members.filter((entry) => entry.user.toString() !== req.params.userId);
		await workspace.save();

		return res.status(200).json({ message: "Member removed" });
	} catch (err) {
		return next(err);
	}
};

export const listActivity = async (req, res, next) => {
	try {
		const page = Math.max(parseInt(req.query.page || "1", 10), 1);
		const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
		const skip = (page - 1) * limit;

		const [logs, total] = await Promise.all([
			ActivityLog.find({ workspace: req.params.workspaceId })
				.populate("actor", "name avatar email")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
			ActivityLog.countDocuments({ workspace: req.params.workspaceId }),
		]);

		return res.status(200).json({
			activity: logs,
			page,
			totalPages: Math.ceil(total / limit),
			totalItems: total,
		});
	} catch (err) {
		return next(err);
	}
};

export const getMessages = async (req, res, next) => {
	try {
		const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
		const before = req.query.before || null;
		const threadId = req.query.threadId || null;

		let channel = await Channel.findOne({ workspace: req.params.workspaceId, name: "general" });
		if (!channel) {
			channel = await Channel.create({
				workspace: req.params.workspaceId,
				name: "general",
				description: "General team discussion",
				createdBy: req.user._id,
			});
		}

		const filter = { workspace: req.params.workspaceId, channel: channel._id };
		if (threadId) {
			filter.threadId = threadId;
		} else {
			filter.threadId = null;
		}
		if (before) filter._id = { $lt: before };

		const messages = await Message.find(filter).sort({ _id: -1 }).limit(limit).populate("sender", "name avatar");

		return res.status(200).json({
			messages: messages.reverse(),
			hasMore: messages.length === limit,
			nextCursor: messages[0]?._id || null,
		});
	} catch (err) {
		return next(err);
	}
};
