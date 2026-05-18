import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

const FEATURES = [
	{
		icon: "spark",
		title: "Real-time sync",
		desc: "Changes appear instantly for every team member. No refreshing required.",
	},
	{
		icon: "whiteboard",
		title: "Live whiteboard",
		desc: "Draw together, see each other's cursors move live across the canvas.",
	},
	{
		icon: "chat",
		title: "Team chat",
		desc: "One chat room per workspace with @mentions and typing indicators.",
	},
];

const MOCK_TASKS = [
	{ col: 0, title: "Fix login bug", priority: "#F87171", width: "34%" },
	{ col: 1, title: "Design nav component", priority: "#FBBF24", width: "39%" },
	{ col: 1, title: "Setup CI pipeline", priority: "#FB923C", width: "32%" },
	{ col: 2, title: "Review PR #42", priority: "#34D399", width: "30%" },
	{ col: 3, title: "Deploy to staging", priority: "#34D399", width: "36%" },
];

function FeatureCard({ icon, title, desc }) {
	return (
		<div
			style={{
				background: "var(--bg-surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius-lg)",
				padding: "28px 24px",
				display: "flex",
				flexDirection: "column",
				gap: 12,
				flex: 1,
				minWidth: 200,
				boxShadow: "var(--shadow-card)",
				transition: "transform 0.2s, box-shadow 0.2s",
				cursor: "default",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.transform = "translateY(-4px)";
				e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.transform = "translateY(0)";
				e.currentTarget.style.boxShadow = "var(--shadow-card)";
			}}
		>
			<span className="icon-box icon-box-accent" style={{ width: 42, height: 42 }}>
				<Icon name={icon} size={22} />
			</span>
			<p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{title}</p>
			<p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{desc}</p>
		</div>
	);
}

export default function LandingPage() {
	const navigate = useNavigate();
	const accessToken = useAuthStore((s) => s.accessToken);
	const user = useAuthStore((s) => s.user);
	const [scrolled, setScrolled] = useState(false);

	// Redirect if already logged in
	useEffect(() => {
		if (accessToken && user) navigate("/app/workspaces", { replace: true });
	}, [accessToken, user, navigate]);

	useEffect(() => {
		const handler = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handler);
		return () => window.removeEventListener("scroll", handler);
	}, []);

	return (
		<div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>
			{/* ── Navbar ── */}
			<nav
				style={{
					position: "sticky",
					top: 0,
					zIndex: 50,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 32px",
					height: 60,
					background: scrolled ? "rgba(15,17,23,0.85)" : "transparent",
					backdropFilter: scrolled ? "blur(12px)" : "none",
					borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
					transition: "all 0.3s",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<Icon name="spark" size={22} style={{ color: "var(--accent)" }} />
					<span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>CollabBoard</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<Link
						to="/login"
						style={{
							color: "var(--text-secondary)",
							fontSize: 14,
							fontWeight: 500,
							textDecoration: "none",
							padding: "6px 12px",
							borderRadius: "var(--radius-md)",
							transition: "color 0.15s",
						}}
						onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
						onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
					>
						Log in
					</Link>
					<Link to="/register" className="btn btn-primary" style={{ fontSize: 14 }}>
						Get started
					</Link>
				</div>
			</nav>

			{/* ── Hero ── */}
			<section
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
					padding: "80px 24px 60px",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* Grid pattern bg */}
				<div
					className="grid-pattern"
					style={{
						position: "absolute",
						inset: 0,
						opacity: 0.06,
						pointerEvents: "none",
					}}
				/>

				{/* Glow blobs */}
				<div
					style={{
						position: "absolute",
						width: 600,
						height: 600,
						borderRadius: "50%",
						background: "radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -60%)",
						pointerEvents: "none",
					}}
				/>

				<div style={{ position: "relative", maxWidth: 760 }}>
					<div
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							background: "var(--accent-muted)",
							border: "1px solid rgba(108,99,255,0.3)",
							borderRadius: "var(--radius-full)",
							padding: "4px 14px",
							fontSize: 12,
							fontWeight: 500,
							color: "var(--accent)",
							marginBottom: 24,
						}}
					>
						<Icon name="spark" size={14} /> Real-time collaboration
					</div>

					<h1
						style={{
							fontSize: "clamp(40px, 6vw, 72px)",
							fontWeight: 700,
							color: "var(--text-primary)",
							lineHeight: 1.15,
							margin: 0,
						}}
					>
						Work together.
						<br />
						<span style={{ color: "var(--accent)" }}>In real time.</span>
					</h1>

					<p
						style={{
							fontSize: 18,
							color: "var(--text-secondary)",
							marginTop: 20,
							lineHeight: 1.6,
							maxWidth: 540,
							margin: "20px auto 0",
						}}
					>
						Kanban boards, shared whiteboard, and team chat - all synced live across your whole team.
					</p>

					<div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 36, flexWrap: "wrap" }}>
						<Link to="/register" className="btn btn-primary btn-lg">
							Get started free
						</Link>
						<Link
							to="/login"
							className="btn btn-ghost btn-lg"
							style={{ borderColor: "var(--border)" }}
						>
							Watch demo ▶
						</Link>
					</div>

					{/* Mock screenshot card */}
					<div
						style={{
							marginTop: 56,
							background: "var(--bg-surface)",
							border: "1px solid var(--border)",
							borderRadius: "var(--radius-xl)",
							padding: 24,
							boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
							transform: "perspective(1200px) rotateX(4deg)",
							maxWidth: 800,
							width: "100%",
						}}
					>
						{/* Fake board header */}
						<div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
							{["To Do", "In Progress", "Review", "Done"].map((col, i) => {
								const colors = ["#8B8FA8", "#60A5FA", "#A78BFA", "#34D399"];
								return (
									<div
										key={col}
										style={{
											flex: 1,
											background: "var(--bg-base)",
											borderRadius: "var(--radius-md)",
											padding: "8px 10px",
											borderTop: `3px solid ${colors[i]}`,
											fontSize: 12,
											fontWeight: 600,
											color: colors[i],
										}}
									>
										{col}
									</div>
								);
							})}
						</div>
						{/* Fake task cards */}
						{MOCK_TASKS.map((t, i) => (
							<div
								key={i}
								style={{
									background: "var(--bg-surface-2)",
									border: "1px solid var(--border)",
									borderRadius: "var(--radius-sm)",
									padding: "8px 10px",
									fontSize: 12,
									color: "var(--text-primary)",
									marginBottom: 6,
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									width: t.width,
									marginLeft: `${t.col * 25}%`,
								}}
							>
								<span style={{ width: 7, height: 7, borderRadius: "50%", background: t.priority }} /> {t.title}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Features ── */}
			<section
				style={{
					padding: "64px 32px",
					maxWidth: 1000,
					margin: "0 auto",
					width: "100%",
				}}
			>
				<h2
					style={{
						textAlign: "center",
						fontSize: 14,
						fontWeight: 600,
						color: "var(--text-muted)",
						textTransform: "uppercase",
						letterSpacing: "0.1em",
						marginBottom: 40,
					}}
				>
					Everything your team needs
				</h2>
				<div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
					{FEATURES.map((f) => (
						<FeatureCard key={f.title} {...f} />
					))}
				</div>
			</section>

			{/* ── Footer ── */}
			<footer
				style={{
					textAlign: "center",
					padding: "24px 32px",
					borderTop: "1px solid var(--border)",
					fontSize: 13,
					color: "var(--text-muted)",
				}}
			>
				2025 CollabBoard / Built with MERN + Socket.io + Redis
			</footer>
		</div>
	);
}
