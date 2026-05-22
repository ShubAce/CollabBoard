import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import mongoose from "mongoose";
import activityQueue from "../activityQueue.js";
import ActivityLog from "../../models/ActivityLog.js";

// Workers run as standalone processes — need their own DB connection
await mongoose.connect(process.env.MONGO_URI);

const actionMap = {
	log_task_created: { action: "task.created", entityType: "task" },
	log_task_moved: { action: "task.moved", entityType: "task" },
	log_task_deleted: { action: "task.deleted", entityType: "task" },
	log_member_invited: { action: "member.invited", entityType: "workspace_invite" },
	log_comment_added: { action: "comment.added", entityType: "task" },
};

const createActivityLog = async (job) => {
	const { name, data } = job;
	const config = actionMap[name];
	if (!config) {
		throw new Error(`Unknown activity job type: ${name}`);
	}

	await ActivityLog.create({
		workspace: data.workspaceId,
		actor: data.actorId,
		action: config.action,
		entity: {
			type: config.entityType,
			id: data.taskId || data.meta?.inviteId || null,
		},
		meta: data,
	});
};

for (const jobName of Object.keys(actionMap)) {
	activityQueue.process(jobName, createActivityLog);
}

activityQueue.on("failed", (job, err) => {
	console.error(`Activity job failed [${job.name}]:`, err.message);
});

console.log("Activity worker running...");
