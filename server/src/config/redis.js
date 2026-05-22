import Redis from "ioredis";

const redis = process.env.REDIS_URL
	? new Redis(process.env.REDIS_URL)
	: new Redis({
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
			password: process.env.REDIS_PASSWORD || undefined,
	  });

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err));

export default redis;