import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
	{
		recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		type: {
			type: String,
			enum: ["task_assigned", "task_due", "comment_mention", "chat_mention", "workspace_invite"],
			required: true,
		},
		payload: { type: mongoose.Schema.Types.Mixed, default: {} },
		isRead: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
