import { AnimatePresence, motion, useAnimate } from "framer-motion";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { EASE_OUT } from "../lib/motion";
import Icon from "./ui/Icon.jsx";

export function GoogleIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			aria-hidden
		>
			<path
				d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
				fill="#4285F4"
			/>
			<path
				d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
				fill="#34A853"
			/>
			<path
				d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
				fill="#FBBC05"
			/>
			<path
				d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
				fill="#EA4335"
			/>
		</svg>
	);
}

/** Error banner that grows in and collapses out instead of jumping the form. */
export function AuthError({ message }) {
	return (
		<AnimatePresence initial={false}>
			{message && (
				<motion.div
					key="error"
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{ duration: 0.25, ease: EASE_OUT }}
					style={{ overflow: "hidden" }}
				>
					<div
						className="auth-banner"
						role="alert"
						style={{ marginBottom: 16 }}
					>
						<Icon
							name="alert"
							size={16}
						/>
						{message}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

/**
 * Centered auth card over a slowly drifting gradient mesh (UI.md §7.1).
 * Change `shakeKey` (e.g. to the latest error) to shake the card.
 */
export default function AuthLayout({ children, shakeKey, maxWidth = 420 }) {
	const [scope, animate] = useAnimate();

	useEffect(() => {
		if (!shakeKey || !scope.current) return;
		animate(scope.current, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.45, ease: "easeInOut" });
	}, [shakeKey, animate, scope]);

	return (
		<div
			className="lp"
			style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", position: "relative" }}
		>
			<div
				className="lp-aurora"
				aria-hidden
				style={{ inset: "-120px 0 auto" }}
			>
				<span />
				<span />
				<span />
			</div>
			<div
				className="lp-grid"
				aria-hidden
				style={{ WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, #000 20%, transparent 75%)", maskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, #000 20%, transparent 75%)" }}
			/>
			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.6, ease: EASE_OUT }}
				style={{ position: "relative", width: "100%", maxWidth }}
			>
				<div
					ref={scope}
					className="auth-card"
				>
					<Link
						to="/"
						className="auth-logo"
					>
						<img
							src="/logo.png"
							alt="CollabBoard Logo"
							style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 6 }}
						/>
						<span>CollabBoard</span>
					</Link>
					{children}
				</div>
			</motion.div>
		</div>
	);
}
