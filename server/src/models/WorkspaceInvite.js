import mongoose from "mongoose";

const workspaceInviteSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		email: { type: String, required: true, lowercase: true, trim: true },
		role: {
			type: String,
			enum: ["admin", "editor", "viewer"],
			required: true,
		},
		invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		token: { type: String, required: true, unique: true },
		status: {
			type: String,
			enum: ["pending", "accepted", "revoked", "expired"],
			default: "pending",
		},
		expiresAt: { type: Date, required: true },
		acceptedAt: { type: Date, default: null },
	},
	{ timestamps: true },
);

workspaceInviteSchema.index({ workspace: 1, status: 1, createdAt: -1 });

export default mongoose.model("WorkspaceInvite", workspaceInviteSchema);
