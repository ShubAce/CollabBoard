import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";
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
		<section className="rounded-2xl border border-ghost-white-200 bg-white/90 p-4 shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-jet-black-900">Shared Whiteboard</h3>
					<p className="text-xs text-jet-black-500">Draw, sketch, and move together in real time.</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={handleClear}
						className="rounded-lg border border-ghost-white-200 px-3 py-1.5 text-xs font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
						type="button"
					>
						Clear
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="rounded-lg bg-space-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-space-indigo-600 disabled:opacity-60"
						type="button"
					>
						{isSaving ? "Saving..." : "Save snapshot"}
					</button>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ghost-white-200 bg-ghost-white-100/60 p-3">
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-jet-black-600">Color</span>
						<div className="flex items-center gap-1">
							{COLOR_OPTIONS.map((option) => (
								<button
									key={option.value}
									className={`h-6 w-6 rounded-full border-2 transition ${
										strokeColor === option.value ? "border-jet-black-900" : "border-white"
									}`}
									style={{ backgroundColor: option.value }}
									onClick={() => setStrokeColor(option.value)}
									type="button"
									title={option.label}
									aria-label={`Select ${option.label} color`}
								/>
							))}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-jet-black-600">Brush</span>
						<div className="flex items-center gap-1">
							{BRUSH_SIZES.map((size) => (
								<button
									key={size}
									className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
										strokeWidth === size
											? "border-space-indigo-500 bg-space-indigo-500 text-white"
											: "border-ghost-white-200 bg-white text-jet-black-700 hover:bg-ghost-white-100"
									}`}
									onClick={() => setStrokeWidth(size)}
									type="button"
								>
									{size}px
								</button>
							))}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2 text-xs text-jet-black-500">
					<span
						className="inline-flex h-2 w-2 rounded-full"
						style={{ backgroundColor: strokeColor }}
					/>
					<span>Brush {strokeWidth}px</span>
				</div>
			</div>
			{saveError ? <p className="mt-2 text-xs text-red-600">{saveError}</p> : null}

			<div
				className="relative mt-4 h-[520px] w-full overflow-hidden rounded-xl border border-ghost-white-200 bg-white"
				style={{
					backgroundImage:
						"linear-gradient(rgba(15, 23, 42, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			>
				<canvas
					ref={canvasRef}
					width={1200}
					height={700}
					className="h-full w-full touch-none"
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
								className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
								style={{ left, top }}
							>
								<span className="h-2 w-2 rounded-full bg-space-indigo-500" />
								<span className="rounded bg-jet-black-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">{cursor.name}</span>
							</div>
						);
					})}
			</div>
		</section>
	);
}
