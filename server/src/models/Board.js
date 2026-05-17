import mongoose from "mongoose";

const columnSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true },
		order: { type: Number, required: true },
		color: { type: String, default: "#E2E8F0" },
	},
	{ _id: true },
);

const boardSchema = new mongoose.Schema(
	{
		workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
		name: { type: String, required: true, trim: true },
		columns: { type: [columnSchema], default: [] },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	},
	{ timestamps: true },
);

export default mongoose.model("Board", boardSchema);
