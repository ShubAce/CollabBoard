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

// Strict auth limiters (brute-force protection). Only failed attempts count, so a
// user who signs in successfully is never locked out; dev gets more headroom.
const isProd = process.env.NODE_ENV === "production";
const authLimiterFor = (prefix, message) =>
	rateLimit({
		windowMs: 15 * 60 * 1000,
		max: isProd ? 10 : 100,
		skipSuccessfulRequests: true,
		standardHeaders: true,
		legacyHeaders: false,
		store: new RedisStore({
			prefix,
			sendCommand: (...args) => redis.call(...args),
		}),
		message: { message },
	});

export const authLimiter = authLimiterFor("rl:login:", "Too many login attempts. Please wait a few minutes and try again.");
export const registerLimiter = authLimiterFor("rl:register:", "Too many sign-up attempts. Please wait a few minutes and try again.");
