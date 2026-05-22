import "dotenv/config";
import mongoose from "mongoose";
import cron from "node-cron";
import emailQueue from "../emailQueue.js";
import Task from "../../models/Task.js";

// ── DB Connection ─────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB connected.");

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Resend Sender Resolution ──────────────────────────────────────────────────
// Resend requires the `from` address to use a domain you've verified in their
// dashboard (app.resend.com/domains). On the free plan without a custom domain,
// the only usable sender is: onboarding@resend.dev
//
// YOUR CURRENT EMAIL_FROM uses @gmail.com which Resend will reject with 403.
//
// Fix (pick one):
//   A) Verify your own domain at app.resend.com/domains, then set:
//        EMAIL_FROM="CollabBoard <you@yourdomain.com>"
//   B) Leave EMAIL_FROM as-is and set RESEND_FROM_OVERRIDE in Render:
//        RESEND_FROM_OVERRIDE="CollabBoard <you@yourdomain.com>"
//   C) For quick testing only — no override needed, falls back to onboarding@resend.dev
//
// The function below resolves the right from address automatically.
function resolveFromAddress() {
    // Explicit override always wins (set this in Render env vars)
    if (process.env.RESEND_FROM_OVERRIDE) {
        return process.env.RESEND_FROM_OVERRIDE.trim();
    }

    const raw = (process.env.EMAIL_FROM || "").trim();

    // Strip outer quotes that .env files sometimes add: "CollabBoard <x>" → CollabBoard <x>
    const unquoted = raw.replace(/^["']|["']$/g, "").trim();

    // Extract the email address from "Display Name <email@domain.com>" format
    const match = unquoted.match(/<([^>]+)>/);
    const emailAddress = match ? match[1].trim() : unquoted;

    // Resend will reject any @gmail.com, @yahoo.com, etc. as the sender
    // unless you own and verify that domain. Fall back to their sandbox address.
    const isFreeProvider = /\@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i.test(emailAddress);
    if (isFreeProvider || !emailAddress.includes("@")) {
        console.warn(
            `[resend] EMAIL_FROM uses "${emailAddress}" which is not a Resend-verified domain.\n` +
            `         Falling back to onboarding@resend.dev for testing.\n` +
            `         To send from your own address, verify a domain at app.resend.com/domains\n` +
            `         and set RESEND_FROM_OVERRIDE="CollabBoard <you@yourdomain.com>" in Render.`
        );
        return "CollabBoard <onboarding@resend.dev>";
    }

    // Use the cleaned unquoted value as-is
    return unquoted;
}

const RESEND_FROM = resolveFromAddress();
console.log(`[resend] Sending from: ${RESEND_FROM}`);

// ── Resend Send Function ──────────────────────────────────────────────────────
async function sendMailWithResend(mailOptions, maxAttempts = 3) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not set in environment variables.");
    }

    const { to, subject, html, text } = mailOptions;
    const toArray = Array.isArray(to) ? to : [to];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: RESEND_FROM,
                    to: toArray,
                    subject,
                    html,
                    text,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Resend API ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (err) {
            console.error(`[resend] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
            if (attempt < maxAttempts) {
                const delay = 1000 * attempt; // 1s, 2s
                console.log(`[resend] Retrying in ${delay / 1000}s…`);
                await sleep(delay);
            } else {
                throw err;
            }
        }
    }
}

// ── Brand & Templates ─────────────────────────────────────────────────────────
const BRAND = {
    name: "CollabBoard",
    accent: "#4F46E5",
    bg: "#F3F4F6",
    card: "#FFFFFF",
    textMain: "#111827",
    textSecondary: "#4B5563",
    muted: "#9CA3AF",
    border: "#E5E7EB",
    plate: "#F9FAFB",
};

const BRAND_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="6" fill="${BRAND.accent}" />
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
    userPlus:       `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
    clipboardCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="m9 14 2 2 4-4"/></svg>`,
    messageCircle:  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
    hash:           `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
    key:            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`,
    clock:          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

const THEMES = {
    invite:   "#4F46E5",
    task:     "#10B981",
    comment:  "#0EA5E9",
    chat:     "#EC4899",
    password: "#F59E0B",
    alert:    "#EF4444",
};

const renderEmail = ({
    subject, preheader, greeting, message,
    ctaLabel, ctaUrl, details = [], footerNote,
    themeColor = BRAND.accent, iconSvg,
}) => {
    const themedIcon = iconSvg ? iconSvg.replace('stroke="currentColor"', `stroke="${themeColor}"`) : "";
    const validDetails = details.filter((item) => item?.value);

    const detailHtml = validDetails.length > 0 ? `
        <div style="background:${BRAND.plate}; border:1px solid ${BRAND.border}; border-radius:12px; padding:20px; margin-top:24px; margin-bottom:24px;">
            ${validDetails.map((item, index) => `
                <div style="display:block; ${index !== 0 ? "margin-top:16px;" : ""}">
                    <div style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:${BRAND.muted}; margin-bottom:4px;">
                        ${escapeHtml(item.label)}
                    </div>
                    <div style="font-size:15px; font-weight:500; color:${BRAND.textMain};">
                        ${escapeHtml(item.value)}
                    </div>
                </div>
            `).join("")}
        </div>
    ` : "";

    const buttonHtml = ctaLabel && ctaUrl ? `
        <div style="margin-top:32px;">
            <a href="${escapeHtml(ctaUrl)}" style="
                display:inline-block;
                background-color:${themeColor};
                color:#FFFFFF;
                text-decoration:none;
                padding:14px 28px;
                border-radius:8px;
                font-size:15px;
                font-weight:600;
                box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);
            ">
                ${escapeHtml(ctaLabel)}
            </a>
        </div>
    ` : "";

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.bg}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;">

    <div style="display:none; max-height:0; overflow:hidden; color:transparent; font-size:0;">
        ${escapeHtml(preheader || subject)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
        <tr>
            <td align="center">

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin-bottom:24px;">
                    <tr>
                        <td align="center">
                            <div style="display:inline-flex; align-items:center; gap:10px; font-size:22px; font-weight:700; color:${BRAND.textMain}; letter-spacing:-0.02em;">
                                ${BRAND_LOGO}
                                ${BRAND.name}
                            </div>
                        </td>
                    </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:${BRAND.card}; border-radius:16px; overflow:hidden; border:1px solid ${BRAND.border}; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="height:6px; background-color:${themeColor};"></td>
                    </tr>
                    <tr>
                        <td style="padding:48px 40px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
                                <tr>
                                    ${iconSvg ? `
                                    <td width="48" style="padding-right:16px;">
                                        <div style="width:48px; height:48px; border-radius:12px; background-color:${themeColor}1A; display:flex; align-items:center; justify-content:center;">
                                            ${themedIcon}
                                        </div>
                                    </td>
                                    ` : ""}
                                    <td>
                                        <h1 style="margin:0; font-size:24px; font-weight:700; color:${BRAND.textMain}; line-height:1.2;">
                                            ${escapeHtml(subject)}
                                        </h1>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 12px; font-size:16px; font-weight:600; color:${BRAND.textMain};">
                                ${escapeHtml(greeting || "Hi there,")}
                            </p>

                            <div style="font-size:16px; line-height:1.6; color:${BRAND.textSecondary}; margin-bottom:8px;">
                                ${message}
                            </div>

                            ${detailHtml}
                            ${buttonHtml}

                            ${footerNote ? `
                                <div style="margin-top:40px; padding-top:24px; border-top:1px solid ${BRAND.border}; font-size:14px; line-height:1.6; color:${BRAND.muted};">
                                    ${escapeHtml(footerNote)}
                                </div>
                            ` : ""}
                        </td>
                    </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin-top:24px;">
                    <tr>
                        <td align="center" style="font-size:13px; line-height:1.6; color:${BRAND.muted};">
                            © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.<br />
                            You are receiving this email because of your workspace activity on ${BRAND.name}.
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>
</html>`;

    const textLines = [
        subject, "",
        greeting || "Hi there,", "",
        message.replace(/<[^>]*>/g, ""), "",
        ...validDetails.map((item) => `${item.label}: ${item.value}`),
        ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : "",
        "", footerNote || "",
    ].filter(Boolean).join("\n");

    return { subject, html, text: textLines };
};

// ── Email Templates ───────────────────────────────────────────────────────────
const templates = {
    send_workspace_invite: (data) =>
        renderEmail({
            subject: `You have a workspace invite`,
            preheader: `${data.inviterName || "Someone"} invited you to ${data.workspaceName || "a workspace"}`,
            greeting: `Hi ${data.userName || "there"},`,
            message: `${escapeHtml(data.inviterName || "Someone")} invited you to join <strong>${escapeHtml(data.workspaceName || "a workspace")}</strong> as a <strong>${escapeHtml(data.role || "member")}</strong>.`,
            ctaLabel: "Review invite",
            ctaUrl: data.inviteUrl,
            details: [
                { label: "Workspace", value: data.workspaceName },
                { label: "Role",      value: data.role },
                { label: "Invited by",value: data.inviterName },
            ],
            footerNote: "If you were not expecting this invite, you can safely ignore this email.",
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
                { label: "Task",  value: data.taskTitle },
            ],
            footerNote: "Open CollabBoard to view updates and collaborate with your team.",
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
            message: "We received a request to reset your password. Use the button below to continue and set up a new password for your account.",
            ctaLabel: "Reset password",
            ctaUrl: data.resetUrl,
            footerNote: "If you did not request this change, you can safely ignore this email. Your password will remain unchanged.",
            themeColor: THEMES.password,
            iconSvg: ICONS.key,
        }),

    send_task_due_reminder: (data) =>
        renderEmail({
            subject: `Task due tomorrow: ${data.taskTitle || "Upcoming task"}`,
            preheader: `${data.taskTitle || "A task"} is due tomorrow`,
            greeting: `Hi ${data.userName || "there"},`,
            message: `This is a quick reminder that <strong>${escapeHtml(data.taskTitle || "a task")}</strong> is due tomorrow.`,
            ctaLabel: data.taskUrl ? "Open task" : null,
            ctaUrl: data.taskUrl,
            details: [{ label: "Task", value: data.taskTitle }],
            footerNote: "Update the task status to keep your team in sync.",
            themeColor: THEMES.alert,
            iconSvg: ICONS.clock,
        }),
};

// ── Job Processor ─────────────────────────────────────────────────────────────
const processEmailJob = async (job) => {
    const { name, data } = job;
    const template = templates[name];
    if (!template) throw new Error(`Unknown email job: ${name}`);

    const { subject, html, text } = template(data);

    await sendMailWithResend({ from: RESEND_FROM, to: data.to, subject, html, text });
    console.log(`[email] Sent [${name}] → ${data.to}`);
};

// ── Boot ──────────────────────────────────────────────────────────────────────
if (!process.env.RESEND_API_KEY) {
    console.error("FATAL: RESEND_API_KEY is not set. Email worker cannot send emails.");
    process.exit(1);
}

console.log("Starting email job processors…");
for (const name of Object.keys(templates)) {
    emailQueue.process(name, processEmailJob);
}

emailQueue.on("failed",    (job, err) => console.error(`[email] FAILED  [${job.name}] → ${job.data?.to}: ${err.message}`));
emailQueue.on("completed", (job)      => console.log(`[email] SENT    [${job.name}] → ${job.data?.to}`));

// ── Due-date Reminder Cron ─────────────────────────────────────────────────────
cron.schedule("0 9 * * *", async () => {
    console.log("[cron] Running due-date reminder job…");
    try {
        const now = new Date();
        const startOfTomorrow = new Date(now);
        startOfTomorrow.setDate(now.getDate() + 1);
        startOfTomorrow.setHours(0, 0, 0, 0);

        const endOfTomorrow = new Date(startOfTomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);

        const dueTasks = await Task.find({
            dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
            status:  { $ne: "done" },
        }).populate("assignees", "name email");

        let queued = 0;
        for (const task of dueTasks) {
            for (const assignee of task.assignees) {
                await emailQueue.add("send_task_due_reminder", {
                    to:        assignee.email,
                    userName:  assignee.name,
                    taskTitle: task.title,
                    taskUrl:   `${process.env.CLIENT_URL}/app/workspaces/${task.workspace}/boards/${task.board}`,
                });
                queued++;
            }
        }
        console.log(`[cron] Queued ${queued} due-date reminder(s).`);
    } catch (err) {
        console.error("[cron] Error:", err.message);
    }
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
    console.log(`[shutdown] ${signal} received — draining email queue…`);
    try { await emailQueue.close(); } catch (_) {}
    process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

console.log("Email worker ready. Cron: due-date reminders at 9 AM daily.");