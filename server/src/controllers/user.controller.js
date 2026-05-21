import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

const updateMeSchema = z.object({
	name: z.string().trim().min(1, "Name is required").optional(),
	avatar: z.string().trim().url("Avatar must be a valid URL").or(z.literal("")).optional(),
	status: z.object({
		id: z.string(),
		label: z.string(),
		icon: z.string(),
		color: z.string()
	}).optional(),
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const getMe = async (req, res) => {
	return res.status(200).json(req.user);
};

export const updateMe = async (req, res, next) => {
	try {
		const parsed = updateMeSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		if (Object.keys(parsed.data).length === 0) {
			return res.status(400).json({ message: "No fields to update" });
		}

		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (parsed.data.name) user.name = parsed.data.name;
		if (parsed.data.avatar !== undefined) user.avatar = parsed.data.avatar || null;
		if (parsed.data.status !== undefined) user.status = parsed.data.status || null;
		await user.save();

		return res.status(200).json(user);
	} catch (err) {
		return next(err);
	}
};

export const changePassword = async (req, res, next) => {
	try {
		const parsed = changePasswordSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
		}

		const user = await User.findById(req.user._id);
		if (!user || !user.passwordHash) {
			return res.status(400).json({ message: "Password change is not available for this account" });
		}

		const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
		if (!matches) {
			return res.status(401).json({ message: "Current password is incorrect" });
		}

		user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
		await user.save();

		return res.status(200).json({ message: "Password updated" });
	} catch (err) {
		return next(err);
	}
};

export const searchUsers = async (req, res, next) => {
	try {
		const query = (req.query.q || "").trim();
		if (!query) {
			return res.status(200).json([]);
		}

		let excludedUserIds = [];
		if (req.query.workspaceId) {
			const workspace = await Workspace.findById(req.query.workspaceId).select("members.user");
			if (workspace) {
				excludedUserIds = workspace.members.map((member) => member.user);
			}
		}

		const users = await User.find({
			...(excludedUserIds.length ? { _id: { $nin: excludedUserIds } } : {}),
			$or: [{ name: { $regex: query, $options: "i" } }, { email: { $regex: query, $options: "i" } }],
		})
			.select("name email avatar")
			.limit(10);

		return res.status(200).json(users);
	} catch (err) {
		return next(err);
	}
};
