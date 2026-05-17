import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function RegisterPage() {
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleChange = (event) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setSuccess("");
		setIsSubmitting(true);
		try {
			const { data } = await api.post("/auth/register", form);
			setSuccess(data.message || "Registration successful. Please verify your email.");
			setForm({ name: "", email: "", password: "" });
		} catch (err) {
			setError(err.response?.data?.message || "Registration failed");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-amber-100 bg-white/90 p-8 shadow-lg">
			<h1 className="text-3xl font-semibold tracking-tight text-slate-900 font-['Fraunces']">Create account</h1>
			<form
				onSubmit={handleSubmit}
				className="mt-6 space-y-4"
			>
				<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
					Name
					<input
						name="name"
						value={form.name}
						onChange={handleChange}
						required
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/30"
					/>
				</label>
				<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
					Email
					<input
						name="email"
						type="email"
						value={form.email}
						onChange={handleChange}
						required
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/30"
					/>
				</label>
				<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
					Password
					<input
						name="password"
						type="password"
						value={form.password}
						onChange={handleChange}
						required
						minLength={8}
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/30"
					/>
				</label>
				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
				>
					{isSubmitting ? "Creating..." : "Create account"}
				</button>
			</form>
			{success && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
			<p className="mt-4 text-sm text-slate-600">
				Already have an account?{" "}
				<Link
					to="/login"
					className="font-semibold text-slate-900 hover:underline"
				>
					Log in
				</Link>
			</p>
		</div>
	);
}
