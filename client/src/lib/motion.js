// Mirrors the motion tokens in index.css (--ease-*, --duration-*) so Framer Motion
// and CSS transitions share one timing language.
export const EASE_OUT = [0.16, 1, 0.3, 1];
export const EASE_IN = [0.4, 0, 1, 1];
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];

export const DURATION = { fast: 0.1, default: 0.2, slow: 0.35 };

// Snappy spring for interruptible UI (indicators, toggles, press feedback).
export const SPRING = { type: "spring", stiffness: 420, damping: 34 };
// Softer spring for larger surfaces (drawers, sheets, layout moves).
export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 28 };

export const fadeUp = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export const fadeIn = {
	hidden: { opacity: 0 },
	show: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

export const staggerContainer = (stagger = 0.05, delayChildren = 0) => ({
	hidden: {},
	show: { transition: { staggerChildren: stagger, delayChildren } },
});

// Dropdowns and popovers: scale from their anchor, leave faster than they arrive.
export const popover = {
	initial: { opacity: 0, scale: 0.96, y: -4 },
	animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.default, ease: EASE_OUT } },
	exit: { opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.12, ease: EASE_IN } },
};

export const overlay = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: DURATION.default, ease: EASE_OUT } },
	exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_IN } },
};

export const dialog = {
	initial: { opacity: 0, scale: 0.96, y: 8 },
	animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
	exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.15, ease: EASE_IN } },
};

// Mobile bottom sheet (UI.md §19.3).
export const sheet = {
	initial: { y: "100%" },
	animate: { y: 0, transition: SPRING_SOFT },
	exit: { y: "100%", transition: { duration: 0.2, ease: EASE_IN } },
};

export const MOBILE_QUERY = "(max-width: 768px)";
