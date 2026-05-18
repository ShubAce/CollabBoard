import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

function InviteCard({ children }) {
	return (
		<div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, position: "relative", overflow: "hidden" }}>
			<div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none" }} />
			<div className="fade-in" style={{ position: "relative", width: "100%", maxWidth: 480, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-modal)", overflow: "hidden" }}>
				<div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
					<Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
						<span style={{ fontSize: 18 }}>⬡</span>
						<span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>CollabBoard</span>
					</Link>
				</div>
				<div style={{ padding: 28 }}>{children}</div>
			</div>
		</div>
	);
}

export default function InviteAcceptPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token");
	const accessToken = useAuthStore((s) => s.accessToken);
	const setAuth = useAuthStore((s) => s.setAuth);

	const [status, setStatus] = useState("loading");
	const [preview, setPreview] = useState(null);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ name: "", password: "" });
	const [submitting, setSubmitting] = useState(false);
	const [showPw, setShowPw] = useState(false);

	useEffect(() => {
		if (!token) { setStatus("invalid"); return; }
		let active = true;
		api
			.get(`/invite/preview?token=${encodeURIComponent(token)}`)
			.then(({ data }) => { if (active) { setPreview(data); setStatus("ready"); } })
			.catch((err) => { if (active) { setError(err.response?.data?.message || "This invitation is no longer valid."); setStatus("invalid"); } });
		return () => { active = false; };
	}, [token]);

	const loginHref = useMemo(() => `/login?next=${encodeURIComponent(`/invite/accept?token=${token || ""}`)}`, [token]);

	const handleAccept = async () => {
		if (!token) return;
		setSubmitting(true);
		setError("");
		try {
			const { data } = await api.post("/invite/accept", { token });
			navigate(`/app/workspaces/${data.workspace._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to accept invite");
		} finally { setSubmitting(false); }
	};

	const handleRegister = async (e) => {
		e.preventDefault();
		if (!token) return;
		setSubmitting(true);
		setError("");
		try {
			const { data } = await api.post("/invite/accept-register", { token, name: form.name, password: form.password });
			setAuth(data.user, data.accessToken);
			navigate(`/app/workspaces/${data.workspace._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create account");
		} finally { setSubmitting(false); }
	};

	if (status === "loading") {
		return (
			<InviteCard>
				<div style={{ textAlign: "center", padding: "20px 0" }}>
					<div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", borderWidth: 3 }} />
					<p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Checking your invitation...</p>
				</div>
			</InviteCard>
		);
	}

	if (status === "invalid") {
		return (
			<InviteCard>
				<div style={{ textAlign: "center" }}>
					<div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--danger-muted)", border: "2px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>⚠</div>
					<h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>Invitation unavailable</h1>
					<p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>{error || "This invite may have expired or already been used."}</p>
					<Link to="/login" className="btn btn-primary btn-sm">Go to login</Link>
				</div>
			</InviteCard>
		);
	}

	// Logged-in user: show accept button
	if (accessToken) {
		return (
			<InviteCard>
				<div style={{ textAlign: "center" }}>
					<div style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>✉</div>
					<h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>You've been invited!</h1>
					<p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>
						{preview?.inviterName && <><span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{preview.inviterName}</span> invited you to join</>}
					</p>
					<div style={{ background: "var(--bg-surface-2)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 20, display: "inline-block", minWidth: 200 }}>
						<p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{preview?.workspaceName || "a workspace"}</p>
						<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>as <span style={{ textTransform: "capitalize", color: "var(--text-secondary)" }}>{preview?.role || "member"}</span></p>
					</div>

					{error && (
						<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
							{error}
						</div>
					)}

					<div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
						<Link to="/app" className="btn btn-ghost btn-sm">Not now</Link>
						<button type="button" onClick={handleAccept} disabled={submitting} className="btn btn-primary btn-sm">
							{submitting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Joining...</> : "Accept & join →"}
						</button>
					</div>
				</div>
			</InviteCard>
		);
	}

	// Not logged in: show register form
	return (
		<InviteCard>
			<div style={{ textAlign: "center", marginBottom: 24 }}>
				<div style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>✉</div>
				<h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>Join {preview?.workspaceName || "a workspace"}</h1>
				<p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
					{preview?.inviterName ? <><span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{preview.inviterName}</span> invited you · create an account to continue</> : "Create an account to continue"}
				</p>
			</div>

			{error && (
				<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
					{error}
				</div>
			)}

			<form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				<div>
					<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Full name</label>
					<input
						value={form.name}
						onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
						placeholder="Arjun Kumar"
						required
						disabled={submitting}
						className="input"
						autoFocus
					/>
				</div>
				<div>
					<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Password (8+ chars)</label>
					<div style={{ position: "relative" }}>
						<input
							type={showPw ? "text" : "password"}
							value={form.password}
							onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
							placeholder="••••••••"
							required
							minLength={8}
							disabled={submitting}
							className="input"
							style={{ paddingRight: 44 }}
						/>
						<button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 0 }}>
							{showPw ? "🙈" : "👁"}
						</button>
					</div>
				</div>
				<button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%", padding: "10px 16px" }}>
					{submitting ? <><span className="spinner" /> Creating account...</> : "Create account & join →"}
				</button>
			</form>

			<p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-secondary)" }}>
				Already have an account?{" "}
				<Link to={loginHref} style={{ color: "var(--accent)", fontWeight: 500 }}>Log in →</Link>
			</p>
		</InviteCard>
	);
}
