import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../components/ui/Icon.jsx";
import { DURATION, EASE_IN, EASE_OUT } from "../lib/motion";

const ToastCtx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
	const [toasts, setToasts] = useState([]);

	const dismiss = useCallback((id) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const show = useCallback(
		(message, { type = "info", duration = 4000 } = {}) => {
			const id = ++_id;
			setToasts((prev) => [...prev, { id, message, type, duration }]);
			if (duration > 0) {
				setTimeout(() => dismiss(id), duration);
			}
			return id;
		},
		[dismiss],
	);

	const toast = {
		success: (msg, opts) => show(msg, { type: "success", ...opts }),
		error: (msg, opts) => show(msg, { type: "error", ...opts }),
		info: (msg, opts) => show(msg, { type: "info", ...opts }),
		warning: (msg, opts) => show(msg, { type: "warning", ...opts }),
		dismiss,
	};

	return (
		<ToastCtx.Provider value={toast}>
			{children}
			<ToastContainer toasts={toasts} onDismiss={dismiss} />
		</ToastCtx.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastCtx);
	if (!ctx) throw new Error("useToast must be used inside ToastProvider");
	return ctx;
}

const TYPE_META = {
	success: { icon: "checkCircle", color: "var(--green)" },
	error: { icon: "xCircle", color: "var(--red)" },
	info: { icon: "info", color: "var(--blue)" },
	warning: { icon: "alert", color: "var(--yellow)" },
};

function ToastContainer({ toasts, onDismiss }) {
	return (
		<div
			className="toast-container"
			aria-live="polite"
		>
			<AnimatePresence
				mode="popLayout"
				initial={false}
			>
				{toasts.map((t) => {
					const meta = TYPE_META[t.type] || TYPE_META.info;
					return (
						<motion.div
							key={t.id}
							layout
							role="status"
							className={`toast toast-${t.type}`}
							style={{ position: "relative", overflow: "hidden" }}
							initial={{ x: "120%", opacity: 0 }}
							animate={{ x: 0, opacity: 1, transition: { duration: DURATION.default, ease: EASE_OUT } }}
							exit={{ x: "120%", opacity: 0, transition: { duration: 0.15, ease: EASE_IN } }}
						>
							<span style={{ flexShrink: 0, color: meta.color, display: "flex", marginTop: 2 }}>
								<Icon
									name={meta.icon}
									size={16}
								/>
							</span>
							<span style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>{t.message}</span>
							<button
								type="button"
								onClick={() => onDismiss(t.id)}
								style={{
									background: "transparent",
									border: "none",
									color: "var(--text-muted)",
									cursor: "pointer",
									padding: 2,
									display: "flex",
									flexShrink: 0,
								}}
								aria-label="Dismiss"
							>
								<Icon
									name="close"
									size={14}
								/>
							</button>
							{t.duration > 0 && (
								<div
									className="toast-progress"
									style={{ animationDuration: `${t.duration}ms`, background: meta.color }}
								/>
							)}
						</motion.div>
					);
				})}
			</AnimatePresence>
		</div>
	);
}
