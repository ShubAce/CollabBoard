import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

function getInitials(name = "") {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getAvatarColor(name = "") {
	const colors = ["#6C63FF", "#34D399", "#60A5FA", "#F87171", "#FBBF24", "#A78BFA", "#FB923C"];
	let hash = 0;
	for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
	return colors[Math.abs(hash) % colors.length];
}

function Avatar({ user, size = "sm" }) {
	const bg = getAvatarColor(user?.name || "");
	const initials = getInitials(user?.name || "?");
	return user?.avatar ? (
		<img src={user.avatar} alt={user.name} className={`avatar avatar-${size}`} />
	) : (
		<div className={`avatar avatar-${size}`} style={{ background: bg }}>
			{initials}
		</div>
	);
}

export default function AppShell() {
	const navigate = useNavigate();
	const wsMatch = useMatch("/app/workspaces/:workspaceId/*");
	const workspaceId = wsMatch?.params?.workspaceId || null;
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const clearAuth = useAuthStore((s) => s.clearAuth);

	const [unreadCount, setUnreadCount] = useState(0);
	const [workspace, setWorkspace] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const userMenuRef = useRef(null);

	// Fetch initial unread count
	useEffect(() => {
		if (!accessToken) return;
		let active = true;
		api
			.get("/notifications?unreadOnly=true&limit=1")
			.then(({ data }) => { if (active) setUnreadCount(data.unreadCount || 0); })
			.catch(() => {});
		return () => { active = false; };
	}, [accessToken]);

	// Fetch current workspace info
	useEffect(() => {
		if (!workspaceId || !accessToken) return;
		let active = true;
		api
			.get(`/workspaces/${workspaceId}`)
			.then(({ data }) => { if (active) setWorkspace(data); })
			.catch(() => {});
		return () => { active = false; };
	}, [workspaceId, accessToken]);

	// Socket: new notifications
	useEffect(() => {
		if (!accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		const handle = () => setUnreadCount((c) => c + 1);
		socket.on("notification:new", handle);
		return () => socket.off("notification:new", handle);
	}, [accessToken]);

	// Close user menu on outside click
	useEffect(() => {
		const handle = (e) => {
			if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
				setUserMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, []);

	const handleLogout = async () => {
		try { await api.post("/auth/logout"); } finally {
			clearAuth();
			navigate("/login");
		}
	};

	const navLinks = workspaceId
		? [
				{ to: `/app/workspaces/${workspaceId}`, icon: "home", label: "Dashboard" },
				{ to: `/app/workspaces/${workspaceId}/boards`, icon: "board", label: "Boards" },
				{ to: `/app/workspaces/${workspaceId}/chat`, icon: "chat", label: "Chat" },
				{ to: `/app/workspaces/${workspaceId}/settings`, icon: "settings", label: "Settings" },
		  ]
		: [];

	const globalLinks = [
		{ to: "/app/workspaces", icon: "briefcase", label: "Workspaces" },
		{ to: "/app/notifications", icon: "bell", label: "Notifications", badge: unreadCount },
		{ to: "/app/profile", icon: "user", label: "Profile" },
	];

	return (
		<div className="app-layout">
			{/* ── SIDEBAR ── */}
			<aside className="sidebar" style={{ display: sidebarOpen || window.innerWidth > 767 ? undefined : "none" }}>
				{/* Logo */}
				<Link
					to="/app/workspaces"
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "18px 16px",
						textDecoration: "none",
						borderBottom: `1px solid var(--border)`,
					}}
				>
					<Icon name="spark" size={20} style={{ color: "var(--accent)" }} />
					<span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>CollabBoard</span>
				</Link>

				{/* Workspace header */}
				{workspace && (
					<div style={{ padding: "12px 16px 8px", borderBottom: `1px solid var(--border)` }}>
						<p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{workspace.name}</p>
						<p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{workspace.members?.length || 0} members</p>
					</div>
				)}

				{/* Workspace nav links */}
				{navLinks.length > 0 && (
					<nav style={{ paddingTop: 8 }}>
						{navLinks.map(({ to, icon, label }) => (
							<NavLink
								key={to}
								to={to}
								end={to === `/app/workspaces/${workspaceId}`}
								className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
							>
								<Icon name={icon} size={16} />
								<span>{label}</span>
							</NavLink>
						))}
					</nav>
				)}

				<div className="divider" style={{ margin: "8px 0" }} />

				{/* Global nav */}
				<nav>
					<div className="section-label">Navigation</div>
					{globalLinks.map(({ to, icon, label, badge }) => (
						<NavLink
							key={to}
							to={to}
							className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
						>
							<Icon name={icon} size={16} />
							<span style={{ flex: 1 }}>{label}</span>
							{badge > 0 && (
								<span
									style={{
										background: "var(--accent)",
										color: "#fff",
										fontSize: 11,
										fontWeight: 600,
										padding: "1px 6px",
										borderRadius: "var(--radius-full)",
									}}
								>
									{badge > 99 ? "99+" : badge}
								</span>
							)}
						</NavLink>
					))}
				</nav>

				{/* Footer: user */}
				<div style={{ marginTop: "auto", borderTop: `1px solid var(--border)`, padding: 16 }}>
					<div ref={userMenuRef} style={{ position: "relative" }}>
						<button
							type="button"
							onClick={() => setUserMenuOpen((o) => !o)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								width: "100%",
								background: "none",
								border: "none",
								cursor: "pointer",
								padding: 0,
								textAlign: "left",
							}}
						>
							<Avatar user={user} size="sm" />
							<div style={{ minWidth: 0 }}>
								<p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{user?.name || "User"}
								</p>
								<p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{user?.email || ""}
								</p>
							</div>
						</button>

						{userMenuOpen && (
							<div
								className="dropdown"
								style={{ bottom: "calc(100% + 8px)", left: 0, right: 0 }}
							>
								<Link
									to="/app/profile"
									className="dropdown-item"
									onClick={() => setUserMenuOpen(false)}
								>
									<Icon name="user" size={14} /> Profile
								</Link>
								<div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
								<button
									type="button"
									className="dropdown-item danger"
									onClick={handleLogout}
									style={{ width: "100%", textAlign: "left" }}
								>
									<Icon name="logOut" size={14} /> Log out
								</button>
							</div>
						)}
					</div>
				</div>
			</aside>

			{/* ── MAIN AREA ── */}
			<div className="main-area">
				{/* Top Bar */}
				<header className="topbar">
					{/* Mobile hamburger */}
					<button
						type="button"
						onClick={() => setSidebarOpen((o) => !o)}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
							fontSize: 20,
							display: "none",
							padding: 4,
						}}
						className="mobile-menu-btn"
					>
						<Icon name="menu" size={18} />
					</button>

					{/* Breadcrumb */}
					<div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--text-secondary)", overflow: "hidden" }}>
						{workspace ? (
							<>
								<Link to="/app/workspaces" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
									Workspaces
								</Link>
								<span>/</span>
								<Link to={`/app/workspaces/${workspaceId}`} style={{ color: "var(--text-primary)", fontWeight: 500, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									{workspace.name}
								</Link>
							</>
						) : (
							<span style={{ color: "var(--text-primary)", fontWeight: 500 }}>CollabBoard</span>
						)}
					</div>

					{/* Notification bell */}
					<Link
						to="/app/notifications"
						aria-label="Notifications"
						style={{
							position: "relative",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: 36,
							height: 36,
							borderRadius: "var(--radius-md)",
							background: "var(--bg-surface-2)",
							border: "1px solid var(--border)",
							color: "var(--text-secondary)",
							textDecoration: "none",
							fontSize: 16,
							flexShrink: 0,
						}}
					>
						<Icon name="bell" size={16} />
						{unreadCount > 0 && (
							<span
								style={{
									position: "absolute",
									top: -4,
									right: -4,
									background: "var(--accent)",
									color: "#fff",
									fontSize: 10,
									fontWeight: 700,
									padding: "1px 5px",
									borderRadius: "var(--radius-full)",
									lineHeight: 1.4,
								}}
							>
								{unreadCount > 99 ? "99+" : unreadCount}
							</span>
						)}
					</Link>

					{/* User avatar */}
					<Link to="/app/profile" style={{ textDecoration: "none" }}>
						<Avatar user={user} size="sm" />
					</Link>
				</header>

				{/* Page content */}
				<main className="content-area fade-in">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
