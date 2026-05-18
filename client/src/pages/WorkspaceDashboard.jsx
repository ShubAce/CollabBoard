import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];
function getInitials(name = "") { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
function getColor(name = "") {
	let h = 0;
	for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
	return WS_COLORS[Math.abs(h) % WS_COLORS.length];
}

const ROLE_BADGE = {
	owner: { bg: "var(--warning-muted)", color: "var(--warning)" },
	admin: { bg: "var(--accent-muted)", color: "var(--accent)" },
	editor: { bg: "var(--bg-surface-2)", color: "var(--text-primary)" },
	viewer: { bg: "var(--bg-surface-2)", color: "var(--text-secondary)" },
};

function RoleBadge({ role }) {
	const style = ROLE_BADGE[role] || ROLE_BADGE.viewer;
	return (
		<span className="badge" style={{ background: style.bg, color: style.color, textTransform: "capitalize" }}>{role}</span>
	);
}

function SectionTitle({ children }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
			<span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{children}</span>
			<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
		</div>
	);
}

function CreateBoardModal({ workspaceId, onClose, onCreated }) {
	const [name, setName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name.trim()) return;
		setIsSubmitting(true);
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards`, { name: name.trim() });
			onCreated(data);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create board");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<div className="modal fade-in" style={{ maxWidth: 420 }}>
				<div className="modal-header">
					<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Create board</h2>
					<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
						{error && <div style={{ background: "var(--danger-muted)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, color: "var(--danger)" }}>{error}</div>}
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Board name</label>
							<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 4" required autoFocus className="input" />
						</div>
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>Starts with default columns</label>
							<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
								{[
									{ label: "To Do", color: "#8B8FA8" },
									{ label: "In Progress", color: "#60A5FA" },
									{ label: "Review", color: "#A78BFA" },
									{ label: "Done", color: "#34D399" },
								].map((c) => (
									<span key={c.label} className="badge" style={{ background: c.color + "22", color: c.color }}>{c.label}</span>
								))}
							</div>
						</div>
					</div>
					<div className="modal-footer">
						<button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
						<button type="submit" disabled={isSubmitting || !name.trim()} className="btn btn-primary btn-sm">
							{isSubmitting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Creating...</> : "Create board →"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function WorkspaceDashboard() {
	const { workspaceId } = useParams();
	const user = useAuthStore((s) => s.user);
	const [workspace, setWorkspace] = useState(null);
	const [boards, setBoards] = useState([]);
	const [activity, setActivity] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	useEffect(() => {
		if (!workspaceId) return;
		let active = true;
		setStatus("loading");
		Promise.all([
			api.get(`/workspaces/${workspaceId}`),
			api.get(`/workspaces/${workspaceId}/boards`),
			api.get(`/workspaces/${workspaceId}/activity?limit=5`),
		])
			.then(([wsRes, bRes, aRes]) => {
				if (active) {
					setWorkspace(wsRes.data);
					setBoards(bRes.data);
					setActivity(aRes.data.activity || []);
					setStatus("ready");
				}
			})
			.catch((err) => { if (active) { setError(err.response?.data?.message || "Failed to load"); setStatus("error"); } });
		return () => { active = false; };
	}, [workspaceId]);

	if (status === "loading") {
		return (
			<div className="fade-in">
				<div className="skeleton" style={{ height: 32, width: 200, marginBottom: 12 }} />
				<div className="skeleton" style={{ height: 16, width: 140, marginBottom: 32 }} />
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
					{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140 }} />)}
				</div>
			</div>
		);
	}

	if (error) return <div style={{ background: "var(--danger-muted)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--danger)" }}>{error}</div>;

	const members = workspace?.members || [];
	const onlineMembers = members.filter((m) => m.isOnline);

	return (
		<div className="fade-in">
			{/* Header */}
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
				<div>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
							{getInitials(workspace?.name || "")}
						</div>
						<div>
							<h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{workspace?.name}</h1>
							<p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
								{members.length} member{members.length !== 1 ? "s" : ""} · {boards.length} board{boards.length !== 1 ? "s" : ""} · <span style={{ textTransform: "capitalize" }}>You're {workspace?.currentUserRole === "owner" ? "an" : "a"} {workspace?.currentUserRole || "member"}</span>
							</p>
						</div>
					</div>
				</div>
				<button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ fontSize: 13 }}>
					+ New Board
				</button>
			</div>

			{/* Boards */}
			<SectionTitle>Boards</SectionTitle>

			{boards.length === 0 ? (
				<div style={{ textAlign: "center", padding: "40px 24px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", marginBottom: 32 }}>
					<div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
					<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No boards yet</p>
					<p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Create a board to start organizing tasks.</p>
					<button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">+ Create board</button>
				</div>
			) : (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
					{boards.map((board) => (
						<Link key={board._id} to={`/app/workspaces/${workspaceId}/boards/${board._id}`} style={{ textDecoration: "none" }}>
							<div
								className="card"
								style={{ padding: 18, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
								onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.4)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
							>
								<div style={{ fontSize: 22, marginBottom: 10 }}>📋</div>
								<p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.name}</p>
								{/* Mini column bars */}
								<div style={{ display: "flex", gap: 4, marginBottom: 10, height: 4 }}>
									{[
										{ color: "#8B8FA8" },
										{ color: "#60A5FA" },
										{ color: "#A78BFA" },
										{ color: "#34D399" },
									].map((c, i) => (
										<div key={i} style={{ flex: 1, height: 4, background: c.color, borderRadius: 2, opacity: 0.6 }} />
									))}
								</div>
								<p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Click to open →</p>
							</div>
						</Link>
					))}
				</div>
			)}

			{/* Recent Activity */}
			{activity.length > 0 && (
				<>
					<SectionTitle>Recent Activity</SectionTitle>
					<div className="card" style={{ padding: 0, marginBottom: 24, overflow: "hidden" }}>
						{activity.map((log, i) => (
							<div
								key={log._id}
								style={{
									display: "flex",
									alignItems: "flex-start",
									gap: 12,
									padding: "12px 16px",
									borderBottom: i < activity.length - 1 ? "1px solid var(--border)" : "none",
								}}
							>
								<div
									style={{ width: 28, height: 28, borderRadius: "50%", background: getColor(log.actor?.name || ""), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}
								>
									{getInitials(log.actor?.name || "?")}
								</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>
										<span style={{ fontWeight: 500 }}>{log.actor?.name || "Unknown"}</span>{" "}
										<span style={{ color: "var(--text-secondary)" }}>{log.action?.replace(/_/g, " ")}</span>
										{log.taskTitle && <span style={{ fontWeight: 500 }}> "{log.taskTitle}"</span>}
									</p>
								</div>
								<span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
									{new Date(log.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
								</span>
							</div>
						))}
					</div>
				</>
			)}

			{/* Members Online */}
			<SectionTitle>Members ({members.length})</SectionTitle>
			<div className="card" style={{ padding: 0, overflow: "hidden" }}>
				{members.map((member, i) => {
					const memberUser = member.user || {};
					return (
						<div
							key={memberUser._id || i}
							style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < members.length - 1 ? "1px solid var(--border)" : "none" }}
						>
							<div style={{ position: "relative" }}>
								<div style={{ width: 36, height: 36, borderRadius: "50%", background: getColor(memberUser.name || ""), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
									{getInitials(memberUser.name || "?")}
								</div>
								<div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: member.isOnline ? "var(--success)" : "var(--text-muted)", border: "2px solid var(--bg-surface)" }} />
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{memberUser.name || "Unknown"}</p>
								<p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{memberUser.email || ""}</p>
							</div>
							<RoleBadge role={member.role} />
						</div>
					);
				})}
			</div>

			<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
				<Link to={`/app/workspaces/${workspaceId}/settings`} style={{ fontSize: 13, color: "var(--accent)" }}>
					Manage members →
				</Link>
			</div>

			{showCreate && (
				<CreateBoardModal
					workspaceId={workspaceId}
					onClose={() => setShowCreate(false)}
					onCreated={(board) => { setBoards((prev) => [board, ...prev]); setShowCreate(false); }}
				/>
			)}
		</div>
	);
}
