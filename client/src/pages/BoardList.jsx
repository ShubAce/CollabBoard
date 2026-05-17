import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";

export default function BoardList() {
	const { workspaceId } = useParams();
	const [boards, setBoards] = useState([]);
	const [workspaceName, setWorkspaceName] = useState("");
	const [newBoard, setNewBoard] = useState("");
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const loadBoards = async () => {
		setStatus("loading");
		setError("");
		try {
			const [workspaceRes, boardsRes] = await Promise.all([
				api.get(`/workspaces/${workspaceId}`),
				api.get(`/workspaces/${workspaceId}/boards`),
			]);
			setWorkspaceName(workspaceRes.data?.name || "");
			setBoards(boardsRes.data);
			setStatus("ready");
		} catch (err) {
			setError(err.response?.data?.message || "Failed to load boards");
			setStatus("error");
		}
	};

	useEffect(() => {
		if (workspaceId) {
			loadBoards();
		}
	}, [workspaceId]);

	const handleCreate = async (event) => {
		event.preventDefault();
		if (!newBoard.trim()) return;
		setIsSubmitting(true);
		try {
			const { data } = await api.post(`/workspaces/${workspaceId}/boards`, { name: newBoard.trim() });
			setNewBoard("");
			setBoards((prev) => [data, ...prev]);
		} catch (err) {
			setError(err.response?.data?.message || "Failed to create board");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-6 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-2xl font-semibold text-jet-black-900 font-display">{workspaceName ? `${workspaceName} boards` : "Boards"}</h2>
					<p className="mt-1 text-sm text-jet-black-500">Create and manage boards for this workspace.</p>
				</div>
				<Link
					to={`/app/workspaces/${workspaceId}`}
					className="inline-flex items-center justify-center rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
				>
					Workspace overview
				</Link>
			</div>

			<form
				className="mt-6 flex flex-wrap gap-3"
				onSubmit={handleCreate}
			>
				<input
					value={newBoard}
					onChange={(event) => setNewBoard(event.target.value)}
					placeholder="Board name"
					required
					className="min-w-[220px] flex-1 rounded-xl border border-ghost-white-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-space-indigo-400/30"
				/>
				<button
					type="submit"
					disabled={isSubmitting}
					className="rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-60"
				>
					{isSubmitting ? "Creating..." : "Create board"}
				</button>
			</form>

			{status === "loading" && <p className="mt-4 text-sm text-jet-black-500">Loading boards...</p>}
			{error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

			{status === "ready" && boards.length === 0 && <p className="mt-4 text-sm text-jet-black-500">No boards yet.</p>}

			{boards.length > 0 && (
				<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{boards.map((board) => (
						<div
							key={board._id}
							className="flex flex-col justify-between gap-4 rounded-xl border border-ghost-white-200 bg-ghost-white-100/70 p-4"
						>
							<div>
								<h3 className="text-lg font-semibold text-jet-black-900">{board.name}</h3>
								<p className="mt-1 text-sm text-jet-black-500">{board.columns?.length || 0} columns</p>
							</div>
							<div className="flex flex-wrap items-center gap-3 text-sm">
								<Link
									to={`/app/workspaces/${workspaceId}/boards/${board._id}`}
									className="font-semibold text-jet-black-700 hover:text-jet-black-900"
								>
									Open board
								</Link>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
