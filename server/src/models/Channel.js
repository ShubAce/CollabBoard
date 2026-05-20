import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		name: { type: String, required: true, trim: true, lowercase: true },
		description: { type: String, default: "" },
		isPrivate: { type: Boolean, default: false },
		isArchived: { type: Boolean, default: false },
		isReadOnly: { type: Boolean, default: false },
		members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	},
	{ timestamps: true },
);

channelSchema.index({ workspace: 1, name: 1 }, { unique: true });

export default mongoose.model("Channel", channelSchema);
