/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api/axios";
import { GoogleIcon } from "../components/AuthLayout.jsx";
import Icon from "../components/ui/Icon.jsx";
import SegmentedTabs from "../components/ui/SegmentedTabs.jsx";
import { EASE_IN, EASE_OUT, fadeUp, SPRING, staggerContainer } from "../lib/motion";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];
function getInitials(name = "") { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
function getColor(name = "") {
	let h = 0;
	for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
	return WS_COLORS[Math.abs(h) % WS_COLORS.length];
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

const TAB_ITEMS = [
	{ value: "profile", label: "Profile", icon: "user" },
	{ value: "preferences", label: "Preferences", icon: "settings" },
];
const THEME_OPTIONS = [
	{ value: "dark", label: "Dark", preview: "linear-gradient(135deg, #0f1117 0%, #1c1f2e 100%)", ink: "rgba(255,255,255,0.16)" },
	{ value: "light", label: "Light", preview: "linear-gradient(135deg, #ffffff 0%, #e6e8f2 100%)", ink: "rgba(15,17,23,0.14)" },
	{ value: "system", label: "System", preview: "linear-gradient(135deg, #0f1117 0 50%, #eef0f6 50% 100%)", ink: "rgba(124,114,255,0.35)" },
];

// Panel leaves quickly; its sections stagger back in with fadeUp.
const panelExit = { opacity: 0, y: -4, transition: { duration: 0.15, ease: EASE_IN } };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 };
const eyeButtonStyle = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" };
const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function SectionCard({ children, title, subtitle, icon }) {
	return (
		<motion.div
			variants={fadeUp}
			className="card"
			style={{ padding: 24, minWidth: 0 }}
		>
			<div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
				{icon && (
					<span
						className="icon-box icon-box-accent"
						style={{ width: 32, height: 32 }}
					>
						<Icon
							name={icon}
							size={16}
						/>
					</span>
				)}
				<div style={{ minWidth: 0 }}>
					<h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
					{subtitle && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>{subtitle}</p>}
				</div>
			</div>
			{children}
		</motion.div>
	);
}

/** Success / error line that grows in and collapses out instead of jumping the layout. */
function Notice({ tone = "success", message }) {
	const isError = tone === "error";
	return (
		<AnimatePresence initial={false}>
			{message && (
				<motion.div
					key={tone}
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{ duration: 0.25, ease: EASE_OUT }}
					style={{ overflow: "hidden" }}
				>
					<div
						className={isError ? "message-error" : "message-success"}
						role={isError ? "alert" : "status"}
						style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}
					>
						<Icon
							name={isError ? "alert" : "checkCircle"}
							size={14}
							style={{ flexShrink: 0 }}
						/>
						<span>{message}</span>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

/** Stacks both labels in one grid cell so the button keeps its width while loading. */
function LoadingLabel({ loading, idle, busy }) {
	return (
		<span style={{ display: "inline-grid" }}>
			<span style={{ gridArea: "1 / 1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, visibility: loading ? "hidden" : "visible" }}>{idle}</span>
			<span style={{ gridArea: "1 / 1", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, visibility: loading ? "visible" : "hidden" }}>
				<span
					className="spinner"
					style={{ width: 12, height: 12 }}
				/>
				{busy}
			</span>
		</span>
	);
}

function Toggle({ on, onClick, label }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			aria-label={label}
			onClick={onClick}
			style={{
				width: 44,
				height: 24,
				borderRadius: 12,
				background: on ? "var(--accent)" : "var(--bg-surface-3)",
				boxShadow: on ? "0 0 14px rgba(124,114,255,0.35)" : "inset 0 0 0 1px var(--border-default)",
				border: "none",
				cursor: "pointer",
				position: "relative",
				padding: 0,
				transition: "background-color 0.2s, box-shadow 0.2s",
				flexShrink: 0,
			}}
		>
			<motion.span
				initial={false}
				animate={{ x: on ? 20 : 0 }}
				transition={SPRING}
				style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
			/>
		</button>
	);
}

function PrefRow({ label, desc, on, onToggle, divider }) {
	return (
		<div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0" }}>
			{divider && (
				<span
					aria-hidden
					style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "var(--border-subtle)" }}
				/>
			)}
			<div style={{ minWidth: 0 }}>
				<p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
				<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{desc}</p>
			</div>
			<Toggle
				on={on}
				onClick={onToggle}
				label={label}
			/>
		</div>
	);
}

export default function ProfilePage() {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const setAuth = useAuthStore((s) => s.setAuth);
	const avatarInputRef = useRef(null);

	const [activeTab, setActiveTab] = useState("profile");

	const [profileForm, setProfileForm] = useState({ name: "", avatar: "", bio: "" });
	const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
	const [showCurrentPw, setShowCurrentPw] = useState(false);
	const [showNewPw, setShowNewPw] = useState(false);

	// Preferences — persisted to localStorage
	const [prefs, setPrefs] = useState(() => {
		try {
			const raw = localStorage.getItem("cb_prefs");
			const defaults = {
				notifyMentions: true, notifyTaskUpdates: true, notifyInvites: true,
				soundEnabled: false, compactMode: false,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				theme: "dark",
				reduceMotion: false, highContrast: false,
				dateFormat: "MMM D, YYYY", timeFormat: "12h", startOfWeek: "monday",
			};
			return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
		} catch {
			return { notifyMentions: true, notifyTaskUpdates: true, notifyInvites: true, soundEnabled: false, compactMode: false, timezone: "UTC", theme: "dark", reduceMotion: false, highContrast: false, dateFormat: "MMM D, YYYY", timeFormat: "12h", startOfWeek: "monday" };
		}
	});

	const updatePref = (key, value) => {
		setPrefs((prev) => {
			const next = { ...prev, [key]: value };
			try { localStorage.setItem("cb_prefs", JSON.stringify(next)); } catch { /* ignore */ }
			return next;
		});
	};

	const [profileStatus, setProfileStatus] = useState("");
	const [profileError, setProfileError] = useState("");
	const [passwordStatus, setPasswordStatus] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);

	useEffect(() => {
		setProfileForm({ name: user?.name || "", avatar: user?.avatar || "", bio: user?.bio || "" });
	}, [user]);

	const handleProfileSubmit = async (e) => {
		e.preventDefault();
		setSavingProfile(true);
		setProfileStatus("");
		setProfileError("");
		try {
			const { data } = await api.patch("/users/me", profileForm);
			setAuth(data, accessToken);
			setProfileStatus("Profile updated successfully!");
			setTimeout(() => setProfileStatus(""), 3000);
		} catch (err) {
			setProfileError(err.response?.data?.message || "Failed to update profile");
		} finally {
			setSavingProfile(false);
		}
	};

	const handlePasswordSubmit = async (e) => {
		e.preventDefault();
		setSavingPassword(true);
		setPasswordStatus("");
		setPasswordError("");
		try {
			const { data } = await api.patch("/users/me/password", passwordForm);
			setPasswordStatus(data.message || "Password updated!");
			setPasswordForm({ currentPassword: "", newPassword: "" });
			setTimeout(() => setPasswordStatus(""), 3000);
		} catch (err) {
			setPasswordError(err.response?.data?.message || "Failed to update password");
		} finally {
			setSavingPassword(false);
		}
	};

	const handleAvatarUpload = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { setProfileError("Image must be < 2MB"); return; }
		setUploadingAvatar(true);
		setProfileError("");
		try {
			const fd = new FormData();
			fd.append("avatar", file);
			const { data } = await api.post("/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
			setAuth({ ...user, avatar: data.avatar }, accessToken);
			setProfileForm((prev) => ({ ...prev, avatar: data.avatar }));
		} catch (err) {
			setProfileError(err.response?.data?.message || "Failed to upload avatar");
		} finally {
			setUploadingAvatar(false);
		}
	};

	const strength = getPasswordStrength(passwordForm.newPassword);
	const color = getColor(user?.name || "");
	const initials = getInitials(user?.name || "?");

	const isGoogle = user?.provider === "google";

	return (
		<motion.div
			variants={staggerContainer(0.08)}
			initial="hidden"
			animate="show"
			style={{ maxWidth: 680, margin: "0 auto", minWidth: 0 }}
		>
			{/* Page header */}
			<motion.div
				variants={fadeUp}
				style={{ marginBottom: 20 }}
			>
				<h1 className="page-title">Account</h1>
				<p className="page-subtitle">Manage your profile, security, and preferences.</p>
			</motion.div>

			{/* Tab bar */}
			<motion.div
				variants={fadeUp}
				style={{ marginBottom: 20 }}
			>
				<SegmentedTabs
					id="profile-tabs"
					items={TAB_ITEMS}
					value={activeTab}
					onChange={setActiveTab}
				/>
			</motion.div>

			<AnimatePresence mode="wait">
				<motion.div
					key={activeTab}
					role="tabpanel"
					variants={staggerContainer(0.06, 0.05)}
					initial="hidden"
					animate="show"
					exit={panelExit}
					style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}
				>
					{/* ── Profile Tab ── */}
					{activeTab === "profile" && (
						<>
							{/* Avatar card */}
							<motion.div
								variants={fadeUp}
								className="card"
								style={{ padding: 24, overflow: "hidden", background: `radial-gradient(120% 160% at 0% 0%, ${color}26, transparent 55%), var(--bg-surface-1)` }}
							>
								<div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
									<motion.button
										type="button"
										onClick={() => avatarInputRef.current?.click()}
										disabled={uploadingAvatar}
										aria-label="Change avatar"
										title="Change avatar"
										initial="rest"
										animate="rest"
										whileHover="hover"
										whileFocus="hover"
										whileTap={{ scale: 0.96 }}
										transition={SPRING}
										style={{ position: "relative", width: 80, height: 80, flexShrink: 0, padding: 0, border: "none", borderRadius: "50%", background: "none", cursor: uploadingAvatar ? "progress" : "pointer" }}
									>
										<motion.span
											variants={{ rest: { scale: 1 }, hover: { scale: 1.04 } }}
											transition={SPRING}
											style={{
												position: "absolute",
												inset: 0,
												borderRadius: "50%",
												background: profileForm.avatar ? "var(--bg-surface-3)" : color,
												border: "3px solid var(--border-default)",
												boxShadow: `0 0 0 4px ${color}1a, 0 10px 28px -10px ${color}aa`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: 24,
												fontWeight: 700,
												color: "#fff",
												overflow: "hidden",
											}}
										>
											{profileForm.avatar ? (
												<img
													src={profileForm.avatar}
													alt={user?.name}
													style={{ width: "100%", height: "100%", objectFit: "cover" }}
												/>
											) : (
												initials
											)}
											<motion.span
												variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
												transition={{ duration: 0.2, ease: EASE_OUT }}
												style={{ position: "absolute", inset: 0, background: "rgba(10,11,18,0.62)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#fff" }}
											>
												<Icon
													name="upload"
													size={16}
												/>
												Change
											</motion.span>
											<AnimatePresence>
												{uploadingAvatar && (
													<motion.span
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														exit={{ opacity: 0 }}
														transition={{ duration: 0.2, ease: EASE_OUT }}
														style={{ position: "absolute", inset: 0, background: "rgba(10,11,18,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
													>
														<span
															className="spinner"
															style={{ width: 18, height: 18 }}
														/>
													</motion.span>
												)}
											</AnimatePresence>
										</motion.span>
										<span
											aria-hidden
											style={{
												position: "absolute",
												bottom: 0,
												right: 0,
												width: 26,
												height: 26,
												borderRadius: "50%",
												background: "var(--accent)",
												border: "2px solid var(--bg-surface-1)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												color: "#fff",
											}}
										>
											<Icon
												name="edit"
												size={12}
											/>
										</span>
									</motion.button>
									<input
										ref={avatarInputRef}
										type="file"
										accept="image/*"
										onChange={handleAvatarUpload}
										style={{ display: "none" }}
									/>

									<div style={{ minWidth: 0 }}>
										<p style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0, ...ellipsis }}>{user?.name || "Your Name"}</p>
										<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0", ...ellipsis }}>{user?.email || ""}</p>
										<span
											className="badge badge-muted"
											style={{ gap: 6, marginTop: 10 }}
										>
											<Icon
												name={isGoogle ? "user" : "lock"}
												size={12}
											/>
											{isGoogle ? "Google account" : "Email account"}
										</span>
									</div>
								</div>
							</motion.div>

							{/* Profile form */}
							<SectionCard
								title="Account details"
								subtitle="Update your display name and bio"
								icon="user"
							>
								<form
									onSubmit={handleProfileSubmit}
									style={{ display: "flex", flexDirection: "column", gap: 14 }}
								>
									<div>
										<label
											htmlFor="profile-name"
											style={labelStyle}
										>
											Display name
										</label>
										<input
											id="profile-name"
											value={profileForm.name}
											onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
											required
											className="input"
											placeholder="Your name"
										/>
									</div>
									<div>
										<label
											htmlFor="profile-bio"
											style={labelStyle}
										>
											Bio <span style={{ color: "var(--text-muted)" }}>(optional)</span>
										</label>
										<textarea
											id="profile-bio"
											value={profileForm.bio}
											onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
											className="input"
											placeholder="Tell your team a bit about yourself…"
											rows={3}
											style={{ resize: "vertical", fontFamily: "inherit", paddingTop: 8, paddingBottom: 8 }}
										/>
									</div>
									<div>
										<label
											htmlFor="profile-avatar"
											style={labelStyle}
										>
											Avatar URL <span style={{ color: "var(--text-muted)" }}>(or use upload above)</span>
										</label>
										<input
											id="profile-avatar"
											value={profileForm.avatar}
											onChange={(e) => setProfileForm((prev) => ({ ...prev, avatar: e.target.value }))}
											className="input"
											placeholder="https://..."
										/>
									</div>
									<div style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
										<button
											type="submit"
											disabled={savingProfile}
											className="btn btn-primary btn-sm"
										>
											<LoadingLabel
												loading={savingProfile}
												idle="Save changes"
												busy="Saving..."
											/>
										</button>
										<Notice message={profileStatus} />
										<Notice
											tone="error"
											message={profileError}
										/>
									</div>
								</form>
							</SectionCard>

							{/* Linked accounts */}
							<SectionCard
								title="Linked accounts"
								subtitle="How you sign in to CollabBoard"
								icon="layers"
							>
								<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: "var(--bg-surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--border-default)" }}>
									<div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
										<span
											className="icon-box"
											style={{ width: 36, height: 36, background: isGoogle ? "#fff" : "var(--accent-muted)", borderColor: isGoogle ? "transparent" : "var(--accent-border)", color: "var(--accent)" }}
										>
											{isGoogle ? (
												<GoogleIcon />
											) : (
												<Icon
													name="lock"
													size={16}
												/>
											)}
										</span>
										<div style={{ minWidth: 0 }}>
											<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{isGoogle ? "Google" : "Email & Password"}</p>
											<p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", ...ellipsis }}>{user?.email}</p>
										</div>
									</div>
									<span
										className="badge badge-success"
										style={{ gap: 4 }}
									>
										<Icon
											name="check"
											size={11}
										/>
										Active
									</span>
								</div>
							</SectionCard>

							{/* Password — local accounts only */}
							{user?.provider !== "google" && (
								<SectionCard
									title="Change password"
									subtitle="Use a strong, unique password"
									icon="lock"
								>
									<form
										onSubmit={handlePasswordSubmit}
										style={{ display: "flex", flexDirection: "column", gap: 14 }}
									>
										<div>
											<label
												htmlFor="profile-current-password"
												style={labelStyle}
											>
												Current password
											</label>
											<div style={{ position: "relative" }}>
												<input
													id="profile-current-password"
													type={showCurrentPw ? "text" : "password"}
													value={passwordForm.currentPassword}
													onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
													required
													autoComplete="current-password"
													className="input"
													placeholder="••••••••"
													style={{ paddingRight: 44 }}
												/>
												<button
													type="button"
													onClick={() => setShowCurrentPw((v) => !v)}
													aria-label={showCurrentPw ? "Hide password" : "Show password"}
													style={eyeButtonStyle}
												>
													<Icon
														name={showCurrentPw ? "eyeOff" : "eye"}
														size={16}
													/>
												</button>
											</div>
										</div>
										<div>
											<label
												htmlFor="profile-new-password"
												style={labelStyle}
											>
												New password
											</label>
											<div style={{ position: "relative" }}>
												<input
													id="profile-new-password"
													type={showNewPw ? "text" : "password"}
													value={passwordForm.newPassword}
													onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
													required
													minLength={8}
													autoComplete="new-password"
													className="input"
													placeholder="••••••••"
													style={{ paddingRight: 44 }}
												/>
												<button
													type="button"
													onClick={() => setShowNewPw((v) => !v)}
													aria-label={showNewPw ? "Hide password" : "Show password"}
													style={eyeButtonStyle}
												>
													<Icon
														name={showNewPw ? "eyeOff" : "eye"}
														size={16}
													/>
												</button>
											</div>
											<AnimatePresence initial={false}>
												{passwordForm.newPassword && (
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
										</div>
										<div style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
											<button
												type="submit"
												disabled={savingPassword}
												className="btn btn-primary btn-sm"
											>
												<LoadingLabel
													loading={savingPassword}
													idle="Update password"
													busy="Updating..."
												/>
											</button>
											<Notice message={passwordStatus} />
											<Notice
												tone="error"
												message={passwordError}
											/>
										</div>
									</form>
								</SectionCard>
							)}
						</>
					)}

					{/* ── Preferences Tab ── */}
					{activeTab === "preferences" && (
						<>
							<SectionCard
								title="Notifications"
								subtitle="Choose what alerts you receive in CollabBoard"
								icon="bell"
							>
								{[
									{ key: "notifyMentions", label: "@mentions", desc: "When someone mentions you in a message or comment" },
									{ key: "notifyTaskUpdates", label: "Task updates", desc: "When a task assigned to you is updated" },
									{ key: "notifyInvites", label: "Workspace invites", desc: "When you receive a workspace invitation" },
									{ key: "soundEnabled", label: "Notification sounds", desc: "Play a sound when you receive a notification" },
								].map(({ key, label, desc }, index) => (
									<PrefRow
										key={key}
										label={label}
										desc={desc}
										on={prefs[key]}
										onToggle={() => updatePref(key, !prefs[key])}
										divider={index > 0}
									/>
								))}
							</SectionCard>

							<SectionCard
								title="Appearance"
								subtitle="Choose your theme and display density"
								icon="sparkles"
							>
								<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
									<div>
										<p style={{ ...labelStyle, marginBottom: 10 }}>Theme</p>
										<div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
											{THEME_OPTIONS.map((t) => {
												const active = prefs.theme === t.value;
												return (
													<motion.button
														key={t.value}
														type="button"
														aria-pressed={active}
														onClick={() => updatePref("theme", t.value)}
														whileTap={{ scale: 0.97 }}
														transition={SPRING}
														style={{
															position: "relative",
															minWidth: 0,
															padding: 8,
															display: "flex",
															flexDirection: "column",
															gap: 8,
															borderRadius: "var(--r-md)",
															border: "1px solid var(--border-default)",
															background: "var(--bg-surface-2)",
															color: active ? "var(--text-primary)" : "var(--text-secondary)",
															cursor: "pointer",
															fontSize: 13,
															fontWeight: 600,
															fontFamily: "inherit",
															transition: "color 0.15s",
														}}
													>
														{active && (
															<motion.span
																layoutId="profile-theme-ring"
																transition={SPRING}
																style={{ position: "absolute", inset: -1, borderRadius: "inherit", border: "2px solid var(--accent)", background: "var(--accent-muted)", pointerEvents: "none" }}
															/>
														)}
														<span style={{ position: "relative", display: "block", height: 44, borderRadius: 6, background: t.preview, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
															<span style={{ position: "absolute", left: 8, top: 9, width: "42%", height: 5, borderRadius: 3, background: "var(--accent)" }} />
															<span style={{ position: "absolute", left: 8, top: 20, width: "62%", height: 4, borderRadius: 3, background: t.ink }} />
															<span style={{ position: "absolute", left: 8, top: 29, width: "34%", height: 4, borderRadius: 3, background: t.ink }} />
														</span>
														<span style={{ position: "relative", textAlign: "center" }}>{t.label}</span>
													</motion.button>
												);
											})}
										</div>
									</div>
									{[{ key: "compactMode", label: "Compact mode", desc: "Reduce spacing to fit more content" }].map(({ key, label, desc }) => (
										<PrefRow
											key={key}
											label={label}
											desc={desc}
											on={prefs[key]}
											onToggle={() => updatePref(key, !prefs[key])}
											divider
										/>
									))}
								</div>
							</SectionCard>

							<SectionCard
								title="Accessibility"
								subtitle="Make CollabBoard work better for you"
								icon="eye"
							>
								{[
									{ key: "reduceMotion", label: "Reduce motion", desc: "Minimize animations and transitions" },
									{ key: "highContrast", label: "High contrast", desc: "Increase border and text contrast" },
								].map(({ key, label, desc }, index) => (
									<PrefRow
										key={key}
										label={label}
										desc={desc}
										on={prefs[key]}
										onToggle={() => updatePref(key, !prefs[key])}
										divider={index > 0}
									/>
								))}
							</SectionCard>

							<SectionCard
								title="Language & Region"
								subtitle="Date, time, and locale settings"
								icon="clock"
							>
								<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
									<div>
										<label
											htmlFor="pref-date-format"
											style={labelStyle}
										>
											Date format
										</label>
										<select
											id="pref-date-format"
											value={prefs.dateFormat}
											onChange={(e) => updatePref("dateFormat", e.target.value)}
											className="input"
										>
											{["MMM D, YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f) => (
												<option
													key={f}
													value={f}
												>
													{f}
												</option>
											))}
										</select>
									</div>
									<div>
										<label
											htmlFor="pref-time-format"
											style={labelStyle}
										>
											Time format
										</label>
										<select
											id="pref-time-format"
											value={prefs.timeFormat}
											onChange={(e) => updatePref("timeFormat", e.target.value)}
											className="input"
										>
											<option value="12h">12-hour (2:30 PM)</option>
											<option value="24h">24-hour (14:30)</option>
										</select>
									</div>
									<div>
										<label
											htmlFor="pref-start-of-week"
											style={labelStyle}
										>
											Start of week
										</label>
										<select
											id="pref-start-of-week"
											value={prefs.startOfWeek}
											onChange={(e) => updatePref("startOfWeek", e.target.value)}
											className="input"
										>
											<option value="monday">Monday</option>
											<option value="sunday">Sunday</option>
										</select>
									</div>
									<div>
										<label
											htmlFor="pref-timezone"
											style={labelStyle}
										>
											Timezone
										</label>
										<select
											id="pref-timezone"
											value={prefs.timezone}
											onChange={(e) => updatePref("timezone", e.target.value)}
											className="input"
										>
											{["UTC", "America/New_York", "America/Los_Angeles", "America/Chicago", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"].map((tz) => (
												<option
													key={tz}
													value={tz}
												>
													{tz.replace(/_/g, " ")}
												</option>
											))}
										</select>
									</div>
								</div>
							</SectionCard>
						</>
					)}
				</motion.div>
			</AnimatePresence>
		</motion.div>
	);
}
