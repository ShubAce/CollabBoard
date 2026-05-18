import { Link } from "react-router-dom";

export default function NotFoundPage() {
	return (
		<div
			className="fade-in"
			style={{
				minHeight: "100vh",
				background: "var(--bg-base)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
			}}
		>
			<div style={{ textAlign: "center", maxWidth: 420 }}>
				<div style={{ fontSize: 80, fontWeight: 800, color: "var(--border)", lineHeight: 1, marginBottom: 16, letterSpacing: "-4px" }}>404</div>
				<h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px" }}>Page not found</h1>
				<p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
					The page you're looking for doesn't exist or has been moved.
				</p>
				<div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
					<Link to="/" className="btn btn-primary btn-sm">← Back to home</Link>
					<Link to="/app" className="btn btn-ghost btn-sm">Dashboard</Link>
				</div>
			</div>
		</div>
	);
}
