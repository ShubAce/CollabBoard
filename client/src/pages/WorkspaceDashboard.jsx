import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";

export default function WorkspaceDashboard() {
	const { workspaceId } = useParams();
	const [workspace, setWorkspace] = useState(null);
	const [boards, setBoards] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");

	useEffect(() => {
		let isActive = true;
		const loadData = async () => {
			setStatus("loading");
			setError("");
			try {
				const [workspaceRes, boardsRes] = await Promise.all([
					api.get(`/workspaces/${workspaceId}`),
					api.get(`/workspaces/${workspaceId}/boards`),
				]);
				if (isActive) {
					setWorkspace(workspaceRes.data);
					setBoards(boardsRes.data);
					setStatus("ready");
				}
			} catch (err) {
				if (isActive) {
					setError(err.response?.data?.message || "Failed to load workspace");
					setStatus("error");
				}
			}
		};

		if (workspaceId) {
			loadData();
		}
		return () => {
			isActive = false;
		};
	}, [workspaceId]);

	if (status === "loading") {
		return (
			<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
				<p className="text-sm text-slate-500">Loading workspace...</p>
			</section>
		);
	}

	if (error) {
		return (
			<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
				<p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
			</section>
		);
	}

	return (
		<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-slate-900 font-['Fraunces']">{workspace?.name}</h2>
					<p className="mt-1 text-sm text-slate-500">{workspace?.description || "No description"}</p>
				</div>
				<Link
					className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
					to={`/app/workspaces/${workspaceId}/boards`}
				>
					View boards
				</Link>
			</div>

			<div className="mt-6 grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
					<h3 className="text-lg font-semibold text-slate-900">Members</h3>
					{workspace?.members?.length ? (
						<ul className="mt-3 space-y-2 text-sm">
							{workspace.members.map((member) => (
								<li
									key={member.user?._id || member.user}
									className="flex items-center justify-between gap-3"
								>
									<span>{member.user?.name || "Unknown"}</span>
									<span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
										{member.role}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-3 text-sm text-slate-500">No members yet.</p>
					)}
				</div>
				<div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
					<h3 className="text-lg font-semibold text-slate-900">Boards</h3>
					{boards.length ? (
						<ul className="mt-3 space-y-2 text-sm">
							{boards.map((board) => (
								<li key={board._id}>
									<Link
										to={`/app/workspaces/${workspaceId}/boards/${board._id}`}
										className="font-semibold text-slate-700 hover:text-slate-900"
									>
										{board.name}
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-3 text-sm text-slate-500">No boards yet.</p>
					)}
				</div>
			</div>
		</section>
	);
}
