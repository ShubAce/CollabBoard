import { AnimatePresence, motion } from "framer-motion";
import { EASE_OUT } from "../../lib/motion";

/** Count that flips up like a clock digit when it changes (UI.md §18.3). */
export default function FlipNumber({ value, max = 99 }) {
	const label = value > max ? `${max}+` : String(value);
	return (
		<span style={{ display: "inline-grid", overflow: "hidden", verticalAlign: "bottom" }}>
			<AnimatePresence
				mode="popLayout"
				initial={false}
			>
				<motion.span
					key={label}
					style={{ gridArea: "1 / 1" }}
					initial={{ y: "100%", opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: "-100%", opacity: 0 }}
					transition={{ duration: 0.25, ease: EASE_OUT }}
				>
					{label}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
