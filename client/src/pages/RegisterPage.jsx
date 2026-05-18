import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";

function AuthCard({ children }) {
	return (
		<div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, position: "relative", overflow: "hidden" }}>
			<div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none" }} />
			<div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)", top: "30%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
			<div className="fade-in" style={{ position: "relative", width: "100%", maxWidth: 440, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-modal)", overflow: "hidden" }}>
				<div style={{ padding: "24px 28px 0", display: "flex", alignItems: "center", gap: 8 }}>
					<Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
						<Icon name="spark" size={20} style={{ color: "var(--accent)" }} />
						<span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>CollabBoard</span>
					</Link>
				</div>
				<div style={{ padding: "0 28px 28px" }}>{children}</div>
			</div>
		</div>
	);
}

function getPasswordStrength(pw) {
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	return score;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "var(--danger)", "var(--warning)", "#60A5FA", "var(--success)"];

export default function RegisterPage() {
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState("");
	const [successEmail, setSuccessEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);

	const strength = getPasswordStrength(form.password);

	const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setIsSubmitting(true);
		try {
			await api.post("/auth/register", form);
			setSuccessEmail(form.email);
		} catch (err) {
			setError(err.response?.data?.message || "Registration failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResend = async () => {
		if (resendCooldown > 0) return;
		try {
			await api.post("/auth/resend-verification", { email: successEmail });
			let t = 60;
			const iv = setInterval(() => {
				t--;
				setResendCooldown(t);
				if (t <= 0) clearInterval(iv);
			}, 1000);
			setResendCooldown(60);
		} catch {/* ignore */}
	};

	const handleGoogleLogin = () => {
		window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
	};

	if (successEmail) {
		return (
			<AuthCard>
				<div style={{ textAlign: "center", padding: "32px 0 8px" }}>
					<div className="icon-box icon-box-accent" style={{ width: 52, height: 52, margin: "0 auto 16px" }}><Icon name="mail" size={24} /></div>
					<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>Check your email</h1>
					<p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
						We sent a verification link to{" "}
						<span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{successEmail}</span>.
						<br />Click the link to activate your account.
					</p>
					<button
						type="button"
						onClick={handleResend}
						disabled={resendCooldown > 0}
						className="btn btn-ghost"
						style={{ fontSize: 13 }}
					>
						{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
					</button>
					<p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
						Wrong email?{" "}
						<button type="button" onClick={() => setSuccessEmail("")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13 }}>
							Go back
						</button>
					</p>
				</div>
			</AuthCard>
		);
	}

	return (
		<AuthCard>
			<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: "20px 0 4px" }}>Create your account</h1>
			<p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Start collaborating in minutes</p>

			{error && (
				<div style={{ background: "var(--danger-muted)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--danger)", marginBottom: 16 }}>
					<Icon name="alert" size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} /> {error}
				</div>
			)}

			<form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				<div>
					<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Full name</label>
					<input name="name" value={form.name} onChange={handleChange} placeholder="Arjun Kumar" required disabled={isSubmitting} className="input" />
				</div>

				<div>
					<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Email</label>
					<input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required disabled={isSubmitting} className="input" />
				</div>

				<div>
					<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
						<label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Password</label>
						<span style={{ fontSize: 11, color: "var(--text-muted)" }}>8+ chars</span>
					</div>
					<div style={{ position: "relative" }}>
						<input
							name="password"
							type={showPw ? "text" : "password"}
							value={form.password}
							onChange={handleChange}
							placeholder="********"
							required
							minLength={8}
							disabled={isSubmitting}
							className="input"
							style={{ paddingRight: 44 }}
						/>
						<button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 0 }}>
							<Icon name={showPw ? "eyeOff" : "eye"} size={16} />
						</button>
					</div>
					{form.password && (
						<div style={{ marginTop: 8 }}>
							<div className="pw-bar">
								<div className="pw-fill" style={{ width: `${(strength / 4) * 100}%`, background: strengthColor[strength] }} />
							</div>
							<p style={{ fontSize: 11, color: strengthColor[strength], marginTop: 4 }}>{strengthLabel[strength]}</p>
						</div>
					)}
				</div>

				<button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "10px 16px" }}>
					{isSubmitting ? <><span className="spinner" /> Creating...</> : "Create account"}
				</button>
			</form>

			<div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
				<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
				<span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
				<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
			</div>

			<button type="button" onClick={handleGoogleLogin} className="btn btn-ghost" style={{ width: "100%", padding: "10px 16px", justifyContent: "center" }}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
					<path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
					<path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
					<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
				</svg>
				Continue with Google
			</button>

			<p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
				Already have an account?{" "}
				<Link to="/login" style={{ color: "var(--accent)", fontWeight: 500 }}>Log in</Link>
			</p>
		</AuthCard>
	);
}
