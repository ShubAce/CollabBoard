import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import redis from "../config/redis.js";
import { blacklistToken, generateTokens } from "../services/token.services.js";

const registerSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	email: z.string().trim().email("Invalid email"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
	email: z.string().trim().email("Invalid email"),
	password: z.string().min(1, "Password is required"),
});

const buildRefreshCookieOptions = () => ({
	httpOnly: true,
	sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
	secure: process.env.NODE_ENV === "production",
	maxAge: 7 * 24 * 60 * 60 * 1000,
	path: "/api/v1/auth",
});

const setRefreshCookie = (res, refreshToken) => {
	res.cookie("refreshToken", refreshToken, buildRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
	res.clearCookie("refreshToken", buildRefreshCookieOptions());
};

const getRefreshToken = (req) => req.cookies?.refreshToken || req.body?.refreshToken;

export const register = async (req, res) => {
	const parsed = registerSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
	}

	const { name, email, password } = parsed.data;
	const normalizedEmail = email.toLowerCase();

	const existing = await User.findOne({ email: normalizedEmail });
	if (existing) {
		return res.status(409).json({ message: "Email already registered" });
	}

	const passwordHash = await bcrypt.hash(password, 12);

	await User.create({
		name,
		email: normalizedEmail,
		passwordHash,
		isVerified: false,
	});

	return res.status(201).json({ message: "Registration successful. Please verify your email." });
};

export const login = async (req, res) => {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
	}

	const { email, password } = parsed.data;
	const normalizedEmail = email.toLowerCase();

	const user = await User.findOne({ email: normalizedEmail });
	if (!user || !user.passwordHash) {
		return res.status(401).json({ message: "Invalid credentials" });
	}

	const matches = await bcrypt.compare(password, user.passwordHash);
	if (!matches) {
		return res.status(401).json({ message: "Invalid credentials" });
	}

	const { accessToken, refreshToken } = await generateTokens(user);
	setRefreshCookie(res, refreshToken);

	return res.status(200).json({ accessToken, user });
};

export const logout = async (req, res) => {
	const remainingMs = Math.max(req.tokenExp * 1000 - Date.now(), 0);
	if (remainingMs > 0) {
		await blacklistToken(req.tokenJti, remainingMs);
	}

	await redis.del(`refresh:${req.user._id}`);
	clearRefreshCookie(res);

	return res.status(200).json({ message: "Logged out" });
};

export const refresh = async (req, res) => {
	const refreshToken = getRefreshToken(req);
	if (!refreshToken) {
		return res.status(401).json({ message: "Refresh token required" });
	}

	let payload;
	try {
		payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
	} catch {
		return res.status(401).json({ message: "Invalid refresh token" });
	}

	const storedHash = await redis.get(`refresh:${payload.userId}`);
	if (!storedHash) {
		return res.status(401).json({ message: "Invalid refresh token" });
	}

	const matches = await bcrypt.compare(refreshToken, storedHash);
	if (!matches) {
		return res.status(401).json({ message: "Invalid refresh token" });
	}

	const user = await User.findById(payload.userId);
	if (!user) {
		return res.status(401).json({ message: "User not found" });
	}

	const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);
	setRefreshCookie(res, newRefreshToken);

	return res.status(200).json({ accessToken });
};

export const googleCallback = async (req, res) => {
	if (!req.user) {
		return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
	}

	const { accessToken, refreshToken } = await generateTokens(req.user);
	setRefreshCookie(res, refreshToken);

	const redirectUrl = new URL("/auth/callback", process.env.CLIENT_URL);
	redirectUrl.searchParams.set("token", accessToken);

	return res.redirect(redirectUrl.toString());
};
