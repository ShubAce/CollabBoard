import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

export default function LandingPage() {
	const navigate = useNavigate();
	const accessToken = useAuthStore((s) => s.accessToken);
	const user = useAuthStore((s) => s.user);
	const [scrolled, setScrolled] = useState(false);

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
			{/* Navbar */}
			<nav
				style={{
					position: "fixed", top: 0, width: "100%", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between",
					padding: "0 32px", height: 64,
					background: scrolled ? "rgba(15,17,23,0.85)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none",
					borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent", transition: "all 0.3s"
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 32 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<Icon name="spark" size={24} style={{ color: "var(--accent)" }} />
						<span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>CollabBoard</span>
					</div>
					<div style={{ display: "none", alignItems: "center", gap: 24, "@media (minWidth: 768px)": { display: "flex" } }} className="desktop-nav">
						{["Features", "Pricing", "Resources", "Docs"].map(link => (
							<a key={link} href={`#${link.toLowerCase()}`} style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = "var(--text-primary)"} onMouseLeave={e => e.target.style.color = "var(--text-secondary)"}>{link}</a>
						))}
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<Link to="/login" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = "var(--text-primary)"} onMouseLeave={e => e.target.style.color = "var(--text-secondary)"}>Log in</Link>
					<Link to="/register" className="btn btn-primary" style={{ fontSize: 14, padding: "8px 16px" }}>Get started</Link>
				</div>
			</nav>

			{/* Hero */}
			<section style={{ paddingTop: 140, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
				<div className="grid-pattern" style={{ position: "absolute", inset: 0, opacity: 0.08, pointerEvents: "none" }} />
				<div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 60%)", top: "50%", left: "50%", transform: "translate(-50%, -60%)", pointerEvents: "none" }} />
				
				<div style={{ position: "relative", maxWidth: 840, margin: "0 auto" }}>
					<div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: "var(--r-full)", padding: "6px 16px", fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 32 }}>
						<Icon name="spark" size={14} /> Introducing CollabBoard 2.0
					</div>
					<h1 style={{ fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1, margin: 0, letterSpacing: "-0.04em" }}>
						Where agile teams <br /> <span style={{ color: "var(--accent)" }}>build the future.</span>
					</h1>
					<p style={{ fontSize: "clamp(18px, 2vw, 22px)", color: "var(--text-secondary)", marginTop: 24, lineHeight: 1.5, maxWidth: 640, margin: "24px auto 0" }}>
						Kanban boards, real-time whiteboards, and team chat perfectly integrated into one blazing-fast workspace.
					</p>
					<div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
						<Link to="/register" className="btn btn-primary btn-lg" style={{ padding: "14px 28px", fontSize: 16 }}>Start your workspace</Link>
						<button className="btn btn-ghost btn-lg" style={{ padding: "14px 28px", fontSize: 16, border: "1px solid var(--border-default)" }}>Book a demo</button>
					</div>
				</div>

				{/* Trusted By */}
				<div style={{ marginTop: 80, borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", padding: "32px 0", background: "rgba(0,0,0,0.1)" }}>
					<p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 24, margin: "0 0 24px" }}>Trusted by innovative teams</p>
					<div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "clamp(24px, 6vw, 64px)", flexWrap: "wrap", opacity: 0.5, filter: "grayscale(100%)" }}>
						{["Acme Corp", "Globex", "Initech", "Soylent", "Umbrella"].map(logo => (
							<span key={logo} style={{ fontSize: 20, fontWeight: 700, fontFamily: "serif", letterSpacing: "-0.02em", color: "var(--text-secondary)" }}>{logo}</span>
						))}
					</div>
				</div>
			</section>

			{/* Alternating Features */}
			<section id="features" style={{ padding: "80px 24px", display: "flex", flexDirection: "column", gap: 120, maxWidth: 1100, margin: "0 auto" }}>
				{[
					{
						title: "Organize anything with Kanban",
						desc: "Track tasks, bugs, and features with highly customizable boards. Everything syncs instantly to your team, with rich text descriptions, attachments, and due dates.",
						icon: "kanban",
						align: "left",
						visual: (
							<div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 24, height: 320, boxShadow: "var(--shadow-card)", position: "relative" }}>
								<div style={{ display: "flex", gap: 16, height: "100%" }}>
									{["To Do", "In Progress", "Done"].map((col, i) => (
										<div key={col} style={{ flex: 1, background: "var(--bg-surface-1)", borderRadius: "var(--r-md)", padding: 12, borderTop: `3px solid ${["#8B8FA8", "#60A5FA", "#34D399"][i]}` }}>
											<div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>{col}</div>
											{i === 0 && <div style={{ background: "var(--bg-surface)", padding: 10, borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)", fontSize: 12, marginBottom: 8, boxShadow: "var(--shadow-sm)" }}>Update homepage copy</div>}
											{i === 1 && <div style={{ background: "var(--bg-surface)", padding: 10, borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)", fontSize: 12, marginBottom: 8, boxShadow: "var(--shadow-sm)" }}>Design system tokens</div>}
										</div>
									))}
								</div>
							</div>
						)
					},
					{
						title: "Brainstorm on infinite Whiteboards",
						desc: "Map out user flows, architecture diagrams, and brainstorms. See your teammates' cursors fly across the screen as you draw and ideate together in real time.",
						icon: "whiteboard",
						align: "right",
						visual: (
							<div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 24, height: 320, boxShadow: "var(--shadow-card)", position: "relative", overflow: "hidden" }}>
								<div style={{ position: "absolute", top: 60, left: 60, width: 120, height: 80, background: "rgba(108,99,255,0.2)", border: "2px solid var(--accent)", borderRadius: "var(--r-md)" }} />
								<div style={{ position: "absolute", top: 180, left: 240, width: 140, height: 90, background: "rgba(52,211,153,0.2)", border: "2px solid var(--success)", borderRadius: "var(--r-md)" }} />
								<svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
									<path d="M 180 100 C 220 100, 200 220, 240 220" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="4 4" />
								</svg>
								<div style={{ position: "absolute", top: 90, left: 160, display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: 11, fontWeight: 600, boxShadow: "var(--shadow-sm)" }}>
									<Icon name="cursor" size={12} /> Sarah
								</div>
							</div>
						)
					},
					{
						title: "Contextual team Chat",
						desc: "Stop context switching. Keep conversations right where the work happens. Featuring rich text formatting, file attachments, and thread replies to keep things organized.",
						icon: "chat",
						align: "left",
						visual: (
							<div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderRadius: "var(--r-lg)", padding: 24, height: 320, boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
								<div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
									<div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
									<div>
										<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Alex</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>10:42 AM</span></div>
										<div style={{ background: "var(--bg-surface-3)", padding: "8px 12px", borderRadius: "0 12px 12px 12px", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>The new staging environment is up! 🚀</div>
									</div>
								</div>
								<div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: "row-reverse" }}>
									<div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
									<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
										<div style={{ display: "flex", alignItems: "baseline", gap: 8, flexDirection: "row-reverse" }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>You</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>10:45 AM</span></div>
										<div style={{ background: "var(--accent)", padding: "8px 12px", borderRadius: "12px 0 12px 12px", fontSize: 13, color: "#fff", marginTop: 4 }}>Awesome, I will review the PRs now.</div>
									</div>
								</div>
							</div>
						)
					}
				].map((f, idx) => (
					<div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 60, alignItems: "center", direction: f.align === "right" ? "rtl" : "ltr" }}>
						<div style={{ direction: "ltr" }}>
							<div style={{ width: 48, height: 48, borderRadius: "var(--r-lg)", background: "var(--accent-muted)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
								<Icon name={f.icon} size={24} />
							</div>
							<h2 style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{f.title}</h2>
							<p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.6 }}>{f.desc}</p>
						</div>
						<div style={{ direction: "ltr" }}>
							{f.visual}
						</div>
					</div>
				))}
			</section>

			{/* CTA Strip */}
			<section style={{ padding: "80px 24px", background: "linear-gradient(180deg, var(--bg-base) 0%, rgba(108,99,255,0.08) 100%)", textAlign: "center", borderTop: "1px solid var(--border-subtle)" }}>
				<div style={{ maxWidth: 640, margin: "0 auto" }}>
					<h2 style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, letterSpacing: "-0.02em" }}>Ready to work better together?</h2>
					<p style={{ fontSize: 18, color: "var(--text-secondary)", marginBottom: 40 }}>Join thousands of teams already using CollabBoard to ship faster and collaborate seamlessly.</p>
					<Link to="/register" className="btn btn-primary btn-lg" style={{ padding: "16px 40px", fontSize: 16, borderRadius: "var(--r-full)" }}>Get started for free</Link>
					<p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>No credit card required. Free forever plan available.</p>
				</div>
			</section>

			{/* Footer */}
			<footer style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)", paddingTop: 64, paddingBottom: 32 }}>
				<div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 48, marginBottom: 64 }}>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
							<Icon name="spark" size={20} style={{ color: "var(--accent)" }} />
							<span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>CollabBoard</span>
						</div>
						<p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>The ultimate workspace for modern agile teams to plan, collaborate, and ship faster.</p>
					</div>
					<div>
						<h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Product</h4>
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{["Features", "Integrations", "Pricing", "Changelog", "Docs"].map(l => <a key={l} href="#" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>{l}</a>)}
						</div>
					</div>
					<div>
						<h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Company</h4>
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{["About Us", "Careers", "Blog", "Contact"].map(l => <a key={l} href="#" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>{l}</a>)}
						</div>
					</div>
					<div>
						<h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Legal</h4>
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{["Privacy Policy", "Terms of Service", "Cookie Policy"].map(l => <a key={l} href="#" style={{ fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>{l}</a>)}
						</div>
					</div>
				</div>
				<div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, borderTop: "1px solid var(--border-subtle)", paddingTop: 32 }}>
					<p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>© 2025 CollabBoard. Built with MERN.</p>
					<div style={{ display: "flex", gap: 16 }}>
						<Icon name="github" size={20} style={{ color: "var(--text-muted)" }} />
						<Icon name="twitter" size={20} style={{ color: "var(--text-muted)" }} />
					</div>
				</div>
			</footer>
		</div>
	);
}
