import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import passport from "passport";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import authRoutes from "./routes/auth.routes.js";
import boardRoutes from "./routes/board.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import taskRoutes from "./routes/task.routes.js";
import userRoutes from "./routes/user.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import "./config/passport.js";
import { authenticateToken } from "./middleware/auth.js";
import { checkWorkspaceMember } from "./middleware/checkRole.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import emailQueue from "./queues/emailQueue.js";
import activityQueue from "./queues/activityQueue.js";

const app = express();

// ─── Core middleware ───────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());

// ─── Bull Board (dev queue dashboard) ─────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
	const serverAdapter = new ExpressAdapter();
	serverAdapter.setBasePath("/admin/queues");
	createBullBoard({
		queues: [new BullAdapter(emailQueue), new BullAdapter(activityQueue)],
		serverAdapter,
	});
	app.use("/admin/queues", serverAdapter.getRouter());
}

// ─── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/invite", inviteRoutes);
app.use("/api/v1/users", authenticateToken, userRoutes);
app.use("/api/v1/workspaces", authenticateToken, workspaceRoutes);
app.use("/api/v1/workspaces/:workspaceId/boards", authenticateToken, checkWorkspaceMember, boardRoutes);
app.use("/api/v1/workspaces/:workspaceId/boards/:boardId/tasks", authenticateToken, checkWorkspaceMember, taskRoutes);
app.use("/api/v1/notifications", authenticateToken, notificationRoutes);

// ─── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

export default app;
