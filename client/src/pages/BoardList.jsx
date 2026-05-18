/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

function SkeletonCard() {
	return (
		<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
			<div className="skeleton" style={{ height: 22, width: "50%" }} />
			<div className="skeleton" style={{ height: 14, width: "30%" }} />
			<div className="skeleton" style={{ height: 36, marginTop: 8 }} />
		</div>
	);
}

export default function BoardList() {
	const { workspaceId } = useParams();
	const [boards, setBoards] = useState([]);
	const [workspaceName, setWorkspaceName] = useState("");
	const [newBoard, setNewBoard] = useState("");
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const loadBoards = async () => {
		setStatus("loading");
		setError("");
		try {
			const [wsRes, bRes] = await Promise.all([
				api.get(`/workspaces/${workspaceId}`),
				api.get(`/workspaces/${workspaceId}/boards`),
			]);
			setWorkspaceName(wsRes.data?.name || "");
			setBoards(bRes.data);
			setStatus("ready");
		} catch (err) {
			setError(err.response?.data?.message || "Failed to load boards");
			setStatus("error");
		}
	};

	useEffect(() => {
		if (workspaceId) loadBoards();
	}, [workspaceId]);

	const handleCreate = async (e) => {
		e.preventDefault();
		if (!newBoard.trim()) return;
		setIsSubmitting(true);
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards`, { name: newBoard.trim() });
			setNewBoard("");
			setBoards((prev) => [data, ...prev]);
			setShowForm(false);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create board");
		} finally {
			setIsSubmitting(false);
		}
	};

	const COLUMN_COLORS = ["#8B8FA8", "#60A5FA", "#A78BFA", "#34D399"];

	return (
		<div className="fade-in">
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
				<div>
					<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
						<Link to={`/app/workspaces/${workspaceId}`} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
							{workspaceName || "Workspace"}
						</Link>
						<span>/</span>
						<span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Boards</span>
					</div>
					<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
						{workspaceName ? `${workspaceName} - Boards` : "Boards"}
					</h1>
					<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
						{status === "ready" ? `${boards.length} board${boards.length !== 1 ? "s" : ""}` : ""}
					</p>
				</div>
				<button type="button" onClick={() => setShowForm((v) => !v)} className="btn btn-primary" style={{ fontSize: 13 }}>
					{showForm ? "Cancel" : "+ New Board"}
				</button>
			</div>

			{/* Inline create form */}
			{showForm && (
				<div className="card fade-in" style={{ padding: 20, marginBottom: 20 }}>
					<h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px" }}>Create new board</h3>
					<form onSubmit={handleCreate} style={{ display: "flex", gap: 10 }}>
						<input
							value={newBoard}
							onChange={(e) => setNewBoard(e.target.value)}
							placeholder="Sprint 4, Product Backlog..."
							required
							autoFocus
							className="input"
							style={{ flex: 1 }}
						/>
						<button type="submit" disabled={isSubmitting || !newBoard.trim()} className="btn btn-primary" style={{ fontSize: 13 }}>
							{isSubmitting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Creating...</> : "Create"}
						</button>
					</form>
					<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
						Starts with: To Do, In Progress, Review, Done
					</p>
				</div>
			)}

			{/* Error */}
			{error && (
				<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--danger)", fontSize: 14, marginBottom: 16 }}>
					{error}
				</div>
			)}

			{/* Loading */}
			{status === "loading" && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
					{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
				</div>
			)}

			{/* Empty */}
			{status === "ready" && boards.length === 0 && !showForm && (
				<div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-secondary)" }}>
					<div className="icon-box icon-box-accent empty-state-icon"><Icon name="board" size={24} /></div>
					<h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No boards yet</h2>
					<p style={{ fontSize: 14, marginBottom: 24 }}>Create your first board to start organizing tasks with Kanban.</p>
					<button type="button" onClick={() => setShowForm(true)} className="btn btn-primary">+ Create board</button>
				</div>
			)}

			{/* Grid */}
			{boards.length > 0 && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
					{boards.map((board) => (
						<Link key={board._id} to={`/app/workspaces/${workspaceId}/boards/${board._id}`} style={{ textDecoration: "none" }}>
							<div
								className="card"
								style={{ padding: 18, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", gap: 12 }}
								onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
							>
								<div className="icon-box icon-box-accent" style={{ width: 36, height: 36 }}><Icon name="board" size={18} /></div>
								<div>
									<p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.name}</p>
									<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{board.columns?.length || 4} columns</p>
								</div>

								{/* Column progress bars */}
								<div style={{ display: "flex", gap: 4, height: 4 }}>
									{COLUMN_COLORS.map((c, i) => (
										<div key={i} style={{ flex: 1, height: 4, background: c, borderRadius: 2, opacity: 0.6 }} />
									))}
								</div>

								<p style={{ fontSize: 12, color: "var(--accent)", margin: 0, fontWeight: 500 }}>Open board</p>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
