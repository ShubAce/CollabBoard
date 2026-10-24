/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import { fadeUp, staggerContainer } from "../lib/motion";

const AVATAR_COLORS = ["#3b82f6", "#60a5fa", "#3dd68c", "#ff6b6b", "#f0c040", "#2dd4bf", "#ff8c42", "#f472b6"];

const GROUP_HEADER_STYLE = {
	padding: "10px 16px 6px",
	fontSize: 11,
	fontWeight: 600,
	color: "var(--text-muted)",
	textTransform: "uppercase",
	letterSpacing: "0.08em",
	background: "var(--bg-surface-2)",
	borderBottom: "1px solid var(--border-subtle)",
};

// Compact padding so all three filters fit on one row at phone width.
const SELECT_STYLE = { width: "100%", minWidth: 0, fontSize: 13, paddingLeft: 10, paddingRight: 28, backgroundPosition: "right 8px center" };

const getInitials = (name = "") =>
	name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

const getColor = (name = "") => {
	let hash = 0;
	for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

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

function ActivitySkeleton() {
	return (
		<div aria-hidden="true">
			<div style={GROUP_HEADER_STYLE}>
				<div
					className="skeleton"
					style={{ height: 10, width: 48, margin: "2px 0" }}
				/>
			</div>
			{[0.55, 0.4, 0.62, 0.35, 0.5].map((width, index) => (
				<div
					key={index}
					style={{
						display: "grid",
						gridTemplateColumns: "28px minmax(0, 1fr) auto",
						alignItems: "center",
						gap: 12,
						padding: "12px 16px",
						borderBottom: "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="skeleton"
						style={{ width: 28, height: 28, borderRadius: "50%" }}
					/>
					<div>
						<div
							className="skeleton"
							style={{ height: 12, width: `${width * 100}%`, marginBottom: 8 }}
						/>
						<div
							className="skeleton"
							style={{ height: 10, width: `${width * 70}%` }}
						/>
					</div>
					<div
						className="skeleton"
						style={{ height: 10, width: 44 }}
					/>
				</div>
			))}
		</div>
	);
}

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
		<motion.section
			variants={staggerContainer(0.08)}
			initial="hidden"
			animate="show"
			style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960, margin: "0 auto" }}
		>
			<motion.div
				variants={fadeUp}
				style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
			>
				<div style={{ minWidth: 0 }}>
					<h1 className="page-title">Activity Log</h1>
					<p className="page-subtitle">Every change across this workspace.</p>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
						gap: 8,
						flex: "1 1 360px",
						maxWidth: 480,
					}}
				>
					<select
						className="input"
						aria-label="Filter by member"
						style={SELECT_STYLE}
						disabled
					>
						<option>All members</option>
					</select>
					<select
						className="input"
						aria-label="Filter by board"
						style={SELECT_STYLE}
						disabled
					>
						<option>All boards</option>
					</select>
					<select
						className="input"
						aria-label="Filter by date"
						style={SELECT_STYLE}
						disabled
					>
						<option>Date range</option>
					</select>
				</div>
			</motion.div>

			{status === "loading" && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					<ActivitySkeleton />
				</motion.div>
			)}

			{status === "error" && (
				<motion.div
					variants={fadeUp}
					className="message-error"
				>
					{error}
				</motion.div>
			)}

			{status === "ready" && activity.length === 0 && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: "56px 24px", textAlign: "center" }}
				>
					<div className="icon-box icon-box-accent empty-state-icon empty-float">
						<Icon
							name="activity"
							size={22}
						/>
					</div>
					<p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No activity yet.</p>
					<p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Changes to boards, tasks and members will show up here.</p>
				</motion.div>
			)}

			{status === "ready" && activity.length > 0 && (
				<motion.div
					variants={fadeUp}
					className="card"
					style={{ padding: 0, overflow: "hidden" }}
				>
					<motion.div
						variants={staggerContainer(0.035, 0.1)}
						initial="hidden"
						animate="show"
					>
						{Object.entries(grouped).map(([label, items]) => (
							<div key={label}>
								<motion.div
									variants={fadeUp}
									style={GROUP_HEADER_STYLE}
								>
									{label}
								</motion.div>
								{items.map((log, index) => (
									<motion.div
										key={log._id || `${label}-${index}`}
										variants={fadeUp}
										className="row-hover"
										style={{
											display: "grid",
											gridTemplateColumns: "28px minmax(0, 1fr) auto",
											alignItems: "start",
											gap: 12,
											padding: "12px 16px",
											borderBottom: "1px solid var(--border-subtle)",
										}}
									>
										<div
											aria-hidden="true"
											style={{
												width: 28,
												height: 28,
												borderRadius: "50%",
												background: getColor(log.actor?.name || ""),
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: 10,
												fontWeight: 700,
												color: "#fff",
											}}
										>
											{getInitials(log.actor?.name || "?")}
										</div>
										<div style={{ minWidth: 0, paddingTop: 4 }}>
											<p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, overflowWrap: "anywhere" }}>
												<span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.actor?.name || "Unknown"}</span>{" "}
												{log.action?.replace(/[_.]/g, " ") || "updated"}
											</p>
											{log.taskTitle && (
												<p
													style={{
														margin: "4px 0 0",
														fontSize: 12,
														color: "var(--text-muted)",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													Task: <span style={{ color: "var(--text-secondary)" }}>{log.taskTitle}</span>
												</p>
											)}
										</div>
										<span style={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 6, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
											{formatTime(log.createdAt)}
										</span>
									</motion.div>
								))}
							</div>
						))}
					</motion.div>
				</motion.div>
			)}
		</motion.section>
	);
}
