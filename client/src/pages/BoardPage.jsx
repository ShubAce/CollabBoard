import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";

export default function BoardPage() {
	const { workspaceId, boardId } = useParams();
	const [board, setBoard] = useState(null);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");

	useEffect(() => {
		let isActive = true;
		const loadBoard = async () => {
			setStatus("loading");
			setError("");
			try {
				const { data } = await api.get(`/workspaces/${workspaceId}/boards/${boardId}`);
				if (isActive) {
					setBoard(data);
					setStatus("ready");
				}
			} catch (err) {
				if (isActive) {
					setError(err.response?.data?.message || "Failed to load board");
					setStatus("error");
				}
			}
		};

		if (workspaceId && boardId) {
			loadBoard();
		}
		return () => {
			isActive = false;
		};
	}, [workspaceId, boardId]);

	if (status === "loading") {
		return (
			<section className="rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
				<p className="text-sm text-slate-500">Loading board...</p>
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
					<h2 className="text-2xl font-semibold text-slate-900 font-['Fraunces']">{board?.name}</h2>
					<p className="mt-1 text-sm text-slate-500">Drag and drop will be added in Phase 3.</p>
				</div>
				<Link
					to={`/app/workspaces/${workspaceId}/boards`}
					className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
				>
					Back to boards
				</Link>
			</div>

			<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{board?.columns?.map((column) => (
					<div
						key={column._id}
						className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3"
					>
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
							<span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
								{column.tasks?.length || 0}
							</span>
						</div>
						<div className="mt-3 space-y-3">
							{column.tasks?.length ? (
								column.tasks.map((task) => (
									<div
										key={task._id}
										className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm"
									>
										<h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
										{task.description && <p className="mt-1 text-xs text-slate-500">{task.description}</p>}
										{task.assignees?.length ? (
											<p className="mt-2 text-xs text-slate-500">
												Assignees: {task.assignees.map((assignee) => assignee.name).join(", ")}
											</p>
										) : null}
									</div>
								))
							) : (
								<p className="text-xs text-slate-500">No tasks yet.</p>
							)}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
