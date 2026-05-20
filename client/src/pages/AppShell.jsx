import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

function getInitials(name = "") {
	return name
		.split(" ")
		.map((word) => word[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getAvatarColor(name = "") {
	const colors = ["#7c72ff", "#3dd68c", "#60a5fa", "#ff6b6b", "#f0c040", "#a78bfa", "#ff8c42"];
	let hash = 0;
	for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
	return colors[Math.abs(hash) % colors.length];
}

function Avatar({ user, size = "sm" }) {
	const bg = getAvatarColor(user?.name || "");
	const initials = getInitials(user?.name || "?");
	return user?.avatar ? (
		<img
			src={user.avatar}
			alt={user.name}
			className={`avatar avatar-${size}`}
		/>
	) : (
		<div
			className={`avatar avatar-${size}`}
			style={{ background: bg }}
		>
			{initials}
		</div>
	);
}

const DEFAULT_SECTIONS = {
	main: true,
	boards: true,
	channels: true,
	dms: true,
};

const STATUS_OPTIONS = [
	{ id: "available", label: "Available", emoji: "🟢", color: "var(--green)" },
	{ id: "busy", label: "Busy", emoji: "🔴", color: "var(--red)" },
	{ id: "meeting", label: "In a meeting", emoji: "🗓", color: "var(--yellow)" },
	{ id: "focus", label: "Focusing — do not disturb", emoji: "🎧", color: "var(--blue)" },
	{ id: "vacation", label: "On vacation", emoji: "🌴", color: "var(--purple)" },
	{ id: "wfh", label: "Working from home", emoji: "🏠", color: "var(--accent)" },
];

export default function AppShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const wsMatch = useMatch("/app/workspaces/:workspaceId/*");
	const workspaceId = wsMatch?.params?.workspaceId || null;
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const clearAuth = useAuthStore((s) => s.clearAuth);

	const [unreadCount, setUnreadCount] = useState(0);
	const [workspace, setWorkspace] = useState(null);
	const [workspaces, setWorkspaces] = useState([]);
	const [boards, setBoards] = useState([]);
	const [channels, setChannels] = useState([]);
	const [fallbackWorkspaceId, setFallbackWorkspaceId] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const [switcherOpen, setSwitcherOpen] = useState(false);
	const [statusMenuOpen, setStatusMenuOpen] = useState(false);
	const [bellOpen, setBellOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	const [commandQuery, setCommandQuery] = useState("");
	const [sections, setSections] = useState(DEFAULT_SECTIONS);
	const [status, setStatus] = useState(STATUS_OPTIONS[0]);

	const userMenuRef = useRef(null);
	const switcherRef = useRef(null);
	const statusRef = useRef(null);
	const bellRef = useRef(null);
	const commandInputRef = useRef(null);
	const activeWorkspaceId = workspaceId || fallbackWorkspaceId;

	useEffect(() => {
		try {
			const stored = localStorage.getItem("cb:last_workspace");
			if (stored) setFallbackWorkspaceId(stored);
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		if (!workspaceId) return;
		try {
			localStorage.setItem("cb:last_workspace", workspaceId);
			setFallbackWorkspaceId(workspaceId);
		} catch {
			/* ignore */
		}
	}, [workspaceId]);

	useEffect(() => {
		try {
			const stored = localStorage.getItem("cb:sidebar_sections");
			if (stored) {
				const parsed = JSON.parse(stored);
				setSections((prev) => ({ ...prev, ...parsed }));
			}
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem("cb:sidebar_sections", JSON.stringify(sections));
		} catch {
			/* ignore */
		}
	}, [sections]);

	useEffect(() => {
		if (!accessToken) return;
		let active = true;
		api.get("/workspaces")
			.then(({ data }) => {
				if (active) setWorkspaces(Array.isArray(data) ? data : []);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, [accessToken]);

	useEffect(() => {
		if (!activeWorkspaceId || !accessToken) {
			setWorkspace(null);
			setBoards([]);
			setChannels([]);
			return;
		}
		let active = true;
		api.get(`/workspaces/${activeWorkspaceId}`)
			.then(({ data }) => {
				if (active) setWorkspace(data);
			})
			.catch(() => {
				if (!workspaceId) {
					setWorkspace(null);
					setFallbackWorkspaceId(null);
					try {
						localStorage.removeItem("cb:last_workspace");
					} catch {
						/* ignore */
					}
				}
			});
		api.get(`/workspaces/${activeWorkspaceId}/boards`)
			.then(({ data }) => {
				if (active) setBoards(Array.isArray(data) ? data : []);
			})
			.catch(() => {
				if (active) setBoards([]);
			});
		api.get(`/workspaces/${activeWorkspaceId}/channels`)
			.then(({ data }) => {
				if (active) setChannels(Array.isArray(data) ? data : []);
			})
			.catch(() => {
				if (active) setChannels([]);
			});
		return () => {
			active = false;
		};
	}, [activeWorkspaceId, accessToken, workspaceId]);

	useEffect(() => {
		if (!accessToken) return;
		let active = true;
		api.get("/notifications?unreadOnly=true&limit=1")
			.then(({ data }) => {
				if (active) setUnreadCount(data.unreadCount || 0);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, [accessToken]);

	useEffect(() => {
		if (!accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		const handle = () => setUnreadCount((count) => count + 1);
		socket.on("notification:new", handle);
		return () => socket.off("notification:new", handle);
	}, [accessToken]);

	useEffect(() => {
		const handleKey = (event) => {
			const key = event.key?.toLowerCase();
			if ((event.ctrlKey || event.metaKey) && key === "k") {
				event.preventDefault();
				setCommandOpen(true);
				return;
			}
			if (key === "escape") {
				setCommandOpen(false);
				setBellOpen(false);
				setUserMenuOpen(false);
				setStatusMenuOpen(false);
				setSwitcherOpen(false);
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, []);

	useEffect(() => {
		if (!commandOpen) return;
		setCommandQuery("");
		const id = window.setTimeout(() => {
			commandInputRef.current?.focus();
		}, 0);
		return () => window.clearTimeout(id);
	}, [commandOpen]);

	useEffect(() => {
		const handle = (event) => {
			const refs = [userMenuRef, switcherRef, statusRef, bellRef];
			const clickedInside = refs.some((ref) => ref.current && ref.current.contains(event.target));
			if (!clickedInside) {
				setUserMenuOpen(false);
				setSwitcherOpen(false);
				setStatusMenuOpen(false);
				setBellOpen(false);
			}
		};
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, []);

	const handleLogout = async () => {
		try {
			await api.post("/auth/logout");
		} finally {
			clearAuth();
			navigate("/login");
		}
	};

	const toggleSection = (key) => {
		setSections((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const pageLabel = useMemo(() => {
		const path = location.pathname;
		if (path.includes("/boards/") && path.includes("/boards")) return "Board";
		if (path.includes("/boards")) return "Boards";
		if (path.includes("/chat")) return "Chat";
		if (path.includes("/settings")) return "Settings";
		if (path.includes("/notifications")) return "Notifications";
		if (path.includes("/profile")) return "Profile";
		if (path.includes("/my-work")) return "My Work";
		if (path.includes("/activity")) return "Activity";
		if (path === "/app/workspaces") return "Workspaces";
		if (path.includes("/workspaces/") && activeWorkspaceId) return "Home";
		return "Home";
	}, [location.pathname, activeWorkspaceId]);

	const mainItems = activeWorkspaceId
		? [
				{
					key: "home",
					label: "Home",
					icon: "home",
					to: `/app/workspaces/${activeWorkspaceId}`,
				},
				{
					key: "search",
					label: "Search",
					icon: "search",
					onClick: () => setCommandOpen(true),
				},
				{
					key: "my-work",
					label: "My Work",
					icon: "briefcase",
					to: "/app/my-work",
				},
				{
					key: "notifications",
					label: "Notifications",
					icon: "bell",
					to: "/app/notifications",
					badge: unreadCount,
				},
			]
		: [];

	const channelItems = channels
		.filter((c) => !c.isPrivate)
		.map((c) => ({
			key: c._id,
			label: c.name,
			to: `/app/workspaces/${activeWorkspaceId}/chat?channelId=${c._id}`,
			isReadOnly: c.isReadOnly,
		}));

	const dmItems = workspace?.members
		? workspace.members
				.map((member) => member.user)
				.filter((member) => member && member._id !== user?._id)
		: [];

	const workspaceDotColor = workspace?.color || getAvatarColor(workspace?.name || "");
	const showSidebar = sidebarOpen || window.innerWidth > 767;

	return (
		<div className="app-layout">
			<aside
				className="sidebar"
				style={{ display: showSidebar ? "flex" : "none" }}
			>
				<div
					className="sidebar-switcher"
					ref={switcherRef}
				>
					<button
						type="button"
						className="workspace-switcher"
						onClick={() => setSwitcherOpen((open) => !open)}
					>
						<span
							style={{
								width: 16,
								height: 16,
								borderRadius: "var(--r-sm)",
								background: workspaceDotColor,
								flexShrink: 0,
							}}
						/>
						<span style={{ flex: 1, textAlign: "left", fontWeight: 600 }}>{workspace?.name || "Select workspace"}</span>
						<Icon
							name="chevronDown"
							size={14}
						/>
					</button>

					{switcherOpen && (
						<>
							<div
								style={{ position: "fixed", inset: 0, zIndex: 999 }}
								onClick={() => setSwitcherOpen(false)}
							/>
							<div
								className="dropdown"
								style={{ position: "fixed", top: 60, left: 12, width: 240, zIndex: 1000 }}
							>
								{workspaces.map((ws, index) => (
									<button
										key={ws._id}
										type="button"
										className="dropdown-item"
										onClick={() => {
											setSwitcherOpen(false);
											navigate(`/app/workspaces/${ws._id}`);
										}}
										style={{ justifyContent: "space-between" }}
									>
										<span style={{ display: "flex", alignItems: "center", gap: 8 }}>
											<span
												style={{
													width: 14,
													height: 14,
													borderRadius: "var(--r-sm)",
													background: ws.color || getAvatarColor(ws.name || String(index)),
												}}
											/>
											{ws.name}
										</span>
										{activeWorkspaceId === ws._id && (
											<Icon
												name="check"
												size={14}
											/>
										)}
									</button>
								))}
								<div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
								<Link
									to="/app/workspaces"
									className="dropdown-item"
									onClick={() => setSwitcherOpen(false)}
								>
									Browse all workspaces
								</Link>
								<Link
									to="/app/workspaces/new"
									className="dropdown-item"
									onClick={() => setSwitcherOpen(false)}
								>
									Create new workspace
								</Link>
							</div>
						</>
					)}
				</div>

				<div className="sidebar-body">
					{activeWorkspaceId && (
						<div className="sidebar-section">
							<div className="sidebar-section-header">
								<button
									type="button"
									className="section-toggle"
									onClick={() => toggleSection("main")}
								>
									<Icon
										name="chevronDown"
										size={12}
										style={{
											transform: sections.main ? "rotate(0deg)" : "rotate(-90deg)",
											transition: "transform var(--duration-fast) var(--ease-out)",
										}}
									/>
									Main
								</button>
							</div>
							<div className={`sidebar-items${sections.main ? "" : " collapsed"}`}>
								{mainItems.map((item) => {
									if (item.to) {
										return (
											<NavLink
												key={item.key}
												to={item.to}
												className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
											>
												<Icon
													name={item.icon}
													size={14}
												/>
												<span style={{ flex: 1 }}>{item.label}</span>
												{item.badge > 0 && (
													<span
														className="badge badge-accent"
														style={{ fontWeight: 600 }}
													>
														{item.badge > 99 ? "99+" : item.badge}
													</span>
												)}
											</NavLink>
										);
									}
									return (
										<button
											key={item.key}
											type="button"
											className={`sidebar-link${item.disabled ? " disabled" : ""}`}
											onClick={item.disabled ? undefined : item.onClick}
											aria-disabled={item.disabled}
										>
											<Icon
												name={item.icon}
												size={14}
											/>
											<span style={{ flex: 1 }}>{item.label}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}

					{activeWorkspaceId && (
						<div className="sidebar-section">
							<div className="sidebar-section-header">
								<button
									type="button"
									className="section-toggle"
									onClick={() => toggleSection("boards")}
								>
									<Icon
										name="chevronDown"
										size={12}
										style={{
											transform: sections.boards ? "rotate(0deg)" : "rotate(-90deg)",
											transition: "transform var(--duration-fast) var(--ease-out)",
										}}
									/>
									Boards
								</button>
								<div className="sidebar-section-actions">
									<button
										type="button"
										className="sidebar-link"
										onClick={() => navigate(`/app/workspaces/${activeWorkspaceId}/boards`)}
										style={{ padding: "2px 6px" }}
										aria-label="Open boards"
									>
										<Icon
											name="plus"
											size={12}
										/>
									</button>
								</div>
							</div>
							<div className={`sidebar-items${sections.boards ? "" : " collapsed"}`}>
								{boards.length === 0 && (
									<button
										type="button"
										className="sidebar-link disabled"
										aria-disabled
									>
										<Icon
											name="board"
											size={14}
										/>
										No boards yet
									</button>
								)}
								{boards.map((board) => (
									<NavLink
										key={board._id}
										to={`/app/workspaces/${activeWorkspaceId}/boards/${board._id}`}
										className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
									>
										<Icon
											name="board"
											size={14}
										/>
										<span style={{ flex: 1 }}>{board.name}</span>
									</NavLink>
								))}
							</div>
						</div>
					)}

					{activeWorkspaceId && (
						<div className="sidebar-section">
							<div className="sidebar-section-header">
								<button
									type="button"
									className="section-toggle"
									onClick={() => toggleSection("channels")}
								>
									<Icon
										name="chevronDown"
										size={12}
										style={{
											transform: sections.channels ? "rotate(0deg)" : "rotate(-90deg)",
											transition: "transform var(--duration-fast) var(--ease-out)",
										}}
									/>
									Channels
								</button>
							</div>
							<div className={`sidebar-items${sections.channels ? "" : " collapsed"}`}>
								{channelItems.map((channel) => (
									<NavLink
										key={channel.key}
										to={channel.to}
										className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
									>
										<span style={{ color: "var(--text-muted)" }}>#</span>
										<span style={{ flex: 1 }}>{channel.label}</span>
										{channel.isReadOnly && <span className="badge badge-muted">Read-only</span>}
									</NavLink>
								))}
							</div>
						</div>
					)}

					{activeWorkspaceId && (
						<div className="sidebar-section">
							<div className="sidebar-section-header">
								<button
									type="button"
									className="section-toggle"
									onClick={() => toggleSection("dms")}
								>
									<Icon
										name="chevronDown"
										size={12}
										style={{
											transform: sections.dms ? "rotate(0deg)" : "rotate(-90deg)",
											transition: "transform var(--duration-fast) var(--ease-out)",
										}}
									/>
									Direct Messages
								</button>
							</div>
							<div className={`sidebar-items${sections.dms ? "" : " collapsed"}`}>
								{dmItems.length === 0 && (
									<button
										type="button"
										className="sidebar-link disabled"
										aria-disabled
									>
										<Icon
											name="user"
											size={14}
										/>
										No direct messages
									</button>
								)}
								{dmItems.map((member) => (
									<button
										key={member._id}
										type="button"
										className="sidebar-link"
										onClick={() => navigate(`/app/workspaces/${activeWorkspaceId}/chat?dm=${member._id}`)}
									>
										<Avatar
											user={member}
											size="xs"
										/>
										<span style={{ flex: 1, textAlign: "left" }}>{member.name}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="sidebar-footer">
					<div
						ref={statusRef}
						style={{ display: "flex", flexDirection: "column", gap: 8 }}
					>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
							<div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
								<Avatar
									user={user}
									size="sm"
								/>
								<div style={{ minWidth: 0 }}>
									<p
										style={{
											margin: 0,
											fontSize: 13,
											fontWeight: 600,
											color: "var(--text-primary)",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{user?.name || "User"}
									</p>
									<p
										style={{
											margin: 0,
											fontSize: 11,
											color: "var(--text-muted)",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{user?.email || ""}
									</p>
								</div>
							</div>
							<Link
								to="/app/profile"
								className="sidebar-link"
								style={{ padding: "4px 6px" }}
								aria-label="Open profile"
							>
								<Icon
									name="settings"
									size={14}
								/>
							</Link>
						</div>
						<button
							type="button"
							className="status-chip"
							onClick={() => setStatusMenuOpen((open) => !open)}
						>
							<span style={{ fontSize: 12 }}>{status.emoji}</span>
							<span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{status.label}</span>
							<Icon
								name="chevronDown"
								size={12}
							/>
						</button>
						{statusMenuOpen && (
						<div
							className="dropdown"
							style={{ bottom: "calc(100% + 8px)", left: 0, right: 0 }}
						>
							<div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Set a status</div>
							{STATUS_OPTIONS.map((option) => (
								<button
									key={option.id}
									type="button"
									className={`dropdown-item${status.id === option.id ? " active" : ""}`}
									onClick={() => {
										setStatus(option);
										setStatusMenuOpen(false);
									}}
								>
									<span style={{ fontSize: 14 }}>{option.emoji}</span>
									<span>{option.label}</span>
									{status.id === option.id && <Icon name="check" size={12} style={{ marginLeft: "auto", color: "var(--accent)" }} />}
								</button>
							))}
						</div>
					)}
					</div>
				</div>
			</aside>

			<div className="main-area">
				<header className="topbar">
					<button
						type="button"
						onClick={() => setSidebarOpen((open) => !open)}
						className="btn btn-ghost btn-sm"
						style={{ display: "none" }}
					>
						<Icon
							name="menu"
							size={16}
						/>
					</button>

					<div className="topbar-group">
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => navigate(-1)}
							aria-label="Go back"
						>
							<Icon
								name="arrowLeft"
								size={14}
							/>
						</button>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => navigate(1)}
							aria-label="Go forward"
						>
							<Icon
								name="arrowRight"
								size={14}
							/>
						</button>
					</div>

					<div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
						{workspaceId ? (
							<>
								<Link
									to="/app/workspaces"
									style={{ color: "var(--text-secondary)", textDecoration: "none" }}
								>
									Workspaces
								</Link>
								<span>/</span>
								<Link
									to={`/app/workspaces/${workspaceId}`}
									style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none" }}
								>
									{workspace?.name || "Workspace"}
								</Link>
								<span>/</span>
								<span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{pageLabel}</span>
							</>
						) : (
							<span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{pageLabel === "Home" ? "CollabBoard" : pageLabel}</span>
						)}
					</div>

					<button
						type="button"
						className="topbar-search"
						onClick={() => setCommandOpen(true)}
					>
						<Icon
							name="search"
							size={14}
						/>
						<span style={{ flex: 1, textAlign: "left" }}>Search</span>
						<span className="command-kbd">Ctrl+K</span>
					</button>

					<div
						className="topbar-group"
						ref={bellRef}
					>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => setBellOpen((open) => !open)}
							aria-label="Notifications"
						>
							<div key={unreadCount} className={unreadCount > 0 ? "bell-bounce" : ""} style={{ display: "flex" }}>
								<Icon
									name="bell"
									size={16}
								/>
							</div>
							{unreadCount > 0 && (
								<span
									className="badge badge-accent"
									style={{ marginLeft: 6 }}
								>
									{unreadCount > 99 ? "99+" : unreadCount}
								</span>
							)}
						</button>
						{bellOpen && (
							<div
								className="dropdown"
								style={{ right: 0, top: "calc(100% + 8px)", minWidth: 220 }}
							>
								<div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
									{unreadCount > 0 ? `${unreadCount} unread notifications` : "No new notifications"}
								</div>
								<Link
									to="/app/notifications"
									className="dropdown-item"
									onClick={() => setBellOpen(false)}
								>
									View all notifications
								</Link>
							</div>
						)}
					</div>

					<div
						className="topbar-group"
						ref={userMenuRef}
					>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => setUserMenuOpen((open) => !open)}
							style={{ gap: 8 }}
						>
							<Avatar
								user={user}
								size="xs"
							/>
							<Icon
								name="chevronDown"
								size={12}
							/>
						</button>
						{userMenuOpen && (
							<div
								className="dropdown"
								style={{ right: 0, top: "calc(100% + 8px)", minWidth: 240 }}
							>
								{/* User info header */}
								<div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
									<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
										<Avatar user={user} size="md" />
										<div style={{ minWidth: 0 }}>
											<p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "User"}</p>
											<p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</p>
										</div>
									</div>
									<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
										<span className="status-chip" style={{ fontSize: 11 }}>
											<span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
											{status.emoji} {status.label}
										</span>
										<button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "0 8px", minHeight: 22 }}
											onClick={() => { setUserMenuOpen(false); setStatusMenuOpen(true); }}
										>Change status ▸</button>
									</div>
								</div>
								{/* Main links */}
								<Link
									to="/app/profile"
									className="dropdown-item"
									onClick={() => setUserMenuOpen(false)}
								>
									<Icon name="user" size={14} />
									<span style={{ flex: 1 }}>Profile &amp; account</span>
								</Link>
								<Link
									to="/app/profile"
									className="dropdown-item"
									onClick={() => setUserMenuOpen(false)}
								>
									<Icon name="settings" size={14} />
									<span style={{ flex: 1 }}>Preferences</span>
								</Link>
								<button
									type="button"
									className="dropdown-item"
									onClick={() => setUserMenuOpen(false)}
								>
									<Icon name="keyboard" size={14} />
									<span style={{ flex: 1 }}>Keyboard shortcuts</span>
									<span className="command-kbd" style={{ fontSize: 10 }}>Ctrl+/</span>
								</button>
								<div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
								<button type="button" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
									<Icon name="spark" size={14} />
									<span style={{ flex: 1 }}>What&apos;s new</span>
								</button>
								<button type="button" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
									<Icon name="alert" size={14} />
									<span style={{ flex: 1 }}>Help &amp; support</span>
								</button>
								<div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
								<button
									type="button"
									className="dropdown-item danger"
									onClick={handleLogout}
								>
									<Icon name="close" size={14} />
									<span>Sign out everywhere</span>
								</button>
							</div>
						)}
					</div>
				</header>

				<main className="content-area fade-in">
					<Outlet context={{ workspace }} />
				</main>
				
				{/* Mobile Bottom Nav */}
				<nav className="mobile-bottom-nav">
					<Link to="/app/workspaces" className="mobile-nav-item">
						<Icon name="kanban" size={20} />
						<span>Boards</span>
					</Link>
					<Link to="/app/my-work" className="mobile-nav-item">
						<Icon name="check" size={20} />
						<span>My Work</span>
					</Link>
					<Link to="/app/notifications" className="mobile-nav-item">
						<Icon name="bell" size={20} />
						<span>Alerts</span>
					</Link>
					<button type="button" className="mobile-nav-item" onClick={() => setCommandOpen(true)} style={{ background: "none", border: "none" }}>
						<Icon name="search" size={20} />
						<span>Search</span>
					</button>
				</nav>
			</div>

			{commandOpen && (
				<div
					className="command-overlay"
					onClick={(event) => {
						if (event.target === event.currentTarget) setCommandOpen(false);
					}}
				>
					<div className="command-palette">
						<div className="command-input">
							<Icon
								name="search"
								size={16}
							/>
							<input
								ref={commandInputRef}
								value={commandQuery}
								onChange={(event) => setCommandQuery(event.target.value)}
								placeholder="Search or run a command"
							/>
							<span className="command-kbd">Esc</span>
						</div>
						<div className="command-section">
							<div className="command-section-title">Quick actions</div>
							<button
								type="button"
								className="command-item"
								onClick={() => {
									setCommandOpen(false);
									if (activeWorkspaceId) navigate(`/app/workspaces/${activeWorkspaceId}/boards`);
								}}
							>
								<span>Create new board</span>
								<span className="command-kbd">B</span>
							</button>
							<button
								type="button"
								className="command-item"
								onClick={() => {
									setCommandOpen(false);
									navigate("/app/notifications");
								}}
							>
								<span>Open notifications</span>
								<span className="command-kbd">N</span>
							</button>
							<button
								type="button"
								className="command-item"
								onClick={() => {
									setCommandOpen(false);
									navigate("/app/profile");
								}}
							>
								<span>Open profile</span>
								<span className="command-kbd">P</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
