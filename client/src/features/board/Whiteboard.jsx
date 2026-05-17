import { useEffect, useRef } from "react";
import { getSocket } from "../../socket";

export default function Whiteboard({ boardId }) {
	const canvasRef = useRef(null);
	const isDrawing = useRef(false);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		const socket = getSocket();

		// Draw strokes received from other users
		socket.on("whiteboard:stroke", ({ stroke }) => {
			drawStroke(ctx, stroke);
		});

		// Show other users' cursors (render name labels on canvas overlay)
		socket.on("whiteboard:cursor", ({ userId, name, x, y }) => {
			updateRemoteCursor(userId, name, x, y);
		});

		socket.on("whiteboard:cleared", () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		});

		const handleMouseDown = (e) => {
			isDrawing.current = true; /* start stroke */
		};
		const handleMouseMove = (e) => {
			if (!isDrawing.current) return;
			const stroke = buildStroke(e);
			drawStroke(ctx, stroke); // draw locally immediately
			socket.emit("whiteboard:stroke", { boardId, stroke });
			socket.emit("whiteboard:cursor", { boardId, x: e.clientX, y: e.clientY });
		};
		const handleMouseUp = () => {
			isDrawing.current = false;
		};

		canvas.addEventListener("mousedown", handleMouseDown);
		canvas.addEventListener("mousemove", handleMouseMove);
		canvas.addEventListener("mouseup", handleMouseUp);

		return () => {
			socket.off("whiteboard:stroke");
			socket.off("whiteboard:cursor");
			socket.off("whiteboard:cleared");
			canvas.removeEventListener("mousedown", handleMouseDown);
			canvas.removeEventListener("mousemove", handleMouseMove);
			canvas.removeEventListener("mouseup", handleMouseUp);
		};
	}, [boardId]);

	return (
		<canvas
			ref={canvasRef}
			width={1200}
			height={700}
			style={{ border: "1px solid #eee" }}
		/>
	);
}