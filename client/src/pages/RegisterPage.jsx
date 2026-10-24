import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api/axios";
import AuthLayout, { AuthError, GoogleIcon } from "../components/AuthLayout.jsx";
import Icon from "../components/ui/Icon.jsx";
import { EASE_OUT, fadeUp, staggerContainer } from "../lib/motion";
import useAuthStore from "../store/authStore";

function getPasswordStrength(pw) {
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	return score;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "var(--danger)", "var(--warning)", "var(--blue)", "var(--success)"];

export default function RegisterPage() {
	const navigate = useNavigate();
	const setAuth = useAuthStore((s) => s.setAuth);
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState("");
	const [fieldErrors, setFieldErrors] = useState({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [failures, setFailures] = useState(0);

	const strength = getPasswordStrength(form.password);

	const handleChange = (e) => {
		setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
		setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
	};

	const validate = () => {
		const errs = {};
		if (!form.name.trim()) errs.name = "Please enter your name";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Please enter a valid email";
		if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
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
			const { data } = await api.post("/auth/register", { ...form, name: form.name.trim(), email: form.email.trim() });
			setAuth(data.user, data.accessToken);
			navigate("/app");
		} catch (err) {
			setError(err.response?.data?.message || "Could not create your account. Please try again.");
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
					<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 4px" }}>Create your account</h1>
					<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 24px" }}>Start collaborating in minutes</p>
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
							htmlFor="reg-name"
						>
							Full name
						</label>
						<input
							id="reg-name"
							name="name"
							value={form.name}
							onChange={handleChange}
							placeholder="Arjun Kumar"
							autoComplete="name"
							disabled={isSubmitting}
							className={`input auth-input${fieldErrors.name ? " input-error" : ""}`}
						/>
						{fieldErrors.name && <p className="auth-field-error">{fieldErrors.name}</p>}
					</motion.div>

					<motion.div variants={fadeUp}>
						<label
							className="auth-label"
							htmlFor="reg-email"
						>
							Email
						</label>
						<input
							id="reg-email"
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
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
							<label
								className="auth-label"
								htmlFor="reg-password"
							>
								Password
							</label>
							<span style={{ fontSize: 11, color: "var(--text-muted)" }}>8+ chars</span>
						</div>
						<div style={{ position: "relative" }}>
							<input
								id="reg-password"
								name="password"
								type={showPw ? "text" : "password"}
								value={form.password}
								onChange={handleChange}
								placeholder="••••••••"
								autoComplete="new-password"
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
						<AnimatePresence initial={false}>
							{form.password && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.2, ease: EASE_OUT }}
									style={{ overflow: "hidden" }}
								>
									<div style={{ display: "flex", gap: 4, marginTop: 10 }}>
										{[1, 2, 3, 4].map((level) => (
											<div
												key={level}
												className="pw-bar"
												style={{ flex: 1 }}
											>
												<div
													className="pw-fill"
													style={{ width: strength >= level ? "100%" : "0%", background: strengthColor[strength], transitionDelay: `${(level - 1) * 40}ms` }}
												/>
											</div>
										))}
									</div>
									<p style={{ fontSize: 11, color: strengthColor[strength], margin: "6px 0 0", minHeight: 16 }}>{strengthLabel[strength]}</p>
								</motion.div>
							)}
						</AnimatePresence>
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
									<span className="spinner" /> Creating account...
								</>
							) : (
								"Create account"
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
						Already have an account?{" "}
						<Link
							to="/login"
							style={{ fontWeight: 500 }}
						>
							Log in
						</Link>
					</p>
				</motion.div>
			</motion.div>
		</AuthLayout>
	);
}
