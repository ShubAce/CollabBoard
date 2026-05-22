import Bull from "bull";

const activityQueue = process.env.REDIS_URL
	? new Bull("activity", process.env.REDIS_URL, {
			redis: {
				tls: process.env.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
				maxRetriesPerRequest: null,
				enableReadyCheck: false,
			},
			defaultJobOptions: {
				attempts: 3,
				backoff: { type: "exponential", delay: 1000 },
				removeOnComplete: true,
				removeOnFail: false,
			},
	  })
	: new Bull("activity", {
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

export default activityQueue;
