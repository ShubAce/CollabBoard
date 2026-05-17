import activityQueue from "../activityQueue.js";
import ActivityLog from "../../models/ActivityLog.js";

activityQueue.process(async (job) => {
	const { name, data } = job;

	const actionMap = {
		log_task_created: "task.created",
		log_task_moved: "task.moved",
		log_task_deleted: "task.deleted",
		log_member_invited: "member.invited",
		log_comment_added: "comment.added",
	};

	await ActivityLog.create({
		workspace: data.workspaceId,
		actor: data.actorId,
		action: actionMap[name],
		entity: { type: "task", id: data.taskId },
		meta: data,
	});
});