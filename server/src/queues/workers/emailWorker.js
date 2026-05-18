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

const BRAND = {
	name: "CollabBoard",
	accent: "#6C63FF",
	bg: "#F4F5FB",
	card: "#FFFFFF",
	text: "#111827",
	muted: "#6B7280",
	border: "#E5E7EB",
};

const escapeHtml = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const renderEmail = ({ subject, preheader, greeting, message, ctaLabel, ctaUrl, details = [], footerNote }) => {
	const detailRows = details
		.filter((item) => item?.value)
		.map(
			(item) =>
				`<tr>
				<td style="padding:6px 0;color:${BRAND.muted};font-size:12px;width:130px;">${escapeHtml(item.label)}</td>
				<td style="padding:6px 0;color:${BRAND.text};font-size:13px;font-weight:600;">${escapeHtml(item.value)}</td>
			</tr>`,
		)
		.join("");

	const buttonHtml =
		ctaLabel && ctaUrl
			? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${BRAND.accent};color:#FFFFFF;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">${escapeHtml(ctaLabel)}</a>`
			: "";

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
	<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
		${escapeHtml(preheader || subject)}
	</div>
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:24px 0;">
		<tr>
			<td align="center">
				<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:92%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
					<tr>
						<td style="padding:20px 24px;border-bottom:1px solid ${BRAND.border};">
							<span style="font-size:16px;font-weight:700;color:${BRAND.text};">${BRAND.name}</span>
						</td>
					</tr>
					<tr>
						<td style="padding:24px;">
							<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escapeHtml(subject)}</h1>
							<p style="margin:0 0 12px;color:${BRAND.muted};font-size:14px;">${escapeHtml(greeting || "Hi there,")}</p>
							<p style="margin:0 0 18px;font-size:14px;line-height:1.6;">${message}</p>
							${detailRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">${detailRows}</table>` : ""}
							${buttonHtml ? `<div style="margin:8px 0 22px;">${buttonHtml}</div>` : ""}
							${footerNote ? `<p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.5;">${escapeHtml(footerNote)}</p>` : ""}
						</td>
					</tr>
					<tr>
						<td style="padding:16px 24px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:11px;">
							You received this email because you have an account or invitation on ${BRAND.name}.
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;

	const textLines = [
		subject,
		"",
		greeting || "Hi there,",
		"",
		message.replace(/<[^>]*>/g, ""),
		"",
		...details.filter((item) => item?.value).map((item) => `${item.label}: ${item.value}`),
		ctaLabel && ctaUrl ? "" : null,
		ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : null,
		"",
		footerNote || "",
	]
		.filter((line) => line !== null)
		.join("\n");

	return { subject, html, text: textLines };
};

const templates = {
	send_workspace_invite: (data) =>
		renderEmail({
			subject: `You have a workspace invite`,
			preheader: `${data.inviterName || "Someone"} invited you to ${data.workspaceName || "a workspace"}`,
			greeting: `Hi ${data.userName || "there"},`,
			message: `${escapeHtml(data.inviterName || "Someone")} invited you to join <strong>${escapeHtml(data.workspaceName || "a workspace")}</strong> as <strong>${escapeHtml(data.role || "member")}</strong>.`,
			ctaLabel: "Review invite",
			ctaUrl: data.inviteUrl,
			details: [
				{ label: "Workspace", value: data.workspaceName },
				{ label: "Role", value: data.role },
				{ label: "Invited by", value: data.inviterName },
			],
			footerNote: "If you were not expecting this invite, you can ignore this email.",
		}),
	send_task_assigned: (data) =>
		renderEmail({
			subject: `Task assigned: ${data.taskTitle || "New task"}`,
			preheader: `You were assigned ${data.taskTitle || "a task"}`,
			greeting: `Hi ${data.userName || "there"},`,
			message: `You have been assigned <strong>${escapeHtml(data.taskTitle || "a task")}</strong>${data.boardName ? ` in <strong>${escapeHtml(data.boardName)}</strong>` : ""}.`,
			ctaLabel: data.taskUrl ? "View task" : null,
			ctaUrl: data.taskUrl,
			details: [
				{ label: "Board", value: data.boardName },
				{ label: "Task", value: data.taskTitle },
			],
			footerNote: "Open CollabBoard to view updates and collaborate.",
		}),
	send_comment_mention: (data) =>
		renderEmail({
			subject: `${data.authorName || "Someone"} mentioned you`,
			preheader: `New mention on ${data.taskTitle || "a task"}`,
			greeting: `Hi ${data.userName || "there"},`,
			message: `<strong>${escapeHtml(data.authorName || "Someone")}</strong> mentioned you in a comment on <strong>${escapeHtml(data.taskTitle || "a task")}</strong>.`,
			ctaLabel: data.taskUrl ? "View comment" : null,
			ctaUrl: data.taskUrl,
			details: [{ label: "Task", value: data.taskTitle }],
			footerNote: "Reply in CollabBoard to keep the conversation going.",
		}),
	send_chat_mention: (data) =>
		renderEmail({
			subject: `${data.authorName || "Someone"} mentioned you in chat`,
			preheader: `New mention in ${data.workspaceName || "workspace"} chat`,
			greeting: `Hi ${data.userName || "there"},`,
			message: `<strong>${escapeHtml(data.authorName || "Someone")}</strong> mentioned you in the <strong>${escapeHtml(data.workspaceName || "workspace")}</strong> chat.`,
			ctaLabel: data.chatUrl ? "Open chat" : null,
			ctaUrl: data.chatUrl,
			details: [{ label: "Workspace", value: data.workspaceName }],
			footerNote: "Jump in to keep the conversation moving.",
		}),
	send_password_reset: (data) =>
		renderEmail({
			subject: "Reset your CollabBoard password",
			preheader: "Reset your password in a few clicks",
			greeting: "Hi there,",
			message: "We received a request to reset your password. Use the button below to continue.",
			ctaLabel: "Reset password",
			ctaUrl: data.resetUrl,
			footerNote: "If you did not request this change, you can ignore this email.",
		}),
	send_task_due_reminder: (data) =>
		renderEmail({
			subject: `Task due tomorrow: ${data.taskTitle || "Upcoming task"}`,
			preheader: `${data.taskTitle || "A task"} is due tomorrow`,
			greeting: `Hi ${data.userName || "there"},`,
			message: `Reminder: <strong>${escapeHtml(data.taskTitle || "a task")}</strong> is due tomorrow.`,
			ctaLabel: data.taskUrl ? "Open task" : null,
			ctaUrl: data.taskUrl,
			details: [{ label: "Task", value: data.taskTitle }],
			footerNote: "Update the task status to keep your team in sync.",
		}),
};

const processEmailJob = async (job) => {
	const { name, data } = job;
	const template = templates[name];
	if (!template) throw new Error(`Unknown email job: ${name}`);

	const { subject, html, text } = template(data);
	await transporter.sendMail({
		from: process.env.EMAIL_FROM,
		to: data.to,
		subject,
		html,
		text,
	});
	console.log(`Email sent [${name}] to ${data.to}`);
};

for (const name of Object.keys(templates)) {
	emailQueue.process(name, processEmailJob);
}

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
					taskUrl: `${process.env.CLIENT_URL}/app/workspaces/${task.workspace}/boards/${task.board}`,
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
