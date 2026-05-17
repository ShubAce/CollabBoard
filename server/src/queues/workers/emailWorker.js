import "dotenv/config";
import nodemailer from "nodemailer";
import emailQueue from "../emailQueue.js";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: process.env.SMTP_PORT,
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const templates = {
	send_workspace_invite: (data) => ({
		subject: `You've been invited to ${data.workspaceName}`,
		html: `<p>Hi ${data.userName}, <b>${data.inviterName}</b> invited you to join <b>${data.workspaceName}</b>.</p>`,
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

console.log("Email worker running...");