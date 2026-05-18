import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

const TYPE_META = {
	task_assigned:   { icon: "check", label: "Task assigned",         accentColor: "var(--accent)", bgColor: "var(--accent-muted)" },
	comment_mention: { icon: "chat", label: "Mentioned",             accentColor: "var(--warning)", bgColor: "var(--warning-muted)" },
	workspace_invite:{ icon: "mail",  label: "Workspace invite",      accentColor: "var(--success)", bgColor: "var(--success-muted)" },
	task_due:        { icon: "alert", label: "Due reminder",           accentColor: "var(--danger)", bgColor: "var(--danger-muted)" },
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

const getNotificationTitle = (n) => {
	if (n.type === "workspace_invite") return n.payload?.workspaceName || "Workspace invitation";
	return n.payload?.taskTitle || "";
};

const getNotificationDescription = (n) => {
	if (n.type === "workspace_invite") {
		return `${n.payload?.inviterName || "Someone"} invited you to join ${n.payload?.workspaceName || "a workspace"} as ${n.payload?.role || "member"}.`;
	}
	if (n.type === "task_assigned") return "A task was assigned to you.";
	if (n.type === "comment_mention") return "You were mentioned in a comment.";
	if (n.type === "task_due") return "A due date reminder for this task.";
	return "";
};

function NotifRow({ notif, onRead, onDelete }) {
	const meta = TYPE_META[notif.type] || TYPE_META.task_assigned;
	const [hovered, setHovered] = useState(false);

	return (
		<div
			onClick={() => onRead(notif)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				position: "relative",
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				padding: "14px 16px",
				cursor: "pointer",
				background: notif.isRead ? "transparent" : "rgba(108,99,255,0.05)",
				borderBottom: "1px solid var(--border)",
				transition: "background 0.15s",
			}}
		>
			{/* Unread dot */}
			{!notif.isRead && (
				<div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 28, background: "var(--accent)", borderRadius: "0 2px 2px 0" }} />
			)}

			{/* Icon */}
			<div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: meta.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, color: meta.accentColor }}>
				<Icon name={meta.icon} size={18} />
			</div>

			{/* Content */}
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
				{notif.type === "workspace_invite" && notif.payload?.inviteToken && (
					<button
						type="button"
						className="btn btn-sm"
						onClick={(e) => { e.stopPropagation(); onRead(notif); }}
						style={{ marginTop: 8, background: "var(--success-muted)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}
					>
						Review invite
					</button>
				)}
				<span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>{formatRelative(notif.createdAt)}</span>
			</div>

			{/* Delete */}
			{hovered && (
				<button
					type="button"
					onClick={(e) => { e.stopPropagation(); onDelete(notif._id); }}
					style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 6px", borderRadius: "var(--radius-sm)", fontSize: 14, flexShrink: 0 }}
					aria-label="Delete"
					title="Delete notification"
				>
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
	const [filter, setFilter] = useState("all"); // "all" | "unread"
	const navigate = useNavigate();

	useEffect(() => {
		let active = true;
		api
			.get("/notifications?limit=50")
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
				setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
				setUnreadCount((c) => Math.max(0, c - 1));
			} catch {/* ignore */}
		}
		const { workspaceId, boardId, inviteToken } = notif.payload || {};
		if (notif.type === "workspace_invite" && inviteToken) {
			navigate(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
			return;
		}
		if (workspaceId && boardId) navigate(`/app/workspaces/${workspaceId}/boards/${boardId}`);
	};

	const markAllRead = async () => {
		setMarkingAll(true);
		try {
			await api.patch("/notifications/read-all");
			setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
			setUnreadCount(0);
		} catch {/* ignore */}
		finally { setMarkingAll(false); }
	};

	const deleteNotif = async (notifId) => {
		try {
			await api.delete(`/notifications/${notifId}`);
			setNotifications((prev) => {
				const n = prev.find((x) => x._id === notifId);
				if (n && !n.isRead) setUnreadCount((c) => Math.max(0, c - 1));
				return prev.filter((x) => x._id !== notifId);
			});
		} catch {/* ignore */}
	};

	const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

	return (
		<div className="fade-in" style={{ maxWidth: 660, margin: "0 auto" }}>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
				<div>
					<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Notifications</h1>
					{unreadCount > 0 && (
						<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
							<span style={{ color: "var(--accent)", fontWeight: 500 }}>{unreadCount} unread</span>
						</p>
					)}
				</div>
				{unreadCount > 0 && (
					<button type="button" onClick={markAllRead} disabled={markingAll} className="btn btn-ghost btn-sm">
						{markingAll ? "Marking..." : <><Icon name="check" size={14} /> Mark all read</>}
					</button>
				)}
			</div>

			{/* Filter tabs */}
			<div style={{ display: "flex", gap: 2, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 4, marginBottom: 16, width: "fit-content" }}>
				{["all", "unread"].map((f) => (
					<button
						key={f}
						type="button"
						onClick={() => setFilter(f)}
						style={{
							background: filter === f ? "var(--bg-surface-3)" : "none",
							border: "none",
							cursor: "pointer",
							padding: "5px 14px",
							borderRadius: "var(--radius-sm)",
							fontSize: 13,
							fontWeight: 500,
							color: filter === f ? "var(--text-primary)" : "var(--text-secondary)",
							transition: "all 0.15s",
							textTransform: "capitalize",
						}}
					>
						{f} {f === "unread" && unreadCount > 0 && <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10, padding: "1px 5px", borderRadius: "var(--radius-full)", marginLeft: 4 }}>{unreadCount}</span>}
					</button>
				))}
			</div>

			{/* Card */}
			<div className="card" style={{ padding: 0, overflow: "hidden" }}>
				{status === "loading" && (
					<div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
						{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: "var(--radius-md)" }} />)}
					</div>
				)}

				{status === "error" && (
					<div style={{ padding: 24, textAlign: "center", color: "var(--danger)", fontSize: 14 }}>Failed to load notifications</div>
				)}

				{status === "ready" && filtered.length === 0 && (
					<div style={{ padding: "64px 24px", textAlign: "center" }}>
						<div className="icon-box icon-box-accent empty-state-icon"><Icon name="bell" size={24} /></div>
						<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
							{filter === "unread" ? "No unread notifications" : "All caught up!"}
						</p>
						<p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
							{filter === "unread" ? "You've read everything." : "No notifications yet."}
						</p>
					</div>
				)}

				{status === "ready" && filtered.map((notif) => (
					<NotifRow key={notif._id} notif={notif} onRead={markRead} onDelete={deleteNotif} />
				))}
			</div>
		</div>
	);
}
