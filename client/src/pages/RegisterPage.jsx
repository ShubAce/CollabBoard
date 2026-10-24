import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api/axios";
import AuthLayout, { AuthError, GoogleIcon } from "../components/AuthLayout.jsx";
import Icon from "../components/ui/Icon.jsx";
import { EASE_OUT, fadeUp, staggerContainer } from "../lib/motion";

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

const swap = {
	initial: { opacity: 0, y: 12, filter: "blur(4px)" },
	animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: EASE_OUT } },
	exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2 } },
};

export default function RegisterPage() {
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState("");
	const [successEmail, setSuccessEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [failures, setFailures] = useState(0);

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
			setFailures((n) => n + 1);
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
		} catch {
			/* ignore */
		}
	};

	const handleGoogleLogin = () => {
		window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
	};

	return (
		<AuthLayout shakeKey={failures}>
			<AnimatePresence
				mode="wait"
				initial={false}
			>
				{successEmail ? (
					<motion.div
						key="success"
						variants={swap}
						initial="initial"
						animate="animate"
						exit="exit"
						style={{ textAlign: "center", padding: "8px 0" }}
					>
						<motion.div
							initial={{ scale: 0.6, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.1 }}
							className="icon-box icon-box-accent"
							style={{ width: 60, height: 60, margin: "0 auto 18px", borderRadius: 16, boxShadow: "0 0 40px rgba(124,114,255,0.45)" }}
						>
							<svg
								width="26"
								height="26"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<motion.path
									d="M4 4h16v16H4V4Z"
									initial={{ pathLength: 0 }}
									animate={{ pathLength: 1 }}
									transition={{ duration: 0.6, delay: 0.25 }}
								/>
								<motion.path
									d="m4 7 8 6 8-6"
									initial={{ pathLength: 0 }}
									animate={{ pathLength: 1 }}
									transition={{ duration: 0.4, delay: 0.7 }}
								/>
							</svg>
						</motion.div>
						<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 8px" }}>Check your email</h1>
						<p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 22 }}>
							We sent a verification link to <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{successEmail}</span>.
							<br />
							Click the link to activate your account.
						</p>
						<button
							type="button"
							onClick={handleResend}
							disabled={resendCooldown > 0}
							className="btn btn-ghost"
							style={{ fontSize: 13, minWidth: 140, fontVariantNumeric: "tabular-nums" }}
						>
							{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
						</button>
						<p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, marginBottom: 0 }}>
							Wrong email?{" "}
							<button
								type="button"
								onClick={() => setSuccessEmail("")}
								style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13 }}
							>
								Go back
							</button>
						</p>
					</motion.div>
				) : (
					<motion.div
						key="form"
						variants={swap}
						initial="initial"
						animate="animate"
						exit="exit"
					>
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
										required
										disabled={isSubmitting}
										className="input auth-input"
									/>
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
										required
										disabled={isSubmitting}
										className="input auth-input"
									/>
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
											required
											minLength={8}
											disabled={isSubmitting}
											className="input auth-input"
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
												<span className="spinner" /> Creating...
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
					</motion.div>
				)}
			</AnimatePresence>
		</AuthLayout>
	);
}
