/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
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

function SectionCard({ children, title, subtitle }) {
	return (
		<div className="card" style={{ padding: 24 }}>
			<div style={{ marginBottom: 20 }}>
				<h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
				{subtitle && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</p>}
			</div>
			{children}
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

	return (
		<div className="fade-in" style={{ maxWidth: 680, margin: "0 auto" }}>
			{/* Page header */}
			<div style={{ marginBottom: 20 }}>
				<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Account</h1>
				<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Manage your profile, security, and preferences.</p>
			</div>

			{/* Tab bar */}
			<div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
				{["profile", "preferences"].map((tab) => (
					<button
						key={tab}
						type="button"
						className={`tab-button${activeTab === tab ? " active" : ""}`}
						onClick={() => setActiveTab(tab)}
					>
						<Icon name={tab === "profile" ? "user" : "settings"} size={13} />
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			{/* ── Profile Tab ── */}
			{activeTab === "profile" && (
				<>
					{/* Avatar card */}
					<div className="card" style={{ padding: 24, marginBottom: 16 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
							<div style={{ position: "relative" }}>
								<div
									style={{
										width: 80,
										height: 80,
										borderRadius: "50%",
										background: profileForm.avatar ? "transparent" : color,
										border: "3px solid var(--border-default)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 24,
										fontWeight: 700,
										color: "#fff",
										overflow: "hidden",
										flexShrink: 0,
									}}
								>
									{profileForm.avatar ? (
										<img src={profileForm.avatar} alt={user?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
									) : initials}
								</div>
								<button
									type="button"
									onClick={() => avatarInputRef.current?.click()}
									disabled={uploadingAvatar}
									style={{
										position: "absolute",
										bottom: 0,
										right: 0,
										width: 26,
										height: 26,
										borderRadius: "50%",
										background: "var(--accent)",
										border: "2px solid var(--bg-surface-1)",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 12,
										color: "#fff",
									}}
								>
									{uploadingAvatar ? <span className="spinner" style={{ width: 10, height: 10 }} /> : <Icon name="edit" size={12} />}
								</button>
								<input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
							</div>

							<div>
								<p style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{user?.name || "Your Name"}</p>
								<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0" }}>{user?.email || ""}</p>
								<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
									<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
										<Icon name={user?.provider === "google" ? "user" : "lock"} size={13} />
										{user?.provider === "google" ? "Google account" : "Email account"}
									</span>
								</p>
							</div>
						</div>
					</div>

					{/* Profile form */}
					<SectionCard title="Account details" subtitle="Update your display name and bio">
						<form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Display name</label>
								<input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} required className="input" placeholder="Your name" />
							</div>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Bio <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
								<textarea value={profileForm.bio} onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))} className="input" placeholder="Tell your team a bit about yourself…" rows={3} style={{ resize: "vertical", fontFamily: "inherit" }} />
							</div>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Avatar URL <span style={{ color: "var(--text-muted)" }}>(or use upload above)</span></label>
								<input value={profileForm.avatar} onChange={(e) => setProfileForm((prev) => ({ ...prev, avatar: e.target.value }))} className="input" placeholder="https://..." />
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
								<button type="submit" disabled={savingProfile} className="btn btn-primary btn-sm">
									{savingProfile ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Saving...</> : "Save changes"}
								</button>
								{profileStatus && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--success)" }}><Icon name="check" size={14} /> {profileStatus}</span>}
								{profileError && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--danger)" }}><Icon name="alert" size={14} /> {profileError}</span>}
							</div>
						</form>
					</SectionCard>

					{/* Linked accounts */}
					<div style={{ marginTop: 16 }}>
						<SectionCard title="Linked accounts" subtitle="How you sign in to CollabBoard">
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--border-default)" }}>
								<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
									<div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: user?.provider === "google" ? "#ea4335" : "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>
										{user?.provider === "google" ? "G" : <Icon name="lock" size={16} />}
									</div>
									<div>
										<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{user?.provider === "google" ? "Google" : "Email & Password"}</p>
										<p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{user?.email}</p>
									</div>
								</div>
								<span className="badge" style={{ background: "var(--green-muted)", color: "var(--green)", fontSize: 11 }}>✓ Active</span>
							</div>
						</SectionCard>
					</div>

					{/* Password — local accounts only */}
					{user?.provider !== "google" && (
						<div style={{ marginTop: 16 }}>
							<SectionCard title="Change password" subtitle="Use a strong, unique password">
								<form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
									<div>
										<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Current password</label>
										<div style={{ position: "relative" }}>
											<input
												type={showCurrentPw ? "text" : "password"}
												value={passwordForm.currentPassword}
												onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
												required
												className="input"
												placeholder="********"
												style={{ paddingRight: 44 }}
											/>
											<button type="button" onClick={() => setShowCurrentPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
												<Icon name={showCurrentPw ? "eyeOff" : "eye"} size={16} />
											</button>
										</div>
									</div>
									<div>
										<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>New password</label>
										<div style={{ position: "relative" }}>
											<input
												type={showNewPw ? "text" : "password"}
												value={passwordForm.newPassword}
												onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
												required
												minLength={8}
												className="input"
												placeholder="********"
												style={{ paddingRight: 44 }}
											/>
											<button type="button" onClick={() => setShowNewPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
												<Icon name={showNewPw ? "eyeOff" : "eye"} size={16} />
											</button>
										</div>
										{passwordForm.newPassword && (
											<div style={{ marginTop: 8 }}>
												<div className="pw-bar">
													<div className="pw-fill" style={{ width: `${(strength / 4) * 100}%`, background: strengthColor[strength] }} />
												</div>
												<p style={{ fontSize: 11, color: strengthColor[strength], marginTop: 4 }}>{strengthLabel[strength]}</p>
											</div>
										)}
									</div>
									<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
										<button type="submit" disabled={savingPassword} className="btn btn-primary btn-sm">
											{savingPassword ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Updating...</> : "Update password"}
										</button>
										{passwordStatus && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--success)" }}><Icon name="check" size={14} /> {passwordStatus}</span>}
										{passwordError && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--danger)" }}><Icon name="alert" size={14} /> {passwordError}</span>}
									</div>
								</form>
							</SectionCard>
						</div>
					)}
				</>
			)}

			{/* ── Preferences Tab ── */}
			{activeTab === "preferences" && (
				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<SectionCard title="Notifications" subtitle="Choose what alerts you receive in CollabBoard">
						{[
							{ key: "notifyMentions", label: "@mentions", desc: "When someone mentions you in a message or comment" },
							{ key: "notifyTaskUpdates", label: "Task updates", desc: "When a task assigned to you is updated" },
							{ key: "notifyInvites", label: "Workspace invites", desc: "When you receive a workspace invitation" },
							{ key: "soundEnabled", label: "Notification sounds", desc: "Play a sound when you receive a notification" },
						].map(({ key, label, desc }) => (
							<div
								key={key}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 16,
									padding: "12px 0",
									borderBottom: "1px solid var(--border-subtle)",
								}}
							>
								<div>
									<p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
									<p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{desc}</p>
								</div>
								{/* Animated toggle */}
								<button
									type="button"
									aria-pressed={prefs[key]}
									onClick={() => updatePref(key, !prefs[key])}
									style={{
										width: 44,
										height: 24,
										borderRadius: 12,
										background: prefs[key] ? "var(--accent)" : "var(--bg-surface-3)",
										border: "none",
										cursor: "pointer",
										position: "relative",
										transition: "background 0.2s",
										flexShrink: 0,
									}}
								>
									<span
										style={{
											position: "absolute",
											top: 3,
											left: prefs[key] ? 23 : 3,
											width: 18,
											height: 18,
											borderRadius: "50%",
											background: "#fff",
											transition: "left 0.2s",
										}}
									/>
								</button>
							</div>
						))}
					</SectionCard>

					<SectionCard title="Appearance" subtitle="Choose your theme and display density">
						<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>Theme</label>
								<div style={{ display: "flex", gap: 8 }}>
									{["dark", "light", "system"].map(t => (
										<button key={t} type="button" onClick={() => updatePref("theme", t)}
											style={{ flex: 1, padding: "10px 0", borderRadius: "var(--r-md)", border: `2px solid ${prefs.theme === t ? "var(--accent)" : "var(--border-default)"}`, background: prefs.theme === t ? "var(--accent-muted)" : "var(--bg-surface-2)", color: prefs.theme === t ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600, textTransform: "capitalize", transition: "all 0.15s" }}>
											{t === "dark" ? "🌙 Dark" : t === "light" ? "☀️ Light" : "💻 System"}
										</button>
									))}
								</div>
							</div>
							{[{ key: "compactMode", label: "Compact mode", desc: "Reduce spacing to fit more content" }].map(({ key, label, desc }) => (
								<div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
									<div><p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p><p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{desc}</p></div>
									<button type="button" aria-pressed={prefs[key]} onClick={() => updatePref(key, !prefs[key])} style={{ width: 44, height: 24, borderRadius: 12, background: prefs[key] ? "var(--accent)" : "var(--bg-surface-3)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: prefs[key] ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} /></button>
								</div>
							))}
						</div>
					</SectionCard>

					<SectionCard title="Accessibility" subtitle="Make CollabBoard work better for you">
						{[
							{ key: "reduceMotion", label: "Reduce motion", desc: "Minimize animations and transitions" },
							{ key: "highContrast", label: "High contrast", desc: "Increase border and text contrast" },
						].map(({ key, label, desc }) => (
							<div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
								<div><p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p><p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{desc}</p></div>
								<button type="button" aria-pressed={prefs[key]} onClick={() => updatePref(key, !prefs[key])} style={{ width: 44, height: 24, borderRadius: 12, background: prefs[key] ? "var(--accent)" : "var(--bg-surface-3)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}><span style={{ position: "absolute", top: 3, left: prefs[key] ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} /></button>
							</div>
						))}
					</SectionCard>

					<SectionCard title="Language &amp; Region" subtitle="Date, time, and locale settings">
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Date format</label>
								<select value={prefs.dateFormat} onChange={e => updatePref("dateFormat", e.target.value)} className="input">
									{["MMM D, YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map(f => <option key={f} value={f}>{f}</option>)}
								</select>
							</div>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Time format</label>
								<select value={prefs.timeFormat} onChange={e => updatePref("timeFormat", e.target.value)} className="input">
									<option value="12h">12-hour (2:30 PM)</option>
									<option value="24h">24-hour (14:30)</option>
								</select>
							</div>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Start of week</label>
								<select value={prefs.startOfWeek} onChange={e => updatePref("startOfWeek", e.target.value)} className="input">
									<option value="monday">Monday</option>
									<option value="sunday">Sunday</option>
								</select>
							</div>
							<div>
								<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Timezone</label>
								<select value={prefs.timezone} onChange={e => updatePref("timezone", e.target.value)} className="input">
									{["UTC", "America/New_York", "America/Los_Angeles", "America/Chicago", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"].map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
								</select>
							</div>
						</div>
					</SectionCard>
				</div>
			)}
		</div>
	);
}
