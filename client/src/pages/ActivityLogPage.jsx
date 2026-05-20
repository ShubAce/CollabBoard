import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";

const formatGroupLabel = (value) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Earlier";
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	if (date.toDateString() === today.toDateString()) return "Today";
	if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatTime = (value) => {
	if (!value) return "";
	return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function ActivityLogPage() {
	const { workspaceId } = useParams();
	const [activity, setActivity] = useState([]);
	const [status, setStatus] = useState("loading");
	const [error, setError] = useState("");

	useEffect(() => {
		if (!workspaceId) return;
		let active = true;
		setStatus("loading");
		setError("");
		api.get(`/workspaces/${workspaceId}/activity?limit=50`)
			.then(({ data }) => {
				if (!active) return;
				setActivity(data.activity || []);
				setStatus("ready");
			})
			.catch((err) => {
				if (!active) return;
				setError(err.response?.data?.message || "Failed to load activity");
				setStatus("error");
			});
		return () => {
			active = false;
		};
	}, [workspaceId]);

	const grouped = useMemo(() => {
		return activity.reduce((acc, item) => {
			const label = formatGroupLabel(item.createdAt);
			if (!acc[label]) acc[label] = [];
			acc[label].push(item);
			return acc;
		}, {});
	}, [activity]);

	return (
		<section
			className="fade-in"
			style={{ display: "flex", flexDirection: "column", gap: 18 }}
		>
			<div
				className="page-panel"
				style={{ padding: 20 }}
			>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
					<div>
						<h1 className="page-title">Activity Log</h1>
						<p className="page-subtitle">Every change across this workspace.</p>
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
						<select
							className="input"
							style={{ width: 160 }}
							disabled
						>
							<option>All members</option>
						</select>
						<select
							className="input"
							style={{ width: 160 }}
							disabled
						>
							<option>All boards</option>
						</select>
						<select
							className="input"
							style={{ width: 160 }}
							disabled
						>
							<option>Date range</option>
						</select>
					</div>
				</div>
			</div>

			{status === "loading" && (
				<div
					className="card"
					style={{ padding: 24 }}
				>
					{[1, 2, 3].map((item) => (
						<div
							key={item}
							className="skeleton"
							style={{ height: 24, marginBottom: 12 }}
						/>
					))}
				</div>
			)}

			{status === "error" && <div className="message-error">{error}</div>}

			{status === "ready" && activity.length === 0 && (
				<div
					className="card"
					style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}
				>
					No activity yet.
				</div>
			)}

			{status === "ready" && activity.length > 0 && (
				<div
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					{Object.entries(grouped).map(([label, items]) => (
						<div key={label}>
							<div
								style={{
									padding: "10px 12px",
									fontSize: 11,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									letterSpacing: "0.08em",
								}}
							>
								{label}
							</div>
							{items.map((log, index) => (
								<div
									key={log._id || `${label}-${index}`}
									style={{
										display: "grid",
										gridTemplateColumns: "minmax(0, 1fr) auto",
										gap: 12,
										padding: "12px 16px",
										borderBottom: "1px solid var(--border-subtle)",
									}}
								>
									<div style={{ minWidth: 0 }}>
										<p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
											<span style={{ fontWeight: 600 }}>{log.actor?.name || "Unknown"}</span>{" "}
											{log.action?.replace(/[_\.]/g, " ") || "updated"}
										</p>
										{log.taskTitle && (
											<p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Task: {log.taskTitle}</p>
										)}
									</div>
									<span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatTime(log.createdAt)}</span>
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</section>
	);
}
