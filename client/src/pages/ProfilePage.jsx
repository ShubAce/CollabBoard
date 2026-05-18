import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
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

	const [profileForm, setProfileForm] = useState({ name: "", avatar: "" });
	const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
	const [showCurrentPw, setShowCurrentPw] = useState(false);
	const [showNewPw, setShowNewPw] = useState(false);

	const [profileStatus, setProfileStatus] = useState("");
	const [profileError, setProfileError] = useState("");
	const [passwordStatus, setPasswordStatus] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);

	useEffect(() => {
		setProfileForm({ name: user?.name || "", avatar: user?.avatar || "" });
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
			const { data } = await api.post("/users/me/avatar", fd, {
				headers: { "Content-Type": "multipart/form-data" },
			});
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
			<div style={{ marginBottom: 24 }}>
				<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Profile</h1>
				<p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Manage your account details and security.</p>
			</div>

			{/* Avatar section */}
			<div className="card" style={{ padding: 24, marginBottom: 16 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
					{/* Avatar */}
					<div style={{ position: "relative" }}>
						<div
							style={{
								width: 80,
								height: 80,
								borderRadius: "50%",
								background: profileForm.avatar ? "transparent" : color,
								border: "3px solid var(--border)",
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
								border: "2px solid var(--bg-surface)",
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 12,
								color: "#fff",
							}}
						>
							{uploadingAvatar ? <span className="spinner" style={{ width: 10, height: 10 }} /> : "✎"}
						</button>
						<input
							ref={avatarInputRef}
							type="file"
							accept="image/*"
							onChange={handleAvatarUpload}
							style={{ display: "none" }}
						/>
					</div>

					<div>
						<p style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{user?.name || "Your Name"}</p>
						<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "4px 0 0" }}>{user?.email || ""}</p>
						<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
							{user?.provider === "google" ? "🔗 Google account" : "🔒 Email account"}
						</p>
					</div>
				</div>
			</div>

			{/* Profile form */}
			<SectionCard title="Account details" subtitle="Update your display name">
				<form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Display name</label>
						<input
							value={profileForm.name}
							onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
							required
							className="input"
							placeholder="Your name"
						/>
					</div>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
							Avatar URL <span style={{ color: "var(--text-muted)" }}>(or use upload above)</span>
						</label>
						<input
							value={profileForm.avatar}
							onChange={(e) => setProfileForm((prev) => ({ ...prev, avatar: e.target.value }))}
							className="input"
							placeholder="https://..."
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<button type="submit" disabled={savingProfile} className="btn btn-primary btn-sm">
							{savingProfile ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Saving...</> : "Save changes"}
						</button>
						{profileStatus && <span style={{ fontSize: 13, color: "var(--success)" }}>✓ {profileStatus}</span>}
						{profileError && <span style={{ fontSize: 13, color: "var(--danger)" }}>⚠ {profileError}</span>}
					</div>
				</form>
			</SectionCard>

			{/* Password section - only for local accounts */}
			{user?.provider !== "google" && (
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
									placeholder="••••••••"
									style={{ paddingRight: 44 }}
								/>
								<button type="button" onClick={() => setShowCurrentPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 0 }}>
									{showCurrentPw ? "🙈" : "👁"}
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
									placeholder="••••••••"
									style={{ paddingRight: 44 }}
								/>
								<button type="button" onClick={() => setShowNewPw((v) => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 0 }}>
									{showNewPw ? "🙈" : "👁"}
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
							{passwordStatus && <span style={{ fontSize: 13, color: "var(--success)" }}>✓ {passwordStatus}</span>}
							{passwordError && <span style={{ fontSize: 13, color: "var(--danger)" }}>⚠ {passwordError}</span>}
						</div>
					</form>
				</SectionCard>
			)}
		</div>
	);
}
