import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function WorkspaceList() {
	const [workspaces, setWorkspaces] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");

	useEffect(() => {
		let isActive = true;
		const loadWorkspaces = async () => {
			setStatus("loading");
			setError("");
			try {
				const { data } = await api.get("/workspaces");
				if (isActive) {
					setWorkspaces(data);
					setStatus("ready");
				}
			} catch (err) {
				if (isActive) {
					setError(err.response?.data?.message || "Failed to load workspaces");
					setStatus("error");
				}
			}
		};

		loadWorkspaces();
		return () => {
			isActive = false;
		};
	}, []);

	return (
		<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-slate-900 font-['Fraunces']">Workspaces</h2>
					<p className="mt-1 text-sm text-slate-500">Manage your teams and boards.</p>
				</div>
				<Link
					className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
					to="/app/workspaces/new"
				>
					Create workspace
				</Link>
			</div>

			{status === "loading" && <p className="mt-4 text-sm text-slate-500">Loading workspaces...</p>}
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

			{status === "ready" && workspaces.length === 0 && (
				<p className="mt-4 text-sm text-slate-500">No workspaces yet. Create one to get started.</p>
			)}

			{workspaces.length > 0 && (
				<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{workspaces.map((workspace) => (
						<div
							key={workspace._id}
							className="flex flex-col justify-between gap-4 rounded-xl border border-amber-100 bg-amber-50/70 p-4"
						>
							<div>
								<h3 className="text-lg font-semibold text-slate-900">{workspace.name}</h3>
								<p className="mt-1 text-sm text-slate-500">{workspace.description || "No description"}</p>
							</div>
							<div className="flex flex-wrap items-center gap-3 text-sm">
								<span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
									{workspace.members?.length || 0} members
								</span>
								<Link
									to={`/app/workspaces/${workspace._id}`}
									className="font-semibold text-slate-700 hover:text-slate-900"
								>
									Open
								</Link>
								<Link
									to={`/app/workspaces/${workspace._id}/boards`}
									className="font-semibold text-slate-700 hover:text-slate-900"
								>
									Boards
								</Link>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
