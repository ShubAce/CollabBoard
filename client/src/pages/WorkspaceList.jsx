import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];

function getInitials(name = "") {
	return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function WorkspaceAvatar({ name, color }) {
	return (
		<div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: color + "22", border: `2px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color, flexShrink: 0 }}>
			{getInitials(name)}
		</div>
	);
}

function SkeletonCard() {
	return (
		<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
			<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
				<div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)" }} />
				<div style={{ flex: 1 }}>
					<div className="skeleton" style={{ height: 16, width: "60%", marginBottom: 8 }} />
					<div className="skeleton" style={{ height: 12, width: "40%" }} />
				</div>
			</div>
			<div className="skeleton" style={{ height: 12, width: "80%" }} />
			<div className="skeleton" style={{ height: 32 }} />
		</div>
	);
}

function CreateWorkspaceModal({ onClose, onCreated }) {
	const [form, setForm] = useState({ name: "", description: "", color: WS_COLORS[0] });
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError("");
		try {
			const { data } = await api.post("/workspaces", form);
			onCreated(data);
			navigate(`/app/workspaces/${data._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create workspace");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<div className="modal fade-in">
				<div className="modal-header">
					<h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Create workspace</h2>
					<button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						{error && <div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, color: "var(--danger)" }}>{error}</div>}
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Workspace name</label>
							<input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="My Team" required className="input" />
						</div>
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Description <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
							<textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="What's this workspace for?" rows={3} className="input" style={{ resize: "vertical", fontFamily: "inherit" }} />
						</div>
						<div>
							<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Color</label>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
								{WS_COLORS.map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => setForm((p) => ({ ...p, color: c }))}
										style={{
											width: 28, height: 28,
											borderRadius: "50%",
											background: c,
											border: form.color === c ? "3px solid #fff" : "3px solid transparent",
											outline: form.color === c ? `2px solid ${c}` : "none",
											cursor: "pointer",
											padding: 0,
											transition: "outline 0.15s",
										}}
									/>
								))}
							</div>
						</div>
					</div>
					<div className="modal-footer">
						<button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
						<button type="submit" disabled={isSubmitting || !form.name.trim()} className="btn btn-primary btn-sm">
							{isSubmitting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Creating...</> : "Create →"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function WorkspaceList() {
	const user = useAuthStore((s) => s.user);
	const [workspaces, setWorkspaces] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	useEffect(() => {
		let active = true;
		setStatus("loading");
		api.get("/workspaces")
			.then(({ data }) => { if (active) { setWorkspaces(data); setStatus("ready"); } })
			.catch((err) => { if (active) { setError(err.response?.data?.message || "Failed to load workspaces"); setStatus("error"); } });
		return () => { active = false; };
	}, []);

	return (
		<div className="fade-in">
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
				<div>
					<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Your Workspaces</h1>
					<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
						{status === "ready" ? `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}` : ""}
					</p>
				</div>
				<button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary" style={{ fontSize: 13 }}>
					+ New Workspace
				</button>
			</div>

			{/* Loading */}
			{status === "loading" && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
					{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
				</div>
			)}

			{/* Error */}
			{error && (
				<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--danger)", fontSize: 14 }}>
					{error}
				</div>
			)}

			{/* Empty state */}
			{status === "ready" && workspaces.length === 0 && (
				<div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-secondary)" }}>
					<div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
					<h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No workspaces yet</h2>
					<p style={{ fontSize: 14, marginBottom: 24 }}>Create your first workspace to start collaborating with your team.</p>
					<button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary">Create workspace →</button>
				</div>
			)}

			{/* Grid */}
			{workspaces.length > 0 && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
					{workspaces.map((ws, i) => {
						const color = WS_COLORS[i % WS_COLORS.length];
						const isOwner = ws.isOwner;
						const memberCount = ws.members?.length || 0;
						return (
							<Link
								key={ws._id}
								to={`/app/workspaces/${ws._id}`}
								style={{ textDecoration: "none" }}
							>
								<div
									className="card"
									style={{ padding: 20, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
									onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)"; }}
									onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}
								>
									<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
										<WorkspaceAvatar name={ws.name} color={color} />
										<div style={{ minWidth: 0 }}>
											<p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.name}</p>
											<p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
												{memberCount} member{memberCount !== 1 ? "s" : ""}
											</p>
										</div>
									</div>

									{ws.description && (
										<p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
											{ws.description}
										</p>
									)}

									{/* Member avatars */}
									<div style={{ display: "flex", alignItems: "center", gap: -6, marginBottom: 12 }}>
										{(ws.members || []).slice(0, 3).map((m, mi) => {
											const bg = WS_COLORS[mi % WS_COLORS.length];
											return (
												<div
													key={m.user?._id || mi}
													style={{ width: 24, height: 24, borderRadius: "50%", background: bg, border: "2px solid var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", marginLeft: mi > 0 ? -6 : 0 }}
												>
													{getInitials(m.user?.name || "?")}
												</div>
											);
										})}
										{memberCount > 3 && (
											<div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-surface-2)", border: "2px solid var(--bg-surface)", marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "var(--text-secondary)" }}>
												+{memberCount - 3}
											</div>
										)}
									</div>

									<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
										<span className={`badge ${isOwner ? "badge-accent" : "badge-muted"}`}>
											{ws.currentUserRole || "member"}
										</span>
										<span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>Open →</span>
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}

			{showCreate && (
				<CreateWorkspaceModal
					onClose={() => setShowCreate(false)}
					onCreated={(ws) => { setWorkspaces((prev) => [ws, ...prev]); setShowCreate(false); }}
				/>
			)}
		</div>
	);
}
