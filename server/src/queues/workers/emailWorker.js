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
	secure: process.env.SMTP_PORT === "465" || process.env.SMTP_PORT == 465,
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify()
	.then(() => console.log("SMTP connection verified successfully!"))
	.catch((err) => console.error("SMTP verification failed. Emails will not send:", err.message));

const BRAND = {
	name: "CollabBoard",
	accent: "#6366F1",
	bg: "#F5F7FB",
	card: "#FFFFFF",
	text: "#0F172A",
	muted: "#64748B",
	border: "#E2E8F0",
};

const BRAND_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
	<rect x="3" y="3" width="18" height="18" rx="5" fill="${BRAND.accent}" />
	<path d="M7 12H17" stroke="white" stroke-width="2" stroke-linecap="round"/>
	<path d="M12 7V17" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

const escapeHtml = (value) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const ICONS = {
	userPlus: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,

	clipboardCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="m9 14 2 2 4-4"/></svg>`,

	messageCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,

	hash: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,

	key: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`,

	clock: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const THEMES = {
	invite: "#6366F1",
	task: "#10B981",
	comment: "#0EA5E9",
	chat: "#EC4899",
	password: "#F59E0B",
	alert: "#EF4444",
};

const renderEmail = ({
	subject,
	preheader,
	greeting,
	message,
	ctaLabel,
	ctaUrl,
	details = [],
	footerNote,
	themeColor = BRAND.accent,
	iconSvg,
}) => {
	const detailCards = details
		.filter((item) => item?.value)
		.map(
			(item) => `
			<div style="
				background:#F8FAFC;
				border:1px solid ${BRAND.border};
				border-radius:18px;
				padding:18px;
				margin-bottom:14px;
			">

				<div style="
					font-size:11px;
					font-weight:700;
					letter-spacing:0.08em;
					text-transform:uppercase;
					color:${BRAND.muted};
					margin-bottom:8px;
				">
					${escapeHtml(item.label)}
				</div>

				<div style="
					font-size:15px;
					font-weight:600;
					line-height:1.5;
					color:${BRAND.text};
				">
					${escapeHtml(item.value)}
				</div>

			</div>
		`,
		)
		.join("");

	const buttonHtml =
		ctaLabel && ctaUrl
			? `
			<div style="margin-top:34px;">

				<a
					href="${escapeHtml(ctaUrl)}"
					style="
						display:inline-block;
						background:${themeColor};
						color:#FFFFFF;
						text-decoration:none;
						padding:15px 24px;
						border-radius:16px;
						font-size:15px;
						font-weight:600;
						letter-spacing:-0.01em;
						box-shadow:
							0 10px 25px rgba(15,23,42,0.12),
							inset 0 1px 0 rgba(255,255,255,0.14);
					"
				>
					${escapeHtml(ctaLabel)}
				</a>

			</div>
		`
			: "";

	const html = `
<!DOCTYPE html>
<html>

<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="color-scheme" content="light" />
	<meta name="supported-color-schemes" content="light" />
	<title>${escapeHtml(subject)}</title>
</head>

<body style="
	margin:0;
	padding:0;
	background:${BRAND.bg};
	font-family:
		Inter,
		-apple-system,
		BlinkMacSystemFont,
		'Segoe UI',
		sans-serif;
">

	<div style="
		display:none;
		max-height:0;
		overflow:hidden;
		opacity:0;
	">
		${escapeHtml(preheader || subject)}
	</div>

	<table
		role="presentation"
		width="100%"
		cellspacing="0"
		cellpadding="0"
		style="padding:48px 18px;"
	>
		<tr>
			<td align="center">

				<!-- Brand -->

				<table
					role="presentation"
					width="640"
					cellspacing="0"
					cellpadding="0"
					style="
						width:640px;
						max-width:100%;
						margin-bottom:18px;
					"
				>
					<tr>
						<td align="center">

							<div style="
								display:inline-flex;
								align-items:center;
								gap:12px;
								font-size:20px;
								font-weight:700;
								color:${BRAND.text};
								letter-spacing:-0.03em;
							">
								${BRAND_LOGO}
								${BRAND.name}
							</div>

						</td>
					</tr>
				</table>

				<!-- Card -->

				<table
					role="presentation"
					width="640"
					cellspacing="0"
					cellpadding="0"
					style="
						width:640px;
						max-width:100%;
						background:${BRAND.card};
						border-radius:30px;
						overflow:hidden;
						border:1px solid rgba(226,232,240,0.9);
						box-shadow:
							0 10px 40px rgba(15,23,42,0.08),
							0 2px 12px rgba(15,23,42,0.05);
					"
				>

					<!-- Hero -->

					<tr>
						<td style="
							background:
								radial-gradient(
									circle at top left,
									rgba(255,255,255,0.16),
									transparent 40%
								),
								linear-gradient(
									135deg,
									${themeColor} 0%,
									#8B5CF6 100%
								);

							padding:52px 38px 46px;
						">

							${
								iconSvg
									? `
								<div style="
									width:60px;
									height:60px;
									border-radius:20px;
									background:rgba(255,255,255,0.14);
									display:flex;
									align-items:center;
									justify-content:center;
									color:#FFFFFF;
									margin-bottom:28px;
									backdrop-filter:blur(10px);
								">
									${iconSvg}
								</div>
							`
									: ""
							}

							<div style="
								font-size:34px;
								font-weight:750;
								line-height:1.12;
								letter-spacing:-0.05em;
								color:#FFFFFF;
								max-width:460px;
							">
								${escapeHtml(subject)}
							</div>

						</td>
					</tr>

					<!-- Content -->

					<tr>
						<td style="padding:42px 38px;">

							<p style="
								margin:0 0 18px;
								font-size:16px;
								font-weight:600;
								color:${BRAND.text};
								letter-spacing:-0.01em;
							">
								${escapeHtml(greeting || "Hi there,")}
							</p>

							<div style="
								font-size:15px;
								line-height:1.85;
								color:#334155;
								margin-bottom:30px;
							">
								${message}
							</div>

							${detailCards}

							${buttonHtml}

							${
								footerNote
									? `
								<div style="
									margin-top:38px;
									padding-top:24px;
									border-top:1px solid ${BRAND.border};
									font-size:13px;
									line-height:1.7;
									color:${BRAND.muted};
								">
									${escapeHtml(footerNote)}
								</div>
							`
									: ""
							}

						</td>
					</tr>

				</table>

				<!-- Footer -->

				<table
					role="presentation"
					width="640"
					cellspacing="0"
					cellpadding="0"
					style="
						width:640px;
						max-width:100%;
						margin-top:22px;
					"
				>
					<tr>
						<td align="center">

							<div style="
								font-size:12px;
								line-height:1.8;
								color:${BRAND.muted};
							">
								© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
								<br />
								You are receiving this email because you have an account or workspace activity on ${BRAND.name}.
							</div>

						</td>
					</tr>
				</table>

			</td>
		</tr>
	</table>

</body>
</html>
`;

	const textLines = [
		subject,
		"",
		greeting || "Hi there,",
		"",
		message.replace(/<[^>]*>/g, ""),
		"",
		...details
			.filter((item) => item?.value)
			.map((item) => `${item.label}: ${item.value}`),
		ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : "",
		"",
		footerNote || "",
	]
		.filter(Boolean)
		.join("\\n");

	return {
		subject,
		html,
		text: textLines,
	};
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
