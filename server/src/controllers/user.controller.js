import User from "../models/User.js";

export const getMe = async (req, res) => {
	return res.status(200).json(req.user);
};

export const searchUsers = async (req, res, next) => {
	try {
		const query = (req.query.q || "").trim();
		if (!query) {
			return res.status(200).json([]);
		}

		const users = await User.find({
			$or: [{ name: { $regex: query, $options: "i" } }, { email: { $regex: query, $options: "i" } }],
		})
			.select("name email avatar")
			.limit(10);

		return res.status(200).json(users);
	} catch (err) {
		return next(err);
	}
};
