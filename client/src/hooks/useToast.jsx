import { createContext, useCallback, useContext, useRef, useState } from "react";

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

const TYPE_ICON = {
	success: "✓",
	error: "✕",
	info: "ℹ",
	warning: "⚠",
};

function ToastContainer({ toasts, onDismiss }) {
	if (!toasts.length) return null;
	return (
		<div className="toast-container">
			{toasts.map((t) => (
				<div key={t.id} className={`toast toast-${t.type}`} style={{ position: "relative", overflow: "hidden" }}>
					<span
						style={{
							fontSize: 16,
							flexShrink: 0,
							color:
								t.type === "success"
									? "var(--green)"
									: t.type === "error"
										? "var(--red)"
										: t.type === "warning"
											? "var(--yellow)"
											: "var(--blue)",
						}}
					>
						{TYPE_ICON[t.type]}
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
							padding: "2px 4px",
							fontSize: 16,
							flexShrink: 0,
						}}
						aria-label="Dismiss"
					>
						×
					</button>
					{t.duration > 0 && <div className="toast-progress" style={{ animationDuration: `${t.duration}ms`, background: t.type === "success" ? "var(--green)" : t.type === "error" ? "var(--red)" : t.type === "warning" ? "var(--yellow)" : "var(--blue)" }} />}
				</div>
			))}
		</div>
	);
}
