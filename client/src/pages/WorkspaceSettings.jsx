/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

const TABS = ["general", "members", "danger"];
const roleOptions = ["viewer", "editor", "admin"];

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const formatExpiry = (value) => {
	if (!value) return "";
	return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function SettingsCard({ title, subtitle, children, danger = false }) {
	return (
		<div className="page-panel" style={{ padding: 20, borderColor: danger ? "rgba(248,113,113,0.35)" : "var(--border)", background: danger ? "var(--danger-muted)" : "var(--bg-surface)" }}>
			<h3 style={{ fontSize: 16, fontWeight: 600, color: danger ? "var(--danger)" : "var(--text-primary)", margin: 0 }}>{title}</h3>
			{subtitle && <p style={{ fontSize: 13, color: danger ? "rgba(248,113,113,0.85)" : "var(--text-secondary)", margin: "4px 0 0" }}>{subtitle}</p>}
			<div style={{ marginTop: 16 }}>{children}</div>
		</div>
	);
}

function RoleBadge({ role }) {
	const style = {
		owner: { background: "var(--warning-muted)", color: "var(--warning)" },
		admin: { background: "var(--accent-muted)", color: "var(--accent)" },
		editor: { background: "var(--bg-surface-2)", color: "var(--text-primary)" },
		viewer: { background: "var(--bg-surface-2)", color: "var(--text-secondary)" },
	}[role] || { background: "var(--bg-surface-2)", color: "var(--text-secondary)" };
	return <span className="badge" style={{ ...style, textTransform: "capitalize" }}>{role}</span>;
}

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

	const loadData = async () => {
		setStatus("loading");
		setError("");
		try {
			const [workspaceRes, invitesRes] = await Promise.all([
				api.get(`/workspaces/${workspaceId}`),
				api.get(`/workspaces/${workspaceId}/invites`),
			]);
			setWorkspace(workspaceRes.data);
			setGeneralForm({ name: workspaceRes.data?.name || "", description: workspaceRes.data?.description || "" });
			setPendingInvites(invitesRes.data.invites || []);
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
		if (!workspaceId) return undefined;
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
	}, [query, workspaceId]);

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
		setSubmittingInvite(true);
		setInviteError("");
		setInviteStatus("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/invite`, { email, role: inviteRole });
			setInviteStatus(data.message || "Invite sent");
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
		try {
			await api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
			setPendingInvites((prev) => prev.filter((invite) => invite._id !== inviteId));
		} catch (err) {
			setInviteError(err.response?.data?.message || "Failed to revoke invite");
		}
	};

	const copyInviteLink = async (inviteUrl) => {
		if (!inviteUrl) return;
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

	if (status === "loading") {
		return (
			<div className="page-panel fade-in" style={{ padding: 24 }}>
				<div className="skeleton" style={{ height: 28, width: 240, marginBottom: 12 }} />
				<div className="skeleton" style={{ height: 14, width: 180, marginBottom: 28 }} />
				<div className="skeleton" style={{ height: 240 }} />
			</div>
		);
	}

	if (status === "error") return <div className="message-error">{error}</div>;

	return (
		<section className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
			<div className="page-panel" style={{ padding: 20 }}>
				<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
					<div>
						<h1 className="page-title">Workspace Settings</h1>
						<p className="page-subtitle">{workspace?.name}</p>
					</div>
					<Link to={`/app/workspaces/${workspaceId}`} className="btn btn-ghost btn-sm">
						<Icon name="arrowLeft" size={14} /> Back to workspace
					</Link>
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
					{TABS.map((tab) => (
						<button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`tab-button${activeTab === tab ? " active" : ""}`}>
							{tab === "general" && <Icon name="settings" size={14} />}
							{tab === "members" && <Icon name="users" size={14} />}
							{tab === "danger" && <Icon name="alert" size={14} />}
							{tab === "danger" ? "Danger Zone" : tab}
						</button>
					))}
				</div>
			</div>

			{activeTab === "general" && (
				<SettingsCard title="General" subtitle="Rename this workspace and keep its purpose visible to members.">
					<form onSubmit={handleGeneralSave} style={{ display: "grid", gap: 16 }}>
						<div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
							<label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
								Workspace name
								<input value={generalForm.name} onChange={(event) => setGeneralForm((prev) => ({ ...prev, name: event.target.value }))} required className="input" />
							</label>
							<label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
								Description
								<input value={generalForm.description} onChange={(event) => setGeneralForm((prev) => ({ ...prev, description: event.target.value }))} className="input" />
							</label>
						</div>
						<p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Slug: {workspace?.slug}</p>
						<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
							<button type="submit" disabled={savingGeneral} className="btn btn-primary btn-sm">{savingGeneral ? "Saving..." : "Save changes"}</button>
							{generalMessage && <span className="message-success">{generalMessage}</span>}
							{generalError && <span className="message-error">{generalError}</span>}
						</div>
					</form>
				</SettingsCard>
			)}

			{activeTab === "members" && (
				<div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
						<SettingsCard title="Invite Members" subtitle="Search an existing account or send an email invite.">
							<div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
								<div style={{ position: "relative", minWidth: 240, flex: 1 }}>
									<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" className="input" />
									{(query.trim() || isSearching) && (
										<div className="dropdown" style={{ left: 0, right: 0, top: "calc(100% + 8px)", minWidth: "100%" }}>
											{isSearching && <p style={{ padding: "10px 12px", margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Searching...</p>}
											{!isSearching && results.map((result) => (
												<button key={result._id} type="button" onMouseDown={() => handleInvite(result.email)} className="dropdown-item" style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}>
													<span><strong style={{ display: "block", color: "var(--text-primary)" }}>{result.name}</strong><span style={{ fontSize: 12 }}>{result.email}</span></span>
													<span style={{ color: "var(--accent)", fontWeight: 600 }}>Invite</span>
												</button>
											))}
											{!isSearching && !results.length && emailFallbackVisible && (
												<button type="button" onMouseDown={() => handleInvite(query.trim())} className="dropdown-item" style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}>
													<span><strong style={{ display: "block", color: "var(--text-primary)" }}>{query.trim()}</strong><span style={{ fontSize: 12 }}>Send invite link</span></span>
													<span style={{ color: "var(--success)", fontWeight: 600 }}>Email invite</span>
												</button>
											)}
											{!isSearching && !results.length && !emailFallbackVisible && <p style={{ padding: "10px 12px", margin: 0, fontSize: 12, color: "var(--text-muted)" }}>No matching users.</p>}
										</div>
									)}
								</div>
								<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="input" style={{ width: 130 }}>
									{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
								</select>
								<button type="button" onClick={() => handleInvite(query.trim())} disabled={submittingInvite || !isEmail(query.trim())} className="btn btn-primary">
									{submittingInvite ? "Sending..." : "Send invite"}
								</button>
							</div>
							{inviteStatus && <p className="message-success" style={{ marginTop: 12 }}>{inviteStatus}</p>}
							{inviteError && <p className="message-error" style={{ marginTop: 12 }}>{inviteError}</p>}
						</SettingsCard>

						<SettingsCard title="Members">
							{memberMessage && <p className="message-success">{memberMessage}</p>}
							{memberError && <p className="message-error">{memberError}</p>}
							<div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: memberMessage || memberError ? 12 : 0 }}>
								{workspace?.members?.map((member) => {
									const memberUserId = member.user?._id || member.user;
									const isOwner = member.role === "owner";
									return (
										<div key={memberUserId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12 }}>
											<div>
												<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{member.user?.name || "Unknown user"}</p>
												<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{member.user?.email || ""}</p>
											</div>
											<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
												{isOwner ? <RoleBadge role="owner" /> : (
													<select value={member.role} onChange={(event) => handleRoleChange(memberUserId, event.target.value)} className="input" style={{ width: 110, padding: "6px 10px", fontSize: 12 }}>
														{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
													</select>
												)}
												{!isOwner && <button type="button" onClick={() => handleRemoveMember(memberUserId)} className="btn btn-danger btn-sm">Remove</button>}
											</div>
										</div>
									);
								})}
							</div>
						</SettingsCard>
					</div>

					<SettingsCard title="Pending Invitations">
						{pendingInvites.length ? (
							<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
								{pendingInvites.map((invite) => (
									<div key={invite._id} style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12 }}>
										<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{invite.email}</p>
										<p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
											{invite.role} role{invite.expiresAt ? ` - Expires ${formatExpiry(invite.expiresAt)}` : ""}
										</p>
										{invite.invitedBy?.name && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Sent by {invite.invitedBy.name}</p>}
										<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
											<button type="button" onClick={() => handleRevoke(invite._id)} className="btn btn-danger btn-sm">Revoke</button>
											{invite.inviteUrl && <button type="button" onClick={() => copyInviteLink(invite.inviteUrl)} className="btn btn-ghost btn-sm">Copy link</button>}
										</div>
									</div>
								))}
							</div>
						) : (
							<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>No pending invites.</p>
						)}
					</SettingsCard>
				</div>
			)}

			{activeTab === "danger" && (
				<SettingsCard title="Danger Zone" subtitle="Deleting this workspace removes boards, tasks, chat messages, whiteboard snapshots, and activity history." danger>
					<label style={{ display: "flex", maxWidth: 420, flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>
						Type {workspace?.name} to confirm
						<input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="input" />
					</label>
					<button type="button" onClick={handleDeleteWorkspace} disabled={deletingWorkspace} className="btn btn-danger" style={{ marginTop: 14 }}>
						{deletingWorkspace ? "Deleting..." : "Delete workspace"}
					</button>
					{deleteError && <p className="message-error" style={{ marginTop: 12 }}>{deleteError}</p>}
				</SettingsCard>
			)}
		</section>
	);
}
