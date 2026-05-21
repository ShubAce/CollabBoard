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

const BRAND_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${BRAND.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>`;

const escapeHtml = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const ICONS = {
	userPlus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
	clipboardCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="m9 14 2 2 4-4"/></svg>`,
	messageCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
	hash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
	key: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`,
	clock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const THEMES = {
	invite: "#6366f1",
	task: "#10b981",
	comment: "#0ea5e9",
	chat: "#ec4899",
	password: "#f59e0b",
	alert: "#ef4444",
};

const renderEmail = ({ subject, preheader, greeting, message, ctaLabel, ctaUrl, details = [], footerNote, themeColor = BRAND.accent, iconSvg }) => {
	const detailRows = details
		.filter((item) => item?.value)
		.map(
			(item) =>
				`<tr>
				<td style="padding:8px 0;color:${BRAND.muted};font-size:13px;width:120px;border-bottom:1px solid #f1f3f5;">${escapeHtml(item.label)}</td>
				<td style="padding:8px 0;color:${BRAND.text};font-size:14px;font-weight:600;border-bottom:1px solid #f1f3f5;">${escapeHtml(item.value)}</td>
			</tr>`,
		)
		.join("");

	const buttonHtml =
		ctaLabel && ctaUrl
			? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${themeColor};color:#FFFFFF;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">${escapeHtml(ctaLabel)}</a>`
			: "";

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
	<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
		${escapeHtml(preheader || subject)}
	</div>
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:40px 0;">
		<tr>
			<td align="center">
				<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:92%;margin-bottom:16px;">
					<tr>
						<td style="text-align:center;">
							<div style="display:inline-flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:${BRAND.text};">
								${BRAND_LOGO}
								${BRAND.name}
							</div>
						</td>
					</tr>
				</table>
				<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:92%;background:${BRAND.card};border-radius:16px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025);">
					<tr>
						<td style="background:${themeColor};padding:40px 24px 30px;text-align:center;">
							${iconSvg ? `<div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:rgba(255,255,255,0.2);color:#fff;border-radius:50%;margin-bottom:16px;">${iconSvg}</div>` : ""}
							<h1 style="margin:0;font-size:24px;color:#ffffff;line-height:1.2;font-weight:700;">${escapeHtml(subject)}</h1>
						</td>
					</tr>
					<tr>
						<td style="padding:32px 32px 40px;">
							<p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};font-weight:500;">${escapeHtml(greeting || "Hi there,")}</p>
							<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${message}</p>
							${detailRows ? `<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;">${detailRows}</table></div>` : ""}
							${buttonHtml ? `<div style="text-align:center;margin:32px 0 16px;">${buttonHtml}</div>` : ""}
							${footerNote ? `<p style="margin:24px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.5;text-align:center;border-top:1px solid #f1f3f5;padding-top:24px;">${escapeHtml(footerNote)}</p>` : ""}
						</td>
					</tr>
				</table>
				<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:92%;margin-top:24px;">
					<tr>
						<td style="text-align:center;color:${BRAND.muted};font-size:12px;line-height:1.5;">
							&copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.<br/>
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
			themeColor: THEMES.invite,
			iconSvg: ICONS.userPlus,
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
			themeColor: THEMES.task,
			iconSvg: ICONS.clipboardCheck,
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
			themeColor: THEMES.comment,
			iconSvg: ICONS.messageCircle,
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
			themeColor: THEMES.chat,
			iconSvg: ICONS.hash,
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
			themeColor: THEMES.password,
			iconSvg: ICONS.key,
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
			themeColor: THEMES.alert,
			iconSvg: ICONS.clock,
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
