import Bull from "bull";

const emailQueue = process.env.REDIS_URL
	? new Bull("email", process.env.REDIS_URL, {
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
	: new Bull("email", {
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

// Bull re-emits its Redis clients' errors on the queue; without a listener a dropped
// connection (routine on managed Redis) becomes an uncaught exception and kills the process.
emailQueue.on("error", (err) => console.error(`[email queue] ${err.message}`));

export default emailQueue;