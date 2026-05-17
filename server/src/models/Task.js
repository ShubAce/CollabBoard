import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		url: { type: String, required: true },
		uploadedAt: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const taskSchema = new mongoose.Schema(
	{
		board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		columnId: { type: mongoose.Schema.Types.ObjectId, required: true },
		title: { type: String, required: true, trim: true },
		description: { type: String, default: "" },
		order: { type: Number, required: true },
		priority: {
			type: String,
			enum: ["low", "medium", "high", "urgent"],
			default: "medium",
		},
		status: {
			type: String,
			enum: ["todo", "in_progress", "review", "done"],
			default: "todo",
		},
		assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		labels: [{ type: String }],
		dueDate: { type: Date },
		attachments: { type: [attachmentSchema], default: [] },
		comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	},
	{ timestamps: true },
);

taskSchema.index({ board: 1, columnId: 1, order: 1 });

export default mongoose.model("Task", taskSchema);
