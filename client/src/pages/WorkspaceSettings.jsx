import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";

const TABS = ["general", "members", "danger"];

const roleOptions = ["viewer", "editor", "admin"];

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const formatExpiry = (value) => {
	if (!value) return "";
	const date = new Date(value);
	return date.toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};

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
			setGeneralForm({
				name: workspaceRes.data?.name || "",
				description: workspaceRes.data?.description || "",
			});
			setPendingInvites(invitesRes.data.invites || []);
			setStatus("ready");
		} catch (err) {
			setError(err.response?.data?.message || "Failed to load workspace settings");
			setStatus("error");
		}
	};

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

	useEffect(() => {
		if (workspaceId) {
			loadData();
		}
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

	const handleInvite = async (email) => {
		if (!email) return;
		setSubmittingInvite(true);
		setInviteError("");
		setInviteStatus("");
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/invite`, {
				email,
				role: inviteRole,
			});
			setInviteStatus(data.message || "Invite sent");
			setQuery("");
			setResults([]);
			if (data.invite) {
				setPendingInvites((prev) => [data.invite, ...prev]);
			}
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
				members: prev.members.filter((member) => {
					const memberUserId = member.user?._id || member.user;
					return memberUserId !== userId;
				}),
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
			<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
				<p className="text-sm text-jet-black-500">Loading workspace settings...</p>
			</section>
		);
	}

	if (status === "error") {
		return (
			<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
				<p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
			</section>
		);
	}

	return (
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-jet-black-900 font-display">Workspace Settings</h2>
					<p className="mt-1 text-sm text-jet-black-500">{workspace?.name}</p>
				</div>
				<Link
					to={`/app/workspaces/${workspaceId}`}
					className="inline-flex items-center justify-center rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
				>
					Back to workspace
				</Link>
			</div>

			<div className="mt-6 flex flex-wrap gap-2">
				{TABS.map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize transition ${
							activeTab === tab
								? "bg-space-indigo-500 text-white"
								: "border border-ghost-white-200 text-jet-black-700 hover:bg-ghost-white-100"
						}`}
					>
						{tab === "danger" ? "Danger Zone" : tab}
					</button>
				))}
			</div>

			{activeTab === "general" && (
				<form
					onSubmit={handleGeneralSave}
					className="mt-6 rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4"
				>
					<h3 className="text-lg font-semibold text-jet-black-900">General</h3>
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
							Workspace name
							<input
								value={generalForm.name}
								onChange={(event) => setGeneralForm((prev) => ({ ...prev, name: event.target.value }))}
								required
								className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
							/>
						</label>
						<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
							Description
							<input
								value={generalForm.description}
								onChange={(event) => setGeneralForm((prev) => ({ ...prev, description: event.target.value }))}
								className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
							/>
						</label>
					</div>
					<p className="mt-4 text-xs text-jet-black-500">Slug: {workspace?.slug}</p>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<button
							type="submit"
							disabled={savingGeneral}
							className="rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
						>
							{savingGeneral ? "Saving..." : "Save changes"}
						</button>
						{generalMessage && <span className="text-sm text-emerald-700">{generalMessage}</span>}
						{generalError && <span className="text-sm text-red-600">{generalError}</span>}
					</div>
				</form>
			)}

			{activeTab === "members" && (
				<div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
					<div className="space-y-6">
						<div className="rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4">
							<h3 className="text-lg font-semibold text-jet-black-900">Invite Members</h3>
							<p className="mt-1 text-sm text-jet-black-500">Search existing users or send an email invite.</p>
							<div className="mt-4 flex flex-wrap gap-3">
								<div className="relative min-w-[240px] flex-1">
									<input
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										placeholder="Search by name or email"
										className="w-full rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
									/>
									{(query.trim() || isSearching) && (
										<div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 rounded-xl border border-ghost-white-200 bg-white p-2 shadow-lg">
											{isSearching && <p className="px-2 py-2 text-xs text-jet-black-500">Searching...</p>}
											{!isSearching && results.map((result) => (
												<button
													key={result._id}
													type="button"
													onMouseDown={() => handleInvite(result.email)}
													className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-ghost-white-100"
												>
													<span>
														<span className="block text-sm font-semibold text-jet-black-900">{result.name}</span>
														<span className="block text-xs text-jet-black-500">{result.email}</span>
													</span>
													<span className="text-xs font-semibold text-space-indigo-600">Invite</span>
												</button>
											))}
											{!isSearching && !results.length && emailFallbackVisible && (
												<button
													type="button"
													onMouseDown={() => handleInvite(query.trim())}
													className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-ghost-white-100"
												>
													<span>
														<span className="block text-sm font-semibold text-jet-black-900">{query.trim()}</span>
														<span className="block text-xs text-jet-black-500">No account found. Send invite link.</span>
													</span>
													<span className="text-xs font-semibold text-emerald-600">Email invite</span>
												</button>
											)}
											{!isSearching && !results.length && !emailFallbackVisible && (
												<p className="px-2 py-2 text-xs text-jet-black-500">No matching users.</p>
											)}
										</div>
									)}
								</div>
								<select
									value={inviteRole}
									onChange={(event) => setInviteRole(event.target.value)}
									className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
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
									className="rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
								>
									{submittingInvite ? "Sending..." : "Send invite"}
								</button>
							</div>
							{inviteStatus && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{inviteStatus}</p>}
							{inviteError && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{inviteError}</p>}
						</div>

						<div className="rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4">
							<h3 className="text-lg font-semibold text-jet-black-900">Members</h3>
							{memberMessage && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{memberMessage}</p>}
							{memberError && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{memberError}</p>}
							<ul className="mt-3 space-y-3">
								{workspace?.members?.map((member) => {
									const memberUserId = member.user?._id || member.user;
									const isOwner = member.role === "owner";
									return (
										<li
											key={memberUserId}
											className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ghost-white-200 bg-white px-3 py-3"
										>
											<div>
												<p className="text-sm font-semibold text-jet-black-900">{member.user?.name || "Unknown user"}</p>
												<p className="text-xs text-jet-black-500">{member.user?.email || ""}</p>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												{isOwner ? (
													<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
														owner
													</span>
												) : (
													<select
														value={member.role}
														onChange={(event) => handleRoleChange(memberUserId, event.target.value)}
														className="rounded-lg border border-ghost-white-200 bg-white px-2 py-1.5 text-xs font-semibold text-jet-black-700 focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
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
														className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
													>
														Remove
													</button>
												)}
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					</div>

					<div className="rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4">
						<h3 className="text-lg font-semibold text-jet-black-900">Pending Invitations</h3>
						{pendingInvites.length ? (
							<ul className="mt-4 space-y-3">
								{pendingInvites.map((invite) => (
									<li
										key={invite._id}
										className="rounded-xl border border-ghost-white-200 bg-white px-3 py-3"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-sm font-semibold text-jet-black-900">{invite.email}</p>
												<p className="mt-1 text-xs text-jet-black-500">
													{invite.role} role
													{invite.expiresAt ? ` · Expires ${formatExpiry(invite.expiresAt)}` : ""}
												</p>
												{invite.invitedBy?.name && (
													<p className="mt-1 text-xs text-jet-black-500">Sent by {invite.invitedBy.name}</p>
												)}
											</div>
											<button
												type="button"
												onClick={() => handleRevoke(invite._id)}
												className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
											>
												Revoke
											</button>
											{invite.inviteUrl && (
												<button
													type="button"
													onClick={() => copyInviteLink(invite.inviteUrl)}
													className="rounded-lg border border-ghost-white-200 px-3 py-1.5 text-xs font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
												>
													Copy link
												</button>
											)}
										</div>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-4 text-sm text-jet-black-500">No pending invites.</p>
						)}
					</div>
				</div>
			)}

			{activeTab === "danger" && (
				<div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
					<h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
					<p className="mt-2 text-sm text-red-600">Deleting this workspace removes its boards, tasks, chat messages, whiteboard snapshots, and activity history.</p>
					<label className="mt-4 flex max-w-md flex-col gap-2 text-sm font-medium text-red-700">
						Type {workspace?.name} to confirm
						<input
							value={deleteConfirm}
							onChange={(event) => setDeleteConfirm(event.target.value)}
							className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-jet-black-900 focus:outline-none focus:ring-2 focus:ring-red-300"
						/>
					</label>
					<button
						type="button"
						onClick={handleDeleteWorkspace}
						disabled={deletingWorkspace}
						className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{deletingWorkspace ? "Deleting..." : "Delete workspace"}
					</button>
					{deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}
				</div>
			)}
		</section>
	);
}
