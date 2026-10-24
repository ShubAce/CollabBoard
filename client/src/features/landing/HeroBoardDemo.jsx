import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import useMeasure from "react-use-measure";
import Icon from "../../components/ui/Icon.jsx";
import { EASE_OUT } from "../../lib/motion";

// The mock is drawn at a fixed design size and scaled to fit, like a screenshot.
// Cards and cursors are positioned explicitly (not with `layout`) because layout
// animations mis-measure inside the scaled + 3D-tilted parent.
const DESIGN_W = 1040;
const DESIGN_H = 620;
const SIDEBAR_W = 200;
const COL_W = 256;
const COL_GAP = 16;
const COL_X = (i) => SIDEBAR_W + 22 + i * (COL_W + COL_GAP);
const CARD_TOP = 164;
const CARD_H = 92;
const CARD_GAP = 10;

const PEOPLE = {
	priya: { name: "Priya", initials: "PS", color: "#3dd68c" },
	rahul: { name: "Rahul", initials: "RV", color: "#ff8c42" },
	arjun: { name: "Arjun", initials: "AK", color: "#7c72ff" },
	sara: { name: "Sara", initials: "SL", color: "#60a5fa" },
};

const CARDS = {
	a: { title: "Design onboarding checklist", tag: ["Design", "#a78bfa"], priority: "var(--p-high)", people: ["priya"], meta: "Due Thu" },
	b: { title: "Write webhook API docs", tag: ["Docs", "#60a5fa"], priority: "var(--p-medium)", people: ["rahul"], meta: "Due Fri" },
	c: { title: "Realtime cursor presence", tag: ["Feature", "#3dd68c"], priority: "var(--p-urgent)", people: ["arjun", "priya"], progress: 0.6 },
	d: { title: "Kanban drag performance", tag: ["Perf", "#f0c040"], priority: "var(--p-high)", people: ["sara"], meta: "2 / 3" },
	e: { title: "Google OAuth sign-in", tag: ["Auth", "#ff8c42"], priority: "var(--p-medium)", people: ["arjun"], meta: "Shipped" },
	f: { title: "Audit color contrast", tag: ["A11y", "#ff6b6b"], priority: "var(--p-low)", people: [], meta: "No due date" },
};

const COLUMNS = [
	{ id: "todo", title: "To Do", color: "var(--col-todo)" },
	{ id: "progress", title: "In Progress", color: "var(--col-inprogress)" },
	{ id: "done", title: "Done", color: "var(--col-done)" },
];

// A closed loop of single moves so the demo can run forever without a "reset".
const STEPS = [
	{ board: { todo: ["a", "b", "f"], progress: ["c", "d"], done: ["e"] } },
	{ board: { todo: ["a", "b", "f"], progress: ["d"], done: ["c", "e"] }, actor: "priya", card: "c", verb: "moved", to: "Done" },
	{ board: { todo: ["a", "f"], progress: ["b", "d"], done: ["c", "e"] }, actor: "rahul", card: "b", verb: "started", to: "In Progress" },
	{ board: { todo: ["a", "f"], progress: ["c", "b", "d"], done: ["e"] }, actor: "priya", card: "c", verb: "reopened", to: "In Progress" },
	{ board: { todo: ["a", "b", "f"], progress: ["c", "d"], done: ["e"] }, actor: "rahul", card: "b", verb: "moved", to: "To Do" },
];

const CARD_SPRING = { type: "spring", stiffness: 140, damping: 20, mass: 0.9 };

function positionsFor(board) {
	const positions = {};
	COLUMNS.forEach((column, colIndex) => {
		board[column.id].forEach((id, index) => {
			positions[id] = { x: COL_X(colIndex) + 10, y: CARD_TOP + index * (CARD_H + CARD_GAP) };
		});
	});
	return positions;
}

function Face({ id, size = 20, ring = "#161925" }) {
	const person = PEOPLE[id];
	return (
		<span
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				background: person.color,
				color: "#0d0f17",
				fontSize: size * 0.42,
				fontWeight: 700,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				boxShadow: `0 0 0 2px ${ring}`,
			}}
		>
			{person.initials}
		</span>
	);
}

function DemoCard({ card, isMoving }) {
	return (
		<div
			className={`lp-card${isMoving ? " dragging" : ""}`}
			style={{ height: CARD_H, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
		>
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
				<span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35 }}>{card.title}</span>
				<span style={{ width: 7, height: 7, borderRadius: "50%", background: card.priority, flexShrink: 0, marginTop: 5 }} />
			</div>
			{card.progress ? (
				<div style={{ height: 4, borderRadius: 4, background: "var(--bg-surface-3)", overflow: "hidden" }}>
					<div style={{ width: `${card.progress * 100}%`, height: "100%", background: "var(--green)", borderRadius: 4 }} />
				</div>
			) : null}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<span
					className="lp-tag"
					style={{ background: `${card.tag[1]}22`, color: card.tag[1] }}
				>
					{card.tag[0]}
				</span>
				<span style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{card.meta && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{card.meta}</span>}
					<span style={{ display: "flex" }}>
						{card.people.map((p, i) => (
							<span
								key={p}
								style={{ marginLeft: i ? -6 : 0 }}
							>
								<Face
									id={p}
									size={18}
								/>
							</span>
						))}
					</span>
				</span>
			</div>
		</div>
	);
}

function Cursor({ person, x, y, transition }) {
	return (
		<motion.div
			className="lp-cursor"
			initial={false}
			animate={{ x, y }}
			transition={transition}
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill={person.color}
				stroke="#fff"
				strokeWidth="1.5"
				strokeLinejoin="round"
			>
				<path d="M4 3l7.5 18 2.6-7.4L21.5 11 4 3Z" />
			</svg>
			<span
				className="lp-cursor-name"
				style={{ background: person.color, color: "#0d0f17" }}
			>
				{person.name}
			</span>
		</motion.div>
	);
}

// STEPS[last] equals STEPS[0], so the loop continues from 1.
const nextIndex = (i) => (i + 1 >= STEPS.length ? 1 : i + 1);
// Pointer sits on the card's grab handle while dragging it.
const grip = (pos) => ({ x: pos.x + 168, y: pos.y + 46 });
const REST = {
	priya: { x: COL_X(2) + 190, y: 470 },
	rahul: { x: COL_X(0) + 110, y: 520 },
};

export default function HeroBoardDemo() {
	const [measureRef, bounds] = useMeasure();
	const stageRef = useRef(null);
	const inView = useInView(stageRef, { margin: "-10% 0px" });
	const [step, setStep] = useState(0);
	const [phase, setPhase] = useState("rest"); // rest → reach (pointer moves to card) → drag
	const [cursors, setCursors] = useState(REST);

	useEffect(() => {
		if (!inView) return undefined;
		const upcomingIndex = nextIndex(step);
		const upcoming = STEPS[upcomingIndex];
		const from = positionsFor(STEPS[step].board)[upcoming.card];
		const to = positionsFor(upcoming.board)[upcoming.card];
		const timers = [
			window.setTimeout(() => setPhase("rest"), 1100),
			window.setTimeout(() => {
				setPhase("reach");
				setCursors((c) => ({ ...c, [upcoming.actor]: grip(from) }));
			}, 2300),
			window.setTimeout(() => {
				setStep(upcomingIndex);
				setPhase("drag");
				setCursors((c) => ({ ...c, [upcoming.actor]: grip(to) }));
			}, 3200),
		];
		return () => timers.forEach(window.clearTimeout);
	}, [inView, step]);

	const scale = bounds.width ? Math.max(bounds.width / DESIGN_W, 0.56) : 1;
	const cropped = bounds.width && bounds.width < DESIGN_W * 0.56;

	const current = STEPS[step];
	const shownBoard = current.board;
	const positions = positionsFor(shownBoard);
	const moving = phase === "drag" ? current.card : null;
	const toast = step !== 0 ? current : null;
	const cursorTransition = (who) => (phase === "drag" && current.actor === who ? CARD_SPRING : { duration: 0.8, ease: EASE_OUT });

	return (
		<div
			ref={measureRef}
			style={{
				height: DESIGN_H * scale,
				position: "relative",
				WebkitMaskImage: cropped ? "linear-gradient(90deg, #000 75%, transparent)" : undefined,
				maskImage: cropped ? "linear-gradient(90deg, #000 75%, transparent)" : undefined,
			}}
		>
			<div
				ref={stageRef}
				className="lp-frame"
				style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
			>
				{/* Window chrome */}
				<div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d0f19" }}>
					<span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f56" }} />
					<span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ffbd2e" }} />
					<span style={{ width: 11, height: 11, borderRadius: "50%", background: "#27c93f" }} />
					<span style={{ margin: "0 auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--text-muted)" }}>
						<Icon
							name="lock"
							size={10}
						/>
						collabboard.app/team-alpha/sprint-3
					</span>
					<span style={{ width: 44 }} />
				</div>

				{/* Sidebar */}
				<div style={{ position: "absolute", top: 40, bottom: 0, left: 0, width: SIDEBAR_W, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-subtle)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 14px", fontSize: 13, fontWeight: 600 }}>
						<span style={{ width: 14, height: 14, borderRadius: 4, background: "var(--accent)", boxShadow: "0 0 10px rgba(124,114,255,0.6)" }} />
						Team Alpha
					</div>
					{[
						["home", "Home"],
						["briefcase", "My Work"],
						["bell", "Notifications", 3],
					].map(([icon, label, badge]) => (
						<div
							key={label}
							style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12, color: "var(--text-secondary)" }}
						>
							<Icon
								name={icon}
								size={13}
							/>
							<span style={{ flex: 1 }}>{label}</span>
							{badge && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: "var(--accent)", color: "#fff" }}>{badge}</span>}
						</div>
					))}
					<div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", padding: "14px 8px 6px" }}>BOARDS</div>
					{["Sprint 3", "Bug Tracker", "Roadmap"].map((label, i) => (
						<div
							key={label}
							style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12, borderRadius: 6, color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", background: i === 0 ? "var(--bg-surface-3)" : "transparent" }}
						>
							{i === 0 && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />}
							<Icon
								name="board"
								size={13}
							/>
							{label}
						</div>
					))}
					<div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-muted)", padding: "14px 8px 6px" }}>CHANNELS</div>
					{["general", "dev-updates", "design"].map((label) => (
						<div
							key={label}
							style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12, color: "var(--text-secondary)" }}
						>
							<Icon
								name="hash"
								size={13}
							/>
							{label}
						</div>
					))}
				</div>

				{/* Board header */}
				<div style={{ position: "absolute", top: 40, left: SIDEBAR_W, right: 0, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", borderBottom: "1px solid var(--border-subtle)" }}>
					<div>
						<div style={{ fontSize: 11, color: "var(--text-muted)" }}>Team Alpha / Boards</div>
						<div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Sprint 3</div>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
						<span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
							<span className="lp-live-dot" />
							Live
						</span>
						<span style={{ display: "flex" }}>
							{["arjun", "priya", "rahul", "sara"].map((p, i) => (
								<span
									key={p}
									style={{ marginLeft: i ? -6 : 0 }}
								>
									<Face
										id={p}
										size={24}
										ring="#0b0d16"
									/>
								</span>
							))}
						</span>
						<span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
							<Icon
								name="plus"
								size={12}
							/>
							New task
						</span>
					</div>
				</div>

				{/* Columns */}
				{COLUMNS.map((column, i) => (
					<div
						key={column.id}
						style={{ position: "absolute", top: 120, left: COL_X(i), width: COL_W, bottom: 18, borderRadius: 12, background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.035)", borderTop: `2px solid ${column.color}` }}
					>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
							<span style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<span style={{ width: 7, height: 7, borderRadius: "50%", background: column.color }} />
								{column.title}
							</span>
							<span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>{shownBoard[column.id].length}</span>
						</div>
					</div>
				))}

				{/* Cards */}
				{Object.entries(CARDS).map(([id, card]) => {
					const pos = positions[id];
					const isMoving = moving === id;
					return (
						<motion.div
							key={id}
							style={{ position: "absolute", top: 0, left: 0, width: COL_W - 20, zIndex: isMoving ? 10 : 1 }}
							initial={false}
							animate={{ x: pos.x, y: pos.y, rotate: isMoving ? [0, 2.5, 2.5, 0] : 0, scale: isMoving ? [1, 1.04, 1.04, 1] : 1 }}
							transition={{ x: CARD_SPRING, y: CARD_SPRING, rotate: { duration: 1, times: [0, 0.15, 0.75, 1] }, scale: { duration: 1, times: [0, 0.15, 0.75, 1] } }}
						>
							<DemoCard
								card={card}
								isMoving={isMoving}
							/>
						</motion.div>
					);
				})}

				<Cursor
					person={PEOPLE.priya}
					x={cursors.priya.x}
					y={cursors.priya.y}
					transition={cursorTransition("priya")}
				/>
				<Cursor
					person={PEOPLE.rahul}
					x={cursors.rahul.x}
					y={cursors.rahul.y}
					transition={cursorTransition("rahul")}
				/>

				{/* Activity toast */}
				<AnimatePresence>
					{toast && (
						<motion.div
							key={step}
							initial={{ opacity: 0, y: 16, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE_OUT, delay: 0.5 } }}
							exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
							style={{ position: "absolute", right: 22, bottom: 26, zIndex: 30, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", borderLeft: "3px solid var(--green)", boxShadow: "var(--shadow-dropdown)", fontSize: 12, color: "var(--text-secondary)" }}
						>
							<Face
								id={toast.actor}
								size={22}
								ring="var(--bg-surface-2)"
							/>
							<span>
								<b style={{ color: "var(--text-primary)", fontWeight: 600 }}>{PEOPLE[toast.actor].name}</b> {toast.verb} <b style={{ color: "var(--text-primary)", fontWeight: 600 }}>{CARDS[toast.card].title}</b> → {toast.to}
							</span>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
