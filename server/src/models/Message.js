import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		url: { type: String, required: true },
		size: { type: Number },
		type: { type: String },
		uploadedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const reactionSchema = new mongoose.Schema(
	{
		emoji: { type: String, required: true },
		users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	},
	{ _id: false },
);

const messageSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
		sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
		threadCount: { type: Number, default: 0 },
		lastReplyAt: { type: Date, default: null },
		content: { type: String, default: "" },
		type: { type: String, enum: ["text", "system"], default: "text" },
		attachments: { type: [attachmentSchema], default: [] },
		reactions: { type: [reactionSchema], default: [] },
		isPinned: { type: Boolean, default: false },
		pinnedAt: { type: Date, default: null },
		pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
		editedAt: { type: Date, default: null },
		isDeleted: { type: Boolean, default: false },
		deletedAt: { type: Date, default: null },
		deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
	},
	{ timestamps: true },
);

messageSchema.index({ workspace: 1, _id: -1 });
messageSchema.index({ channel: 1, _id: -1 });
messageSchema.index({ threadId: 1, _id: -1 });

export default mongoose.model("Message", messageSchema);
