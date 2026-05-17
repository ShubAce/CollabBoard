import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const TYPE_META = {
	task_assigned: {
		icon: (
			<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-space-indigo-500">
				<path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
			</svg>
		),
		label: "Task assigned",
		color: "bg-space-indigo-50",
	},
	comment_mention: {
		icon: (
			<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-500">
				<path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.658-3.9c1.26.028 2.51-.025 3.737-.157 1.44-.232 2.435-1.49 2.435-2.903V5.426c0-1.413-.994-2.67-2.43-2.902A41.97 41.97 0 0010 2z" clipRule="evenodd" />
			</svg>
		),
		label: "Mentioned in comment",
		color: "bg-amber-50",
	},
	workspace_invite: {
		icon: (
			<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-500">
				<path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 018 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
			</svg>
		),
		label: "Workspace invite",
		color: "bg-emerald-50",
	},
	task_due: {
		icon: (
			<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
				<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
			</svg>
		),
		label: "Task due reminder",
		color: "bg-rose-50",
	},
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

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [status, setStatus] = useState("loading");
	const [markingAll, setMarkingAll] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		let isActive = true;
		const load = async () => {
			try {
				const { data } = await api.get("/notifications?limit=50");
				if (!isActive) return;
				setNotifications(data.notifications);
				setUnreadCount(data.unreadCount);
				setStatus("ready");
			} catch {
				if (isActive) setStatus("error");
			}
		};
		load();
		return () => {
			isActive = false;
		};
	}, []);

	const markRead = async (notif) => {
		if (!notif.isRead) {
			try {
				await api.patch(`/notifications/${notif._id}/read`);
				setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
				setUnreadCount((c) => Math.max(0, c - 1));
			} catch {
				// ignore
			}
		}
		// Navigate to the relevant board if payload has it
		const { workspaceId, boardId } = notif.payload || {};
		if (workspaceId && boardId) {
			navigate(`/app/workspaces/${workspaceId}/boards/${boardId}`);
		}
	};

	const markAllRead = async () => {
		setMarkingAll(true);
		try {
			await api.patch("/notifications/read-all");
			setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
			setUnreadCount(0);
		} catch {
			// ignore
		} finally {
			setMarkingAll(false);
		}
	};

	const deleteNotif = async (e, notifId) => {
		e.stopPropagation();
		try {
			await api.delete(`/notifications/${notifId}`);
			setNotifications((prev) => prev.filter((n) => n._id !== notifId));
		} catch {
			// ignore
		}
	};

	return (
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<div className="flex items-center justify-between gap-4 mb-6">
				<div>
					<h2 className="text-2xl font-semibold text-jet-black-900 font-display">Notifications</h2>
					{unreadCount > 0 && (
						<p className="mt-1 text-sm text-jet-black-500">
							You have <span className="font-semibold text-space-indigo-600">{unreadCount} unread</span> notification{unreadCount !== 1 ? "s" : ""}
						</p>
					)}
				</div>
				{unreadCount > 0 && (
					<button
						type="button"
						onClick={markAllRead}
						disabled={markingAll}
						className="rounded-lg border border-ghost-white-200 px-4 py-2 text-xs font-semibold text-jet-black-700 transition hover:bg-ghost-white-100 disabled:opacity-50"
					>
						{markingAll ? "Marking..." : "Mark all as read"}
					</button>
				)}
			</div>

			{status === "loading" && <p className="text-sm text-jet-black-400 text-center py-12">Loading notifications...</p>}
			{status === "error" && <p className="text-sm text-red-500 text-center py-12">Failed to load notifications.</p>}

			{status === "ready" && notifications.length === 0 && (
				<div className="flex flex-col items-center py-16 gap-3">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-ghost-white-100">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-jet-black-400">
							<path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
						</svg>
					</div>
					<p className="text-sm text-jet-black-500">You&apos;re all caught up! No notifications yet.</p>
				</div>
			)}

			{status === "ready" && notifications.length > 0 && (
				<ul className="space-y-2">
					{notifications.map((notif) => {
						const meta = TYPE_META[notif.type] || TYPE_META.task_assigned;
						return (
							<li
								key={notif._id}
								onClick={() => markRead(notif)}
								className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition hover:shadow-sm ${
									notif.isRead
										? "border-ghost-white-200 bg-white"
										: "border-space-indigo-100 bg-space-indigo-50/30"
								}`}
							>
								{/* Type icon */}
								<div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
									{meta.icon}
								</div>

								{/* Content */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-xs font-semibold text-jet-black-500 uppercase tracking-wide">{meta.label}</span>
										{!notif.isRead && (
											<span className="h-2 w-2 rounded-full bg-space-indigo-500 shrink-0" />
										)}
									</div>
									{notif.payload?.taskTitle && (
										<p className="mt-0.5 text-sm font-medium text-jet-black-900 truncate">
											{notif.payload.taskTitle}
										</p>
									)}
									<p className="mt-0.5 text-xs text-jet-black-400">{formatRelative(notif.createdAt)}</p>
								</div>

								{/* Delete button */}
								<button
									type="button"
									onClick={(e) => deleteNotif(e, notif._id)}
									className="absolute right-3 top-3 hidden rounded-lg p-1.5 text-jet-black-400 transition hover:bg-ghost-white-200 hover:text-jet-black-700 group-hover:flex"
									aria-label="Delete notification"
								>
									<svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
										<path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
									</svg>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
