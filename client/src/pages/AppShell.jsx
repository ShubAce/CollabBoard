import { useEffect, useState } from "react";
import { Link, Outlet, useMatch, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

export default function AppShell() {
	const navigate = useNavigate();
	// Extract workspaceId if current route has one (for contextual Chat nav link)
	const wsMatch = useMatch("/app/workspaces/:workspaceId/*");
	const workspaceId = wsMatch?.params?.workspaceId || null;
	const user = useAuthStore((state) => state.user);
	const accessToken = useAuthStore((state) => state.accessToken);
	const clearAuth = useAuthStore((state) => state.clearAuth);

	const [unreadCount, setUnreadCount] = useState(0);

	// Fetch initial unread count
	useEffect(() => {
		if (!accessToken) return;
		let isActive = true;
		api.get("/notifications?unreadOnly=true&limit=1")
			.then(({ data }) => {
				if (isActive) setUnreadCount(data.unreadCount || 0);
			})
			.catch(() => {});
		return () => {
			isActive = false;
		};
	}, [accessToken]);

	// Socket: listen for new notifications
	useEffect(() => {
		if (!accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;

		const handleNew = () => {
			setUnreadCount((c) => c + 1);
		};
		socket.on("notification:new", handleNew);
		return () => {
			socket.off("notification:new", handleNew);
		};
	}, [accessToken]);

	const handleLogout = async () => {
		try {
			await api.post("/auth/logout");
		} finally {
			clearAuth();
			navigate("/login");
		}
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-6 py-8">
			<header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ghost-white-200 bg-white/80 p-6 shadow-sm">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-jet-black-900 font-display">CollabBoard</h1>
					<p className="text-sm text-jet-black-500">{user ? `Signed in as ${user.name}` : "Signed in"}</p>
				</div>
				<nav className="flex items-center gap-2 text-sm font-medium">
					<Link
						to="/app/workspaces"
						className="rounded-xl border border-ghost-white-200 bg-ghost-white-100 px-3 py-2 text-jet-black-700 transition hover:bg-ghost-white-200"
					>
						Workspaces
					</Link>
					<Link
						to="/app/profile"
						className="rounded-xl border border-ghost-white-200 bg-ghost-white-100 px-3 py-2 text-jet-black-700 transition hover:bg-ghost-white-200"
					>
						Profile
					</Link>
					{workspaceId && (
						<>
							<Link
								to={`/app/workspaces/${workspaceId}/chat`}
								className="rounded-xl border border-ghost-white-200 bg-ghost-white-100 px-3 py-2 text-jet-black-700 transition hover:bg-ghost-white-200"
							>
								Chat
							</Link>
							<Link
								to={`/app/workspaces/${workspaceId}/settings`}
								className="rounded-xl border border-ghost-white-200 bg-ghost-white-100 px-3 py-2 text-jet-black-700 transition hover:bg-ghost-white-200"
							>
								Settings
							</Link>
						</>
					)}
					{/* Bell / Notifications */}
					<Link
						to="/app/notifications"
						className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ghost-white-200 bg-ghost-white-100 text-jet-black-700 transition hover:bg-ghost-white-200"
						aria-label="Notifications"
					>
						<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
							<path fillRule="evenodd" d="M10 2a6 6 0 00-6 6v2.172l-.707.707A1 1 0 004 12v1a1 1 0 001 1h10a1 1 0 001-1v-1a1 1 0 00-.293-.707L15 10.172V8a6 6 0 00-5-5.917V2a1 1 0 10-2 0v.083A6.001 6.001 0 0010 2zM8 16a2 2 0 104 0H8z" clipRule="evenodd" />
						</svg>
						{unreadCount > 0 && (
							<span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white leading-none">
								{unreadCount > 99 ? "99+" : unreadCount}
							</span>
						)}
					</Link>
				</nav>
				<button
					type="button"
					onClick={handleLogout}
					className="rounded-xl border border-ghost-white-200 bg-white px-4 py-2 text-sm font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
				>
					Log out
				</button>
			</header>
			<main className="mt-6 grid gap-6">
				<Outlet />
			</main>
		</div>
	);
}
