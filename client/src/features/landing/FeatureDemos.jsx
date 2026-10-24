import { useRef } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView } from "framer-motion";
import useMeasure from "react-use-measure";
import Icon from "../../components/ui/Icon.jsx";
import useLoop from "../../hooks/useLoop";
import { EASE_OUT } from "../../lib/motion";

const CARD_SPRING = { type: "spring", stiffness: 260, damping: 26 };

/** Draws children on a fixed design canvas and scales it to the available width. */
function ScaledStage({ width, height, children, className = "", style }) {
	const [ref, bounds] = useMeasure();
	const scale = bounds.width ? bounds.width / width : 1;
	return (
		<div
			ref={ref}
			className={className}
			style={{ position: "relative", height: height * scale, ...style }}
		>
			<div style={{ position: "absolute", top: 0, left: 0, width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
		</div>
	);
}

/* ── Kanban ─────────────────────────────────────────────────────────── */

const KANBAN_CARDS = {
	copy: { title: "Update homepage copy", tags: [["Urgent", "#ff6b6b"], ["Design", "#60a5fa"]], people: ["#60a5fa"], meta: "paperclip" },
	auth: { title: "Implement OAuth login", tags: [["Feature", "#3dd68c"]], people: ["#f472b6", "#f0c040"], meta: "chat", count: 3 },
	nav: { title: "Fix mobile nav overflow", tags: [["Bug", "#ff8c42"]], people: ["#2dd4bf"], meta: "clock" },
};

const RESTING_SHADOW = "0 6px 18px rgba(0,0,0,0.3), 0 0 0 0px rgba(59, 130, 246,0)";
const LIFTED_SHADOW = "0 16px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(59, 130, 246,0.6)";

// The travelling card remounts in its new column (shared layoutId), so its
// mount animation doubles as the "picked up → dropped" moment (UI.md §18.1).
function KanbanCard({ id, lifted }) {
	const card = KANBAN_CARDS[id];
	return (
		<motion.div
			layoutId={`kanban-demo-${id}`}
			className="lp-card"
			initial={lifted ? { rotate: 3, scale: 1.05, boxShadow: LIFTED_SHADOW } : false}
			animate={{ rotate: 0, scale: 1, boxShadow: RESTING_SHADOW }}
			transition={{ layout: CARD_SPRING, default: { delay: 0.45, ...CARD_SPRING } }}
			style={{ position: "relative", zIndex: lifted ? 5 : 1 }}
		>
			<div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
				{card.tags.map(([label, color]) => (
					<span
						key={label}
						className="lp-tag"
						style={{ background: `${color}22`, color }}
					>
						{label}
					</span>
				))}
			</div>
			<div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{card.title}</div>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text-muted)", fontSize: 11 }}>
				<span style={{ display: "flex", alignItems: "center", gap: 4 }}>
					<Icon
						name={card.meta}
						size={12}
					/>
					{card.count}
				</span>
				<span style={{ display: "flex" }}>
					{card.people.map((color, i) => (
						<span
							key={color}
							style={{ width: 18, height: 18, borderRadius: "50%", background: color, marginLeft: i ? -6 : 0, boxShadow: "0 0 0 2px var(--bg-surface-1)" }}
						/>
					))}
				</span>
			</div>
		</motion.div>
	);
}

export function KanbanDemo() {
	const ref = useRef(null);
	const inView = useInView(ref, { margin: "-15% 0px" });
	const step = useLoop(inView, 2, 2800);
	const columns = [
		{ title: "To Do", color: "var(--col-todo)", cards: step === 0 ? ["copy", "nav"] : ["nav"] },
		{ title: "In Progress", color: "var(--col-inprogress)", cards: step === 0 ? ["auth"] : ["copy", "auth"] },
	];
	return (
		<div
			ref={ref}
			className="lp-panel"
			style={{ padding: 18 }}
		>
			<LayoutGroup id="kanban-demo">
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 300 }}>
					{columns.map((column) => (
						<div
							key={column.title}
							style={{ borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.025)", display: "flex", flexDirection: "column", gap: 10, borderTop: `2px solid ${column.color}` }}
						>
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", padding: "2px 2px 4px" }}>
								{column.title}
								<motion.span
									key={column.cards.length}
									initial={{ scale: 0.6, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}
								>
									{column.cards.length}
								</motion.span>
							</div>
							{column.cards.map((id) => (
								<KanbanCard
									key={id}
									id={id}
									lifted={id === "copy"}
								/>
							))}
						</div>
					))}
				</div>
			</LayoutGroup>
		</div>
	);
}

/* ── Whiteboard ─────────────────────────────────────────────────────── */

const WB_W = 480;
const WB_H = 340;
// Freehand ellipse a teammate keeps circling around the "Dashboard" node.
const ELLIPSE = { cx: 300, cy: 214, rx: 104, ry: 40 };
const ELLIPSE_PATH = `M ${ELLIPSE.cx + ELLIPSE.rx} ${ELLIPSE.cy} A ${ELLIPSE.rx} ${ELLIPSE.ry} 0 1 1 ${ELLIPSE.cx + ELLIPSE.rx - 0.1} ${ELLIPSE.cy - 0.5}`;
const ELLIPSE_POINTS = Array.from({ length: 17 }, (_, i) => {
	const t = (i / 16) * Math.PI * 2;
	return { x: ELLIPSE.cx + ELLIPSE.rx * Math.cos(t), y: ELLIPSE.cy + ELLIPSE.ry * Math.sin(t) };
});
const DRAW = { duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.2 };

function WbCursor({ name, color, animate, transition, initial }) {
	return (
		<motion.div
			className="lp-cursor"
			initial={initial}
			animate={animate}
			transition={transition}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill={color}
				stroke="#fff"
				strokeWidth="1.5"
				strokeLinejoin="round"
				style={{ marginLeft: -2, marginTop: -2 }}
			>
				<path d="M4 3l7.5 18 2.6-7.4L21.5 11 4 3Z" />
			</svg>
			<span
				className="lp-cursor-name"
				style={{ background: color }}
			>
				{name}
			</span>
		</motion.div>
	);
}

export function WhiteboardDemo() {
	const ref = useRef(null);
	const inView = useInView(ref, { once: true, margin: "-15% 0px" });
	const pop = (delay) => ({
		initial: { opacity: 0, scale: 0.8 },
		animate: inView ? { opacity: 1, scale: 1 } : {},
		transition: { type: "spring", stiffness: 300, damping: 20, delay },
	});
	return (
		<div
			ref={ref}
			className="lp-panel"
			style={{ background: "radial-gradient(circle at 50% 40%, #141418 0%, #08080a 100%)" }}
		>
			<ScaledStage
				width={WB_W}
				height={WB_H}
			>
				<div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

				<svg
					width={WB_W}
					height={WB_H}
					style={{ position: "absolute", inset: 0 }}
				>
					<motion.path
						d="M 178 108 C 236 108, 214 214, 250 214"
						fill="none"
						stroke="var(--text-muted)"
						strokeWidth="2"
						initial={{ pathLength: 0 }}
						animate={inView ? { pathLength: 1 } : {}}
						transition={{ duration: 1, ease: EASE_OUT, delay: 0.7 }}
					/>
					<motion.path
						d="M 243 208 L 252 214 L 243 220"
						fill="none"
						stroke="var(--text-muted)"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						initial={{ opacity: 0 }}
						animate={inView ? { opacity: 1 } : {}}
						transition={{ delay: 1.6 }}
					/>
					<motion.path
						d={ELLIPSE_PATH}
						fill="none"
						stroke="#f472b6"
						strokeWidth="2.5"
						strokeLinecap="round"
						initial={{ pathLength: 0 }}
						animate={inView ? { pathLength: [0, 1] } : {}}
						transition={{ ...DRAW, delay: 2 }}
					/>
				</svg>

				<motion.div
					{...pop(0.2)}
					style={{ position: "absolute", left: 66, top: 86, padding: "11px 18px", borderRadius: 10, background: "#18181c", border: "2px solid var(--blue)", fontSize: 14, fontWeight: 600, boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}
				>
					User Login
				</motion.div>
				<motion.div
					{...pop(0.45)}
					style={{ position: "absolute", left: 252, top: 192, padding: "11px 18px", borderRadius: 10, background: "#18181c", border: "2px solid var(--green)", fontSize: 14, fontWeight: 600, boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}
				>
					Dashboard
				</motion.div>
				<motion.div
					initial={{ opacity: 0, rotate: -10, y: 20 }}
					animate={inView ? { opacity: 1, rotate: 4, y: 0 } : {}}
					transition={{ type: "spring", stiffness: 200, damping: 14, delay: 1.1 }}
					style={{ position: "absolute", left: 330, top: 50, width: 110, padding: 12, borderRadius: 4, background: "#f0c040", color: "#3a2a00", fontSize: 12, fontWeight: 600, lineHeight: 1.35, boxShadow: "0 12px 24px rgba(0,0,0,0.4)" }}
				>
					Ship v2 before Friday 🚀
				</motion.div>

				{/* Toolbar */}
				<div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8, padding: 6, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
					{["pointer", "edit"].map((icon, i) => (
						<span
							key={icon}
							style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: i === 1 ? "var(--accent)" : "transparent", color: i === 1 ? "#fff" : "var(--text-muted)" }}
						>
							<Icon
								name={icon}
								size={14}
							/>
						</span>
					))}
					{["#f472b6", "#3dd68c", "#60a5fa"].map((color) => (
						<span
							key={color}
							style={{ width: 14, height: 14, margin: "2px auto", borderRadius: "50%", background: color, boxShadow: color === "#f472b6" ? "0 0 0 2px #08080a, 0 0 0 3px #f472b6" : "none" }}
						/>
					))}
				</div>

				<WbCursor
					name="Sara"
					color="#f472b6"
					initial={{ x: ELLIPSE_POINTS[0].x, y: ELLIPSE_POINTS[0].y, opacity: 0 }}
					animate={inView ? { x: ELLIPSE_POINTS.map((p) => p.x), y: ELLIPSE_POINTS.map((p) => p.y), opacity: 1 } : {}}
					transition={{ x: { ...DRAW, delay: 2 }, y: { ...DRAW, delay: 2 }, opacity: { delay: 1.8 } }}
				/>
				<WbCursor
					name="Alex"
					color="#60a5fa"
					initial={{ x: 120, y: 270, opacity: 0 }}
					animate={inView ? { x: [120, 170, 150, 120], y: [270, 250, 300, 270], opacity: 1 } : {}}
					transition={{ x: { duration: 6, repeat: Infinity, ease: "easeInOut" }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" }, opacity: { delay: 1.2 } }}
				/>
			</ScaledStage>
		</div>
	);
}

/* ── Chat ───────────────────────────────────────────────────────────── */

const CHAT = [
	{ id: "m1", who: "Alex", initials: "AL", gradient: "linear-gradient(135deg, #60a5fa, #2dd4bf)", text: "The new staging environment is up! 🚀 Everyone please test the kanban drag-and-drop.", time: "10:42 AM" },
	{ id: "m2", who: "Priya", initials: "PS", gradient: "linear-gradient(135deg, #3dd68c, #a3e635)", text: "On it — the column reorder feels instant now.", time: "10:44 AM" },
	{ id: "m3", who: "You", initials: "YOU", gradient: "linear-gradient(135deg, #3b82f6, #2dd4bf)", text: "Awesome, jumping in to review the PRs now. Looks super smooth so far.", time: "10:45 AM", own: true },
];
// Script: which messages are visible, whether someone is typing, whether the reaction landed.
const CHAT_SCRIPT = [
	{ shown: 1 },
	{ shown: 1, typing: true },
	{ shown: 2 },
	{ shown: 3 },
	{ shown: 3, reaction: true },
	{ shown: 3, reaction: true },
	{ shown: 0 },
];

export function ChatDemo() {
	const ref = useRef(null);
	const inView = useInView(ref, { margin: "-15% 0px" });
	const step = useLoop(inView, CHAT_SCRIPT.length, 1500);
	const frame = CHAT_SCRIPT[step];
	return (
		<div
			ref={ref}
			className="lp-panel"
			style={{ display: "flex", flexDirection: "column", height: 380 }}
		>
			<div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
				<span style={{ fontSize: 15, fontWeight: 700 }}># frontend-team</span>
				<span style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 99, background: "rgba(255,255,255,0.05)", fontSize: 12, color: "var(--text-secondary)" }}>
					<span className="lp-live-dot" />4 online
				</span>
			</div>
			<div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, overflow: "hidden" }}>
				<AnimatePresence
					mode="popLayout"
					initial={false}
				>
					{CHAT.slice(0, frame.shown).map((m) => (
						<motion.div
							key={m.id}
							layout
							initial={{ opacity: 0, y: 16, scale: 0.97 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, transition: { duration: 0.25 } }}
							transition={{ duration: 0.4, ease: EASE_OUT }}
							style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.own ? "row-reverse" : "row" }}
						>
							<span style={{ width: 32, height: 32, borderRadius: 9, background: m.gradient, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{m.initials}</span>
							<div style={{ display: "flex", flexDirection: "column", alignItems: m.own ? "flex-end" : "flex-start", maxWidth: "78%" }}>
								<div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4, flexDirection: m.own ? "row-reverse" : "row" }}>
									<span style={{ fontSize: 13, fontWeight: 600 }}>{m.who}</span>
									<span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.time}</span>
								</div>
								<div style={{ padding: "9px 13px", fontSize: 13, lineHeight: 1.5, borderRadius: m.own ? "12px 0 12px 12px" : "0 12px 12px 12px", background: m.own ? "var(--accent)" : "rgba(255,255,255,0.06)", color: m.own ? "#fff" : "var(--text-primary)" }}>{m.text}</div>
								{m.id === "m1" && (
									<AnimatePresence>
										{frame.reaction && (
											<motion.span
												initial={{ scale: 0, opacity: 0 }}
												animate={{ scale: 1, opacity: 1 }}
												exit={{ scale: 0, opacity: 0 }}
												transition={{ type: "spring", stiffness: 500, damping: 18 }}
												style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, border: "1px solid var(--accent-border)", background: "var(--accent-muted)", fontSize: 12 }}
											>
												🚀 <b style={{ fontSize: 11, color: "var(--accent-light)" }}>3</b>
											</motion.span>
										)}
									</AnimatePresence>
								)}
							</div>
						</motion.div>
					))}
					{frame.typing && (
						<motion.div
							key="typing"
							layout
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, transition: { duration: 0.1 } }}
							style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}
						>
							<span className="lp-typing">
								<span />
								<span />
								<span />
							</span>
							Priya is typing…
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)" }}>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-default)", background: "rgba(255,255,255,0.02)", color: "var(--text-muted)", fontSize: 13 }}>
					Message #frontend-team…
					<span style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<Icon
							name="smile"
							size={16}
						/>
						<Icon
							name="paperclip"
							size={16}
						/>
						<span style={{ display: "flex", padding: 5, borderRadius: 7, background: "var(--accent)", color: "#fff" }}>
							<Icon
								name="send"
								size={12}
							/>
						</span>
					</span>
				</div>
			</div>
		</div>
	);
}
