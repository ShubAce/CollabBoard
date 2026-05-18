import { useEffect, useState } from "react";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

export default function ProfilePage() {
	const user = useAuthStore((state) => state.user);
	const accessToken = useAuthStore((state) => state.accessToken);
	const setAuth = useAuthStore((state) => state.setAuth);
	const [profileForm, setProfileForm] = useState({ name: "", avatar: "" });
	const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
	const [profileStatus, setProfileStatus] = useState("");
	const [profileError, setProfileError] = useState("");
	const [passwordStatus, setPasswordStatus] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => {
		setProfileForm({
			name: user?.name || "",
			avatar: user?.avatar || "",
		});
	}, [user]);

	const handleProfileSubmit = async (event) => {
		event.preventDefault();
		setSavingProfile(true);
		setProfileStatus("");
		setProfileError("");
		try {
			const { data } = await api.patch("/users/me", profileForm);
			setAuth(data, accessToken);
			setProfileStatus("Profile updated.");
		} catch (err) {
			setProfileError(err.response?.data?.message || "Failed to update profile");
		} finally {
			setSavingProfile(false);
		}
	};

	const handlePasswordSubmit = async (event) => {
		event.preventDefault();
		setSavingPassword(true);
		setPasswordStatus("");
		setPasswordError("");
		try {
			const { data } = await api.patch("/users/me/password", passwordForm);
			setPasswordStatus(data.message || "Password updated.");
			setPasswordForm({ currentPassword: "", newPassword: "" });
		} catch (err) {
			setPasswordError(err.response?.data?.message || "Failed to update password");
		} finally {
			setSavingPassword(false);
		}
	};

	return (
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<h2 className="text-2xl font-semibold text-jet-black-900 font-display">Profile</h2>
			<p className="mt-1 text-sm text-jet-black-500">Manage your account details.</p>

			<div className="mt-6 grid gap-6 lg:grid-cols-2">
				<form
					onSubmit={handleProfileSubmit}
					className="rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4"
				>
					<h3 className="text-lg font-semibold text-jet-black-900">Account</h3>
					<label className="mt-4 flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						Name
						<input
							value={profileForm.name}
							onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
							required
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<label className="mt-4 flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						Avatar URL
						<input
							value={profileForm.avatar}
							onChange={(event) => setProfileForm((prev) => ({ ...prev, avatar: event.target.value }))}
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<button
						type="submit"
						disabled={savingProfile}
						className="mt-4 rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
					>
						{savingProfile ? "Saving..." : "Save profile"}
					</button>
					{profileStatus && <p className="mt-3 text-sm text-emerald-700">{profileStatus}</p>}
					{profileError && <p className="mt-3 text-sm text-red-600">{profileError}</p>}
				</form>

				<form
					onSubmit={handlePasswordSubmit}
					className="rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4"
				>
					<h3 className="text-lg font-semibold text-jet-black-900">Password</h3>
					<label className="mt-4 flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						Current password
						<input
							type="password"
							value={passwordForm.currentPassword}
							onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
							required
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<label className="mt-4 flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						New password
						<input
							type="password"
							value={passwordForm.newPassword}
							onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
							required
							minLength={8}
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<button
						type="submit"
						disabled={savingPassword}
						className="mt-4 rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
					>
						{savingPassword ? "Updating..." : "Update password"}
					</button>
					{passwordStatus && <p className="mt-3 text-sm text-emerald-700">{passwordStatus}</p>}
					{passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}
				</form>
			</div>
		</section>
	);
}
