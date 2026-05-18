import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

export default function WorkspaceList() {
	const user = useAuthStore((state) => state.user);
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
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-jet-black-900 font-display">Workspaces</h2>
					<p className="mt-1 text-sm text-jet-black-500">Manage your teams and boards.</p>
				</div>
				<Link
					className="inline-flex items-center justify-center rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
					to="/app/workspaces/new"
				>
					Create workspace
				</Link>
			</div>

			{status === "loading" && <p className="mt-4 text-sm text-jet-black-500">Loading workspaces...</p>}
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

			{status === "ready" && workspaces.length === 0 && (
				<p className="mt-4 text-sm text-jet-black-500">No workspaces yet. Create one to get started.</p>
			)}

			{workspaces.length > 0 && (
				<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{workspaces.map((workspace) => {
						const owner = workspace.owner;
						const ownerId = owner?._id || owner;
						const isCreatedByUser = workspace.isOwner || ownerId?.toString?.() === user?._id;
						return (
							<div
								key={workspace._id}
								className="flex flex-col justify-between gap-4 rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4"
							>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="text-lg font-semibold text-jet-black-900">{workspace.name}</h3>
										<span
											className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
												isCreatedByUser
													? "bg-emerald-100 text-emerald-700"
													: "bg-amber-100 text-amber-700"
											}`}
										>
											{isCreatedByUser ? "Created by you" : "Joined"}
										</span>
									</div>
									<p className="mt-1 text-sm text-jet-black-500">{workspace.description || "No description"}</p>
									<p className="mt-2 text-xs text-jet-black-500">
										Owner: {isCreatedByUser ? "You" : owner?.name || "Unknown"}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-3 text-sm">
									<span className="inline-flex items-center rounded-full bg-space-indigo-500 px-2.5 py-1 text-xs font-semibold text-white">
										{workspace.members?.length || 0} members
									</span>
									<span className="inline-flex items-center rounded-full bg-ghost-white-200 px-2.5 py-1 text-xs font-semibold text-jet-black-700">
										{workspace.currentUserRole || "member"}
									</span>
									<Link
										to={`/app/workspaces/${workspace._id}`}
										className="font-semibold text-jet-black-700 hover:text-jet-black-900"
									>
										Open
									</Link>
									<Link
										to={`/app/workspaces/${workspace._id}/boards`}
										className="font-semibold text-jet-black-700 hover:text-jet-black-900"
									>
										Boards
									</Link>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
