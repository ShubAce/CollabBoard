import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		action: { type: String, required: true },
		entity: {
			type: {
				type: String,
				required: true,
			},
			id: { type: mongoose.Schema.Types.ObjectId, required: true },
		},
		meta: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true },
);

activityLogSchema.index({ workspace: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
