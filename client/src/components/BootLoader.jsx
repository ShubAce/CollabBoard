/** Full-screen branded loader: session checks and lazy route chunks. */
export default function BootLoader({ label = "Loading…" }) {
	return (
		<div style={{ minHeight: "100dvh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			<div
				className="fade-in"
				style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
			>
				<div className="boot-logo">
					<img
						src="/logo.png"
						alt=""
						style={{ width: 34, height: 34, objectFit: "contain" }}
					/>
				</div>
				<div className="boot-bar" />
				<p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{label}</p>
			</div>
		</div>
	);
}
