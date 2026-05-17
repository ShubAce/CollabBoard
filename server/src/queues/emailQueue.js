import Bull from "bull";

const emailQueue = new Bull("email", {
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
		password: process.env.REDIS_PASSWORD,
	},
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 1000 },
		removeOnComplete: true,
		removeOnFail: false,
	},
});

export default emailQueue;