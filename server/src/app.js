import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import passport from "passport";
import authRoutes from "./routes/auth.routes.js";
import boardRoutes from "./routes/board.routes.js";
import taskRoutes from "./routes/task.routes.js";
import userRoutes from "./routes/user.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import "./config/passport.js";
import { authenticateToken } from "./middleware/auth.js";
import { checkWorkspaceMember } from "./middleware/checkRole.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", authenticateToken, userRoutes);
app.use("/api/v1/workspaces", authenticateToken, workspaceRoutes);
app.use("/api/v1/workspaces/:workspaceId/boards", authenticateToken, checkWorkspaceMember, boardRoutes);
app.use("/api/v1/workspaces/:workspaceId/boards/:boardId/tasks", authenticateToken, checkWorkspaceMember, taskRoutes);

export default app;
