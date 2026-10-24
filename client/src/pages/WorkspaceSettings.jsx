/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import SegmentedTabs from "../components/ui/SegmentedTabs.jsx";
import { EASE_IN, EASE_OUT, fadeUp, popover, staggerContainer } from "../lib/motion";

const TABS = ["general", "members", "channels", "danger"];
const roleOptions = ["viewer", "editor", "admin"];
const TAB_META = {
	general: { label: "General", icon: "settings" },
	members: { label: "Members", icon: "users" },
	channels: { label: "Channels", icon: "hash" },
	danger: { label: "Danger Zone", icon: "alert" },
};
const WS_COLORS = ["#3b82f6", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#2dd4bf", "#FB923C", "#F472B6"];

// Panel leaves quickly; its children stagger back in with fadeUp.
const panelExit = { opacity: 0, y: -4, transition: { duration: 0.15, ease: EASE_IN } };
const rowExit = { opacity: 0, x: -16, transition: { duration: 0.2, ease: EASE_IN } };

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const formatExpiry = (value) => {
	if (!value) return "";
	return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function getInitials(name = "") {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getColor(name = "") {
	let hash = 0;
	for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
	return WS_COLORS[Math.abs(hash) % WS_COLORS.length];
}

const labelStyle = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	fontSize: 12,
	fontWeight: 500,
	color: "var(--text-secondary)",
};

/** Success / error line that grows in and collapses out instead of jumping the layout. */
function Notice({ tone = "success", message, style }) {
	const isError = tone === "error";
	return (
		<AnimatePresence initial={false}>
			{message && (
				<motion.div
					key={tone}
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{ duration: 0.25, ease: EASE_OUT }}
					style={{ overflow: "hidden" }}
				>
					<div
						className={isError ? "message-error" : "message-success"}
						role={isError ? "alert" : "status"}
						style={{ display: "flex", alignItems: "center", gap: 8, ...style }}
					>
						<Icon
							name={isError ? "alert" : "checkCircle"}
							size={14}
							style={{ flexShrink: 0 }}
						/>
						<span>{message}</span>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

/** Stacks both labels in one grid cell so the button keeps its width while loading. */
function LoadingLabel({ loading, idle, busy }) {
	return (
		<span style={{ display: "inline-grid" }}>
			<span style={{ gridArea: "1 / 1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, visibility: loading ? "hidden" : "visible" }}>{idle}</span>
			<span style={{ gridArea: "1 / 1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, visibility: loading ? "visible" : "hidden" }}>
				<span
					className="spinner"
					style={{ width: 12, height: 12 }}
				/>
				{busy}
			</span>
		</span>
	);
}

function SettingsCard({ title, subtitle, icon, action, children, danger = false }) {
	return (
		<div
			className="page-panel"
			style={{
				padding: 20,
				minWidth: 0,
				borderColor: danger ? "rgba(255,107,107,0.35)" : "var(--border-default)",
				background: danger ? "linear-gradient(180deg, var(--danger-muted), transparent 160px), var(--bg-surface-1)" : "var(--bg-surface-1)",
			}}
		>
			<div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
				{icon && (
					<span
						className={`icon-box${danger ? "" : " icon-box-accent"}`}
						style={{ width: 32, height: 32, ...(danger ? { background: "var(--danger-muted)", borderColor: "rgba(255,107,107,0.35)", color: "var(--danger)" } : {}) }}
					>
						<Icon
							name={icon}
							size={16}
						/>
					</span>
				)}
				<div style={{ flex: 1, minWidth: 0 }}>
					<h3 style={{ fontSize: 15, fontWeight: 600, color: danger ? "var(--danger)" : "var(--text-primary)", margin: 0 }}>{title}</h3>
					{subtitle && (
						<p style={{ fontSize: 13, lineHeight: 1.5, color: danger ? "rgba(248,113,113,0.85)" : "var(--text-secondary)", margin: "3px 0 0" }}>{subtitle}</p>
					)}
				</div>
				{action}
			</div>
			<div style={{ marginTop: 18 }}>{children}</div>
		</div>
	);
}

function RoleBadge({ role }) {
	const style = {
		owner: { background: "var(--warning-muted)", color: "var(--warning)" },
		admin: { background: "var(--accent-muted)", color: "var(--accent-light)" },
		editor: { background: "var(--bg-surface-2)", color: "var(--text-primary)" },
		viewer: { background: "var(--bg-surface-2)", color: "var(--text-secondary)" },
	}[role] || { background: "var(--bg-surface-2)", color: "var(--text-secondary)" };
	return (
		<span
			className="badge"
			style={{ ...style, textTransform: "capitalize" }}
		>
			{role}
		</span>
	);
}

function MemberAvatar({ user }) {
	const name = user?.name || "?";
	return (
		<span
			className="avatar avatar-md"
			style={{ background: user?.avatar ? "var(--bg-surface-3)" : getColor(name), color: "#fff", overflow: "hidden" }}
		>
			{user?.avatar ? (
				<img
					src={user.avatar}
					alt=""
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			) : (
				getInitials(name)
			)}
		</span>
	);
}

function CountBadge({ count }) {
	return (
		<span
			className="badge badge-muted"
			style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
		>
			{count}
		</span>
	);
}

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export default function WorkspaceSettings() {
	const { workspaceId } = useParams();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("members");
	const [workspace, setWorkspace] = useState(null);
	const [generalForm, setGeneralForm] = useState({ name: "", description: "" });
	const [pendingInvites, setPendingInvites] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState([]);
	const [isSearching, setIsSearching] = useState(false);
	const [inviteRole, setInviteRole] = useState("viewer");
	const [inviteStatus, setInviteStatus] = useState("");
	const [inviteError, setInviteError] = useState("");
	const [submittingInvite, setSubmittingInvite] = useState(false);
	const [savingGeneral, setSavingGeneral] = useState(false);
	const [generalMessage, setGeneralMessage] = useState("");
	const [generalError, setGeneralError] = useState("");
	const [memberMessage, setMemberMessage] = useState("");
	const [memberError, setMemberError] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState("");
	const [deleteError, setDeleteError] = useState("");
	const [deletingWorkspace, setDeletingWorkspace] = useState(false);
	const canManageInvites = ["admin", "owner"].includes(workspace?.currentUserRole);

	const loadData = async () => {
		setStatus("loading");
		setError("");
		try {
			const { data: workspaceData } = await api.get(`/workspaces/${workspaceId}`);
			setWorkspace(workspaceData);
			setGeneralForm({ name: workspaceData?.name || "", description: workspaceData?.description || "" });
			const canInvite = ["admin", "owner"].includes(workspaceData?.currentUserRole);
			if (canInvite) {
				try {
					const invitesRes = await api.get(`/workspaces/${workspaceId}/invites`);
					setPendingInvites(invitesRes.data.invites || []);
				} catch (inviteErr) {
					setInviteError(inviteErr.response?.data?.message || "Failed to load pending invites");
					setPendingInvites([]);
				}
			} else {
				setPendingInvites([]);
			}
			setStatus("ready");
		} catch (err) {
			setError(err.response?.data?.message || "Failed to load workspace settings");
			setStatus("error");
		}
	};

	useEffect(() => {
		if (workspaceId) loadData();
	}, [workspaceId]);

	useEffect(() => {
		if (!workspaceId || !canManageInvites) return undefined;
		const trimmed = query.trim();
		if (!trimmed) {
			setResults([]);
			setIsSearching(false);
			return undefined;
		}

		setIsSearching(true);
		const timer = setTimeout(async () => {
			try {
				const { data } = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}&workspaceId=${workspaceId}`);
				setResults(Array.isArray(data) ? data : []);
			} catch {
				setResults([]);
			} finally {
				setIsSearching(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [query, workspaceId, canManageInvites]);

	const emailFallbackVisible = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!isEmail(trimmed)) return false;
		return !results.some((result) => result.email?.toLowerCase() === trimmed);
	}, [query, results]);

	const handleGeneralSave = async (event) => {
		event.preventDefault();
		setSavingGeneral(true);
		setGeneralMessage("");
		setGeneralError("");
		try {
			const { data } = await api.patch(`/workspaces/${workspaceId}`, generalForm);
			setWorkspace(data);
			setGeneralMessage("Workspace details updated.");
		} catch (err) {
			setGeneralError(err.response?.data?.message || "Failed to update workspace");
		} finally {
			setSavingGeneral(false);
		}
	};

	const handleInvite = async (email) => {
		if (!email) return;
		if (!canManageInvites) {
			setInviteError("Requires admin role or higher");
			return;
		}
		setSubmittingInvite(true);
		setInviteError("");
		setInviteStatus("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/invite`, { email, role: inviteRole });
			let message = data.message || "Invite sent";
			// Email is down and they have no account to get an in-app notification:
			// hand the admin the link so the invite still reaches them.
			if (data.emailDelivery === "unavailable" && data.type === "email_invite" && data.invite?.inviteUrl) {
				try {
					await navigator.clipboard.writeText(data.invite.inviteUrl);
					message = `Invite created for ${email}. Email delivery is unavailable, so the invite link was copied to your clipboard — share it with them.`;
				} catch {
					/* keep the server's message, which points to "Copy link" */
				}
			}
			setInviteStatus(message);
			setQuery("");
			setResults([]);
			if (data.invite) setPendingInvites((prev) => [data.invite, ...prev]);
		} catch (err) {
			setInviteError(err.response?.data?.message || "Failed to send invite");
		} finally {
			setSubmittingInvite(false);
		}
	};

	const handleRevoke = async (inviteId) => {
		if (!canManageInvites) {
			setInviteError("Requires admin role or higher");
			return;
		}
		try {
			await api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
			setPendingInvites((prev) => prev.filter((invite) => invite._id !== inviteId));
		} catch (err) {
			setInviteError(err.response?.data?.message || "Failed to revoke invite");
		}
	};

	const copyInviteLink = async (inviteUrl) => {
		if (!inviteUrl) return;
		if (!canManageInvites) {
			setInviteError("Requires admin role or higher");
			return;
		}
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setInviteStatus("Invite link copied.");
		} catch {
			setInviteError("Could not copy invite link.");
		}
	};

	const handleRoleChange = async (userId, role) => {
		setMemberMessage("");
		setMemberError("");
		try {
			await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
			setWorkspace((prev) => ({
				...prev,
				members: prev.members.map((member) => {
					const memberUserId = member.user?._id || member.user;
					return memberUserId === userId ? { ...member, role } : member;
				}),
			}));
			setMemberMessage("Member role updated.");
		} catch (err) {
			setMemberError(err.response?.data?.message || "Failed to update member role");
		}
	};

	const handleRemoveMember = async (userId) => {
		setMemberMessage("");
		setMemberError("");
		try {
			await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
			setWorkspace((prev) => ({
				...prev,
				members: prev.members.filter((member) => (member.user?._id || member.user) !== userId),
			}));
			setMemberMessage("Member removed.");
		} catch (err) {
			setMemberError(err.response?.data?.message || "Failed to remove member");
		}
	};

	const handleDeleteWorkspace = async () => {
		if (deleteConfirm !== workspace?.name) {
			setDeleteError("Type the workspace name exactly to confirm deletion.");
			return;
		}

		setDeletingWorkspace(true);
		setDeleteError("");
		try {
			await api.delete(`/workspaces/${workspaceId}`);
			navigate("/app/workspaces");
		} catch (err) {
			setDeleteError(err.response?.data?.message || "Failed to delete workspace");
		} finally {
			setDeletingWorkspace(false);
		}
	};

	const stackMembersLayout = useMediaQuery("(max-width: 1024px)");

	if (status === "loading") {
		return (
			<div
				className="fade-in"
				style={{ display: "flex", flexDirection: "column", gap: 20 }}
			>
				<div>
					<div
						className="skeleton"
						style={{ height: 26, width: 240, maxWidth: "70%", marginBottom: 10 }}
					/>
					<div
						className="skeleton"
						style={{ height: 14, width: 160 }}
					/>
				</div>
				<div
					className="skeleton"
					style={{ height: 38, width: 420, maxWidth: "100%", borderRadius: "var(--r-md)" }}
				/>
				<div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
					<div
						className="skeleton"
						style={{ height: 260, borderRadius: "var(--r-lg)" }}
					/>
					<div
						className="skeleton"
						style={{ height: 200, borderRadius: "var(--r-lg)" }}
					/>
				</div>
			</div>
		);
	}

	if (status === "error") return <div className="message-error">{error}</div>;

	const members = workspace?.members || [];
	const deleteMatches = Boolean(workspace?.name) && deleteConfirm === workspace?.name;
	const tabItems = TABS.map((tab) => ({
		value: tab,
		label: TAB_META[tab].label,
		icon: TAB_META[tab].icon,
		count: tab === "members" ? members.length : undefined,
	}));
	const previewName = generalForm.name || workspace?.name || "";
	const workspaceColor = workspace?.color || "#3b82f6";

	return (
		<motion.section
			variants={staggerContainer(0.08)}
			initial="hidden"
			animate="show"
			style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}
		>
			<motion.div
				variants={fadeUp}
				style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}
			>
				<div style={{ minWidth: 0 }}>
					<h1 className="page-title">Workspace Settings</h1>
					<p
						className="page-subtitle"
						style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
					>
						<span style={{ width: 8, height: 8, borderRadius: "50%", background: workspaceColor, boxShadow: `0 0 10px ${workspaceColor}88`, flexShrink: 0 }} />
						<span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{workspace?.name}</span>
						{workspace?.currentUserRole && <RoleBadge role={workspace.currentUserRole} />}
					</p>
				</div>
				<Link
					to={`/app/workspaces/${workspaceId}`}
					className="btn btn-ghost btn-sm"
				>
					<Icon
						name="arrowLeft"
						size={14}
					/>{" "}
					Back to workspace
				</Link>
			</motion.div>

			<motion.div variants={fadeUp}>
				<SegmentedTabs
					id="workspace-settings-tabs"
					items={tabItems}
					value={activeTab}
					onChange={setActiveTab}
				/>
			</motion.div>

			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					role="tabpanel"
					variants={staggerContainer(0.06, 0.05)}
					initial="hidden"
					animate="show"
					exit={panelExit}
					style={{ minWidth: 0 }}
				>
					{activeTab === "general" && (
						<motion.div variants={fadeUp}>
							<SettingsCard
								title="General"
								subtitle="Rename this workspace and keep its purpose visible to members."
								icon="settings"
							>
								<form
									onSubmit={handleGeneralSave}
									style={{ display: "grid", gap: 18 }}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 14,
											padding: 14,
											borderRadius: "var(--r-md)",
											background: `radial-gradient(120% 160% at 0% 0%, ${workspaceColor}1f, transparent 60%), var(--bg-surface-2)`,
											border: "1px solid var(--border-subtle)",
											minWidth: 0,
										}}
									>
										<div
											style={{
												width: 44,
												height: 44,
												borderRadius: "var(--r-md)",
												background: `${workspaceColor}22`,
												border: `2px solid ${workspaceColor}44`,
												boxShadow: `0 0 24px ${workspaceColor}33`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: 15,
												fontWeight: 700,
												color: workspaceColor,
												flexShrink: 0,
											}}
										>
											{getInitials(previewName) || "WS"}
										</div>
										<div style={{ minWidth: 0, flex: 1 }}>
											<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", ...ellipsis }}>{previewName || "Workspace name"}</p>
											<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)", ...ellipsis }}>{generalForm.description || "No description yet"}</p>
										</div>
									</div>
									<div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
										<label style={labelStyle}>
											Workspace name
											<input
												value={generalForm.name}
												onChange={(event) => setGeneralForm((prev) => ({ ...prev, name: event.target.value }))}
												required
												className="input"
											/>
										</label>
										<label style={labelStyle}>
											Description
											<input
												value={generalForm.description}
												onChange={(event) => setGeneralForm((prev) => ({ ...prev, description: event.target.value }))}
												className="input"
												placeholder="What is this workspace for?"
											/>
										</label>
									</div>
									{workspace?.slug && (
										<p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
											Slug
											<span
												className="kbd"
												style={{ display: "inline-block", fontFamily: "var(--font-mono, monospace)", maxWidth: "100%", ...ellipsis }}
											>
												{workspace?.slug}
											</span>
										</p>
									)}
									<div style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
										<button
											type="submit"
											disabled={savingGeneral}
											className="btn btn-primary btn-sm"
										>
											<LoadingLabel
												loading={savingGeneral}
												idle="Save changes"
												busy="Saving..."
											/>
										</button>
										<Notice
											message={generalMessage}
											style={{ marginTop: 12 }}
										/>
										<Notice
											tone="error"
											message={generalError}
											style={{ marginTop: 12 }}
										/>
									</div>
								</form>
							</SettingsCard>
						</motion.div>
					)}

					{activeTab === "members" && (
						<div
							style={{
								display: "grid",
								gap: 18,
								alignItems: "start",
								gridTemplateColumns: canManageInvites && !stackMembersLayout ? "minmax(0, 1.15fr) minmax(280px, 0.85fr)" : "minmax(0, 1fr)",
							}}
						>
							<div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
								<motion.div variants={fadeUp}>
									{canManageInvites ? (
										<SettingsCard
											title="Invite Members"
											subtitle="Search an existing account or send an email invite."
											icon="send"
										>
											<div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
												<div style={{ position: "relative", minWidth: "min(100%, 220px)", flex: "1 1 220px" }}>
													<Icon
														name="search"
														size={15}
														style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
													/>
													<input
														value={query}
														onChange={(event) => setQuery(event.target.value)}
														placeholder="Search by name or email"
														className="input"
														style={{ paddingLeft: 36 }}
													/>
													<AnimatePresence>
														{(query.trim() || isSearching) && (
															<motion.div
																data-motion
																className="dropdown"
																variants={popover}
																initial="initial"
																animate="animate"
																exit="exit"
																style={{ left: 0, right: 0, top: "calc(100% + 8px)", minWidth: "100%" }}
															>
																{isSearching && (
																	<p style={{ padding: "10px 12px", margin: 0, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
																		<span
																			className="spinner"
																			style={{ width: 12, height: 12 }}
																		/>
																		Searching...
																	</p>
																)}
																{!isSearching &&
																	results.map((result) => (
																		<button
																			key={result._id}
																			type="button"
																			onMouseDown={() => handleInvite(result.email)}
																			className="dropdown-item"
																			style={{ width: "100%", justifyContent: "space-between", textAlign: "left", gap: 10 }}
																		>
																			<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
																				<span
																					className="avatar avatar-sm"
																					style={{ background: getColor(result.name || ""), color: "#fff" }}
																				>
																					{getInitials(result.name || "?")}
																				</span>
																				<span style={{ minWidth: 0 }}>
																					<strong style={{ display: "block", color: "var(--text-primary)", ...ellipsis }}>{result.name}</strong>
																					<span style={{ display: "block", fontSize: 12, ...ellipsis }}>{result.email}</span>
																				</span>
																			</span>
																			<span style={{ color: "var(--accent-light)", fontWeight: 600, flexShrink: 0 }}>Invite</span>
																		</button>
																	))}
																{!isSearching && !results.length && emailFallbackVisible && (
																	<button
																		type="button"
																		onMouseDown={() => handleInvite(query.trim())}
																		className="dropdown-item"
																		style={{ width: "100%", justifyContent: "space-between", textAlign: "left", gap: 10 }}
																	>
																		<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
																			<span
																				className="icon-box icon-box-accent"
																				style={{ width: 32, height: 32, borderRadius: "50%" }}
																			>
																				<Icon
																					name="mail"
																					size={14}
																				/>
																			</span>
																			<span style={{ minWidth: 0 }}>
																				<strong style={{ display: "block", color: "var(--text-primary)", ...ellipsis }}>{query.trim()}</strong>
																				<span style={{ fontSize: 12 }}>Send invite link</span>
																			</span>
																		</span>
																		<span style={{ color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>Email invite</span>
																	</button>
																)}
																{!isSearching && !results.length && !emailFallbackVisible && (
																	<p style={{ padding: "10px 12px", margin: 0, fontSize: 12, color: "var(--text-muted)" }}>No matching users.</p>
																)}
															</motion.div>
														)}
													</AnimatePresence>
												</div>
												<select
													value={inviteRole}
													onChange={(event) => setInviteRole(event.target.value)}
													className="input"
													aria-label="Invite role"
													style={{ width: 130, flex: "1 0 110px", maxWidth: 160, textTransform: "capitalize" }}
												>
													{roleOptions.map((role) => (
														<option
															key={role}
															value={role}
														>
															{role}
														</option>
													))}
												</select>
												<button
													type="button"
													onClick={() => handleInvite(query.trim())}
													disabled={submittingInvite || !isEmail(query.trim())}
													className="btn btn-primary"
													style={{ flex: "1 0 auto" }}
												>
													<LoadingLabel
														loading={submittingInvite}
														idle={
															<>
																<Icon
																	name="send"
																	size={14}
																/>
																Send invite
															</>
														}
														busy="Sending..."
													/>
												</button>
											</div>
											<Notice
												message={inviteStatus}
												style={{ marginTop: 12 }}
											/>
											<Notice
												tone="error"
												message={inviteError}
												style={{ marginTop: 12 }}
											/>
										</SettingsCard>
									) : (
										<SettingsCard
											title="Invite Members"
											subtitle="Only admins and owners can invite new members."
											icon="lock"
										>
											<p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Ask a workspace admin to send invitations.</p>
										</SettingsCard>
									)}
								</motion.div>

								<motion.div variants={fadeUp}>
									<SettingsCard
										title="Members"
										subtitle="Change roles or remove people from this workspace."
										icon="users"
										action={<CountBadge count={members.length} />}
									>
										<Notice
											message={memberMessage}
											style={{ marginBottom: 12 }}
										/>
										<Notice
											tone="error"
											message={memberError}
											style={{ marginBottom: 12 }}
										/>
										<motion.div
											variants={staggerContainer(0.04, 0.1)}
											initial="hidden"
											animate="show"
											style={{ position: "relative", display: "flex", flexDirection: "column", margin: "0 -12px" }}
										>
											<AnimatePresence mode="popLayout">
												{members.map((member, index) => {
													const memberUserId = member.user?._id || member.user;
													const isOwner = member.role === "owner";
													return (
														<motion.div
															key={memberUserId}
															layout
															variants={fadeUp}
															exit={rowExit}
															className="row-hover"
															style={{
																position: "relative",
																display: "flex",
																flexWrap: "wrap",
																alignItems: "center",
																justifyContent: "space-between",
																gap: "10px 12px",
																padding: "10px 12px",
																borderRadius: "var(--r-md)",
															}}
														>
															{index > 0 && (
																<span
																	aria-hidden
																	style={{ position: "absolute", top: 0, left: 12, right: 12, height: 1, background: "var(--border-subtle)" }}
																/>
															)}
															{/* Brief accent wash confirms a role change landed */}
															<AnimatePresence initial={false}>
																<motion.span
																	key={member.role}
																	aria-hidden
																	initial={{ opacity: 1 }}
																	animate={{ opacity: 0 }}
																	exit={{ opacity: 0 }}
																	transition={{ duration: 1.1, ease: EASE_OUT }}
																	style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "var(--accent-muted)", boxShadow: "inset 0 0 0 1px var(--accent-border)", pointerEvents: "none" }}
																/>
															</AnimatePresence>
															<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px", minWidth: 0 }}>
																<MemberAvatar user={member.user} />
																<div style={{ minWidth: 0 }}>
																	<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", ...ellipsis }}>{member.user?.name || "Unknown user"}</p>
																	<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)", ...ellipsis }}>{member.user?.email || ""}</p>
																</div>
															</div>
															<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
																{isOwner ? (
																	<RoleBadge role="owner" />
																) : (
																	<select
																		value={member.role}
																		onChange={(event) => handleRoleChange(memberUserId, event.target.value)}
																		className="input"
																		aria-label={`Role for ${member.user?.name || "member"}`}
																		style={{ width: 110, minHeight: 30, padding: "4px 10px", fontSize: 12, textTransform: "capitalize" }}
																	>
																		{roleOptions.map((role) => (
																			<option
																				key={role}
																				value={role}
																			>
																				{role}
																			</option>
																		))}
																	</select>
																)}
																{!isOwner && (
																	<button
																		type="button"
																		onClick={() => handleRemoveMember(memberUserId)}
																		className="btn btn-danger btn-sm"
																	>
																		Remove
																	</button>
																)}
															</div>
														</motion.div>
													);
												})}
											</AnimatePresence>
										</motion.div>
									</SettingsCard>
								</motion.div>
							</div>

							{canManageInvites && (
								<motion.div
									variants={fadeUp}
									style={{ minWidth: 0 }}
								>
									<SettingsCard
										title="Pending Invitations"
										subtitle="Invites waiting to be accepted."
										icon="mail"
										action={<CountBadge count={pendingInvites.length} />}
									>
										{pendingInvites.length ? (
											<motion.div
												variants={staggerContainer(0.05, 0.15)}
												initial="hidden"
												animate="show"
												style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}
											>
												<AnimatePresence mode="popLayout">
													{pendingInvites.map((invite) => (
														<motion.div
															key={invite._id}
															layout
															variants={fadeUp}
															exit={rowExit}
															className="row-hover"
															style={{
																border: "1px solid var(--border-subtle)",
																borderRadius: "var(--r-md)",
																padding: 12,
															}}
														>
															<div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
																<span
																	className="icon-box"
																	style={{ width: 32, height: 32, borderRadius: "50%" }}
																>
																	<Icon
																		name="mail"
																		size={14}
																	/>
																</span>
																<div style={{ minWidth: 0, flex: 1 }}>
																	<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
																		<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", ...ellipsis }}>{invite.email}</p>
																		<RoleBadge role={invite.role} />
																	</div>
																	{invite.expiresAt && (
																		<p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
																			<Icon
																				name="clock"
																				size={12}
																			/>
																			Expires {formatExpiry(invite.expiresAt)}
																		</p>
																	)}
																	{invite.invitedBy?.name && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Sent by {invite.invitedBy.name}</p>}
																</div>
															</div>
															<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
																{invite.inviteUrl && (
																	<button
																		type="button"
																		onClick={() => copyInviteLink(invite.inviteUrl)}
																		className="btn btn-ghost btn-sm"
																	>
																		Copy link
																	</button>
																)}
																<button
																	type="button"
																	onClick={() => handleRevoke(invite._id)}
																	className="btn btn-danger btn-sm"
																>
																	Revoke
																</button>
															</div>
														</motion.div>
													))}
												</AnimatePresence>
											</motion.div>
										) : (
											<motion.div
												initial={{ opacity: 0, y: 6 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.35, ease: EASE_OUT }}
												style={{ textAlign: "center", padding: "20px 8px 8px" }}
											>
												<div
													className="icon-box icon-box-accent empty-float"
													style={{ width: 44, height: 44, margin: "0 auto 12px", borderRadius: 12 }}
												>
													<Icon
														name="mail"
														size={18}
													/>
												</div>
												<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>No pending invites.</p>
											</motion.div>
										)}
									</SettingsCard>
								</motion.div>
							)}
						</div>
					)}

					{activeTab === "channels" && (
						<motion.div variants={fadeUp}>
							<SettingsCard
								title="Channels"
								subtitle="Channels let your team organize conversations by topic."
								icon="hash"
							>
								<motion.div
									variants={staggerContainer(0.05, 0.1)}
									initial="hidden"
									animate="show"
									style={{ display: "flex", flexDirection: "column", gap: 8 }}
								>
									{/* Default channel */}
									{[
										{ name: "general", desc: "All workspace members — company-wide announcements and work-based matters", locked: true },
										{ name: "random", desc: "Non-work banter and everything in between", locked: false },
									].map((ch) => (
										<motion.div
											key={ch.name}
											variants={fadeUp}
											className="row-hover"
											style={{
												display: "flex",
												flexWrap: "wrap",
												alignItems: "center",
												justifyContent: "space-between",
												gap: "8px 16px",
												padding: "12px 14px",
												borderRadius: "var(--r-md)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 220px", minWidth: 0 }}>
												<span
													className="icon-box"
													style={{ width: 32, height: 32 }}
												>
													<Icon
														name="hash"
														size={15}
													/>
												</span>
												<div style={{ minWidth: 0 }}>
													<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{ch.name}</p>
													<p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)" }}>{ch.desc}</p>
												</div>
											</div>
											<div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
												{ch.locked && <span className="badge badge-muted">Default</span>}
												<span
													className="badge badge-success"
													style={{ gap: 4 }}
												>
													<Icon
														name="check"
														size={11}
													/>
													Joined
												</span>
											</div>
										</motion.div>
									))}

									{canManageInvites && (
										<motion.div
											variants={fadeUp}
											style={{
												marginTop: 8,
												padding: "14px 16px",
												background: "var(--accent-muted)",
												border: "1px dashed var(--accent-border)",
												borderRadius: "var(--r-md)",
												display: "flex",
												flexWrap: "wrap",
												alignItems: "center",
												justifyContent: "space-between",
												gap: 12,
											}}
										>
											<div style={{ minWidth: 0 }}>
												<p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--accent-light)" }}>Create a new channel</p>
												<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Custom channels for projects, teams, or topics</p>
											</div>
											<button
												type="button"
												className="btn btn-primary btn-sm"
												disabled
												title="Coming soon"
											>
												<Icon
													name="plus"
													size={13}
												/>{" "}
												New channel
											</button>
										</motion.div>
									)}
								</motion.div>
							</SettingsCard>
						</motion.div>
					)}

					{activeTab === "danger" && (
						<motion.div variants={fadeUp}>
							<SettingsCard
								title="Danger Zone"
								subtitle="Irreversible actions. Proceed with care."
								icon="alert"
								danger
							>
								<div
									style={{
										padding: 16,
										borderRadius: "var(--r-md)",
										background: "var(--bg-surface-1)",
										border: "1px solid rgba(255,107,107,0.25)",
									}}
								>
									<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Delete this workspace</p>
									<p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
										Deleting this workspace removes boards, tasks, chat messages, whiteboard snapshots, and activity history.
									</p>
									<label
										style={{
											display: "flex",
											maxWidth: 420,
											flexDirection: "column",
											gap: 8,
											marginTop: 16,
											fontSize: 13,
											fontWeight: 500,
											color: "var(--text-secondary)",
										}}
									>
										<span>
											Type{" "}
											<span
												className="kbd"
												style={{ fontSize: 12, color: "var(--danger)" }}
											>
												{workspace?.name}
											</span>{" "}
											to confirm
										</span>
										<span style={{ position: "relative", display: "block" }}>
											<input
												value={deleteConfirm}
												onChange={(event) => setDeleteConfirm(event.target.value)}
												className="input"
												autoComplete="off"
												style={{ paddingRight: 36, borderColor: deleteMatches ? "rgba(255,107,107,0.6)" : undefined }}
											/>
											<AnimatePresence>
												{deleteMatches && (
													<motion.span
														initial={{ opacity: 0, scale: 0.6 }}
														animate={{ opacity: 1, scale: 1 }}
														exit={{ opacity: 0, scale: 0.6 }}
														transition={{ duration: 0.2, ease: EASE_OUT }}
														style={{ position: "absolute", right: 12, top: "50%", marginTop: -7, color: "var(--danger)", display: "flex" }}
													>
														<Icon
															name="check"
															size={14}
														/>
													</motion.span>
												)}
											</AnimatePresence>
										</span>
									</label>
									<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 14 }}>
										<button
											type="button"
											onClick={handleDeleteWorkspace}
											disabled={deletingWorkspace}
											className="btn btn-danger"
										>
											<LoadingLabel
												loading={deletingWorkspace}
												idle={
													<>
														<Icon
															name="trash"
															size={14}
														/>
														Delete workspace
													</>
												}
												busy="Deleting..."
											/>
										</button>
									</div>
									<Notice
										tone="error"
										message={deleteError}
										style={{ marginTop: 12 }}
									/>
								</div>
							</SettingsCard>
						</motion.div>
					)}
				</motion.div>
			</AnimatePresence>
		</motion.section>
	);
}
