import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

function AuthCard({ children }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				background: "var(--bg-base)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				position: "relative",
				overflow: "hidden",
			}}
		>
			<div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none" }} />
			<div
				style={{
					position: "absolute",
					width: 500,
					height: 500,
					borderRadius: "50%",
					background: "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)",
					top: "30%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					pointerEvents: "none",
				}}
			/>
			<div
				className="fade-in"
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 440,
					background: "var(--bg-surface)",
					border: "1px solid var(--border)",
					borderRadius: "var(--radius-xl)",
					boxShadow: "var(--shadow-modal)",
					overflow: "hidden",
				}}
			>
				{/* Logo strip */}
				<div style={{ padding: "24px 28px 0", display: "flex", alignItems: "center", gap: 8 }}>
					<Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
						<img src="/logo.png" alt="CollabBoard Logo" style={{ width: 20, height: 20, objectFit: "contain" }} />
						<span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>CollabBoard</span>
					</Link>
				</div>
				<div style={{ padding: "0 28px 28px" }}>{children}</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const setAuth = useAuthStore((s) => s.setAuth);
	const [form, setForm] = useState({ email: "", password: "" });
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState("");
	const [fieldErrors, setFieldErrors] = useState({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleChange = (e) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
		setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
	};

	const validate = () => {
		const errs = {};
		if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
			errs.email = "Please enter a valid email";
		if (!form.password) errs.password = "Password is required";
		return errs;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const errs = validate();
		if (Object.keys(errs).length) { setFieldErrors(errs); return; }
		setError("");
		setIsSubmitting(true);
		try {
			const { data } = await api.post("/auth/login", form);
			setAuth(data.user, data.accessToken);
			navigate(searchParams.get("next") || "/app");
		} catch (err) {
			setError(err.response?.data?.message || "Incorrect email or password");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGoogleLogin = () => {
		window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
	};

	return (
		<AuthCard>
			<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: "20px 0 4px" }}>
				Welcome back
			</h1>
			<p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Sign in to continue</p>

			{error && (
				<div
					style={{
						background: "var(--danger-muted)",
						border: "1px solid rgba(248,113,113,0.3)",
						borderRadius: "var(--radius-md)",
						padding: "10px 14px",
						fontSize: 14,
						color: "var(--danger)",
						marginBottom: 16,
						display: "flex",
						alignItems: "center",
						gap: 8,
					}}
				>
					<Icon name="alert" size={16} /> {error}
				</div>
			)}

			<form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				<div>
					<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
						Email
					</label>
					<input
						name="email"
						type="email"
						value={form.email}
						onChange={handleChange}
						placeholder="you@example.com"
						autoComplete="email"
						disabled={isSubmitting}
						className={`input${fieldErrors.email ? " input-error" : ""}`}
					/>
					{fieldErrors.email && (
						<p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{fieldErrors.email}</p>
					)}
				</div>

				<div>
					<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
						<label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>Password</label>
						<button type="button" style={{ background: "none", border: "none", fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>
							Forgot?
						</button>
					</div>
					<div style={{ position: "relative" }}>
						<input
							name="password"
							type={showPw ? "text" : "password"}
							value={form.password}
							onChange={handleChange}
							placeholder="********"
							autoComplete="current-password"
							disabled={isSubmitting}
							className={`input${fieldErrors.password ? " input-error" : ""}`}
							style={{ paddingRight: 44 }}
						/>
						<button
							type="button"
							onClick={() => setShowPw((v) => !v)}
							style={{
								position: "absolute",
								right: 12,
								top: "50%",
								transform: "translateY(-50%)",
								background: "none",
								border: "none",
								color: "var(--text-muted)",
								cursor: "pointer",
								fontSize: 14,
								padding: 0,
							}}
						>
							<Icon name={showPw ? "eyeOff" : "eye"} size={16} />
						</button>
					</div>
					{fieldErrors.password && (
						<p style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>{fieldErrors.password}</p>
					)}
				</div>

				<button
					type="submit"
					disabled={isSubmitting}
					className="btn btn-primary"
					style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "10px 16px" }}
				>
					{isSubmitting ? <><span className="spinner" /> Logging in...</> : "Log in"}
				</button>
			</form>

			<div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
				<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
				<span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
				<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
			</div>

			<button
				type="button"
				onClick={handleGoogleLogin}
				className="btn btn-ghost"
				style={{ width: "100%", padding: "10px 16px", justifyContent: "center" }}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
					<path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
					<path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
					<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
				</svg>
				Continue with Google
			</button>

			<p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
				Don't have an account?{" "}
				<Link to="/register" style={{ color: "var(--accent)", fontWeight: 500 }}>
					Sign up
				</Link>
			</p>
		</AuthCard>
	);
}
