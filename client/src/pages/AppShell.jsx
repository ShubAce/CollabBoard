import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import api from "../api/axios";
import FlipNumber from "../components/motion/FlipNumber.jsx";
import Icon from "../components/ui/Icon.jsx";
import { dialog, EASE_OUT, MOBILE_QUERY, overlay, popover, sheet, SPRING, SPRING_SOFT } from "../lib/motion";
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
	const colors = ["#3b82f6", "#3dd68c", "#60a5fa", "#ff6b6b", "#f0c040", "#2dd4bf", "#ff8c42"];
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
	{ id: "available", label: "Available", icon: "check", color: "var(--green)" },
	{ id: "busy", label: "Busy", icon: "alert", color: "var(--red)" },
	{ id: "meeting", label: "In a meeting", icon: "users", color: "var(--yellow)" },
	{ id: "focus", label: "Focusing — do not disturb", icon: "lock", color: "var(--blue)" },
	{ id: "vacation", label: "On vacation", icon: "home", color: "var(--teal)" },
	{ id: "wfh", label: "Working from home", icon: "home", color: "var(--accent-light)" },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const sectionVariants = {
	open: { height: "auto", opacity: 1, transition: { duration: 0.25, ease: EASE_OUT }, transitionEnd: { overflow: "visible" } },
	closed: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.2, ease: EASE_OUT } },
};

/** Highlight that glides to whichever sidebar link is active (UI.md §18.2). */
function ActiveIndicator() {
	return (
		<motion.span
			layoutId="sidebar-active"
			className="sidebar-active"
			transition={SPRING}
		/>
	);
}

function PageFallback() {
	return (
		<div
			className="fade-in"
			aria-busy="true"
		>
			<div
				className="skeleton"
				style={{ height: 28, width: 240, marginBottom: 10 }}
			/>
			<div
				className="skeleton"
				style={{ height: 14, width: 180, marginBottom: 28 }}
			/>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="skeleton"
						style={{ height: 150 }}
					/>
				))}
			</div>
		</div>
	);
}

function SidebarSection({ title, open, onToggle, action, children }) {
	return (
		<div className="sidebar-section">
			<div className="sidebar-section-header">
				<button
					type="button"
					className="section-toggle"
					onClick={onToggle}
					aria-expanded={open}
				>
					<motion.span
						style={{ display: "flex" }}
						initial={false}
						animate={{ rotate: open ? 0 : -90 }}
						transition={SPRING}
					>
						<Icon
							name="chevronDown"
							size={12}
						/>
					</motion.span>
					{title}
				</button>
				{action && <div className="sidebar-section-actions">{action}</div>}
			</div>
			<motion.div
				className="sidebar-items"
				initial={false}
				animate={open ? "open" : "closed"}
				variants={sectionVariants}
			>
				{children}
			</motion.div>
		</div>
	);
}

export default function AppShell() {
	const navigate = useNavigate();
	const location = useLocation();
	const wsMatch = useMatch("/app/workspaces/:workspaceId/*");
	const workspaceId = wsMatch?.params?.workspaceId || null;
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const clearAuth = useAuthStore((s) => s.clearAuth);
	const setAuth = useAuthStore((s) => s.setAuth);
	const isMobile = useMediaQuery(MOBILE_QUERY);

	const [unreadCount, setUnreadCount] = useState(0);
	const [workspace, setWorkspace] = useState(null);
	const [workspaces, setWorkspaces] = useState([]);
	const [boards, setBoards] = useState([]);
	const [channels, setChannels] = useState([]);
	const [fallbackWorkspaceId, setFallbackWorkspaceId] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	// Tablets start with the compact rail so content keeps its room.
	const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1100);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const [switcherOpen, setSwitcherOpen] = useState(false);
	const [statusMenuOpen, setStatusMenuOpen] = useState(false);
	const [bellOpen, setBellOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	const [commandQuery, setCommandQuery] = useState("");
	const [commandIndex, setCommandIndex] = useState(0);
	const [sections, setSections] = useState(DEFAULT_SECTIONS);
	const [status, setStatus] = useState(() => {
		return user?.status || STATUS_OPTIONS[0];
	});

	useEffect(() => {
		if (user?.status) {
			setStatus(user.status);
		}
	}, [user]);

	const userMenuRef = useRef(null);
	const switcherRef = useRef(null);
	const statusRef = useRef(null);
	const bellRef = useRef(null);
	const commandInputRef = useRef(null);
	const commandListRef = useRef(null);
	const contentRef = useRef(null);
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
		setSidebarOpen(false);
		contentRef.current?.scrollTo({ top: 0 });
	}, [location.pathname]);

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
		const handleUpdate = (e) => setUnreadCount(e.detail);
		window.addEventListener("notifications:update", handleUpdate);
		return () => window.removeEventListener("notifications:update", handleUpdate);
	}, []);

	useEffect(() => {
		const handleKey = (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandOpen((open) => !open);
				return;
			}
			if (event.key === "Escape") {
				setCommandOpen(false);
				setBellOpen(false);
				setUserMenuOpen(false);
				setStatusMenuOpen(false);
				setSwitcherOpen(false);
				setSidebarOpen(false);
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, []);

	useEffect(() => {
		if (!commandOpen) return;
		setCommandQuery("");
		setCommandIndex(0);
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

	const handleStatusChange = async (option) => {
		setStatus(option);
		setStatusMenuOpen(false);
		try {
			const { data } = await api.patch("/users/me", { status: option });
			setAuth(data, accessToken);
		} catch {
			/* ignore — status is UI-only if API not available */
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
					end: true,
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
					end: true,
				},
				{
					key: "notifications",
					label: "Notifications",
					icon: "bell",
					to: "/app/notifications",
					badge: unreadCount,
					end: true,
				},
			]
		: [];

	const visibleChannels = channels.filter((ch) => !ch.name?.startsWith("dm_"));
	const channelItems = activeWorkspaceId
		? visibleChannels.length > 0
			? visibleChannels.map((ch) => ({
					key: ch._id,
					label: ch.name,
					to: `/app/workspaces/${activeWorkspaceId}/chat?channelId=${ch._id}`,
					isReadOnly: ch.isReadOnly,
				}))
			: [
					{ key: "general", label: "general", to: `/app/workspaces/${activeWorkspaceId}/chat` },
					{ key: "announcements", label: "announcements", to: `/app/workspaces/${activeWorkspaceId}/chat?channel=announcements` },
				]
		: [];

	const dmItems = useMemo(
		() => (workspace?.members ? workspace.members.map((member) => member.user).filter((member) => member && member._id !== user?._id) : []),
		[workspace, user?._id],
	);

	const workspaceDotColor = workspace?.color || getAvatarColor(workspace?.name || "");
	const isCollapsed = sidebarCollapsed && !isMobile;
	const searchParams = new URLSearchParams(location.search);
	const activeChannelId = searchParams.get("channelId");
	const activeChannelParam = searchParams.get("channel");

	// Flat, ordered command list so ↑/↓/Enter can drive it (UI.md §14).
	const commandGroups = useMemo(() => {
		if (!commandOpen) return [];
		const query = commandQuery.trim().toLowerCase();
		const go = (path) => () => {
			setCommandOpen(false);
			navigate(path);
		};
		if (!query) {
			const groups = [
				{
					title: "Quick actions",
					items: [
						{ id: "new-board", icon: "plus", label: "Create new board", run: go(activeWorkspaceId ? `/app/workspaces/${activeWorkspaceId}/boards` : "/app/workspaces") },
						{ id: "my-work", icon: "briefcase", label: "Open my work", run: go("/app/my-work") },
						{ id: "notifications", icon: "bell", label: "Open notifications", run: go("/app/notifications") },
						{ id: "profile", icon: "user", label: "Open profile", run: go("/app/profile") },
					],
				},
			];
			if (boards.length && activeWorkspaceId) {
				groups.push({
					title: "Jump to board",
					items: boards.slice(0, 5).map((board) => ({
						id: `board-${board._id}`,
						icon: "board",
						label: board.name,
						hint: workspace?.name,
						run: go(`/app/workspaces/${activeWorkspaceId}/boards/${board._id}`),
					})),
				});
			}
			return groups;
		}
		const matches = (value) => value?.toLowerCase().includes(query);
		return [
			{
				title: "Workspaces",
				items: workspaces.filter((w) => matches(w.name)).map((ws) => ({ id: `ws-${ws._id}`, icon: "briefcase", label: ws.name, run: go(`/app/workspaces/${ws._id}`) })),
			},
			{
				title: "Boards",
				items: boards.filter((b) => matches(b.name)).map((board) => ({ id: `board-${board._id}`, icon: "board", label: board.name, run: go(`/app/workspaces/${activeWorkspaceId}/boards/${board._id}`) })),
			},
			{
				title: "Channels",
				items: channels
					.filter((c) => matches(c.name) && !c.name?.startsWith("dm_"))
					.map((ch) => ({ id: `ch-${ch._id}`, icon: "hash", label: ch.name, run: go(`/app/workspaces/${activeWorkspaceId}/chat?channelId=${ch._id}`) })),
			},
			{
				title: "Direct Messages",
				items: dmItems.filter((m) => matches(m.name)).map((member) => ({ id: `dm-${member._id}`, icon: "user", label: member.name, run: go(`/app/workspaces/${activeWorkspaceId}/chat?dm=${member._id}`) })),
			},
		].filter((group) => group.items.length > 0);
	}, [commandOpen, commandQuery, workspaces, boards, channels, dmItems, activeWorkspaceId, workspace?.name, navigate]);

	const commandItems = commandGroups.flatMap((group) => group.items);

	useEffect(() => {
		commandListRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
	}, [commandIndex]);

	const handleCommandKey = (event) => {
		if (!commandItems.length) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setCommandIndex((index) => (index + 1) % commandItems.length);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setCommandIndex((index) => (index - 1 + commandItems.length) % commandItems.length);
		} else if (event.key === "Enter") {
			event.preventDefault();
			commandItems[Math.min(commandIndex, commandItems.length - 1)]?.run();
		}
	};

	const sidebarContent = (
		<>
			<div
				className="sidebar-switcher"
				ref={switcherRef}
			>
				<button
					type="button"
					className="workspace-switcher"
					onClick={() => setSwitcherOpen((open) => !open)}
					style={{ flex: 1, minWidth: 0, paddingRight: 4 }}
					title={isCollapsed ? workspace?.name : undefined}
				>
					<span
						style={{
							width: 16,
							height: 16,
							borderRadius: "var(--r-sm)",
							background: workspaceDotColor,
							boxShadow: `0 0 12px ${workspaceDotColor}66`,
							flexShrink: 0,
						}}
					/>
					<span style={{ flex: 1, textAlign: "left", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace?.name || "Select workspace"}</span>
					<motion.span
						style={{ display: "flex" }}
						animate={{ rotate: switcherOpen ? 180 : 0 }}
						transition={SPRING}
					>
						<Icon
							name="chevronDown"
							size={14}
						/>
					</motion.span>
				</button>

				{isMobile ? (
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						style={{ padding: 4, height: "auto", color: "var(--text-muted)", border: "none" }}
						onClick={() => setSidebarOpen(false)}
						aria-label="Close menu"
					>
						<Icon
							name="close"
							size={16}
						/>
					</button>
				) : (
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						style={{ padding: 4, height: "auto", color: "var(--text-muted)", border: "none" }}
						onClick={() => setSidebarCollapsed((c) => !c)}
						title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						<Icon
							name={sidebarCollapsed ? "menu" : "sidebar"}
							size={16}
						/>
					</button>
				)}

				<AnimatePresence>
					{switcherOpen && (
						<>
							<div
								style={{ position: "fixed", inset: 0, zIndex: 999 }}
								onClick={() => setSwitcherOpen(false)}
							/>
							<motion.div
								data-motion
								className="dropdown"
								style={{ position: "fixed", top: 52, left: 12, width: 240, zIndex: 1000, transformOrigin: "top left" }}
								variants={popover}
								initial="initial"
								animate="animate"
								exit="exit"
							>
								<div className="command-section-title" style={{ padding: "6px 10px 4px" }}>
									Workspaces
								</div>
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
										<span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
											<span
												style={{
													width: 14,
													height: 14,
													borderRadius: "var(--r-sm)",
													background: ws.color || getAvatarColor(ws.name || String(index)),
													flexShrink: 0,
												}}
											/>
											<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.name}</span>
										</span>
										{activeWorkspaceId === ws._id && (
											<Icon
												name="check"
												size={14}
												style={{ color: "var(--accent-light)" }}
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
									<Icon
										name="layers"
										size={14}
									/>
									Browse all workspaces
								</Link>
								<Link
									to="/app/workspaces/new"
									className="dropdown-item"
									onClick={() => setSwitcherOpen(false)}
								>
									<Icon
										name="plus"
										size={14}
									/>
									Create new workspace
								</Link>
							</motion.div>
						</>
					)}
				</AnimatePresence>
			</div>

			<motion.div
				className="sidebar-body"
				layoutScroll
			>
				{activeWorkspaceId && (
					<SidebarSection
						title="Main"
						open={sections.main}
						onToggle={() => toggleSection("main")}
					>
						{mainItems.map((item) => {
							if (item.to) {
								return (
									<NavLink
										key={item.key}
										to={item.to}
										end={item.end}
										className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
										title={isCollapsed ? item.label : undefined}
									>
										{({ isActive }) => (
											<>
												{isActive && <ActiveIndicator />}
												<Icon
													name={item.icon}
													size={14}
												/>
												<span style={{ flex: 1 }}>{item.label}</span>
												{item.badge > 0 && (
													<span className="sidebar-badge">
														<FlipNumber value={item.badge} />
													</span>
												)}
											</>
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
									title={isCollapsed ? item.label : undefined}
								>
									<Icon
										name={item.icon}
										size={14}
									/>
									<span style={{ flex: 1 }}>{item.label}</span>
									{item.key === "search" && !isCollapsed && !isMobile && <span className="kbd">{IS_MAC ? "⌘K" : "Ctrl K"}</span>}
								</button>
							);
						})}
					</SidebarSection>
				)}

				{activeWorkspaceId && (
					<SidebarSection
						title="Boards"
						open={sections.boards}
						onToggle={() => toggleSection("boards")}
						action={
							<button
								type="button"
								className="sidebar-link"
								onClick={() => navigate(`/app/workspaces/${activeWorkspaceId}/boards`)}
								style={{ padding: "2px 6px", width: "auto" }}
								aria-label="Open boards"
							>
								<Icon
									name="plus"
									size={12}
								/>
							</button>
						}
					>
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
								<span>No boards yet</span>
							</button>
						)}
						{boards.map((board) => (
							<NavLink
								key={board._id}
								to={`/app/workspaces/${activeWorkspaceId}/boards/${board._id}`}
								className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
								title={isCollapsed ? board.name : undefined}
							>
								{({ isActive }) => (
									<>
										{isActive && <ActiveIndicator />}
										<Icon
											name="board"
											size={14}
										/>
										<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.name}</span>
									</>
								)}
							</NavLink>
						))}
					</SidebarSection>
				)}

				{activeWorkspaceId && (
					<SidebarSection
						title="Channels"
						open={sections.channels}
						onToggle={() => toggleSection("channels")}
					>
						{channelItems.map((channel) => {
							const isGeneral = channel.key === "general" || channel.label === "general";
							const isAnnouncements = channel.key === "announcements" || channel.label === "announcements";

							let isActive = false;
							if (activeChannelId) {
								isActive = activeChannelId === channel.key;
							} else if (activeChannelParam) {
								isActive = activeChannelParam === channel.key || activeChannelParam === channel.label;
							} else {
								isActive = isGeneral && location.pathname.endsWith("/chat");
							}

							return (
								<Link
									key={channel.key}
									to={channel.to}
									className={`sidebar-link${isActive ? " active" : ""}`}
									title={isCollapsed ? channel.label : undefined}
								>
									{isActive && <ActiveIndicator />}
									{isAnnouncements ? (
										<Icon
											name="bell"
											size={14}
											style={{ color: "var(--text-muted)" }}
										/>
									) : isGeneral ? (
										<Icon
											name="chat"
											size={14}
											style={{ color: "var(--text-muted)" }}
										/>
									) : (
										<Icon
											name="hash"
											size={14}
											style={{ color: "var(--text-muted)" }}
										/>
									)}
									<span style={{ flex: 1 }}>{channel.label}</span>
									{channel.isReadOnly && <span className="badge badge-muted">Read-only</span>}
								</Link>
							);
						})}
					</SidebarSection>
				)}

				{activeWorkspaceId && (
					<SidebarSection
						title="Direct Messages"
						open={sections.dms}
						onToggle={() => toggleSection("dms")}
					>
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
								<span>No direct messages</span>
							</button>
						)}
						{dmItems.map((member) => {
							const dmChannel = channels.find((ch) => ch.name?.startsWith("dm_") && ch.name.includes(member._id) && ch.name.includes(user?._id));
							const isActive = Boolean(activeChannelId && dmChannel && activeChannelId === dmChannel._id);
							return (
								<Link
									key={member._id}
									to={`/app/workspaces/${activeWorkspaceId}/chat?dm=${member._id}`}
									className={`sidebar-link${isActive ? " active" : ""}`}
									title={isCollapsed ? member.name : undefined}
								>
									{isActive && <ActiveIndicator />}
									<Avatar
										user={member}
										size="xs"
									/>
									<span style={{ flex: 1 }}>{member.name}</span>
									{member.status && (
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: "50%",
												background: member.status.color || "var(--green)",
												flexShrink: 0,
											}}
											title={member.status.label}
										/>
									)}
								</Link>
							);
						})}
					</SidebarSection>
				)}
			</motion.div>

			<div className="sidebar-footer">
				<div
					ref={statusRef}
					style={{ display: "flex", flexDirection: "column", gap: 8 }}
				>
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
							<div style={{ position: "relative", flexShrink: 0 }}>
								<Avatar
									user={user}
									size="sm"
								/>
								<span
									style={{
										position: "absolute",
										right: -1,
										bottom: -1,
										width: 10,
										height: 10,
										borderRadius: "50%",
										background: status.color || "var(--green)",
										border: "2px solid var(--bg-sidebar)",
									}}
								/>
							</div>
							{!isCollapsed && (
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
							)}
						</div>
						{!isCollapsed && (
							<Link
								to="/app/profile"
								className="sidebar-link"
								style={{ padding: "4px 6px", width: "auto" }}
								aria-label="Open profile"
							>
								<Icon
									name="settings"
									size={14}
								/>
							</Link>
						)}
					</div>
					<button
						type="button"
						className="status-chip"
						onClick={() => setStatusMenuOpen((open) => !open)}
					>
						<span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color || "var(--green)", flexShrink: 0 }} />
						<span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{status.label}</span>
						<Icon
							name="chevronDown"
							size={12}
						/>
					</button>
					<AnimatePresence>
						{statusMenuOpen && (
							<motion.div
								data-motion
								className="dropdown"
								style={{ bottom: "calc(100% + 8px)", left: 0, right: 0, zIndex: 200, transformOrigin: "bottom" }}
								initial={{ opacity: 0, y: 6, scale: 0.97 }}
								animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
								exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
							>
								<div className="command-section-title" style={{ padding: "6px 10px 4px" }}>
									Set a status
								</div>
								{STATUS_OPTIONS.map((option) => (
									<button
										key={option.id}
										type="button"
										className="dropdown-item"
										onClick={() => handleStatusChange(option)}
									>
										<Icon
											name={option.icon}
											size={14}
											style={{ color: option.color }}
										/>
										<span style={{ flex: 1 }}>{option.label}</span>
										{status.id === option.id && (
											<Icon
												name="check"
												size={12}
												style={{ color: "var(--accent-light)" }}
											/>
										)}
									</button>
								))}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</>
	);

	return (
		<div className="app-layout">
			{!isMobile && <aside className={`sidebar${isCollapsed ? " collapsed" : ""}`}>{sidebarContent}</aside>}

			<AnimatePresence>
				{isMobile && sidebarOpen && (
					<motion.div
						key="sidebar-overlay"
						className="sidebar-overlay"
						variants={overlay}
						initial="initial"
						animate="animate"
						exit="exit"
						onClick={() => setSidebarOpen(false)}
					/>
				)}
				{isMobile && sidebarOpen && (
					<motion.aside
						key="sidebar-drawer"
						className="sidebar"
						initial={{ x: "-100%" }}
						animate={{ x: 0, transition: SPRING_SOFT }}
						exit={{ x: "-100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={{ left: 0.5, right: 0 }}
						onDragEnd={(_, info) => {
							if (info.offset.x < -80 || info.velocity.x < -400) setSidebarOpen(false);
						}}
					>
						{sidebarContent}
					</motion.aside>
				)}
			</AnimatePresence>

			<div className="main-area">
				<header className="topbar">
					<button
						type="button"
						onClick={() => setSidebarOpen((open) => !open)}
						className="btn btn-ghost btn-sm mobile-hamburger"
						aria-label="Open menu"
					>
						<Icon
							name="menu"
							size={16}
						/>
					</button>

					<div className="topbar-group">
						<button
							type="button"
							className="btn btn-ghost btn-sm mobile-nav-arrows"
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
							className="btn btn-ghost btn-sm mobile-nav-arrows"
							onClick={() => navigate(1)}
							aria-label="Go forward"
						>
							<Icon
								name="arrowRight"
								size={14}
							/>
						</button>
					</div>

					<div className="topbar-crumbs">
						{workspaceId && (
							<span className="topbar-crumbs-extra">
								<Link
									to="/app/workspaces"
									style={{ color: "var(--text-secondary)", textDecoration: "none" }}
								>
									Workspaces
								</Link>
								<span style={{ color: "var(--text-muted)" }}>/</span>
								<Link
									to={`/app/workspaces/${workspaceId}`}
									style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
								>
									{workspace?.name || "Workspace"}
								</Link>
								<span style={{ color: "var(--text-muted)" }}>/</span>
							</span>
						)}
						<AnimatePresence
							mode="popLayout"
							initial={false}
						>
							<motion.span
								key={pageLabel}
								style={{ color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.2, ease: EASE_OUT }}
							>
								{!workspaceId && pageLabel === "Home" ? "CollabBoard" : pageLabel}
							</motion.span>
						</AnimatePresence>
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
						<span className="kbd">{IS_MAC ? "⌘K" : "Ctrl K"}</span>
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
							style={{ position: "relative" }}
						>
							<div
								key={unreadCount}
								className={unreadCount > 0 ? "bell-bounce" : ""}
								style={{ display: "flex", transformOrigin: "top center" }}
							>
								<Icon
									name="bell"
									size={16}
								/>
							</div>
							{unreadCount > 0 && (
								<span
									className="sidebar-badge"
									style={{ marginLeft: 2 }}
								>
									<FlipNumber value={unreadCount} />
								</span>
							)}
						</button>
						<AnimatePresence>
							{bellOpen && (
								<motion.div
									data-motion
									className="dropdown"
									style={{ right: 0, top: "calc(100% + 8px)", minWidth: 240, zIndex: 200, transformOrigin: "top right" }}
									variants={popover}
									initial="initial"
									animate="animate"
									exit="exit"
								>
									<div style={{ padding: "10px 10px 8px", display: "flex", alignItems: "center", gap: 10 }}>
										<span
											className="icon-box icon-box-accent"
											style={{ width: 28, height: 28 }}
										>
											<Icon
												name="bell"
												size={14}
											/>
										</span>
										<div>
											<p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Notifications</p>
											<p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p>
										</div>
									</div>
									<div style={{ height: 1, background: "var(--border-subtle)", margin: "0 0 4px" }} />
									<Link
										to="/app/notifications"
										className="dropdown-item"
										onClick={() => setBellOpen(false)}
									>
										<span style={{ flex: 1 }}>View all notifications</span>
										<Icon
											name="arrowRight"
											size={12}
										/>
									</Link>
								</motion.div>
							)}
						</AnimatePresence>
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
							aria-label="Account menu"
						>
							<Avatar
								user={user}
								size="xs"
							/>
							<motion.span
								style={{ display: "flex" }}
								animate={{ rotate: userMenuOpen ? 180 : 0 }}
								transition={SPRING}
							>
								<Icon
									name="chevronDown"
									size={12}
								/>
							</motion.span>
						</button>
						<AnimatePresence>
							{userMenuOpen && (
								<motion.div
									data-motion
									className="dropdown"
									style={{ right: 0, top: "calc(100% + 8px)", minWidth: 240, zIndex: 200, transformOrigin: "top right" }}
									variants={popover}
									initial="initial"
									animate="animate"
									exit="exit"
								>
									{/* User info header */}
									<div style={{ padding: "10px 10px 12px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
										<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
											<Avatar
												user={user}
												size="md"
											/>
											<div style={{ minWidth: 0 }}>
												<p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "User"}</p>
												<p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || ""}</p>
											</div>
										</div>
										<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
											<span
												className="status-chip"
												style={{ fontSize: 11 }}
											>
												<span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
												{status.label}
											</span>
											<button
												type="button"
												className="btn btn-ghost btn-sm"
												style={{ fontSize: 11, padding: "0 8px", minHeight: 22 }}
												onClick={() => {
													setUserMenuOpen(false);
													if (isMobile) setSidebarOpen(true);
													setStatusMenuOpen(true);
												}}
											>
												Change status
											</button>
										</div>
									</div>
									{/* Main links */}
									<Link
										to="/app/profile"
										className="dropdown-item"
										onClick={() => setUserMenuOpen(false)}
									>
										<Icon
											name="user"
											size={14}
										/>
										<span style={{ flex: 1 }}>Profile &amp; account</span>
									</Link>
									<Link
										to="/app/profile"
										className="dropdown-item"
										onClick={() => setUserMenuOpen(false)}
									>
										<Icon
											name="settings"
											size={14}
										/>
										<span style={{ flex: 1 }}>Preferences</span>
									</Link>
									<button
										type="button"
										className="dropdown-item"
										onClick={() => setUserMenuOpen(false)}
									>
										<Icon
											name="keyboard"
											size={14}
										/>
										<span style={{ flex: 1 }}>Keyboard shortcuts</span>
									</button>
									<div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
									<button
										type="button"
										className="dropdown-item"
										onClick={() => setUserMenuOpen(false)}
									>
										<Icon
											name="sparkles"
											size={14}
										/>
										<span style={{ flex: 1 }}>What&apos;s new</span>
									</button>
									<button
										type="button"
										className="dropdown-item"
										onClick={() => setUserMenuOpen(false)}
									>
										<Icon
											name="info"
											size={14}
										/>
										<span style={{ flex: 1 }}>Help &amp; support</span>
									</button>
									<div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
									<button
										type="button"
										className="dropdown-item danger"
										onClick={handleLogout}
									>
										<Icon
											name="logOut"
											size={14}
										/>
										<span>Sign out everywhere</span>
									</button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</header>

				<main
					className="content-area"
					ref={contentRef}
				>
					{/* Only the content area waits for a lazy page chunk; the shell stays put */}
					<Suspense fallback={<PageFallback />}>
						<Outlet context={{ workspace, workspaceId: activeWorkspaceId }} />
					</Suspense>
				</main>

				{/* Mobile Bottom Nav */}
				<nav
					className="mobile-bottom-nav"
					aria-label="Primary"
				>
					{[
						{ to: "/app/workspaces", icon: "kanban", label: "Boards" },
						{ to: "/app/my-work", icon: "check", label: "My Work" },
						{ to: "/app/notifications", icon: "bell", label: "Alerts", badge: unreadCount },
					].map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}
						>
							{({ isActive }) => (
								<>
									{isActive && (
										<motion.span
											layoutId="mobile-nav-pill"
											className="mobile-nav-pill"
											transition={SPRING}
										/>
									)}
									<span style={{ display: "flex", position: "relative" }}>
										<Icon
											name={item.icon}
											size={20}
										/>
										{item.badge > 0 && <span className="mobile-nav-dot">{item.badge > 9 ? "9+" : item.badge}</span>}
									</span>
									<span>{item.label}</span>
								</>
							)}
						</NavLink>
					))}
					<button
						type="button"
						className="mobile-nav-item"
						onClick={() => setCommandOpen(true)}
					>
						<span style={{ display: "flex" }}>
							<Icon
								name="search"
								size={20}
							/>
						</span>
						<span>Search</span>
					</button>
				</nav>
			</div>

			<AnimatePresence>
				{commandOpen && (
					<motion.div
						key="command"
						className="command-overlay"
						variants={overlay}
						initial="initial"
						animate="animate"
						exit="exit"
						onClick={(event) => {
							if (event.target === event.currentTarget) setCommandOpen(false);
						}}
					>
						<motion.div
							className="command-palette"
							role="dialog"
							aria-modal="true"
							aria-label="Command palette"
							variants={isMobile ? sheet : dialog}
							initial="initial"
							animate="animate"
							exit="exit"
						>
							<div className="command-input">
								<Icon
									name="search"
									size={16}
								/>
								<input
									ref={commandInputRef}
									value={commandQuery}
									onChange={(event) => {
										setCommandQuery(event.target.value);
										setCommandIndex(0);
									}}
									onKeyDown={handleCommandKey}
									placeholder="Search or jump to…"
									aria-label="Search"
								/>
								<span className="kbd">Esc</span>
							</div>
							<motion.div
								className="command-section"
								ref={commandListRef}
								layoutScroll
							>
								{commandItems.length === 0 ? (
									<div className="command-empty">
										<Icon
											name="search"
											size={20}
										/>
										<p>No results for &ldquo;{commandQuery}&rdquo;</p>
									</div>
								) : (
									commandGroups.map((group) => (
										<div key={group.title}>
											<div className="command-section-title">{group.title}</div>
											{group.items.map((item) => {
												const index = commandItems.indexOf(item);
												const isActive = index === Math.min(commandIndex, commandItems.length - 1);
												return (
													<button
														key={item.id}
														type="button"
														className={`command-item${isActive ? " active" : ""}`}
														data-active={isActive}
														onClick={item.run}
														onMouseMove={() => index !== commandIndex && setCommandIndex(index)}
													>
														{isActive && (
															<motion.span
																layoutId="command-active"
																className="command-active"
																transition={{ type: "spring", stiffness: 600, damping: 40 }}
															/>
														)}
														<Icon
															name={item.icon}
															size={14}
														/>
														<span className="command-item-label">{item.label}</span>
														{item.hint && <span className="command-item-hint">{item.hint}</span>}
														{isActive && (
															<Icon
																name="arrowRight"
																size={12}
															/>
														)}
													</button>
												);
											})}
										</div>
									))
								)}
							</motion.div>
							<div className="command-footer">
								<span>
									<span className="kbd">↑</span>
									<span className="kbd">↓</span> navigate
								</span>
								<span>
									<span className="kbd">↵</span> open
								</span>
								<span>
									<span className="kbd">esc</span> close
								</span>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
