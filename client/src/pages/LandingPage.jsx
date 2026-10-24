import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Reveal from "../components/motion/Reveal.jsx";
import Icon from "../components/ui/Icon.jsx";
import { CommandDemo, InviteDemo, NotifyDemo, PresenceDemo } from "../features/landing/BentoDemos.jsx";
import { ChatDemo, KanbanDemo, WhiteboardDemo } from "../features/landing/FeatureDemos.jsx";
import HeroBoardDemo from "../features/landing/HeroBoardDemo.jsx";
import { EASE_OUT } from "../lib/motion";
import useAuthStore from "../store/authStore";

const NAV_LINKS = [
	["Features", "#features"],
	["Whiteboard", "#whiteboard"],
	["Chat", "#chat"],
	["Workflow", "#workflow"],
];

const HEADLINE = [
	["Where", "agile", "teams"],
	["build", "the", "future."],
];

const FEATURES = [
	{
		id: "kanban",
		icon: "kanban",
		tint: "var(--accent)",
		eyebrow: "Boards",
		title: "Organize anything with powerful Kanban",
		body: "Track tasks, bugs, and features with highly customizable boards. Everything syncs instantly to your team, with rich descriptions, attachments, and due dates.",
		bullets: ["Board, list and timeline views", "Sub-tasks, dependencies and attachments", "Filter by assignee, priority or due date"],
		Demo: KanbanDemo,
	},
	{
		id: "whiteboard",
		icon: "edit",
		tint: "var(--green)",
		eyebrow: "Whiteboard",
		title: "Brainstorm on infinite whiteboards",
		body: "Map out user flows, architecture diagrams, and brainstorms. See your teammates' cursors fly across the screen as you draw and ideate together in real time.",
		bullets: ["Live cursors with teammate names", "Freehand ink in any color and brush size", "Saved with every board"],
		Demo: WhiteboardDemo,
		reverse: true,
	},
	{
		id: "chat",
		icon: "messageCircle",
		tint: "#f472b6",
		eyebrow: "Chat",
		title: "Contextual team chat",
		body: "Stop context switching. Keep conversations right where the work happens, with threaded replies, emoji reactions, and direct messages.",
		bullets: ["Threaded replies keep topics tidy", "Emoji reactions and direct messages", "Edit or delete messages any time"],
		Demo: ChatDemo,
	},
];

const BENTO = [
	{ title: "Jump anywhere with ⌘K", body: "Search workspaces, boards, channels and people without leaving the keyboard.", Demo: CommandDemo, wide: true },
	{ title: "Notifications that find you", body: "Assignments, mentions and due dates arrive the moment they happen.", Demo: NotifyDemo },
	{ title: "See who's here", body: "Presence and status show who's online, focusing or away.", Demo: PresenceDemo },
	{ title: "Invite with the right role", body: "Bring people in as owners, admins or members in seconds.", Demo: InviteDemo, wide: true },
];

const wordVariants = {
	hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
	show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE_OUT } },
};

function Nav() {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const handler = () => setScrolled(window.scrollY > 20);
		handler();
		window.addEventListener("scroll", handler, { passive: true });
		return () => window.removeEventListener("scroll", handler);
	}, []);

	return (
		<nav className={`lp-nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
				<div className="flex items-center gap-10">
					<Link
						to="/"
						className="flex items-center gap-2.5"
					>
						<img
							src="/logo.png"
							alt="CollabBoard Logo"
							className="h-8 w-8 rounded-lg object-contain"
						/>
						<span className="text-xl font-bold tracking-tight text-(--text-primary)">CollabBoard</span>
					</Link>
					<div className="hidden gap-7 md:flex">
						{NAV_LINKS.map(([label, href]) => (
							<a
								key={label}
								href={href}
								className="lp-nav-link"
							>
								{label}
							</a>
						))}
					</div>
				</div>
				<div className="flex items-center gap-2 sm:gap-4">
					<Link
						to="/login"
						className="lp-nav-link hidden px-2 sm:inline"
					>
						Log in
					</Link>
					<Link
						to="/register"
						className="btn btn-primary"
						style={{ borderRadius: 999, padding: "0 18px", minHeight: 38 }}
					>
						Get started
					</Link>
					<button
						type="button"
						className="btn btn-ghost lp-menu-btn"
						style={{ padding: 0, width: 38, minHeight: 38, borderRadius: 10 }}
						onClick={() => setOpen((o) => !o)}
						aria-label={open ? "Close menu" : "Open menu"}
						aria-expanded={open}
					>
						<Icon
							name={open ? "close" : "menu"}
							size={18}
						/>
					</button>
				</div>
			</div>
			<AnimatePresence>
				{open && (
					<motion.div
						className="overflow-hidden md:hidden"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } }}
						exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
					>
						<div className="flex flex-col gap-1 px-4 pb-5 pt-1">
							{NAV_LINKS.map(([label, href], i) => (
								<motion.a
									key={label}
									href={href}
									onClick={() => setOpen(false)}
									className="rounded-lg px-3 py-3 text-base font-medium text-(--text-secondary) hover:bg-white/5 hover:text-(--text-primary)"
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0, transition: { delay: 0.05 * i + 0.05 } }}
								>
									{label}
								</motion.a>
							))}
							<Link
								to="/login"
								className="btn btn-ghost mt-2"
								style={{ minHeight: 44 }}
							>
								Log in
							</Link>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</nav>
	);
}

function Hero() {
	const mockRef = useRef(null);
	const { scrollYProgress } = useScroll({ target: mockRef, offset: ["start end", "start 0.2"] });
	const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
	const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

	return (
		<section className="relative px-4 pb-10 pt-32 text-center sm:px-6 sm:pt-40">
			<div
				className="lp-aurora"
				aria-hidden
			>
				<span />
				<span />
				<span />
			</div>
			<div
				className="lp-grid"
				aria-hidden
			/>

			<div className="relative mx-auto max-w-4xl">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: EASE_OUT }}
				>
					<Link
						to="/register"
						className="lp-pill"
					>
						<span className="lp-pill-tag">BETA</span>
						Now in public beta
						<Icon
							name="arrowRight"
							size={12}
						/>
					</Link>
				</motion.div>

				<motion.h1
					className="mx-auto mt-7 text-[clamp(2.5rem,7.4vw,5.25rem)] font-bold leading-[1.03] tracking-[-0.04em]"
					initial="hidden"
					animate="show"
					transition={{ staggerChildren: 0.07, delayChildren: 0.15 }}
				>
					{HEADLINE.map((line, lineIndex) => (
						<span
							key={lineIndex}
							className="block"
						>
							{line.map((word, i) => (
								<motion.span
									key={word}
									variants={wordVariants}
									className={`inline-block${lineIndex === 1 ? " text-gradient" : ""}`}
									style={
										lineIndex === 1
											? { backgroundSize: `${line.length * 100}% 100%`, backgroundPosition: `${(i / (line.length - 1)) * 100}% 0`, paddingBottom: "0.08em" }
											: undefined
									}
								>
									{word}
									{i < line.length - 1 && " "}
								</motion.span>
							))}
						</span>
					))}
				</motion.h1>

				<motion.p
					className="mx-auto mt-6 max-w-2xl text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-(--text-secondary)"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.55 }}
				>
					Kanban boards, infinite whiteboards, and real-time chat seamlessly integrated into a single, blazing-fast workspace.
				</motion.p>

				<motion.div
					className="mt-10 flex flex-wrap justify-center gap-3"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.7 }}
				>
					<Link
						to="/register"
						className="lp-cta"
					>
						Start your workspace
						<Icon
							name="arrowRight"
							size={18}
						/>
					</Link>
					<a
						href="#features"
						className="lp-cta-ghost"
					>
						<Icon
							name="play"
							size={14}
						/>
						See it in action
					</a>
				</motion.div>
				<motion.p
					className="mt-5 text-sm text-(--text-muted)"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1 }}
				>
					Free forever plan · No credit card required
				</motion.p>
			</div>

			<div
				ref={mockRef}
				className="relative mx-auto mt-16 max-w-[1080px] sm:mt-20"
				style={{ perspective: 1800 }}
			>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-[10%] -bottom-10 top-1/3 rounded-full"
					style={{ background: "radial-gradient(ellipse at center, rgba(59, 130, 246,0.35), transparent 70%)" }}
				/>
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.5 }}
				>
					<motion.div style={{ rotateX, scale, transformOrigin: "center top" }}>
						<HeroBoardDemo />
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

function FeatureRow({ feature }) {
	const { id, icon, tint, eyebrow, title, body, bullets, Demo, reverse } = feature;
	return (
		<div
			id={id}
			className="grid scroll-mt-24 grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20"
		>
			<Reveal className={reverse ? "md:order-2" : undefined}>
				<div
					className="lp-feature-icon"
					style={{ color: tint, background: `color-mix(in srgb, ${tint} 12%, transparent)`, borderColor: `color-mix(in srgb, ${tint} 28%, transparent)` }}
				>
					<Icon
						name={icon}
						size={22}
					/>
				</div>
				<p
					className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]"
					style={{ color: tint }}
				>
					{eyebrow}
				</p>
				<h2 className="mb-4 text-[clamp(1.9rem,3.6vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.03em]">{title}</h2>
				<p className="text-lg leading-relaxed text-(--text-secondary)">{body}</p>
				<ul className="mt-7 flex flex-col gap-3">
					{bullets.map((item, i) => (
						<motion.li
							key={item}
							className="flex items-center gap-3 text-[15px] text-(--text-primary)"
							initial={{ opacity: 0, x: -12 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.25 + i * 0.08 }}
						>
							<span
								className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
								style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}
							>
								<Icon
									name="check"
									size={12}
									strokeWidth={3}
								/>
							</span>
							{item}
						</motion.li>
					))}
				</ul>
			</Reveal>
			<Reveal
				className={reverse ? "md:order-1" : undefined}
				delay={0.12}
				y={40}
			>
				<Demo />
			</Reveal>
		</div>
	);
}

function Bento() {
	return (
		<section
			id="workflow"
			className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32"
		>
			<Reveal className="mx-auto mb-14 max-w-2xl text-center">
				<p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-light)">Workflow</p>
				<h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">Built for flow, down to the details.</h2>
				<p className="mt-4 text-lg text-(--text-secondary)">The small things that keep a team moving without breaking focus.</p>
			</Reveal>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
				{BENTO.map(({ title, body, Demo, wide }, i) => (
					<Reveal
						key={title}
						delay={(i % 2) * 0.1}
						className={wide ? "md:col-span-3" : "md:col-span-2"}
					>
						<div className="lp-bento h-full">
							<div className="lp-bento-stage">
								<Demo />
							</div>
							<div className="p-6">
								<h3 className="text-lg font-semibold tracking-tight">{title}</h3>
								<p className="mt-1.5 text-[15px] leading-relaxed text-(--text-secondary)">{body}</p>
							</div>
						</div>
					</Reveal>
				))}
			</div>
		</section>
	);
}

function FinalCta() {
	const handleMove = (event) => {
		const rect = event.currentTarget.getBoundingClientRect();
		event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
		event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
	};
	return (
		<section className="px-4 pb-24 sm:px-6 sm:pb-32">
			<Reveal className="mx-auto max-w-5xl">
				<div className="lp-final">
					<div
						className="lp-final-inner px-6 py-16 text-center sm:px-12 sm:py-24"
						onMouseMove={handleMove}
					>
						<h2 className="text-[clamp(2.2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.035em]">Ready to ship faster?</h2>
						<p className="mx-auto mb-10 mt-5 max-w-xl text-lg leading-relaxed text-(--text-secondary)">
							Join agile teams already using CollabBoard to centralize their workflow and collaborate seamlessly.
						</p>
						<Link
							to="/register"
							className="lp-cta"
						>
							Get started for free
							<Icon
								name="arrowRight"
								size={18}
							/>
						</Link>
						<p className="mt-6 text-sm text-(--text-muted)">No credit card required. Free forever plan available.</p>
					</div>
				</div>
			</Reveal>
		</section>
	);
}

function Footer() {
	return (
		<footer className="border-t border-(--border-subtle) pb-10 pt-16">
			<div className="mx-auto mb-14 grid max-w-6xl grid-cols-2 gap-10 px-4 sm:px-6 md:grid-cols-4 md:gap-16">
				<div className="col-span-2 md:col-span-1">
					<div className="mb-4 flex items-center gap-2">
						<img
							src="/logo.png"
							alt="CollabBoard Logo"
							className="h-6 w-6 rounded-sm object-contain"
						/>
						<span className="text-lg font-bold">CollabBoard</span>
					</div>
					<p className="max-w-xs text-sm leading-relaxed text-(--text-secondary)">The workspace for modern agile teams to plan, collaborate, and ship faster.</p>
				</div>
				{[
					["Product", ["Features", "Integrations", "Pricing", "Changelog", "Docs"]],
					["Company", ["About Us", "Careers", "Blog", "Contact"]],
					["Legal", ["Privacy Policy", "Terms of Service", "Security"]],
				].map(([heading, links]) => (
					<div key={heading}>
						<h4 className="mb-4 text-sm font-semibold">{heading}</h4>
						<div className="flex flex-col gap-3">
							{links.map((label) => (
								<a
									key={label}
									href={label === "Features" ? "#features" : "#"}
									className="lp-footer-link"
								>
									{label}
								</a>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-(--border-subtle) px-4 pt-8 sm:px-6">
				<p className="m-0 text-sm text-(--text-muted)">© {new Date().getFullYear()} CollabBoard Inc. All rights reserved.</p>
				<div className="flex gap-4 text-(--text-muted)">
					<Icon
						name="github"
						size={20}
						className="cursor-pointer transition-colors hover:text-(--text-primary)"
					/>
					<Icon
						name="twitter"
						size={20}
						className="cursor-pointer transition-colors hover:text-(--text-primary)"
					/>
				</div>
			</div>
		</footer>
	);
}

export default function LandingPage() {
	const navigate = useNavigate();
	const accessToken = useAuthStore((s) => s.accessToken);
	const user = useAuthStore((s) => s.user);

	useEffect(() => {
		if (accessToken && user) navigate("/app/workspaces", { replace: true });
	}, [accessToken, user, navigate]);

	return (
		<div className="lp">
			<Nav />
			<Hero />

			<section
				id="features"
				className="mx-auto max-w-6xl scroll-mt-16 px-4 pt-20 sm:px-6 sm:pt-28"
			>
				<Reveal className="mx-auto mb-20 max-w-2xl text-center sm:mb-28">
					<p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--accent-light)">One workspace</p>
					<h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em]">
						Everything your team needs.
						<br />
						<span className="text-(--text-secondary)">Nothing it doesn&apos;t.</span>
					</h2>
				</Reveal>
				<div className="flex flex-col gap-28 sm:gap-36">
					{FEATURES.map((feature) => (
						<FeatureRow
							key={feature.id}
							feature={feature}
						/>
					))}
				</div>
			</section>

			<Bento />
			<FinalCta />
			<Footer />
		</div>
	);
}
