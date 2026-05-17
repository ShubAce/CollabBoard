import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function CreateWorkspace() {
	const navigate = useNavigate();
	const [form, setForm] = useState({ name: "", description: "" });
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
			const { data } = await api.post("/workspaces", form);
			navigate(`/app/workspaces/${data._id}`);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create workspace");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
			<h2 className="text-2xl font-semibold text-slate-900 font-['Fraunces']">Create workspace</h2>
			<form
				className="mt-6 space-y-4"
				onSubmit={handleSubmit}
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
					Description
					<input
						name="description"
						value={form.description}
						onChange={handleChange}
						placeholder="Optional"
						className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/30"
					/>
				</label>
				<button
					type="submit"
					disabled={isSubmitting}
					className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
				>
					{isSubmitting ? "Creating..." : "Create workspace"}
				</button>
			</form>
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
		</section>
	);
}
