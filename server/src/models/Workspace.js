import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		role: {
			type: String,
			enum: ["owner", "admin", "editor", "viewer"],
			default: "viewer",
		},
		joinedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const workspaceSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
		description: { type: String, default: "" },
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		members: { type: [memberSchema], default: [] },
	},
	{ timestamps: true },
);

workspaceSchema.index({ "members.user": 1 });

export default mongoose.model("Workspace", workspaceSchema);
