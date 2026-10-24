import { useEffect } from "react";
import { motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import { dialog, MOBILE_QUERY, overlay, sheet } from "../../lib/motion";

/**
 * Animated overlay + dialog. Render it inside <AnimatePresence> at the call site
 * so the exit animation runs:  <AnimatePresence>{open && <ModalShell .../>}</AnimatePresence>
 * On phones the dialog becomes a bottom sheet (UI.md §19.3).
 */
export default function ModalShell({ onClose, maxWidth = 480, className = "", style, children, labelledBy }) {
	const isMobile = useMediaQuery(MOBILE_QUERY);

	useEffect(() => {
		const handleKey = (event) => {
			if (event.key === "Escape") onClose?.();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return (
		<motion.div
			data-motion
			className="modal-overlay"
			variants={overlay}
			initial="initial"
			animate="animate"
			exit="exit"
			onClick={(event) => event.target === event.currentTarget && onClose?.()}
		>
			<motion.div
				data-motion
				role="dialog"
				aria-modal="true"
				aria-labelledby={labelledBy}
				className={`modal ${className}`}
				style={{ maxWidth, ...style }}
				variants={isMobile ? sheet : dialog}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				{children}
			</motion.div>
		</motion.div>
	);
}
