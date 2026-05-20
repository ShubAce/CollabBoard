import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

const TYPE_META = {
	task_assigned: { icon: "check", label: "Task assigned", accentColor: "var(--accent)", bgColor: "var(--accent-muted)" },
	comment_mention: { icon: "chat", label: "Mentioned", accentColor: "var(--warning)", bgColor: "var(--warning-muted)" },
	chat_mention: { icon: "chat", label: "Chat mention", accentColor: "var(--warning)", bgColor: "var(--warning-muted)" },
	workspace_invite: { icon: "mail", label: "Workspace invite", accentColor: "var(--success)", bgColor: "var(--success-muted)" },
	task_due: { icon: "alert", label: "Due reminder", accentColor: "var(--danger)", bgColor: "var(--danger-muted)" },
};

const formatRelative = (iso) => {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
};

const getDateGroup = (iso) => {
	const d = new Date(iso);
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterdayStart = new Date(todayStart - 86400000);
	if (d >= todayStart) return "TODAY";
	if (d >= yesterdayStart) return "YESTERDAY";
	return "OLDER";
};

const getNotificationTitle = (n) => {
	if (n.type === "workspace_invite") return n.payload?.workspaceName || "Workspace invitation";
	if (n.type === "chat_mention") return n.payload?.workspaceName || "Workspace chat";
	return n.payload?.taskTitle || "";
};

const getNotificationDescription = (n) => {
	if (n.type === "workspace_invite") return `${n.payload?.inviterName || "Someone"} invited you to join ${n.payload?.workspaceName || "a workspace"} as ${n.payload?.role || "member"}.`;
	if (n.type === "task_assigned") return "A task was assigned to you.";
	if (n.type === "comment_mention") return "You were mentioned in a comment.";
	if (n.type === "chat_mention") return `${n.payload?.senderName || "Someone"} mentioned you in workspace chat.`;
	if (n.type === "task_due") return "A due date reminder for this task.";
	return "";
};

function Toggle({ value, onChange }) {
	return (
		<button
			type="button"
			aria-pressed={value}
			onClick={() => onChange(!value)}
			style={{ width: 40, height: 22, borderRadius: 11, background: value ? "var(--accent)" : "var(--bg-surface-3)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
		>
			<span style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
		</button>
	);
}

function PrefsModal({ onClose }) {
	const [prefs, setPrefs] = useState({
		taskAssigned: true, taskDue: true, taskOverdue: true,
		commentOnTask: true, mentionComment: true, mentionChat: false,
		workspaceInvite: true,
	});
	const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));
	const rows = [
		{ key: "taskAssigned", label: "Task assigned to me" },
		{ key: "taskDue", label: "Task due today" },
		{ key: "taskOverdue", label: "Task overdue" },
		{ key: "commentOnTask", label: "Comment on my tasks" },
		{ key: "mentionComment", label: "@mentions in comments" },
		{ key: "mentionChat", label: "@mentions in chat" },
		{ key: "workspaceInvite", label: "Workspace invitations" },
	];
	return (
		<div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
			<div className="modal fade-in" style={{ maxWidth: 480 }}>
				<div className="modal-header">
					<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Notification Preferences</h2>
					<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
						<Icon name="close" size={18} />
					</button>
				</div>
				<div className="modal-body">
					<p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notify me about</p>
					{rows.map(({ key, label }) => (
						<div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
							<span style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</span>
							<Toggle value={prefs[key]} onChange={() => toggle(key)} />
						</div>
					))}
					<div style={{ marginTop: 20, padding: "14px 16px", background: "var(--bg-surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--border-default)" }}>
						<p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Do Not Disturb</p>
						<p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)" }}>Pause all notifications</p>
						<Toggle value={false} onChange={() => {}} />
					</div>
				</div>
				<div className="modal-footer">
					<button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
					<button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Save preferences</button>
				</div>
			</div>
		</div>
	);
}

function NotifRow({ notif, onRead, onDelete }) {
	const meta = TYPE_META[notif.type] || TYPE_META.task_assigned;
	const [hovered, setHovered] = useState(false);
	const isInviteResolved = notif.type === "workspace_invite" && (notif.payload?.inviteStatus === "accepted" || !notif.payload?.inviteToken);
	const isActionable = !isInviteResolved;

	return (
		<div
			onClick={() => { if (isActionable) onRead(notif); }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				position: "relative", display: "flex", alignItems: "flex-start", gap: 12,
				padding: "14px 16px", cursor: isActionable ? "pointer" : "default",
				background: notif.isRead ? "transparent" : "rgba(108,99,255,0.05)",
				borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s",
			}}
		>
			{!notif.isRead && (
				<div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 28, background: "var(--accent)", borderRadius: "0 2px 2px 0" }} />
			)}
			<div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: meta.bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: meta.accentColor }}>
				<Icon name={meta.icon} size={18} />
			</div>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
					<span style={{ fontSize: 11, fontWeight: 600, color: meta.accentColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{meta.label}</span>
					{!notif.isRead && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
				</div>
				{getNotificationTitle(notif) && (
					<p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{getNotificationTitle(notif)}
					</p>
				)}
				<p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>{getNotificationDescription(notif)}</p>
				{notif.type === "workspace_invite" && notif.payload?.inviteToken && !notif.isRead && !isInviteResolved && (
					<button type="button" className="btn btn-sm" onClick={e => { e.stopPropagation(); onRead(notif); }} style={{ marginTop: 8, background: "var(--success-muted)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}>
						Review invite
					</button>
				)}
				<span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>{formatRelative(notif.createdAt)}</span>
			</div>
			{hovered && (
				<button type="button" onClick={e => { e.stopPropagation(); onDelete(notif._id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 6px", borderRadius: "var(--r-sm)" }} aria-label="Delete">
					<Icon name="close" size={14} />
				</button>
			)}
		</div>
	);
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [status, setStatus] = useState("loading");
	const [markingAll, setMarkingAll] = useState(false);
	const [filter, setFilter] = useState("all");
	const [showPrefs, setShowPrefs] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		let active = true;
		api.get("/notifications?limit=50")
			.then(({ data }) => {
				if (!active) return;
				setNotifications(data.notifications);
				setUnreadCount(data.unreadCount);
				setStatus("ready");
			})
			.catch(() => { if (active) setStatus("error"); });
		return () => { active = false; };
	}, []);

	const markRead = async (notif) => {
		if (!notif.isRead) {
			try {
				await api.patch(`/notifications/${notif._id}/read`);
				setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
				setUnreadCount(c => Math.max(0, c - 1));
			} catch { /* ignore */ }
		}
		if (notif.type === "workspace_invite" && (notif.payload?.inviteStatus === "accepted" || !notif.payload?.inviteToken)) return;
		const { workspaceId, boardId, inviteToken } = notif.payload || {};
		if (notif.type === "workspace_invite" && inviteToken) { navigate(`/invite/accept?token=${encodeURIComponent(inviteToken)}`); return; }
		if (notif.type === "chat_mention" && workspaceId) { navigate(`/app/workspaces/${workspaceId}/chat`); return; }
		if (workspaceId && boardId) navigate(`/app/workspaces/${workspaceId}/boards/${boardId}`);
	};

	const markAllRead = async () => {
		setMarkingAll(true);
		try {
			await api.patch("/notifications/read-all");
			setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
			setUnreadCount(0);
		} catch { /* ignore */ } finally { setMarkingAll(false); }
	};

	const deleteNotif = async (notifId) => {
		try {
			await api.delete(`/notifications/${notifId}`);
			setNotifications(prev => {
				const n = prev.find(x => x._id === notifId);
				if (n && !n.isRead) setUnreadCount(c => Math.max(0, c - 1));
				return prev.filter(x => x._id !== notifId);
			});
		} catch { /* ignore */ }
	};

	// Filter tabs
	const FILTER_TABS = [
		{ id: "all", label: "All" },
		{ id: "unread", label: "Unread" },
		{ id: "mentions", label: "Mentions" },
		{ id: "tasks", label: "Tasks" },
	];

	const filtered = notifications.filter(n => {
		if (filter === "unread") return !n.isRead;
		if (filter === "mentions") return n.type === "comment_mention" || n.type === "chat_mention";
		if (filter === "tasks") return n.type === "task_assigned" || n.type === "task_due";
		return true;
	});

	// Group by date
	const grouped = filtered.reduce((acc, n) => {
		const group = getDateGroup(n.createdAt);
		const existing = acc.find(g => g.label === group);
		if (existing) existing.items.push(n);
		else acc.push({ label: group, items: [n] });
		return acc;
	}, []);

	const mentionsCount = notifications.filter(n => !n.isRead && (n.type === "comment_mention" || n.type === "chat_mention")).length;
	const tasksCount = notifications.filter(n => !n.isRead && (n.type === "task_assigned" || n.type === "task_due")).length;

	return (
		<div className="fade-in" style={{ maxWidth: 680, margin: "0 auto" }}>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
				<div>
					<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Notifications</h1>
					{unreadCount > 0 && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}><span style={{ color: "var(--accent)", fontWeight: 500 }}>{unreadCount} unread</span></p>}
				</div>
				<div style={{ display: "flex", gap: 8 }}>
					{unreadCount > 0 && (
						<button type="button" onClick={markAllRead} disabled={markingAll} className="btn btn-ghost btn-sm">
							{markingAll ? "Marking..." : <><Icon name="check" size={14} /> Mark all read</>}
						</button>
					)}
					<button type="button" onClick={() => setShowPrefs(true)} className="btn btn-ghost btn-sm">
						<Icon name="settings" size={14} /> Settings
					</button>
				</div>
			</div>

			{/* Filter tabs */}
			<div style={{ display: "flex", gap: 2, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 4, marginBottom: 20, width: "fit-content" }}>
				{FILTER_TABS.map(tab => {
					const count = tab.id === "unread" ? unreadCount : tab.id === "mentions" ? mentionsCount : tab.id === "tasks" ? tasksCount : 0;
					return (
						<button key={tab.id} type="button" onClick={() => setFilter(tab.id)} style={{ background: filter === tab.id ? "var(--bg-surface-3)" : "none", border: "none", cursor: "pointer", padding: "5px 14px", borderRadius: "var(--r-sm)", fontSize: 13, fontWeight: 500, color: filter === tab.id ? "var(--text-primary)" : "var(--text-secondary)", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
							{tab.label}
							{count > 0 && <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10, padding: "1px 5px", borderRadius: "var(--r-full)", fontWeight: 600 }}>{count}</span>}
						</button>
					);
				})}
			</div>

			{/* Notifications card */}
			<div className="card" style={{ padding: 0, overflow: "hidden" }}>
				{status === "loading" && (
					<div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
						{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: "var(--r-md)" }} />)}
					</div>
				)}
				{status === "error" && <div style={{ padding: 24, textAlign: "center", color: "var(--danger)", fontSize: 14 }}>Failed to load notifications</div>}
				{status === "ready" && filtered.length === 0 && (
					<div style={{ padding: "64px 24px", textAlign: "center" }}>
						<div className="icon-box icon-box-accent empty-state-icon"><Icon name="bell" size={24} /></div>
						<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
							{filter === "unread" ? "No unread notifications" : filter === "mentions" ? "No mention notifications" : filter === "tasks" ? "No task notifications" : "All caught up!"}
						</p>
						<p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No notifications in this category.</p>
					</div>
				)}
				{status === "ready" && grouped.map(group => (
					<div key={group.label}>
						<div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
							{group.label}
						</div>
						{group.items.map(notif => (
							<NotifRow key={notif._id} notif={notif} onRead={markRead} onDelete={deleteNotif} />
						))}
					</div>
				))}
			</div>

			{showPrefs && <PrefsModal onClose={() => setShowPrefs(false)} />}
		</div>
	);
}
