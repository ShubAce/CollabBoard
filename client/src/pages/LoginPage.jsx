import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/axios";
import AuthLayout, { AuthError, GoogleIcon } from "../components/AuthLayout.jsx";
import Icon from "../components/ui/Icon.jsx";
import { fadeUp, staggerContainer } from "../lib/motion";
import useAuthStore from "../store/authStore";

const OAUTH_ERRORS = {
	oauth_failed: "Google sign-in didn't complete. Please try again.",
	oauth_missing_token: "Google sign-in didn't return a session. Please try again.",
};

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const setAuth = useAuthStore((s) => s.setAuth);
	const [form, setForm] = useState({ email: "", password: "" });
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState(() => OAUTH_ERRORS[searchParams.get("error")] || "");
	const [fieldErrors, setFieldErrors] = useState({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [failures, setFailures] = useState(0);

	const handleChange = (e) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
		setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
	};

	const validate = () => {
		const errs = {};
		if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Please enter a valid email";
		if (!form.password) errs.password = "Password is required";
		return errs;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const errs = validate();
		if (Object.keys(errs).length) {
			setFieldErrors(errs);
			setFailures((n) => n + 1);
			return;
		}
		setError("");
		setIsSubmitting(true);
		try {
			const { data } = await api.post("/auth/login", form);
			setAuth(data.user, data.accessToken);
			navigate(searchParams.get("next") || "/app");
		} catch (err) {
			setError(err.response?.data?.message || "Incorrect email or password");
			setFailures((n) => n + 1);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGoogleLogin = () => {
		window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
	};

	return (
		<AuthLayout shakeKey={failures}>
			<motion.div
				variants={staggerContainer(0.06, 0.15)}
				initial="hidden"
				animate="show"
			>
				<motion.div variants={fadeUp}>
					<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 4px" }}>Welcome back</h1>
					<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 24px" }}>Sign in to continue</p>
				</motion.div>

				<AuthError message={error} />

				<form
					onSubmit={handleSubmit}
					noValidate
					style={{ display: "flex", flexDirection: "column", gap: 16 }}
				>
					<motion.div variants={fadeUp}>
						<label
							className="auth-label"
							htmlFor="login-email"
						>
							Email
						</label>
						<input
							id="login-email"
							name="email"
							type="email"
							value={form.email}
							onChange={handleChange}
							placeholder="you@example.com"
							autoComplete="email"
							disabled={isSubmitting}
							className={`input auth-input${fieldErrors.email ? " input-error" : ""}`}
						/>
						{fieldErrors.email && <p className="auth-field-error">{fieldErrors.email}</p>}
					</motion.div>

					<motion.div variants={fadeUp}>
						<label
							className="auth-label"
							htmlFor="login-password"
						>
							Password
						</label>
						<div style={{ position: "relative" }}>
							<input
								id="login-password"
								name="password"
								type={showPw ? "text" : "password"}
								value={form.password}
								onChange={handleChange}
								placeholder="••••••••"
								autoComplete="current-password"
								disabled={isSubmitting}
								className={`input auth-input${fieldErrors.password ? " input-error" : ""}`}
								style={{ paddingRight: 44 }}
							/>
							<button
								type="button"
								onClick={() => setShowPw((v) => !v)}
								aria-label={showPw ? "Hide password" : "Show password"}
								style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}
							>
								<Icon
									name={showPw ? "eyeOff" : "eye"}
									size={16}
								/>
							</button>
						</div>
						{fieldErrors.password && <p className="auth-field-error">{fieldErrors.password}</p>}
					</motion.div>

					<motion.div variants={fadeUp}>
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-primary"
							style={{ width: "100%", minHeight: 42, marginTop: 4 }}
						>
							{isSubmitting ? (
								<>
									<span className="spinner" /> Logging in...
								</>
							) : (
								"Log in"
							)}
						</button>
					</motion.div>
				</form>

				<motion.div variants={fadeUp}>
					<div className="auth-divider">or</div>
					<button
						type="button"
						onClick={handleGoogleLogin}
						className="btn btn-ghost"
						style={{ width: "100%", minHeight: 42, color: "var(--text-primary)" }}
					>
						<GoogleIcon />
						Continue with Google
					</button>
					<p style={{ textAlign: "center", margin: "22px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
						Don&apos;t have an account?{" "}
						<Link
							to="/register"
							style={{ fontWeight: 500 }}
						>
							Sign up
						</Link>
					</p>
				</motion.div>
			</motion.div>
		</AuthLayout>
	);
}
