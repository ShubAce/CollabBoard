import "dotenv/config";
import mongoose from "mongoose";
import cron from "node-cron";
import nodemailer from "nodemailer";
import emailQueue from "../emailQueue.js";
import Task from "../../models/Task.js";

// Workers run as standalone processes — need their own DB connection
await mongoose.connect(process.env.MONGO_URI);

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: process.env.SMTP_PORT,
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const templates = {
	send_workspace_invite: (data) => ({
		subject: `You've been invited to ${data.workspaceName}`,
		html: `<p>Hi ${data.userName}, <b>${data.inviterName}</b> invited you to join <b>${data.workspaceName}</b>.</p><p><a href="${data.inviteUrl}">Accept invitation →</a></p>`,
	}),
	send_task_assigned: (data) => ({
		subject: `Task assigned: ${data.taskTitle}`,
		html: `<p>Hi ${data.userName}, you've been assigned <b>${data.taskTitle}</b> in <b>${data.boardName}</b>. <a href="${data.taskUrl}">View task →</a></p>`,
	}),
	send_comment_mention: (data) => ({
		subject: `${data.authorName} mentioned you in a comment`,
		html: `<p>Hi ${data.userName}, you were mentioned in a comment on <b>${data.taskTitle}</b>.</p>`,
	}),
	send_password_reset: (data) => ({
		subject: "Reset your CollabBoard password",
		html: `<p>Click <a href="${data.resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
	}),
	send_task_due_reminder: (data) => ({
		subject: `⏰ Task due tomorrow: ${data.taskTitle}`,
		html: `<p>Hi ${data.userName}, the task <b>${data.taskTitle}</b> is due tomorrow. Don't forget to complete it!</p>`,
	}),
};

emailQueue.process(async (job) => {
	const { name, data } = job;
	const template = templates[name];
	if (!template) throw new Error(`Unknown email job: ${name}`);

	const { subject, html } = template(data);
	await transporter.sendMail({
		from: process.env.EMAIL_FROM,
		to: data.to,
		subject,
		html,
	});
	console.log(`Email sent [${name}] to ${data.to}`);
});

emailQueue.on("failed", (job, err) => {
	console.error(`Email job failed [${job.name}]:`, err.message);
});

// ── Due-date reminder cron — runs daily at 9 AM ──────────────────────────────
cron.schedule("0 9 * * *", async () => {
	console.log("[cron] Running due-date reminder job...");
	try {
		const now = new Date();
		const startOfTomorrow = new Date(now);
		startOfTomorrow.setDate(now.getDate() + 1);
		startOfTomorrow.setHours(0, 0, 0, 0);

		const endOfTomorrow = new Date(startOfTomorrow);
		endOfTomorrow.setHours(23, 59, 59, 999);

		const dueTasks = await Task.find({
			dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
			status: { $ne: "done" },
		}).populate("assignees", "name email");

		let queued = 0;
		for (const task of dueTasks) {
			for (const assignee of task.assignees) {
				await emailQueue.add("send_task_due_reminder", {
					to: assignee.email,
					userName: assignee.name,
					taskTitle: task.title,
				});
				queued++;
			}
		}
		console.log(`[cron] Due-date reminders queued: ${queued}`);
	} catch (err) {
		console.error("[cron] Due-date reminder error:", err.message);
	}
});

console.log("Email worker running (with daily due-date cron at 9 AM)...");
