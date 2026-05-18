/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
import Icon from "../../components/ui/Icon.jsx";
import { getSocket } from "../../socket";
import useAuthStore from "../../store/authStore";

const DEFAULT_COLOR = "#111827";
const DEFAULT_WIDTH = 4;
const CURSOR_TTL_MS = 5000;
const EXPORT_QUALITY = 0.92;
const SNAPSHOT_CACHE_PREFIX = "whiteboard:snapshot";

const COLOR_OPTIONS = [
	{ label: "Graphite", value: "#111827" },
	{ label: "Indigo", value: "#4338CA" },
	{ label: "Sky", value: "#0284C7" },
	{ label: "Emerald", value: "#16A34A" },
	{ label: "Amber", value: "#F59E0B" },
	{ label: "Rose", value: "#E11D48" },
	{ label: "Violet", value: "#7C3AED" },
];

const BRUSH_SIZES = [2, 4, 6, 10, 14];

const getCanvasPoint = (event, canvas) => {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;

	return {
		x: (event.clientX - rect.left) * scaleX,
		y: (event.clientY - rect.top) * scaleY,
	};
};

const drawStroke = (ctx, stroke) => {
	if (!ctx || !stroke) return;
	ctx.strokeStyle = stroke.color || DEFAULT_COLOR;
	ctx.lineWidth = stroke.width || DEFAULT_WIDTH;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	ctx.moveTo(stroke.from.x, stroke.from.y);
	ctx.lineTo(stroke.to.x, stroke.to.y);
	ctx.stroke();
};

export default function Whiteboard({ workspaceId, boardId }) {
	const accessToken = useAuthStore((state) => state.accessToken);
	const canvasRef = useRef(null);
	const ctxRef = useRef(null);
	const isDrawing = useRef(false);
	const lastPoint = useRef(null);
	const lastCursorSent = useRef(0);
	const activeColorRef = useRef(DEFAULT_COLOR);
	const activeWidthRef = useRef(DEFAULT_WIDTH);

	const [snapshotData, setSnapshotData] = useState(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const [remoteCursors, setRemoteCursors] = useState({});
	const [canvasRect, setCanvasRect] = useState(null);
	const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
	const [strokeWidth, setStrokeWidth] = useState(DEFAULT_WIDTH);

	useEffect(() => {
		activeColorRef.current = strokeColor;
	}, [strokeColor]);

	useEffect(() => {
		activeWidthRef.current = strokeWidth;
	}, [strokeWidth]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		ctxRef.current = canvas.getContext("2d");

		const updateRect = () => {
			setCanvasRect(canvas.getBoundingClientRect());
		};

		updateRect();
		window.addEventListener("resize", updateRect);

		return () => {
			window.removeEventListener("resize", updateRect);
		};
	}, []);

	useEffect(() => {
		if (!workspaceId || !boardId) return undefined;
		let isActive = true;
		const cacheKey = `${SNAPSHOT_CACHE_PREFIX}:${workspaceId}:${boardId}`;
		try {
			const cached = sessionStorage.getItem(cacheKey);
			if (cached) {
				setSnapshotData(cached);
			}
		} catch (err) {
			console.warn("Failed to read whiteboard cache:", err);
		}
		const loadSnapshot = async () => {
			try {
				const { data } = await api.get(`/workspaces/${workspaceId}/boards/${boardId}/whiteboard`);
				if (isActive && data?.data) {
					setSnapshotData(data.data);
					try {
						sessionStorage.setItem(cacheKey, data.data);
					} catch (err) {
						console.warn("Failed to write whiteboard cache:", err);
					}
				}
			} catch (err) {
				console.warn("Failed to load whiteboard snapshot:", err);
			}
		};

		loadSnapshot();
		return () => {
			isActive = false;
		};
	}, [workspaceId, boardId]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = ctxRef.current;
		if (!canvas || !ctx || !snapshotData) return;

		const image = new Image();
		image.decoding = "async";
		let hasDrawn = false;
		const draw = () => {
			if (hasDrawn) return;
			hasDrawn = true;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		};
		image.onload = draw;
		image.src = snapshotData;
		image
			.decode?.()
			.then(draw)
			.catch(() => {});
	}, [snapshotData]);

	useEffect(() => {
		const interval = setInterval(() => {
			setRemoteCursors((prev) => {
				const now = Date.now();
				const next = {};
				Object.entries(prev).forEach(([userId, cursor]) => {
					if (now - cursor.lastSeen < CURSOR_TTL_MS) {
						next[userId] = cursor;
					}
				});
				return next;
			});
		}, 2000);

		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (!boardId || !accessToken) return undefined;
		const canvas = canvasRef.current;
		const ctx = ctxRef.current;
		const socket = getSocket(accessToken);
		if (!canvas || !ctx || !socket) return undefined;

		socket.emit("join:board", { boardId });

		const handleRemoteStroke = ({ stroke }) => {
			drawStroke(ctx, stroke);
		};

		const handleRemoteCursor = ({ userId, name, x, y }) => {
			setRemoteCursors((prev) => ({
				...prev,
				[userId]: {
					userId,
					name,
					x,
					y,
					lastSeen: Date.now(),
				},
			}));
		};

		const handleCleared = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			setSnapshotData(null);
		};

		socket.on("whiteboard:stroke", handleRemoteStroke);
		socket.on("whiteboard:cursor", handleRemoteCursor);
		socket.on("whiteboard:cleared", handleCleared);

		const handlePointerDown = (event) => {
			isDrawing.current = true;
			lastPoint.current = getCanvasPoint(event, canvas);
		};

		const handlePointerMove = (event) => {
			const point = getCanvasPoint(event, canvas);
			const now = Date.now();
			if (now - lastCursorSent.current > 50) {
				lastCursorSent.current = now;
				socket.emit("whiteboard:cursor", { boardId, x: point.x, y: point.y });
			}

			if (!isDrawing.current || !lastPoint.current) return;
			const stroke = {
				from: lastPoint.current,
				to: point,
				color: activeColorRef.current,
				width: activeWidthRef.current,
			};
			lastPoint.current = point;
			drawStroke(ctx, stroke);
			socket.emit("whiteboard:stroke", { boardId, stroke });
		};

		const handlePointerUp = () => {
			isDrawing.current = false;
			lastPoint.current = null;
		};

		canvas.addEventListener("pointerdown", handlePointerDown);
		canvas.addEventListener("pointermove", handlePointerMove);
		canvas.addEventListener("pointerup", handlePointerUp);
		canvas.addEventListener("pointerleave", handlePointerUp);
		canvas.addEventListener("pointercancel", handlePointerUp);

		return () => {
			socket.off("whiteboard:stroke", handleRemoteStroke);
			socket.off("whiteboard:cursor", handleRemoteCursor);
			socket.off("whiteboard:cleared", handleCleared);
			canvas.removeEventListener("pointerdown", handlePointerDown);
			canvas.removeEventListener("pointermove", handlePointerMove);
			canvas.removeEventListener("pointerup", handlePointerUp);
			canvas.removeEventListener("pointerleave", handlePointerUp);
			canvas.removeEventListener("pointercancel", handlePointerUp);
		};
	}, [boardId, accessToken]);

	const handleSave = async () => {
		if (!workspaceId || !boardId || !canvasRef.current) return;
		setIsSaving(true);
		setSaveError("");
		try {
			const canvas = canvasRef.current;
			const exportCanvas = document.createElement("canvas");
			exportCanvas.width = canvas.width;
			exportCanvas.height = canvas.height;
			const exportCtx = exportCanvas.getContext("2d");
			exportCtx.fillStyle = "#ffffff";
			exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
			exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
			let data = exportCanvas.toDataURL("image/webp", EXPORT_QUALITY);
			if (!data.startsWith("data:image/webp")) {
				data = exportCanvas.toDataURL("image/jpeg", EXPORT_QUALITY);
			}
			await api.post(`/workspaces/${workspaceId}/boards/${boardId}/whiteboard/save`, { data });
			setSnapshotData(data);
			try {
				const cacheKey = `${SNAPSHOT_CACHE_PREFIX}:${workspaceId}:${boardId}`;
				sessionStorage.setItem(cacheKey, data);
			} catch (err) {
				console.warn("Failed to write whiteboard cache:", err);
			}
		} catch (err) {
			console.warn("Failed to save whiteboard:", err);
			setSaveError("Save failed. Try again in a moment.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleClear = () => {
		const canvas = canvasRef.current;
		const ctx = ctxRef.current;
		if (!canvas || !ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		setSnapshotData(null);
		try {
			const cacheKey = `${SNAPSHOT_CACHE_PREFIX}:${workspaceId}:${boardId}`;
			sessionStorage.removeItem(cacheKey);
		} catch (err) {
			console.warn("Failed to clear whiteboard cache:", err);
		}
		const socket = getSocket(accessToken);
		if (socket) {
			socket.emit("whiteboard:clear", { boardId });
		}
	};

	const cursorEntries = Object.values(remoteCursors);

	return (
		<section className="page-panel" style={{ padding: 16 }}>
			<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
				<div>
					<h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Shared Whiteboard</h3>
					<p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Draw, sketch, and move together in real time.</p>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<button onClick={handleClear} className="btn btn-ghost btn-sm" type="button">Clear</button>
					<button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-sm" type="button">
						{isSaving ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Saving...</> : "Save snapshot"}
					</button>
				</div>
			</div>

			<div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12 }}>
				<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Color</span>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							{COLOR_OPTIONS.map((option) => (
								<button
									key={option.value}
									style={{
										width: 24,
										height: 24,
										borderRadius: "50%",
										backgroundColor: option.value,
										border: strokeColor === option.value ? "2px solid #fff" : "2px solid var(--border)",
										outline: strokeColor === option.value ? `2px solid ${option.value}` : "none",
										cursor: "pointer",
									}}
									onClick={() => setStrokeColor(option.value)}
									type="button"
									title={option.label}
									aria-label={`Select ${option.label} color`}
								/>
							))}
						</div>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Brush</span>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							{BRUSH_SIZES.map((size) => (
								<button key={size} onClick={() => setStrokeWidth(size)} type="button" className={`tab-button${strokeWidth === size ? " active" : ""}`} style={{ padding: "4px 9px", fontSize: 11 }}>
									{size}px
								</button>
							))}
						</div>
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
					<Icon name="edit" size={14} style={{ color: strokeColor }} />
					<span>Brush {strokeWidth}px</span>
				</div>
			</div>
			{saveError ? <p className="message-error" style={{ marginTop: 10 }}>{saveError}</p> : null}

			<div
				style={{
					position: "relative",
					marginTop: 16,
					height: 520,
					width: "100%",
					overflow: "hidden",
					borderRadius: "var(--radius-lg)",
					border: "1px solid var(--border)",
					backgroundColor: "#F8FAFC",
					backgroundImage:
						"linear-gradient(rgba(15, 23, 42, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.07) 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			>
				<canvas
					ref={canvasRef}
					width={1200}
					height={700}
					style={{ width: "100%", height: "100%", touchAction: "none" }}
				/>
				{canvasRect &&
					cursorEntries.map((cursor) => {
						const scaleX = canvasRect.width / 1200;
						const scaleY = canvasRect.height / 700;
						const left = cursor.x * scaleX;
						const top = cursor.y * scaleY;
						return (
							<div
								key={cursor.userId}
								style={{ pointerEvents: "none", position: "absolute", display: "flex", alignItems: "center", gap: 4, transform: "translate(-50%, -50%)", left, top }}
							>
								<span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
								<span style={{ borderRadius: 4, background: "rgba(15,17,23,0.86)", padding: "2px 6px", fontSize: 10, fontWeight: 600, color: "#fff" }}>{cursor.name}</span>
							</div>
						);
					})}
			</div>
		</section>
	);
}
