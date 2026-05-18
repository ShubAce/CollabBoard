import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

export default function InviteAcceptPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const token = searchParams.get("token");
	const accessToken = useAuthStore((state) => state.accessToken);
	const setAuth = useAuthStore((state) => state.setAuth);

	const [status, setStatus] = useState("loading");
	const [preview, setPreview] = useState(null);
	const [error, setError] = useState("");
	const [form, setForm] = useState({ name: "", password: "" });
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!token) {
			setStatus("invalid");
			return;
		}

		let isActive = true;
		const loadPreview = async () => {
			try {
				const { data } = await api.get(`/invite/preview?token=${encodeURIComponent(token)}`);
				if (!isActive) return;
				setPreview(data);
				setStatus("ready");
			} catch (err) {
				if (!isActive) return;
				setError(err.response?.data?.message || "This invitation is no longer valid.");
				setStatus("invalid");
			}
		};

		loadPreview();
		return () => {
			isActive = false;
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

	const handleRegister = async (event) => {
		event.preventDefault();
		if (!token) return;
		setSubmitting(true);
		setError("");
		try {
			const { data } = await api.post("/invite/accept-register", {
				token,
				name: form.name,
				password: form.password,
			});
			setAuth(data.user, data.accessToken);
			navigate(`/app/workspaces/${data.workspace._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create account");
		} finally {
			setSubmitting(false);
		}
	};

	if (status === "loading") {
		return (
			<div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-ghost-white-200 bg-white/90 p-8 shadow-lg">
				<p className="text-sm text-jet-black-600">Checking your invitation...</p>
			</div>
		);
	}

	if (status === "invalid") {
		return (
			<div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-red-200 bg-white/90 p-8 shadow-lg">
				<h1 className="text-2xl font-semibold text-jet-black-900 font-display">Invitation unavailable</h1>
				<p className="mt-3 text-sm text-jet-black-600">{error || "It may have expired or already been used."}</p>
				<Link
					to="/login"
					className="mt-6 inline-flex rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
				>
					Go to login
				</Link>
			</div>
		);
	}

	const hasAccount = Boolean(preview?.hasAccount);
	const loggedIn = Boolean(accessToken);
	const loggedInAsWrongUser = loggedIn && preview?.currentUserMatchesInvite === false;

	return (
		<div className="mx-auto mt-16 w-full max-w-lg rounded-2xl border border-ghost-white-200 bg-white/90 p-8 shadow-lg">
			<h1 className="text-3xl font-semibold text-jet-black-900 font-display">You&apos;ve been invited</h1>
			<p className="mt-3 text-sm text-jet-black-600">
				{preview?.invitedBy?.name || "A teammate"} invited <span className="font-semibold text-jet-black-900">{preview?.email}</span> to join <span className="font-semibold text-jet-black-900">{preview?.workspace?.name}</span> as a <span className="font-semibold text-jet-black-900">{preview?.role}</span>.
			</p>

			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

			{loggedInAsWrongUser && (
				<div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
					<p className="text-sm text-amber-800">
						This invite is for <span className="font-semibold">{preview?.email}</span>, but you are signed in as <span className="font-semibold">{preview?.currentUserEmail}</span>.
					</p>
					<p className="mt-2 text-sm text-amber-700">Log out and sign in with the invited email to join this workspace.</p>
				</div>
			)}

			{hasAccount && loggedIn && !loggedInAsWrongUser && (
				<div className="mt-6">
					<button
						type="button"
						onClick={handleAccept}
						disabled={submitting}
						className="rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
					>
						{submitting ? "Joining..." : "Join workspace"}
					</button>
				</div>
			)}

			{hasAccount && !loggedIn && (
				<div className="mt-6 rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4">
					<p className="text-sm text-jet-black-600">This email already has an account. Log in first, then come right back to accept the invitation.</p>
					<Link
						to={loginHref}
						className="mt-4 inline-flex rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
					>
						Log in to continue
					</Link>
				</div>
			)}

			{!hasAccount && !loggedInAsWrongUser && (
				<form
					onSubmit={handleRegister}
					className="mt-6 space-y-4"
				>
					<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						Name
						<input
							value={form.name}
							onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
							required
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
						Password
						<input
							type="password"
							value={form.password}
							onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
							required
							minLength={8}
							className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
						/>
					</label>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-50"
					>
						{submitting ? "Creating account..." : "Create account and join"}
					</button>
				</form>
			)}
		</div>
	);
}
