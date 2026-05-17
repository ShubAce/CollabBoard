import jwt from "jsonwebtoken";
import { isBlacklisted } from "../services/token.services.js";
import User from "../models/User.js";

export const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader?.split(" ")[1];
	if (!token) return res.status(401).json({ message: "No token provided" });

	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		// Check blacklist (logout)
		if (await isBlacklisted(decoded.jti)) {
			return res.status(401).json({ message: "Token revoked" });
		}

		req.user = await User.findById(decoded.userId).select("-passwordHash -refreshTokenHash");
		if (!req.user) return res.status(401).json({ message: "User not found" });

		req.tokenJti = decoded.jti;
		req.tokenExp = decoded.exp;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};
