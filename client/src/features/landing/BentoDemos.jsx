import { useRef } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import Icon from "../../components/ui/Icon.jsx";
import useLoop from "../../hooks/useLoop";
import { EASE_OUT } from "../../lib/motion";

function useStage() {
	const ref = useRef(null);
	const inView = useInView(ref, { margin: "-10% 0px" });
	return [ref, inView];
}

const PALETTE_ROWS = [
	["board", "Sprint 3", "Board"],
	["board", "Bug Tracker", "Board"],
	["hash", "dev-updates", "Channel"],
	["user", "Priya Sharma", "Member"],
];

export function CommandDemo() {
	const [ref, inView] = useStage();
	const active = useLoop(inView, PALETTE_ROWS.length, 1100);
	return (
		<div
			ref={ref}
			style={{ width: "82%", maxWidth: 300, borderRadius: 12, border: "1px solid var(--border-default)", background: "var(--bg-surface-1)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", overflow: "hidden" }}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-secondary)" }}>
				<Icon
					name="search"
					size={12}
				/>
				<span style={{ flex: 1 }}>Jump to…</span>
				<span className="kbd">⌘K</span>
			</div>
			<div style={{ padding: 5 }}>
				{PALETTE_ROWS.map(([icon, label, kind], i) => (
					<div
						key={label}
						style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7, fontSize: 12, color: i === active ? "var(--text-primary)" : "var(--text-secondary)" }}
					>
						{i === active && (
							<motion.span
								layoutId="bento-cmd"
								transition={{ type: "spring", stiffness: 500, damping: 36 }}
								style={{ position: "absolute", inset: 0, borderRadius: 7, background: "var(--bg-surface-3)", boxShadow: "inset 0 0 0 1px var(--border-default)" }}
							/>
						)}
						<span style={{ position: "relative", display: "flex", color: i === active ? "var(--accent-light)" : "inherit" }}>
							<Icon
								name={icon}
								size={12}
							/>
						</span>
						<span style={{ position: "relative", flex: 1 }}>{label}</span>
						<span style={{ position: "relative", fontSize: 10, color: "var(--text-muted)" }}>{kind}</span>
					</div>
				))}
			</div>
		</div>
	);
}

const NOTES = [
	{ icon: "user", color: "var(--accent-light)", text: "Priya assigned you", sub: "Realtime cursor presence" },
	{ icon: "chat", color: "var(--teal)", text: "Rahul mentioned you", sub: "#dev-updates" },
	{ icon: "clock", color: "var(--orange)", text: "Due tomorrow", sub: "Kanban drag performance" },
];

export function NotifyDemo() {
	const [ref, inView] = useStage();
	const count = useLoop(inView, NOTES.length + 2, 1300);
	const shown = Math.min(count, NOTES.length);
	return (
		<div
			ref={ref}
			style={{ width: "84%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 10 }}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-end" }}>
				<motion.span
					key={shown}
					style={{ display: "flex", color: "var(--text-primary)", transformOrigin: "top center" }}
					initial={{ rotate: 0 }}
					animate={shown ? { rotate: [0, 18, -14, 9, -5, 0] } : {}}
					transition={{ duration: 0.6 }}
				>
					<Icon
						name="bell"
						size={18}
					/>
				</motion.span>
				<AnimatePresence mode="popLayout">
					{shown > 0 && (
						<motion.span
							key={shown}
							initial={{ y: 10, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -10, opacity: 0 }}
							style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 99, background: "var(--red)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
						>
							{shown}
						</motion.span>
					)}
				</AnimatePresence>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 168 }}>
				<AnimatePresence initial={false}>
					{NOTES.slice(0, shown)
						.reverse()
						.map((note) => (
							<motion.div
								key={note.text}
								layout
								initial={{ opacity: 0, y: -14, scale: 0.96 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
								transition={{ duration: 0.35, ease: EASE_OUT }}
								style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--bg-surface-1)", border: "1px solid var(--border-default)" }}
							>
								<span style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-surface-3)", color: note.color, flexShrink: 0 }}>
									<Icon
										name={note.icon}
										size={13}
									/>
								</span>
								<span style={{ minWidth: 0 }}>
									<span style={{ display: "block", fontSize: 12, fontWeight: 600 }}>{note.text}</span>
									<span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note.sub}</span>
								</span>
							</motion.div>
						))}
				</AnimatePresence>
			</div>
		</div>
	);
}

const ORBIT = [
	["AK", "#3b82f6"],
	["PS", "#3dd68c"],
	["RV", "#ff8c42"],
	["SL", "#60a5fa"],
	["MJ", "#f472b6"],
	["DT", "#f0c040"],
];

export function PresenceDemo() {
	const [ref, inView] = useStage();
	return (
		<div
			ref={ref}
			style={{ position: "relative", width: 200, height: 160 }}
		>
			<div style={{ position: "absolute", inset: "30px 50px", borderRadius: "50%", border: "1px dashed var(--border-strong)" }} />
			<span
				style={{ position: "absolute", left: "50%", top: "50%", width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", boxShadow: "0 0 40px rgba(59, 130, 246,0.7)" }}
			>
				<img
					src="/logo.png"
					alt=""
					style={{ width: 26, height: 26, objectFit: "contain" }}
				/>
			</span>
			<motion.div
				style={{ position: "absolute", inset: 0 }}
				animate={inView ? { rotate: 360 } : {}}
				transition={{ duration: 28, ease: "linear", repeat: Infinity }}
			>
				{ORBIT.map(([initials, color], i) => {
					const angle = (i / ORBIT.length) * Math.PI * 2;
					const x = 100 + Math.cos(angle) * 72 - 15;
					const y = 80 + Math.sin(angle) * 52 - 15;
					return (
						<motion.span
							key={initials}
							style={{ position: "absolute", left: x, top: y, width: 30, height: 30, borderRadius: "50%", background: color, color: "#09090b", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px var(--bg-base)" }}
							animate={inView ? { rotate: -360 } : {}}
							transition={{ duration: 28, ease: "linear", repeat: Infinity }}
						>
							{initials}
							<span style={{ position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%", background: i % 3 === 2 ? "var(--yellow)" : "var(--green)", boxShadow: "0 0 0 2px var(--bg-base)" }} />
						</motion.span>
					);
				})}
			</motion.div>
		</div>
	);
}

const INVITE_EMAIL = "priya@team.dev";

export function InviteDemo() {
	const [ref, inView] = useStage();
	// 0..n type the address, then: sending, sent, hold
	const tick = useLoop(inView, INVITE_EMAIL.length + 9, 110);
	const typed = INVITE_EMAIL.slice(0, Math.min(tick, INVITE_EMAIL.length));
	const after = tick - INVITE_EMAIL.length;
	const state = after < 1 ? "idle" : after < 4 ? "sending" : "sent";
	return (
		<div
			ref={ref}
			style={{ width: "84%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 10 }}
		>
			<div style={{ display: "flex", gap: 8 }}>
				<div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 10px", borderRadius: 8, border: `1px solid ${state === "idle" ? "var(--border-focus)" : "var(--border-default)"}`, background: "var(--bg-surface-2)", fontSize: 12, boxShadow: state === "idle" ? "0 0 0 3px rgba(59, 130, 246,0.18)" : "none", transition: "all 200ms" }}>
					<Icon
						name="mail"
						size={12}
						style={{ color: "var(--text-muted)", flexShrink: 0 }}
					/>
					<span style={{ overflow: "hidden", whiteSpace: "nowrap" }}>{typed}</span>
					{state === "idle" && <span style={{ width: 1, height: 14, background: "var(--accent-light)", animation: "blink 1s infinite" }} />}
				</div>
				<motion.span
					layout
					transition={{ type: "spring", stiffness: 500, damping: 34 }}
					style={{ height: 36, padding: "0 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: state === "sent" ? "var(--green)" : "var(--accent)", transition: "background-color 250ms", whiteSpace: "nowrap" }}
				>
					<AnimatePresence
						mode="popLayout"
						initial={false}
					>
						<motion.span
							key={state}
							initial={{ y: 12, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -12, opacity: 0 }}
							transition={{ duration: 0.2 }}
							style={{ display: "flex", alignItems: "center", gap: 6, color: state === "sent" ? "#0d2a1c" : "#fff" }}
						>
							{state === "sending" && (
								<span
									className="spinner"
									style={{ width: 12, height: 12 }}
								/>
							)}
							{state === "sent" && (
								<Icon
									name="check"
									size={13}
									strokeWidth={3}
								/>
							)}
							{state === "idle" ? "Invite" : state === "sending" ? "Sending" : "Sent"}
						</motion.span>
					</AnimatePresence>
				</motion.span>
			</div>
			<div style={{ display: "flex", gap: 6 }}>
				{["Owner", "Admin", "Member"].map((role) => (
					<span
						key={role}
						style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-default)", background: role === "Member" ? "var(--accent-muted)" : "transparent", color: role === "Member" ? "var(--accent-light)" : "var(--text-muted)", borderColor: role === "Member" ? "var(--accent-border)" : "var(--border-default)" }}
					>
						{role}
					</span>
				))}
			</div>
		</div>
	);
}
