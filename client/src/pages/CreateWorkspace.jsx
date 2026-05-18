import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];

export default function CreateWorkspace() {
	const navigate = useNavigate();
	const [form, setForm] = useState({ name: "", description: "", color: WS_COLORS[0] });
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!form.name.trim()) return;
		setError("");
		setIsSubmitting(true);
		try {
			const { data } = await api.post("/workspaces", form);
			navigate(`/app/workspaces/${data._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create workspace");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fade-in" style={{ maxWidth: 520, margin: "0 auto" }}>
			<div style={{ marginBottom: 24 }}>
				<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Create workspace</h1>
				<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Set up a shared space for your team.</p>
			</div>

			<div className="card" style={{ padding: 28 }}>
				{error && (
					<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--danger)", marginBottom: 20 }}>
						<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="alert" size={16} /> {error}</span>
					</div>
				)}

				<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
							Workspace name <span style={{ color: "var(--danger)" }}>*</span>
						</label>
						<input
							name="name"
							value={form.name}
							onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
							required
							placeholder="e.g. My Team, Product Squad..."
							autoFocus
							className="input"
						/>
					</div>

					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
							Description <span style={{ color: "var(--text-muted)" }}>(optional)</span>
						</label>
						<textarea
							name="description"
							value={form.description}
							onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
							placeholder="What is this workspace for?"
							rows={3}
							className="input"
							style={{ resize: "vertical", fontFamily: "inherit" }}
						/>
					</div>

					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>
							Color theme
						</label>
						<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
							{WS_COLORS.map((c) => (
								<button
									key={c}
									type="button"
									onClick={() => setForm((p) => ({ ...p, color: c }))}
									style={{
										width: 32,
										height: 32,
										borderRadius: "50%",
										background: c,
										border: form.color === c ? "3px solid #fff" : "3px solid transparent",
										outline: form.color === c ? `2px solid ${c}` : "none",
										outlineOffset: 1,
										cursor: "pointer",
										padding: 0,
										transition: "outline 0.15s, transform 0.15s",
										transform: form.color === c ? "scale(1.15)" : "scale(1)",
									}}
								/>
							))}
						</div>
					</div>

					{/* Preview */}
					<div style={{ background: "var(--bg-surface-2)", borderRadius: "var(--radius-md)", padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
						<div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: form.color + "22", border: `2px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: form.color }}>
							{form.name.slice(0, 2).toUpperCase() || "WS"}
						</div>
						<div>
							<p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{form.name || "Workspace Name"}</p>
							<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{form.description || "Workspace description"}</p>
						</div>
					</div>

					<div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
						<button
							type="button"
							onClick={() => navigate("/app/workspaces")}
							className="btn btn-ghost btn-sm"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting || !form.name.trim()}
							className="btn btn-primary btn-sm"
						>
							{isSubmitting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Creating...</> : "Create workspace"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
