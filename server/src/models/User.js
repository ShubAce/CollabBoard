import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true },
		passwordHash: { type: String, default: null },
		avatar: { type: String, default: null },
		googleId: { type: String, default: null },
		isVerified: { type: Boolean, default: false },
		refreshTokenHash: { type: String, default: null },
		status: {
			id: { type: String, default: "available" },
			label: { type: String, default: "Available" },
			icon: { type: String, default: "check" },
			color: { type: String, default: "var(--green)" }
		},
	},
	{ timestamps: true },
);

// Never return password hash to client
userSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.passwordHash;
	delete obj.refreshTokenHash;
	return obj;
};

userSchema.methods.comparePassword = async function (plain) {
	return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model("User", userSchema);