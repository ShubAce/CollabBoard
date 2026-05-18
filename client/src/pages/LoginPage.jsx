import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const setAuth = useAuthStore((state) => state.setAuth);
	const [form, setForm] = useState({ email: "", password: "" });
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);
		try {
			const { data } = await api.post("/auth/login", form);
			setAuth(data.user, data.accessToken);
			navigate(searchParams.get("next") || "/app");
		} catch (err) {
			setError(err.response?.data?.message || "Login failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGoogleLogin = () => {
		window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
	};

	return (
		<div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-ghost-white-200 bg-white/90 p-8 shadow-lg">
			<h1 className="text-3xl font-semibold tracking-tight text-jet-black-900 font-display">Log in</h1>
			<form
				onSubmit={handleSubmit}
				className="mt-6 space-y-4"
			>
				<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
					Email
					<input
						name="email"
						type="email"
						value={form.email}
						onChange={handleChange}
						required
						className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
					/>
				</label>
				<label className="flex flex-col gap-2 text-sm font-medium text-jet-black-700">
					Password
					<input
						name="password"
						type="password"
						value={form.password}
						onChange={handleChange}
						required
						className="rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
					/>
				</label>
				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-60"
				>
					{isSubmitting ? "Signing in..." : "Sign in"}
				</button>
			</form>
			<button
				type="button"
				onClick={handleGoogleLogin}
				className="mt-3 w-full rounded-xl border border-ghost-white-200 bg-white px-4 py-2 text-sm font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
			>
				Continue with Google
			</button>
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
			<p className="mt-4 text-sm text-jet-black-600">
				No account?{" "}
				<Link
					to="/register"
					className="font-semibold text-jet-black-900 hover:underline"
				>
					Create one
				</Link>
			</p>
		</div>
	);
}
