import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import redis from "../config/redis.js";

export const generateTokens = async (user) => {
	const jti = uuidv4();

	const accessToken = jwt.sign({ userId: user._id, email: user.email, jti }, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
	});

	const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" });

	// Store hashed refresh token in Redis (TTL: 7 days)
	const hash = await bcrypt.hash(refreshToken, 10);
	await redis.set(`refresh:${user._id}`, hash, "EX", 60 * 60 * 24 * 7);

	return { accessToken, refreshToken };
};
export const blacklistToken = async (jti, expiresInMs) => {
	const ttlSeconds = Math.ceil(expiresInMs / 1000);
	await redis.set(`blacklist:${jti}`, "1", "EX", ttlSeconds);
};

export const isBlacklisted = async (jti) => {
	const val = await redis.get(`blacklist:${jti}`);
	return val !== null;
};