import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { EASE_OUT, fadeUp, staggerContainer } from "../lib/motion";

export default function NotFoundPage() {
	return (
		<div
			className="lp"
			style={{
				minHeight: "100dvh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
				position: "relative",
			}}
		>
			<div
				className="lp-aurora"
				aria-hidden
			>
				<span />
				<span />
				<span />
			</div>
			<motion.div
				style={{ textAlign: "center", maxWidth: 420, position: "relative" }}
				variants={staggerContainer(0.08)}
				initial="hidden"
				animate="show"
			>
				<motion.div
					className="text-gradient"
					initial={{ opacity: 0, scale: 0.8, filter: "blur(12px)" }}
					animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: [0, -8, 0] }}
					transition={{ duration: 0.8, ease: EASE_OUT, y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 } }}
					style={{ fontSize: "clamp(96px, 22vw, 150px)", fontWeight: 800, lineHeight: 1, marginBottom: 16, letterSpacing: "-0.06em" }}
				>
					404
				</motion.div>
				<motion.h1
					variants={fadeUp}
					style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 12px" }}
				>
					This page wandered off the board
				</motion.h1>
				<motion.p
					variants={fadeUp}
					style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}
				>
					The page you&apos;re looking for doesn&apos;t exist or has been moved.
				</motion.p>
				<motion.div
					variants={fadeUp}
					style={{ display: "flex", gap: 10, justifyContent: "center" }}
				>
					<Link
						to="/"
						className="btn btn-primary"
					>
						Back to home
					</Link>
					<Link
						to="/app"
						className="btn btn-ghost"
					>
						Dashboard
					</Link>
				</motion.div>
			</motion.div>
		</div>
	);
}
