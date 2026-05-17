import mongoose from "mongoose";

const whiteboardSnapshotSchema = new mongoose.Schema(
	{
		board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
		data: { type: String, required: true },
		savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		savedAt: { type: Date, default: Date.now },
	},
	{ timestamps: false },
);

export default mongoose.model("WhiteboardSnapshot", whiteboardSnapshotSchema);
