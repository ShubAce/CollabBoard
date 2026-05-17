import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../config/redis.js";

// General API limiter — 100 req/min per IP
export const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	store: new RedisStore({
		sendCommand: (...args) => redis.call(...args),
	}),
	message: { message: "Too many requests, please try again in a minute." },
});

// Strict auth limiter — 10 req/15min per IP (prevents brute force)
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	store: new RedisStore({
		sendCommand: (...args) => redis.call(...args),
	}),
	message: { message: "Too many login attempts, please try again later." },
});