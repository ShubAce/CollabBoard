import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		content: { type: String, required: true },
		type: { type: String, enum: ["text", "system"], default: "text" },
	},
	{ timestamps: true },
);

messageSchema.index({ workspace: 1, _id: -1 });

export default mongoose.model("Message", messageSchema);
