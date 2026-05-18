import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import redis from "../config/redis.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import WorkspaceInvite from "../models/WorkspaceInvite.js";
import emailQueue from "../queues/emailQueue.js";
import activityQueue from "../queues/activityQueue.js";
import { generateTokens } from "../services/token.services.js";

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

const sendInviteSchema = z.object({
	email: z.string().trim().email("Invalid email"),
	role: z.enum(["admin", "editor", "viewer"]).optional(),
});

const tokenSchema = z.object({
	token: z.string().min(1, "Token is required"),
});

const acceptRegisterSchema = tokenSchema.extend({
	name: z.string().trim().min(1, "Name is required"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const buildInviteCacheKey = (tokenId) => `invite:${tokenId}`;

const getInviteCookieOptions = () => ({
	httpOnly: true,
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
	maxAge: INVITE_TTL_SECONDS * 1000,
	path: "/api/v1/auth",
});

const setRefreshCookie = (res, refreshToken) => {
	res.cookie("refreshToken", refreshToken, getInviteCookieOptions());
};

const getInviteSecret = () => {
	const secret = process.env.INVITE_TOKEN_SECRET;
	if (!secret) {
		const err = new Error("Invite system is not configured. Missing INVITE_TOKEN_SECRET.");
		err.status = 500;
		throw err;
	}
	return secret;
};

const createInviteToken = ({ tokenId, workspaceId, email, role, expiresAt }) =>
	jwt.sign(
		{
			tokenId,
			workspaceId: workspaceId.toString(),
			email,
			role,
		},
		getInviteSecret(),
		{
			expiresIn: INVITE_TTL_SECONDS,
			jwtid: tokenId,
			subject: email,
		},
	);

const decodeInviteToken = (token) => jwt.verify(token, getInviteSecret());

const getWorkspaceRoleMembership = (workspace, userId) => workspace.members.find((member) => member.user.toString() === userId.toString());

const markInviteAccepted = async (invite, acceptedAt = new Date()) => {
	invite.status = "accepted";
	invite.acceptedAt = acceptedAt;
	await invite.save();
};

const addMemberToWorkspace = async ({ workspace, userId, role }) => {
	workspace.members.push({
		user: userId,
		role,
		joinedAt: new Date(),
	});
	await workspace.save();
};

const parseInviteFromCache = (cached) => {
	try {
		return JSON.parse(cached);
	} catch {
		return null;
	}
};

const loadInviteFromToken = async (token) => {
	const decoded = decodeInviteToken(token);
	const cached = await redis.get(buildInviteCacheKey(decoded.tokenId));
	if (!cached) {
		return { decoded, cachedInvite: null, invite: null };
	}

	const cachedInvite = parseInviteFromCache(cached);
	const invite = await WorkspaceInvite.findOne({ token, status: "pending" })
		.populate("workspace", "name slug members")
		.populate("invitedBy", "name avatar email");

	return { decoded, cachedInvite, invite };
};

const buildPreviewPayload = ({ invite, decoded, user, currentUser }) => {
	const currentUserEmail = currentUser?.email?.toLowerCase() || null;
	const invitedEmail = decoded.email.toLowerCase();
	const inviterName = invite?.invitedBy?.name || null;
	const inviterEmail = invite?.invitedBy?.email || null;
	const workspaceName = invite?.workspace?.name || null;

	return {
		workspace: invite?.workspace
			? {
					_id: invite.workspace._id,
					name: invite.workspace.name,
					slug: invite.workspace.slug,
				}
			: { _id: decoded.workspaceId },
		workspaceName,
		workspaceId: invite?.workspace?._id || decoded.workspaceId,
		email: decoded.email,
		role: decoded.role,
		invitedBy: invite?.invitedBy || null,
		inviterName,
		inviterEmail,
		hasAccount: Boolean(user),
		isLoggedIn: Boolean(currentUser),
		currentUserEmail,
		currentUserMatchesInvite: Boolean(currentUserEmail && currentUserEmail === invitedEmail),
		expiresAt: invite?.expiresAt || null,
	};
};

const buildInviteUrl = (inviteToken) => `${process.env.CLIENT_URL}/invite/accept?token=${encodeURIComponent(inviteToken)}`;

const buildInviteResponse = ({ invite, email, role, expiresAt, inviter, inviteUrl }) => ({
	_id: invite._id,
	email,
	role,
	expiresAt,
	invitedBy: {
		_id: inviter._id,
		name: inviter.name,
		email: inviter.email,
	},
	...(process.env.NODE_ENV !== "production" ? { inviteUrl } : {}),
});

const emitNotification = (req, userId, notification) => {
	const io = req.app.get("io");
	if (io) {
		io.to(`user:${userId}`).emit("notification:new", { notification });
	}
};

export const sendInvite = async (req, res, next) => {
	try {
		const parsed = sendInviteSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const workspace = req.workspace || (await Workspace.findById(req.params.workspaceId));
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const email = parsed.data.email.toLowerCase();
		const role = parsed.data.role || "viewer";
		const existingMember = workspace.members.find((member) => member.user.toString() === req.user._id.toString());
		if (!existingMember) {
			return res.status(403).json({ message: "Not a workspace member" });
		}

		const alreadyInvited = await WorkspaceInvite.findOne({
			workspace: workspace._id,
			email,
			status: "pending",
			expiresAt: { $gt: new Date() },
		});
		if (alreadyInvited) {
			return res.status(409).json({ message: "A pending invite already exists for this email" });
		}

		const existingUser = await User.findOne({ email }).select("name email");
		if (existingUser) {
			const isMember = getWorkspaceRoleMembership(workspace, existingUser._id);
			if (isMember) {
				return res.status(409).json({ message: "User is already a workspace member" });
			}
		}

		const tokenId = uuidv4();
		const expiresAt = new Date(Date.now() + INVITE_TTL_SECONDS * 1000);
		const inviteToken = createInviteToken({
			tokenId,
			workspaceId: workspace._id,
			email,
			role,
			expiresAt,
		});
		const inviteUrl = buildInviteUrl(inviteToken);

		const invite = await WorkspaceInvite.create({
			workspace: workspace._id,
			email,
			role,
			invitedBy: req.user._id,
			token: inviteToken,
			expiresAt,
		});

		await redis.set(
			buildInviteCacheKey(tokenId),
			JSON.stringify({
				inviteId: invite._id,
				workspaceId: workspace._id,
				email,
				role,
			}),
			"EX",
			INVITE_TTL_SECONDS,
		);

		try {
			await activityQueue.add("log_member_invited", {
				workspaceId: workspace._id,
				actorId: req.user._id,
				taskId: null,
				meta: { email, role, inviteId: invite._id },
			});
		} catch (queueErr) {
			console.error("Queue error in sendInvite:", queueErr.message);
		}

		if (existingUser) {
			try {
				const notification = await Notification.create({
					recipient: existingUser._id,
					type: "workspace_invite",
					payload: {
						workspaceId: workspace._id,
						workspaceName: workspace.name,
						inviteToken,
						inviteUrl,
						invitedEmail: existingUser.email,
						inviterName: req.user.name,
						inviterEmail: req.user.email,
						role,
						inviteId: invite._id,
					},
					isRead: false,
				});
				emitNotification(req, existingUser._id, notification);
			} catch (notificationErr) {
				console.error("Notification error in sendInvite:", notificationErr.message);
			}

			try {
				await emailQueue.add("send_workspace_invite", {
					to: existingUser.email,
					userName: existingUser.name || existingUser.email,
					workspaceName: workspace.name,
					inviterName: req.user.name,
					inviteUrl,
					role,
				});
			} catch (queueErr) {
				console.error("Queue error in sendInvite existing user email:", queueErr.message);
			}

			return res.status(201).json({
				message: `Invitation sent to ${email}`,
				type: "existing_user_invite",
				invite: buildInviteResponse({
					invite,
					email,
					role,
					expiresAt,
					inviter: req.user,
					inviteUrl,
				}),
			});
		}

		try {
			await emailQueue.add("send_workspace_invite", {
				to: email,
				userName: email,
				workspaceName: workspace.name,
				inviterName: req.user.name,
				inviteUrl,
				role,
			});
		} catch (queueErr) {
			console.error("Queue error in sendInvite email:", queueErr.message);
		}

		return res.status(201).json({
			message: `Invitation sent to ${email}`,
			type: "email_invite",
			invite: buildInviteResponse({
				invite,
				email,
				role,
				expiresAt,
				inviter: req.user,
				inviteUrl,
			}),
		});
	} catch (err) {
		return next(err);
	}
};

export const listPendingInvites = async (req, res, next) => {
	try {
		const invites = await WorkspaceInvite.find({
			workspace: req.params.workspaceId,
			status: "pending",
			expiresAt: { $gt: new Date() },
		})
			.populate("invitedBy", "name avatar email")
			.sort({ createdAt: -1 });

		return res.status(200).json({ invites });
	} catch (err) {
		return next(err);
	}
};

export const revokeInvite = async (req, res, next) => {
	try {
		const invite = await WorkspaceInvite.findOne({
			_id: req.params.inviteId,
			workspace: req.params.workspaceId,
			status: "pending",
		});
		if (!invite) {
			return res.status(404).json({ message: "Invite not found" });
		}

		const decoded = jwt.decode(invite.token);
		if (decoded?.tokenId) {
			await redis.del(buildInviteCacheKey(decoded.tokenId));
		}

		invite.status = "revoked";
		await invite.save();

		return res.status(200).json({ message: "Invitation revoked" });
	} catch (err) {
		return next(err);
	}
};

export const previewInvite = async (req, res, next) => {
	try {
		const token = req.query.token;
		if (!token) {
			return res.status(400).json({ message: "Token required" });
		}

		const { decoded, cachedInvite, invite } = await loadInviteFromToken(token);
		if (!cachedInvite || !invite) {
			if (req.user) {
				const workspace = await Workspace.findById(decoded.workspaceId).select("name slug members");
				if (workspace) {
					const isMember = workspace.members?.some((entry) => entry.user.toString() === req.user._id.toString());
					if (isMember) {
						return res.status(200).json({
							status: "accepted",
							inviteStatus: "accepted",
							workspace: { _id: workspace._id, name: workspace.name, slug: workspace.slug },
							workspaceName: workspace.name,
							isLoggedIn: true,
						});
					}
				}
			}
			return res.status(410).json({ message: "Invitation expired or already used" });
		}

		const user = await User.findOne({ email: decoded.email }).select("_id email");
		return res.status(200).json(buildPreviewPayload({ invite, decoded, user, currentUser: req.user }));
	} catch (err) {
		if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
			return res.status(410).json({ message: "Invitation expired or invalid" });
		}
		return next(err);
	}
};

export const acceptInvite = async (req, res, next) => {
	try {
		const parsed = tokenSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		if (!req.user) {
			return res.status(401).json({ message: "Login required to accept this invite" });
		}

		const { decoded, cachedInvite, invite } = await loadInviteFromToken(parsed.data.token);
		if (!cachedInvite || !invite) {
			return res.status(410).json({ message: "Invitation expired or already used" });
		}

		if (req.user.email.toLowerCase() !== decoded.email.toLowerCase()) {
			return res.status(403).json({ message: "This invite is for a different email address" });
		}

		const workspace = await Workspace.findById(decoded.workspaceId);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		const existingMembership = getWorkspaceRoleMembership(workspace, req.user._id);
		if (!existingMembership) {
			await addMemberToWorkspace({ workspace, userId: req.user._id, role: decoded.role });
		}

		await markInviteAccepted(invite);
		await redis.del(buildInviteCacheKey(decoded.tokenId));

		try {
			await Notification.updateMany(
				{
					recipient: req.user._id,
					type: "workspace_invite",
					"payload.inviteId": invite._id,
				},
				{
					$set: {
						isRead: true,
						"payload.inviteStatus": "accepted",
						"payload.acceptedAt": new Date(),
					},
					$unset: {
						"payload.inviteToken": "",
						"payload.inviteUrl": "",
					},
				},
			);
		} catch (notificationErr) {
			console.error("Notification update error in acceptInvite:", notificationErr.message);
		}

		return res.status(200).json({
			message: "Workspace joined successfully",
			workspace: {
				_id: workspace._id,
				name: workspace.name,
				slug: workspace.slug,
			},
		});
	} catch (err) {
		if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
			return res.status(410).json({ message: "Invitation expired or invalid" });
		}
		return next(err);
	}
};

export const acceptInviteAndRegister = async (req, res, next) => {
	try {
		const parsed = acceptRegisterSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const { decoded, cachedInvite, invite } = await loadInviteFromToken(parsed.data.token);
		if (!cachedInvite || !invite) {
			return res.status(410).json({ message: "Invitation expired or already used" });
		}

		const existingUser = await User.findOne({ email: decoded.email });
		if (existingUser) {
			return res.status(409).json({
				message: "An account with this email already exists. Please log in and accept the invite.",
			});
		}

		const passwordHash = await bcrypt.hash(parsed.data.password, 12);
		const user = await User.create({
			name: parsed.data.name,
			email: decoded.email,
			passwordHash,
			isVerified: true,
		});

		const workspace = await Workspace.findById(decoded.workspaceId);
		if (!workspace) {
			return res.status(404).json({ message: "Workspace not found" });
		}

		await addMemberToWorkspace({ workspace, userId: user._id, role: decoded.role });
		await markInviteAccepted(invite);
		await redis.del(buildInviteCacheKey(decoded.tokenId));

		const { accessToken, refreshToken } = await generateTokens(user);
		setRefreshCookie(res, refreshToken);

		return res.status(201).json({
			accessToken,
			user,
			workspace: {
				_id: workspace._id,
				name: workspace.name,
				slug: workspace.slug,
			},
		});
	} catch (err) {
		if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
			return res.status(410).json({ message: "Invitation expired or invalid" });
		}
		return next(err);
	}
};
