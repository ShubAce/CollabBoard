import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import api from "../api/axios";
import FlipNumber from "../components/motion/FlipNumber.jsx";
import ModalShell from "../components/motion/ModalShell.jsx";
import Icon from "../components/ui/Icon.jsx";
import SegmentedTabs from "../components/ui/SegmentedTabs.jsx";
import { DURATION, EASE_IN, EASE_OUT, fadeUp, SPRING, SPRING_SOFT, staggerContainer } from "../lib/motion";

const TYPE_META = {
	task_assigned: { icon: "check", label: "Task assigned", accentColor: "var(--accent)", bgColor: "var(--accent-muted)" },
	comment_mention: { icon: "chat", label: "Mentioned", accentColor: "var(--warning)", bgColor: "var(--warning-muted)" },
	chat_mention: { icon: "chat", label: "Chat mention", accentColor: "var(--warning)", bgColor: "var(--warning-muted)" },
	workspace_invite: { icon: "mail", label: "Workspace invite", accentColor: "var(--success)", bgColor: "var(--success-muted)" },
	task_due: { icon: "alert", label: "Due reminder", accentColor: "var(--danger)", bgColor: "var(--danger-muted)" },
};

// Rows leave quickly to the left; the rest slide up into the gap (layout + popLayout).
const ROW_EXIT = { opacity: 0, x: -24, transition: { duration: 0.18, ease: EASE_IN } };
const INDICATOR_EXIT = { opacity: 0, scale: 0.4, transition: { duration: DURATION.default, ease: EASE_IN } };

const GROUP_HEADER_STYLE = { padding: "10px 16px 6px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" };

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
			<motion.span
				initial={false}
				animate={{ x: value ? 18 : 0 }}
				transition={SPRING}
				style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
			/>
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
		<ModalShell onClose={onClose} maxWidth={480} labelledBy="notif-prefs-title">
				<div className="modal-header">
					<h2 id="notif-prefs-title" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Notification Preferences</h2>
					<button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
						<Icon name="close" size={18} />
					</button>
				</div>
				<div className="modal-body">
					<p style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notify me about</p>
					{rows.map(({ key, label }) => (
						<div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
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
		</ModalShell>
	);
}

function NotifRow({ notif, onRead, onDelete, isTouch }) {
	const meta = TYPE_META[notif.type] || TYPE_META.task_assigned;
	const [hovered, setHovered] = useState(false);
	const isInviteResolved = notif.type === "workspace_invite" && (notif.payload?.inviteStatus === "accepted" || !notif.payload?.inviteToken);
	const isActionable = !isInviteResolved;
	const title = getNotificationTitle(notif);
	const showDelete = hovered || isTouch;

	return (
		<motion.div
			className="row-hover"
			onClick={() => { if (isActionable) onRead(notif); }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			whileTap={isActionable ? { scale: 0.995, transition: SPRING } : undefined}
			style={{
				position: "relative", display: "flex", alignItems: "flex-start", gap: 12,
				padding: "14px 12px 14px 16px", cursor: isActionable ? "pointer" : "default",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<AnimatePresence initial={false}>
				{!notif.isRead && (
					<motion.span
						key="bar"
						aria-hidden="true"
						initial={{ opacity: 0, scaleY: 0 }}
						animate={{ opacity: 1, scaleY: 1 }}
						exit={{ opacity: 0, scaleY: 0, transition: { duration: DURATION.default, ease: EASE_IN } }}
						transition={{ duration: DURATION.slow, ease: EASE_OUT }}
						style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 3, background: "var(--accent)", borderRadius: "0 2px 2px 0" }}
					/>
				)}
			</AnimatePresence>
			<div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: meta.bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: meta.accentColor, opacity: notif.isRead ? 0.7 : 1, transition: "opacity 0.3s var(--ease-out)" }}>
				<Icon name={meta.icon} size={18} />
			</div>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, minWidth: 0 }}>
					<span style={{ fontSize: 11, fontWeight: 600, color: meta.accentColor, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
					<AnimatePresence initial={false}>
						{!notif.isRead && (
							<motion.span
								key="dot"
								aria-label="Unread"
								initial={{ opacity: 0, scale: 0.4 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={INDICATOR_EXIT}
								transition={SPRING}
								style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, boxShadow: "0 0 8px rgba(59, 130, 246, 0.6)" }}
							/>
						)}
					</AnimatePresence>
					<span style={{ marginLeft: "auto", paddingLeft: 8, fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatRelative(notif.createdAt)}</span>
				</div>
				{title && (
					<p style={{ fontSize: 14, fontWeight: notif.isRead ? 500 : 600, color: "var(--text-primary)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{title}
					</p>
				)}
				<p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45, overflowWrap: "anywhere" }}>{getNotificationDescription(notif)}</p>
				{notif.type === "workspace_invite" && notif.payload?.inviteToken && !notif.isRead && !isInviteResolved && (
					<button type="button" className="btn btn-sm" onClick={e => { e.stopPropagation(); onRead(notif); }} style={{ marginTop: 10, background: "var(--success-muted)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}>
						Review invite <Icon name="arrowRight" size={12} />
					</button>
				)}
			</div>
			<motion.button
				type="button"
				className="btn btn-ghost btn-sm"
				onClick={e => { e.stopPropagation(); onDelete(notif._id); }}
				onFocus={() => setHovered(true)}
				onBlur={() => setHovered(false)}
				initial={false}
				animate={{ opacity: showDelete ? 1 : 0, scale: showDelete ? 1 : 0.85 }}
				transition={{ duration: DURATION.default, ease: EASE_OUT }}
				style={{ width: isTouch ? 36 : 28, minHeight: isTouch ? 36 : 28, padding: 0, flexShrink: 0, marginTop: isTouch ? -8 : -4, border: "1px solid transparent", color: "var(--text-muted)" }}
				aria-label="Delete"
			>
				<Icon name="close" size={14} />
			</motion.button>
		</motion.div>
	);
}

function NotifSkeleton() {
	return (
		<div aria-hidden="true">
			<div style={GROUP_HEADER_STYLE}>
				<div className="skeleton" style={{ height: 10, width: 56, margin: "2px 0" }} />
			</div>
			{[0.7, 0.5, 0.62, 0.45].map((w, i) => (
				<div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
					<div className="skeleton" style={{ width: 36, height: 36, flexShrink: 0 }} />
					<div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
						<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
							<div className="skeleton" style={{ height: 10, width: 90 }} />
							<div className="skeleton" style={{ height: 10, width: 40 }} />
						</div>
						<div className="skeleton" style={{ height: 13, width: `${w * 100}%` }} />
						<div className="skeleton" style={{ height: 11, width: `${(w + 0.2) * 100}%` }} />
					</div>
				</div>
			))}
		</div>
	);
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);

	const updateGlobalCount = (newCount) => {
		setUnreadCount(newCount);
		window.dispatchEvent(new CustomEvent("notifications:update", { detail: newCount }));
	};

	const [status, setStatus] = useState("loading");
	const [markingAll, setMarkingAll] = useState(false);
	const [filter, setFilter] = useState("all");
	const [showPrefs, setShowPrefs] = useState(false);
	const navigate = useNavigate();
	const isTouch = useMediaQuery("(hover: none)");

	useEffect(() => {
		let active = true;
		api.get("/notifications?limit=50")
			.then(({ data }) => {
				if (!active) return;
				setNotifications(data.notifications);
				updateGlobalCount(data.unreadCount);
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
				updateGlobalCount(Math.max(0, unreadCount - 1));
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
			updateGlobalCount(0);
		} catch { /* ignore */ } finally { setMarkingAll(false); }
	};

	const deleteNotif = async (notifId) => {
		try {
			await api.delete(`/notifications/${notifId}`);
			// Count update lives outside the state updater: dispatching an event that
			// re-renders AppShell from inside an updater is a render-phase side effect.
			const removed = notifications.find(x => x._id === notifId);
			setNotifications(prev => prev.filter(x => x._id !== notifId));
			if (removed && !removed.isRead) updateGlobalCount(Math.max(0, unreadCount - 1));
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

	// Flat list (headers + rows) so one AnimatePresence can slide everything up when a row leaves.
	const listItems = grouped.flatMap(group => [
		{ kind: "header", key: `h-${group.label}`, label: group.label },
		...group.items.map(notif => ({ kind: "row", key: notif._id, notif })),
	]);

	const tabItems = FILTER_TABS.map(tab => {
		const count = tab.id === "unread" ? unreadCount : tab.id === "mentions" ? mentionsCount : tab.id === "tasks" ? tasksCount : 0;
		return { value: tab.id, label: tab.label, count: count > 0 ? <FlipNumber value={count} max={999} /> : undefined };
	});

	const emptyIcon = filter === "mentions" ? "chat" : filter === "tasks" ? "check" : "bell";

	return (
		<motion.div
			variants={staggerContainer(0.08)}
			initial="hidden"
			animate="show"
			style={{ maxWidth: 680, margin: "0 auto" }}
		>
			{/* Header */}
			<motion.div variants={fadeUp} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
				<div style={{ minWidth: 0 }}>
					<h1 className="page-title">Notifications</h1>
					<p className="page-subtitle" style={{ minHeight: 18 }}>
						{status === "ready" && (unreadCount > 0
							? <span style={{ color: "var(--accent-light)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}><FlipNumber value={unreadCount} max={9999} /> unread</span>
							: notifications.length > 0 && "All caught up")}
					</p>
				</div>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					<AnimatePresence initial={false}>
						{unreadCount > 0 && (
							<motion.button
								key="mark-all"
								type="button"
								onClick={markAllRead}
								disabled={markingAll}
								className="btn btn-ghost btn-sm"
								initial={{ opacity: 0, scale: 0.96 }}
								animate={{ opacity: 1, scale: 1, transition: { duration: DURATION.default, ease: EASE_OUT } }}
								exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12, ease: EASE_IN } }}
							>
								{markingAll ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Icon name="check" size={14} />} Mark all read
							</motion.button>
						)}
					</AnimatePresence>
					<button type="button" onClick={() => setShowPrefs(true)} className="btn btn-ghost btn-sm">
						<Icon name="settings" size={14} /> Settings
					</button>
				</div>
			</motion.div>

			{/* Filter tabs */}
			<motion.div variants={fadeUp} style={{ marginBottom: 16 }}>
				<SegmentedTabs
					id="notif-filter"
					items={tabItems}
					value={filter}
					onChange={setFilter}
				/>
			</motion.div>

			{/* Notifications card */}
			<motion.div variants={fadeUp} className="card" style={{ padding: 0, overflow: "hidden" }}>
				{status === "loading" && <NotifSkeleton />}
				{status === "error" && (
					<div style={{ padding: "48px 24px", textAlign: "center" }}>
						<div className="icon-box empty-state-icon" style={{ background: "var(--danger-muted)", color: "var(--danger)", borderColor: "transparent" }}><Icon name="alert" size={22} /></div>
						<p style={{ margin: 0, color: "var(--danger)", fontSize: 14 }}>Failed to load notifications</p>
					</div>
				)}
				{status === "ready" && filtered.length === 0 && (
					<motion.div
						key={`empty-${filter}`}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: DURATION.slow, ease: EASE_OUT }}
						style={{ padding: "64px 24px", textAlign: "center" }}
					>
						<div className="icon-box icon-box-accent empty-state-icon empty-float"><Icon name={emptyIcon} size={22} /></div>
						<p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
							{filter === "unread" ? "No unread notifications" : filter === "mentions" ? "No mention notifications" : filter === "tasks" ? "No task notifications" : "All caught up!"}
						</p>
						<p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
							{filter === "all" ? "New notifications will show up here." : "No notifications in this category."}
						</p>
					</motion.div>
				)}
				{status === "ready" && listItems.length > 0 && (
					<motion.div
						key={filter}
						variants={staggerContainer(0.04, 0.05)}
						initial="hidden"
						animate="show"
						style={{ position: "relative" }}
					>
						<AnimatePresence mode="popLayout">
							{listItems.map(item => (
								<motion.div
									key={item.key}
									layout="position"
									variants={fadeUp}
									exit={ROW_EXIT}
									transition={{ layout: SPRING_SOFT }}
									style={item.kind === "header" ? GROUP_HEADER_STYLE : { background: item.notif.isRead ? "transparent" : "rgba(59, 130, 246, 0.05)", transition: "background-color 0.3s var(--ease-out)" }}
								>
									{item.kind === "header"
										? item.label
										: <NotifRow notif={item.notif} onRead={markRead} onDelete={deleteNotif} isTouch={isTouch} />}
								</motion.div>
							))}
						</AnimatePresence>
					</motion.div>
				)}
			</motion.div>

			<AnimatePresence>
				{showPrefs && <PrefsModal key="notif-prefs" onClose={() => setShowPrefs(false)} />}
			</AnimatePresence>
		</motion.div>
	);
}
