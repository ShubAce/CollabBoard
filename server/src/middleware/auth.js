import jwt from "jsonwebtoken";
import { isBlacklisted } from "../services/token.services.js";
import User from "../models/User.js";

const readBearerToken = (req) => {
	const authHeader = req.headers["authorization"];
	return authHeader?.split(" ")[1] || null;
};

export const authenticateToken = async (req, res, next) => {
	const token = readBearerToken(req);
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

export const attachUserIfPresent = async (req, res, next) => {
	const token = readBearerToken(req);
	if (!token) {
		return next();
	}

	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
		if (await isBlacklisted(decoded.jti)) {
			return next();
		}

		const user = await User.findById(decoded.userId).select("-passwordHash -refreshTokenHash");
		if (user) {
			req.user = user;
			req.tokenJti = decoded.jti;
			req.tokenExp = decoded.exp;
		}
	} catch {
		// Intentionally ignore invalid optional auth on public routes.
	}

	return next();
};
