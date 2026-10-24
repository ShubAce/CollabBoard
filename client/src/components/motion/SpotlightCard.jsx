import { motion } from "framer-motion";
import { fadeUp, SPRING } from "../../lib/motion";

/**
 * Interactive card with a cursor-following glow. Works as a stagger child:
 * pass `variants` from a parent `staggerContainer` (defaults to fadeUp).
 */
export default function SpotlightCard({ className = "", style, children, variants = fadeUp, ...rest }) {
	const handleMove = (event) => {
		const rect = event.currentTarget.getBoundingClientRect();
		event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
		event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
	};

	return (
		// Framer owns `transform` here (it writes it inline after the entrance),
		// so the hover lift lives in whileHover rather than in .card-interactive:hover.
		<motion.div
			variants={variants}
			className={`card card-interactive spotlight ${className}`}
			style={style}
			onMouseMove={handleMove}
			whileHover={{ y: -3, transition: SPRING }}
			whileTap={{ scale: 0.99, transition: SPRING }}
			{...rest}
		>
			{children}
		</motion.div>
	);
}
