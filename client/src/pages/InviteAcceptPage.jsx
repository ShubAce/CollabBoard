/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api/axios";
import AuthLayout, { AuthError } from "../components/AuthLayout.jsx";
import Icon from "../components/ui/Icon.jsx";
import { EASE_OUT, fadeUp, staggerContainer } from "../lib/motion";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#3b82f6", "#60a5fa", "#3dd68c", "#ff6b6b", "#f0c040", "#2dd4bf", "#ff8c42", "#f472b6"];
const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "var(--danger)", "var(--warning)", "#60A5FA", "var(--success)"];

// Same state swap as RegisterPage: the card stays put while its content crossfades.
const swap = {
	initial: { opacity: 0, y: 12, filter: "blur(4px)" },
	animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: EASE_OUT } },
	exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2 } },
};

const HERO_PATHS = {
	mail: ["M4 4h16v16H4V4Z", "m4 7 8 6 8-6"],
	check: ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "M22 4 12 14l-3-3"],
	alert: ["M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z", "M12 9v4m0 4h.01"],
};

function getInitials(name = "") {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getColor(name = "") {
	let hash = 0;
	for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
	return WS_COLORS[Math.abs(hash) % WS_COLORS.length];
}

function getPasswordStrength(pw) {
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	return score;
}

/** Icon tile that springs in and draws its glyph (matches RegisterPage's success state). */
function HeroIcon({ name, danger = false }) {
	const [first, second] = HERO_PATHS[name];
	return (
		<motion.div
			initial={{ scale: 0.6, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.1 }}
			className="icon-box icon-box-accent"
			style={{
				width: 60,
				height: 60,
				margin: "0 auto 18px",
				borderRadius: 16,
				...(danger
					? { background: "var(--danger-muted)", borderColor: "rgba(255,107,107,0.35)", color: "var(--danger)", boxShadow: "0 0 40px rgba(255,107,107,0.3)" }
					: { boxShadow: "0 0 40px rgba(59, 130, 246,0.45)" }),
			}}
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
				aria-hidden
			>
				<motion.path
					d={first}
					initial={{ pathLength: 0 }}
					animate={{ pathLength: 1 }}
					transition={{ duration: 0.6, delay: 0.25 }}
				/>
				<motion.path
					d={second}
					initial={{ pathLength: 0 }}
					animate={{ pathLength: 1 }}
					transition={{ duration: 0.4, delay: 0.7 }}
				/>
			</svg>
		</motion.div>
	);
}

function InviteSummary({ name, role }) {
	const color = getColor(name || "");
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 14px",
				borderRadius: "var(--r-md)",
				background: `radial-gradient(120% 160% at 0% 0%, ${color}1f, transparent 60%), var(--bg-surface-2)`,
				border: "1px solid var(--border-default)",
				textAlign: "left",
				minWidth: 0,
			}}
		>
			<div
				style={{
					width: 40,
					height: 40,
					borderRadius: "var(--r-md)",
					background: `${color}22`,
					border: `2px solid ${color}44`,
					boxShadow: `0 0 20px ${color}33`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 14,
					fontWeight: 700,
					color,
					flexShrink: 0,
				}}
			>
				{getInitials(name || "") || "WS"}
			</div>
			<div style={{ minWidth: 0, flex: 1 }}>
				<p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "a workspace"}</p>
				<p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Workspace</p>
			</div>
			<span
				className="badge badge-accent"
				style={{ textTransform: "capitalize", flexShrink: 0 }}
			>
				{role}
			</span>
		</div>
	);
}

export default function InviteAcceptPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token");
	const accessToken = useAuthStore((s) => s.accessToken);
	const setAuth = useAuthStore((s) => s.setAuth);
	const invalidCta = accessToken ? { to: "/app", label: "Go to app" } : { to: "/login", label: "Go to login" };

	const [status, setStatus] = useState("loading");
	const [preview, setPreview] = useState(null);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ name: "", password: "" });
	const [submitting, setSubmitting] = useState(false);
	const [showPw, setShowPw] = useState(false);
	const previewWorkspaceName = preview?.workspaceName || preview?.workspace?.name;
	const previewWorkspaceId = preview?.workspace?._id || preview?.workspaceId;
	const previewInviterName = preview?.inviterName || preview?.invitedBy?.name;

	useEffect(() => {
		if (!token) {
			setStatus("invalid");
			return;
		}
		let active = true;
		api.get(`/invite/preview?token=${encodeURIComponent(token)}`)
			.then(({ data }) => {
				if (active) {
					setPreview(data);
					if (data?.status === "accepted" || data?.inviteStatus === "accepted") {
						setStatus("accepted");
						return;
					}
					setStatus("ready");
				}
			})
			.catch((err) => {
				if (active) {
					setError(err.response?.data?.message || "This invitation is no longer valid.");
					setStatus("invalid");
				}
			});
		return () => {
			active = false;
		};
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
		} finally {
			setSubmitting(false);
		}
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
		} finally {
			setSubmitting(false);
		}
	};

	const view = status === "loading" || status === "invalid" || status === "accepted" ? status : accessToken ? "accept" : "register";
	const strength = getPasswordStrength(form.password);
	const roleLabel = preview?.role || "member";

	return (
		<AuthLayout
			shakeKey={view === "accept" || view === "register" ? error : undefined}
			maxWidth={440}
		>
			<AnimatePresence
				mode="wait"
				initial={false}
			>
				<motion.div
					key={view}
					variants={swap}
					initial="initial"
					animate="animate"
					exit="exit"
				>
					{view === "loading" && (
						<div
							role="status"
							style={{ textAlign: "center", padding: "28px 0 20px" }}
						>
							<div
								className="spinner"
								style={{ width: 32, height: 32, margin: "0 auto 16px", borderWidth: 3 }}
							/>
							<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Checking your invitation...</p>
						</div>
					)}

					{view === "invalid" && (
						<div style={{ textAlign: "center", padding: "8px 0" }}>
							<HeroIcon
								name="alert"
								danger
							/>
							<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 8px" }}>Invitation unavailable</h1>
							<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 24px", lineHeight: 1.6 }}>
								{error || "This invite may have expired or already been used."}
							</p>
							<Link
								to={invalidCta.to}
								className="btn btn-primary"
								style={{ width: "100%", minHeight: 42 }}
							>
								{invalidCta.label}
							</Link>
						</div>
					)}

					{view === "accepted" && (
						<div style={{ textAlign: "center", padding: "8px 0" }}>
							<HeroIcon name="check" />
							<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 8px" }}>Invite already accepted</h1>
							<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 24px", lineHeight: 1.6 }}>
								You are already a member of <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{previewWorkspaceName || "this workspace"}</span>.
							</p>
							<Link
								to={previewWorkspaceId ? `/app/workspaces/${previewWorkspaceId}` : "/app"}
								className="btn btn-primary"
								style={{ width: "100%", minHeight: 42 }}
							>
								Open workspace
								<Icon
									name="arrowRight"
									size={15}
								/>
							</Link>
						</div>
					)}

					{/* Logged-in user: show accept button */}
					{view === "accept" && (
						<motion.div
							variants={staggerContainer(0.06, 0.15)}
							initial="hidden"
							animate="show"
							style={{ textAlign: "center" }}
						>
							<HeroIcon name="mail" />
							<motion.div variants={fadeUp}>
								<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 6px" }}>You&apos;ve been invited!</h1>
								<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px" }}>
									{previewInviterName ? (
										<>
											<span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{previewInviterName}</span> invited you to join
										</>
									) : (
										"You have been invited to join"
									)}
								</p>
							</motion.div>

							<motion.div
								variants={fadeUp}
								style={{ marginBottom: 20 }}
							>
								<InviteSummary
									name={previewWorkspaceName}
									role={roleLabel}
								/>
							</motion.div>

							<AuthError message={error} />

							<motion.div
								variants={fadeUp}
								style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10 }}
							>
								<Link
									to="/app"
									className="btn btn-ghost"
									style={{ minHeight: 42, color: "var(--text-primary)" }}
								>
									Not now
								</Link>
								<button
									type="button"
									onClick={handleAccept}
									disabled={submitting}
									className="btn btn-primary"
									style={{ minHeight: 42 }}
								>
									{submitting ? (
										<>
											<span className="spinner" /> Joining...
										</>
									) : (
										"Accept and join"
									)}
								</button>
							</motion.div>
						</motion.div>
					)}

					{/* Not logged in: show register form */}
					{view === "register" && (
						<motion.div
							variants={staggerContainer(0.06, 0.15)}
							initial="hidden"
							animate="show"
						>
							<motion.div variants={fadeUp}>
								<h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 4px" }}>Join {previewWorkspaceName || "a workspace"}</h1>
								<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px" }}>
									{previewInviterName ? (
										<>
											<span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{previewInviterName}</span> invited you. Create an account to continue
										</>
									) : (
										"Create an account to continue"
									)}
								</p>
							</motion.div>

							<motion.div
								variants={fadeUp}
								style={{ marginBottom: 20 }}
							>
								<InviteSummary
									name={previewWorkspaceName}
									role={roleLabel}
								/>
							</motion.div>

							<AuthError message={error} />

							<form
								onSubmit={handleRegister}
								style={{ display: "flex", flexDirection: "column", gap: 16 }}
							>
								<motion.div variants={fadeUp}>
									<label
										className="auth-label"
										htmlFor="invite-name"
									>
										Full name
									</label>
									<input
										id="invite-name"
										value={form.name}
										onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
										placeholder="Arjun Kumar"
										autoComplete="name"
										required
										disabled={submitting}
										className="input auth-input"
										autoFocus
									/>
								</motion.div>
								<motion.div variants={fadeUp}>
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
										<label
											className="auth-label"
											htmlFor="invite-password"
										>
											Password
										</label>
										<span style={{ fontSize: 11, color: "var(--text-muted)" }}>8+ chars</span>
									</div>
									<div style={{ position: "relative" }}>
										<input
											id="invite-password"
											type={showPw ? "text" : "password"}
											value={form.password}
											onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
											placeholder="••••••••"
											autoComplete="new-password"
											required
											minLength={8}
											disabled={submitting}
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
										disabled={submitting}
										className="btn btn-primary"
										style={{ width: "100%", minHeight: 42, marginTop: 4 }}
									>
										{submitting ? (
											<>
												<span className="spinner" /> Creating account...
											</>
										) : (
											"Create account and join"
										)}
									</button>
								</motion.div>
							</form>

							<motion.p
								variants={fadeUp}
								style={{ textAlign: "center", margin: "22px 0 0", fontSize: 14, color: "var(--text-secondary)" }}
							>
								Already have an account?{" "}
								<Link
									to={loginHref}
									style={{ fontWeight: 500 }}
								>
									Log in
								</Link>
							</motion.p>
						</motion.div>
					)}
				</motion.div>
			</AnimatePresence>
		</AuthLayout>
	);
}
