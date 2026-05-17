# CollabBoard — Phase-Wise Build Plan

**Total estimated time:** 5 weeks (part-time, ~3–4 hrs/day)  
**Stack:** MongoDB · Express · React · Node.js · Socket.io · Redis · Bull  
**Reference:** PRD.md (all endpoint specs, models, socket events live there)

---

## Overview

| Phase | Focus                                | Duration   | Deliverable                                           |
| ----- | ------------------------------------ | ---------- | ----------------------------------------------------- |
| 1     | Project setup + Auth                 | Days 1–4   | Working register/login/logout with JWT + Google OAuth |
| 2     | Workspaces + Core API                | Days 5–9   | Workspaces, members, boards, tasks (REST only)        |
| 3     | Real-time Kanban (Socket.io + Redis) | Days 10–15 | Live board with drag-and-drop synced across users     |
| 4     | Whiteboard + Live Presence           | Days 16–20 | Shared canvas, cursor tracking, online indicators     |
| 5     | Chat, Notifications + Bull Queues    | Days 21–26 | Chat room, email notifications, activity log          |
| 6     | Polish, Docker + Deployment          | Days 27–32 | Dockerized, deployed, README done                     |

---

## Phase 1 — Project Setup & Authentication

**Duration:** Days 1–4  
**Goal:** Scaffold the entire project, wire up the database and Redis, implement full auth flow with JWT (access + refresh tokens) and Google OAuth. By the end of this phase you should be able to register, login, logout, and refresh tokens — with tokens stored securely.

---

### 1.1 Repository & Folder Scaffolding

Set up the monorepo structure exactly as defined in PRD Section 11.

```bash
collabboard/
├── client/          # React + Vite
├── server/          # Node + Express
└── docker-compose.yml
```

**Backend init:**

```bash
mkdir -p server/src/{config,controllers,middleware,models,routes,services,queues,socket}
cd server
npm init -y
npm install express mongoose ioredis jsonwebtoken bcryptjs passport \
  passport-google-oauth20 passport-jwt cors dotenv express-rate-limit \
  rate-limit-redis zod cookie-parser morgan uuid
npm install -D nodemon
```

**Frontend init:**

```bash
cd client
npm create vite@latest . -- --template react
npm install axios react-router-dom zustand socket.io-client
npm install -D tailwindcss postcss autoprefixer
```

**server/src/app.js** — wire up Express:

```js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/api/v1/auth", authRoutes);

export default app;
```

**server/server.js** — entry point:

```js
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`Server on ${PORT}`)));
```

---

### 1.2 Config Files

**server/src/config/db.js:**

```js
import mongoose from "mongoose";

export const connectDB = async () => {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("MongoDB connected");
};
```

**server/src/config/redis.js:**

```js
import Redis from "ioredis";

const redis = new Redis({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT,
	password: process.env.REDIS_PASSWORD || undefined,
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err));

export default redis;
```

---

### 1.3 User Model

**server/src/models/User.js:**

```js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true },
		passwordHash: { type: String, default: null },
		avatar: { type: String, default: null },
		googleId: { type: String, default: null },
		isVerified: { type: Boolean, default: false },
		refreshTokenHash: { type: String, default: null },
	},
	{ timestamps: true },
);

// Never return password hash to client
userSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.passwordHash;
	delete obj.refreshTokenHash;
	return obj;
};

userSchema.methods.comparePassword = async function (plain) {
	return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model("User", userSchema);
```

---

### 1.4 Auth Utilities

**server/src/services/token.service.js:**

```js
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import redis from "../config/redis.js";

export const generateTokens = async (user) => {
	const jti = uuidv4();

	const accessToken = jwt.sign({ userId: user._id, email: user.email, jti }, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
	});

	const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" });

	// Store hashed refresh token in Redis (TTL: 7 days)
	const hash = await bcrypt.hash(refreshToken, 10);
	await redis.set(`refresh:${user._id}`, hash, "EX", 60 * 60 * 24 * 7);

	return { accessToken, refreshToken };
};

export const blacklistToken = async (jti, expiresInMs) => {
	const ttlSeconds = Math.ceil(expiresInMs / 1000);
	await redis.set(`blacklist:${jti}`, "1", "EX", ttlSeconds);
};

export const isBlacklisted = async (jti) => {
	const val = await redis.get(`blacklist:${jti}`);
	return val !== null;
};
```

---

### 1.5 Auth Middleware

**server/src/middleware/auth.js:**

```js
import jwt from "jsonwebtoken";
import { isBlacklisted } from "../services/token.service.js";
import User from "../models/User.js";

export const authenticateToken = async (req, res, next) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader?.split(" ")[1];
	if (!token) return res.status(401).json({ message: "No token provided" });

	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		// Check blacklist (logout)
		if (await isBlacklisted(decoded.jti)) {
			return res.status(401).json({ message: "Token revoked" });
		}

		req.user = await User.findById(decoded.userId).select("-passwordHash -refreshTokenHash");
		if (!req.user) return res.status(401).json({ message: "User not found" });

		req.tokenJti = decoded.jti;
		req.tokenExp = decoded.exp;
		next();
	} catch (err) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};
```

---

### 1.6 Auth Controller & Routes

**server/src/controllers/auth.controller.js** — implement these functions:

**`register`**

1. Validate body with Zod (`name`, `email`, `password` min 8 chars).
2. Check if email already exists → 409 if so.
3. Hash password with `bcrypt.hash(password, 12)`.
4. Create User document with `isVerified: false`.
5. Queue email verification job (Phase 5 — skip for now, just log the token).
6. Return 201 `{ message: 'Registration successful. Please verify your email.' }`.

**`login`**

1. Validate body.
2. Find user by email → 401 if not found.
3. Compare password → 401 if wrong.
4. Call `generateTokens(user)`.
5. Set `refreshToken` in `httpOnly` cookie.
6. Return 200 `{ accessToken, user }`.

**`logout`**

1. Get access token from header, decode to get `jti` and `exp`.
2. Call `blacklistToken(jti, remainingMs)`.
3. Delete `refresh:{userId}` from Redis.
4. Clear cookie.
5. Return 200.

**`refresh`**

1. Read refresh token from cookie or body.
2. Verify JWT signature.
3. Fetch hashed token from Redis → compare → 401 if mismatch.
4. Call `generateTokens(user)` (old token auto-deleted, new one stored).
5. Return 200 `{ accessToken }`.

**server/src/routes/auth.routes.js:**

```js
import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import passport from "passport";

const router = Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/logout", authenticateToken, auth.logout);
router.post("/refresh", auth.refresh);
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), auth.googleCallback);

export default router;
```

---

### 1.7 Google OAuth Strategy

**server/src/config/passport.js:**

```js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: process.env.GOOGLE_CALLBACK_URL,
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				let user = await User.findOne({ googleId: profile.id });
				if (!user) {
					user = await User.findOne({ email: profile.emails[0].value });
					if (user) {
						user.googleId = profile.id;
						await user.save();
					} else {
						user = await User.create({
							name: profile.displayName,
							email: profile.emails[0].value,
							avatar: profile.photos[0]?.value,
							googleId: profile.id,
							isVerified: true,
						});
					}
				}
				return done(null, user);
			} catch (err) {
				return done(err);
			}
		},
	),
);

export default passport;
```

In `googleCallback` controller: generate tokens → redirect to `CLIENT_URL/auth/callback?token=<accessToken>` (frontend picks it up from query param).

---

### 1.8 Frontend — Auth Pages & Store

**Zustand auth store (`client/src/store/authStore.js`):**

```js
import { create } from "zustand";

const useAuthStore = create((set) => ({
	user: null,
	accessToken: null,
	setAuth: (user, accessToken) => set({ user, accessToken }),
	clearAuth: () => set({ user: null, accessToken: null }),
}));

export default useAuthStore;
```

**Axios instance (`client/src/api/axios.js`):**

```js
import axios from "axios";
import useAuthStore from "../store/authStore";

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, withCredentials: true });

// Attach access token to every request
api.interceptors.request.use((config) => {
	const token = useAuthStore.getState().accessToken;
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

// Auto-refresh on 401
api.interceptors.response.use(null, async (error) => {
	if (error.response?.status === 401 && !error.config._retry) {
		error.config._retry = true;
		const { data } = await axios.post("/api/v1/auth/refresh", {}, { withCredentials: true });
		useAuthStore.getState().setAuth(useAuthStore.getState().user, data.accessToken);
		error.config.headers.Authorization = `Bearer ${data.accessToken}`;
		return api(error.config);
	}
	return Promise.reject(error);
});

export default api;
```

Build `LoginPage`, `RegisterPage` with forms, wire to store.  
Add a `ProtectedRoute` component that reads `useAuthStore` and redirects to `/login` if unauthenticated.

---

### Phase 1 Checklist

- [ ] Express server starts and connects to MongoDB + Redis
- [ ] `POST /auth/register` creates user, returns 201
- [ ] `POST /auth/login` returns `accessToken` + sets `refreshToken` cookie
- [ ] `POST /auth/logout` blacklists token in Redis
- [ ] `POST /auth/refresh` issues new access token
- [ ] Google OAuth redirects and creates/links user
- [ ] Frontend login/register forms work and store token in Zustand
- [ ] Protected routes redirect unauthenticated users
- [ ] Axios interceptor auto-refreshes expired tokens

---

## Phase 2 — Workspaces, Boards & Tasks (REST API)

**Duration:** Days 5–9  
**Goal:** Build all the core REST API — workspaces, members, boards, columns, tasks, comments. No real-time yet. The frontend gets a working Kanban board that requires manual refresh to see others' changes (real-time comes in Phase 3).

---

### 2.1 Models

Create all remaining Mongoose models from PRD Section 3. Key points:

**Workspace model** — embed members array with `{ user, role, joinedAt }`. Add index on `members.user` for fast membership lookups.

**Board model** — embed columns array with `{ _id, title, order, color }`. Columns are embedded (not a separate collection) since they only exist within a board.

**Task model** — separate collection, referenced by board + columnId. Index on `{ board: 1, columnId: 1, order: 1 }` for sorted column queries.

**Comment model** — separate collection, ref to task. Keep task's `comments` array as a list of ObjectIds for quick count, but fetch via Comment model for actual content.

Add remaining models: `Notification`, `Message`, `WhiteboardSnapshot`, `ActivityLog`.

---

### 2.2 Role Middleware

**server/src/middleware/checkRole.js:**

```js
import Workspace from "../models/Workspace.js";

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export const checkWorkspaceMember = async (req, res, next) => {
	const workspace = await Workspace.findById(req.params.workspaceId);
	if (!workspace) return res.status(404).json({ message: "Workspace not found" });

	const member = workspace.members.find((m) => m.user.toString() === req.user._id.toString());
	if (!member) return res.status(403).json({ message: "Not a workspace member" });

	req.workspace = workspace;
	req.memberRole = member.role;
	next();
};

export const checkRole = (minRole) => (req, res, next) => {
	if (ROLE_RANK[req.memberRole] < ROLE_RANK[minRole]) {
		return res.status(403).json({ message: `Requires ${minRole} role or higher` });
	}
	next();
};
```

Middleware chain on every workspace route:

```js
router.use("/:workspaceId", authenticateToken, checkWorkspaceMember);
```

---

### 2.3 Workspace Controller

Implement all endpoints from PRD Section 4.3:

**`createWorkspace`**

1. Validate `name`.
2. Generate unique `slug` from name (e.g. `my-team-${nanoid(6)}`).
3. Create workspace with `owner: req.user._id` and `members: [{ user: req.user._id, role: 'owner' }]`.
4. Return 201 with workspace object.

**`listWorkspaces`**

```js
// Find all workspaces where req.user._id is in members array
const workspaces = await Workspace.find({ "members.user": req.user._id }).populate("members.user", "name email avatar");
```

**`inviteMember`**

1. Find user by email from body.
2. Check they aren't already a member.
3. Push `{ user: foundUser._id, role, joinedAt: Date.now() }` to `members`.
4. Save workspace.
5. In Phase 5 — queue `send_workspace_invite` Bull job. For now, just return 200.

**`changeMemberRole`** — find member in array by userId, update role, save.

**`removeMember`** — filter member out of array. If removing owner, reject.

---

### 2.4 Board Controller

Implement all endpoints from PRD Section 4.4:

**`createBoard`** — creates board with default columns: `['To Do', 'In Progress', 'Review', 'Done']`.

**`getBoardWithTasks`** (most important endpoint):

```js
// 1. Fetch board
const board = await Board.findById(req.params.boardId);

// 2. Fetch all tasks for this board, sorted by column order
const tasks = await Task.find({ board: board._id }).populate("assignees", "name avatar email").sort({ order: 1 });

// 3. Group tasks by columnId
const tasksByColumn = {};
for (const col of board.columns) {
	tasksByColumn[col._id.toString()] = tasks.filter((t) => t.columnId.toString() === col._id.toString());
}

// 4. Return merged structure
return res.json({
	...board.toObject(),
	columns: board.columns.map((col) => ({
		...col.toObject(),
		tasks: tasksByColumn[col._id.toString()] || [],
	})),
});
```

**`reorderColumns`** — receive `orderedColumnIds[]`, update each column's `order` field, save.

---

### 2.5 Task Controller

Implement all endpoints from PRD Section 4.5:

**`createTask`**

1. Find max `order` value in target column → `newOrder = max + 1`.
2. Create task.
3. Return 201 with populated task.
4. (Phase 3 will add socket emit here.)

**`moveTask`** (most complex):

```js
// Body: { targetColumnId, newOrder }
// 1. Get current task
const task = await Task.findById(req.params.taskId);
const oldColumnId = task.columnId;

// 2. If moving within same column: shift tasks between old and new order
// 3. If moving to different column:
//    - Decrement order of tasks in old column after removed task
//    - Increment order of tasks in new column at/after target position
// 4. Update task's columnId + order, save
// 5. (Phase 3 will emit task:moved socket event)
```

**`addComment`**

1. Create Comment document.
2. Push comment `_id` to `task.comments`.
3. Parse `@mentions` from content or from explicit `mentions[]` array in body.
4. Create Notification documents for each mentioned user.
5. (Phase 5 will queue email jobs.)

---

### 2.6 User Controller

Implement PRD Section 4.2:

**`getMe`** — return `req.user` (already populated by auth middleware).

**`searchUsers`** — `GET /users/search?q=priya`:

```js
const users = await User.find({
	$or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }],
})
	.select("name email avatar")
	.limit(10);
```

---

### 2.7 Wire All Routes in app.js

```js
import workspaceRoutes from "./routes/workspace.routes.js";
import boardRoutes from "./routes/board.routes.js";
import taskRoutes from "./routes/task.routes.js";
import userRoutes from "./routes/user.routes.js";

app.use("/api/v1/users", authenticateToken, userRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
// Board and task routes nested under workspaces
app.use("/api/v1/workspaces/:workspaceId/boards", authenticateToken, checkWorkspaceMember, boardRoutes);
```

---

### 2.8 Frontend — Workspace & Board UI

Build these pages/components (no real-time yet, data fetches on mount):

**WorkspaceList page** — fetch `GET /workspaces`, show cards, "Create workspace" button.

**WorkspaceDashboard** — show member list, recent activity (empty for now), boards list.

**BoardPage** — fetch `GET .../boards/:boardId` → render columns + task cards. Implement drag-and-drop with `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd):

```bash
npm install @hello-pangea/dnd
```

On drop end:

```js
const onDragEnd = async (result) => {
	const { draggableId, source, destination } = result;
	if (!destination) return;
	// Optimistically update local state
	// Then call PATCH .../tasks/:id/move
};
```

**Task detail modal** — open on task click, show description, assignees, due date, comments.

---

### Phase 2 Checklist

- [ ] All 9 Mongoose models created with proper indexes
- [ ] `checkWorkspaceMember` + `checkRole` middleware working
- [ ] Full workspace CRUD + member management
- [ ] Board CRUD with default column creation
- [ ] `getBoardWithTasks` returns tasks grouped by column
- [ ] Task CRUD including `moveTask` with order recalculation
- [ ] Comment creation with mention parsing
- [ ] User search endpoint working
- [ ] Frontend renders Kanban board with drag-and-drop (non-real-time)
- [ ] Task detail modal opens with full info
- [ ] All routes tested with Postman / Thunder Client

---

## Phase 3 — Real-Time Kanban with Socket.io + Redis

**Duration:** Days 10–15  
**Goal:** Make the Kanban board live. Every task create, move, update, and delete is instantly reflected for all users on the same board — across multiple browser tabs and (via Redis adapter) across multiple server instances.

---

### 3.1 Socket.io Server Setup

**server/src/config/socket.js:**

```js
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const initSocket = async (httpServer) => {
	const io = new Server(httpServer, {
		cors: { origin: process.env.CLIENT_URL, credentials: true },
	});

	// Redis adapter — critical for horizontal scaling
	// Two separate Redis clients required (pub + sub)
	const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` });
	const subClient = pubClient.duplicate();
	await Promise.all([pubClient.connect(), subClient.connect()]);
	io.adapter(createAdapter(pubClient, subClient));
	console.log("Socket.io using Redis adapter");

	// Auth middleware for socket connections
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth?.token || socket.handshake.query?.token;
			if (!token) return next(new Error("Authentication error"));
			const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
			socket.userId = decoded.userId;
			socket.user = await User.findById(decoded.userId).select("name avatar email");
			next();
		} catch {
			next(new Error("Invalid token"));
		}
	});

	// Register event handlers
	io.on("connection", (socket) => {
		console.log(`Socket connected: ${socket.userId}`);

		// Join a personal room for user-specific events (notifications)
		socket.join(`user:${socket.userId}`);

		// Register all handlers
		registerBoardHandlers(io, socket);
		registerPresenceHandlers(io, socket);
		registerWhiteboardHandlers(io, socket);
		registerChatHandlers(io, socket);

		socket.on("disconnect", () => handleDisconnect(io, socket));
	});

	return io;
};
```

Update `server.js` to use `http.createServer(app)` and pass to `initSocket`.

---

### 3.2 Board Socket Handlers

**server/src/socket/handlers/board.handler.js:**

The socket handlers don't do DB work themselves — they call the same service functions the REST controllers use, then broadcast the result.

```js
export const registerBoardHandlers = (io, socket) => {
	socket.on("join:board", ({ boardId }) => {
		socket.join(`board:${boardId}`);
		socket.currentBoardId = boardId;
	});

	socket.on("leave:board", ({ boardId }) => {
		socket.leave(`board:${boardId}`);
	});
};
```

Then in each REST controller, after DB write, emit to the board room:

**In `createTask` controller (server):**

```js
// After task is saved and populated:
req.io.to(`board:${task.board}`).emit("task:created", { task });
```

**In `moveTask` controller:**

```js
req.io.to(`board:${boardId}`).emit("task:moved", {
	taskId,
	fromColumnId: oldColumnId,
	toColumnId: targetColumnId,
	newOrder,
});
```

**In `updateTask` controller:**

```js
req.io.to(`board:${boardId}`).emit("task:updated", { taskId, changes: updatedFields });
```

**In `deleteTask` controller:**

```js
req.io.to(`board:${boardId}`).emit("task:deleted", { taskId });
```

**In `reorderColumns` controller:**

```js
req.io.to(`board:${boardId}`).emit("board:columns_reordered", { orderedColumnIds });
```

To make `req.io` available, attach io to app in server.js:

```js
app.set("io", io);
// In controllers: const io = req.app.get('io');
```

---

### 3.3 Redis Task Cache

When a user joins a board, instead of hitting MongoDB every time, serve from Redis cache:

```js
// In getBoardWithTasks controller:
const cacheKey = `board:${boardId}:tasks`;
const cached = await redis.get(cacheKey);
if (cached) return res.json(JSON.parse(cached));

// ...fetch from DB...
await redis.set(cacheKey, JSON.stringify(boardData), "EX", 300); // 5 min TTL
return res.json(boardData);
```

**Cache invalidation** — after any write (createTask, moveTask, updateTask, deleteTask), delete the cache:

```js
await redis.del(`board:${boardId}:tasks`);
```

This means all reads after a write go to MongoDB and repopulate the cache. The socket event ensures connected clients update in real time without needing a re-fetch.

---

### 3.4 Frontend — Socket Client Setup

**client/src/socket/index.js:**

```js
import { io } from "socket.io-client";
import useAuthStore from "../store/authStore";

let socket = null;

export const getSocket = () => {
	if (!socket) {
		const token = useAuthStore.getState().accessToken;
		socket = io(import.meta.env.VITE_SOCKET_URL, {
			auth: { token },
			transports: ["websocket"],
		});
	}
	return socket;
};

export const disconnectSocket = () => {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
};
```

**client/src/hooks/useBoardSocket.js:**

```js
import { useEffect } from "react";
import { getSocket } from "../socket";

export const useBoardSocket = (boardId, { onTaskCreated, onTaskMoved, onTaskUpdated, onTaskDeleted, onColumnsReordered }) => {
	useEffect(() => {
		if (!boardId) return;
		const socket = getSocket();
		socket.emit("join:board", { boardId });

		socket.on("task:created", onTaskCreated);
		socket.on("task:moved", onTaskMoved);
		socket.on("task:updated", onTaskUpdated);
		socket.on("task:deleted", onTaskDeleted);
		socket.on("board:columns_reordered", onColumnsReordered);

		return () => {
			socket.emit("leave:board", { boardId });
			socket.off("task:created");
			socket.off("task:moved");
			socket.off("task:updated");
			socket.off("task:deleted");
			socket.off("board:columns_reordered");
		};
	}, [boardId]);
};
```

**In BoardPage component:**

```js
useBoardSocket(boardId, {
	onTaskCreated: ({ task }) => setBoardData((prev) => addTaskToColumn(prev, task)),
	onTaskMoved: ({ taskId, toColumnId, newOrder }) => setBoardData((prev) => moveTask(prev, taskId, toColumnId, newOrder)),
	onTaskUpdated: ({ taskId, changes }) => setBoardData((prev) => updateTask(prev, taskId, changes)),
	onTaskDeleted: ({ taskId }) => setBoardData((prev) => removeTask(prev, taskId)),
	onColumnsReordered: ({ orderedColumnIds }) => setBoardData((prev) => reorderColumns(prev, orderedColumnIds)),
});
```

Write pure helper functions (`addTaskToColumn`, `moveTask`, etc.) that take immutable board state and return updated state — easy to test.

---

### Phase 3 Checklist

- [ ] Socket.io server initialized with Redis adapter
- [ ] JWT auth on socket connection (invalid token → disconnect)
- [ ] `join:board` / `leave:board` rooms working
- [ ] `task:created` emitted and received on all clients for same board
- [ ] `task:moved` emitted on drag-drop, all other clients update instantly
- [ ] `task:updated` and `task:deleted` broadcasting correctly
- [ ] Redis board cache set on GET, invalidated on any write
- [ ] Open same board in two browser tabs — both stay in sync
- [ ] Redis adapter confirmed working (check Redis CLI: `PUBSUB CHANNELS *`)

---

## Phase 4 — Whiteboard & Live Presence

**Duration:** Days 16–20  
**Goal:** Add the shared drawing canvas and the live presence system (who's online, where they are, cursor positions).

---

### 4.1 Presence Handler

**server/src/socket/handlers/presence.handler.js:**

Presence state is stored entirely in Redis — no MongoDB writes needed.

```js
const PRESENCE_TTL = 35; // seconds — client pings every 30s

export const registerPresenceHandlers = (io, socket) => {
	socket.on("join:workspace", async ({ workspaceId }) => {
		socket.join(`ws:${workspaceId}`);
		socket.currentWorkspaceId = workspaceId;

		// Add to Redis presence hash
		await redis.hset(
			`presence:${workspaceId}`,
			socket.userId,
			JSON.stringify({
				name: socket.user.name,
				avatar: socket.user.avatar,
				boardId: null,
			}),
		);
		await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);

		// Broadcast updated presence to workspace
		const presenceData = await getPresenceList(workspaceId);
		io.to(`ws:${workspaceId}`).emit("presence:update", { users: presenceData });
	});

	socket.on("presence:active", async ({ workspaceId, boardId }) => {
		// Update which board user is currently on + refresh TTL
		await redis.hset(
			`presence:${workspaceId}`,
			socket.userId,
			JSON.stringify({
				name: socket.user.name,
				avatar: socket.user.avatar,
				boardId,
			}),
		);
		await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);
	});
};

// On disconnect:
export const handleDisconnect = async (io, socket) => {
	if (socket.currentWorkspaceId) {
		await redis.hdel(`presence:${socket.currentWorkspaceId}`, socket.userId);
		const presenceData = await getPresenceList(socket.currentWorkspaceId);
		io.to(`ws:${socket.currentWorkspaceId}`).emit("presence:update", { users: presenceData });
	}
};

const getPresenceList = async (workspaceId) => {
	const raw = await redis.hgetall(`presence:${workspaceId}`);
	if (!raw) return [];
	return Object.entries(raw).map(([userId, json]) => ({ userId, ...JSON.parse(json) }));
};
```

**Frontend `usePresence` hook:**

```js
export const usePresence = (workspaceId) => {
	const [onlineUsers, setOnlineUsers] = useState([]);
	useEffect(() => {
		const socket = getSocket();
		socket.emit("join:workspace", { workspaceId });
		socket.on("presence:update", ({ users }) => setOnlineUsers(users));

		// Heartbeat — refresh presence every 30s
		const interval = setInterval(() => {
			socket.emit("presence:active", { workspaceId, boardId: currentBoardId });
		}, 30000);

		return () => {
			clearInterval(interval);
			socket.off("presence:update");
		};
	}, [workspaceId]);
	return onlineUsers;
};
```

Display online users as an avatar stack in the board header.

---

### 4.2 Whiteboard Handler

The whiteboard is a `<canvas>` element. Drawing events (strokes, cursor moves) are sent via Socket.io at high frequency — never written to MongoDB during drawing. MongoDB only stores periodic snapshots via the REST API.

**server/src/socket/handlers/whiteboard.handler.js:**

```js
export const registerWhiteboardHandlers = (io, socket) => {
	socket.on("whiteboard:stroke", ({ boardId, stroke }) => {
		// Broadcast stroke to everyone else in the board room
		socket.to(`board:${boardId}`).emit("whiteboard:stroke", {
			userId: socket.userId,
			stroke,
		});
	});

	socket.on("whiteboard:cursor", ({ boardId, x, y }) => {
		socket.to(`board:${boardId}`).emit("whiteboard:cursor", {
			userId: socket.userId,
			name: socket.user.name,
			x,
			y,
		});
	});

	socket.on("whiteboard:clear", async ({ boardId }) => {
		// Verify user has editor+ role before clearing
		socket.to(`board:${boardId}`).emit("whiteboard:cleared", {
			clearedBy: socket.user.name,
		});
	});
};
```

**Frontend Whiteboard component:**

```jsx
// client/src/features/board/Whiteboard.jsx
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
```

**Whiteboard REST** (`GET` + `POST /whiteboard/save`) — fetch and save JSON canvas state (call `canvas.toDataURL()` or serialize paths). Add a "Save" button that calls the REST endpoint and stores a `WhiteboardSnapshot` in MongoDB.

---

### Phase 4 Checklist

- [ ] `join:workspace` adds user to Redis presence hash
- [ ] `presence:update` fires on join, disconnect, and tab change
- [ ] Avatar stack in board header shows correct online users
- [ ] 30-second heartbeat refreshing presence TTL in Redis
- [ ] Canvas draws locally on mousedown/mousemove
- [ ] `whiteboard:stroke` broadcast — drawing on one tab appears on another
- [ ] Other users' cursors shown as labeled dots on canvas
- [ ] `whiteboard:clear` broadcasts and clears all clients
- [ ] "Save" button calls REST, snapshot stored in MongoDB
- [ ] Load board → fetch latest snapshot and paint it on canvas

---

## Phase 5 — Chat, Notifications & Bull Queues

**Duration:** Days 21–26  
**Goal:** Add the workspace chat room with typing indicators, build the in-app notification system, and wire up Bull for async email delivery. This phase introduces the queue workers which run as separate Node processes.

---

### 5.1 Chat Handler

**server/src/socket/handlers/chat.handler.js:**

```js
import Message from "../models/Message.js";

export const registerChatHandlers = (io, socket) => {
	socket.on("chat:send", async ({ workspaceId, content }) => {
		// Persist message to MongoDB
		const message = await Message.create({
			workspace: workspaceId,
			sender: socket.userId,
			content,
			type: "text",
		});

		const populated = await message.populate("sender", "name avatar");

		// Broadcast to workspace room
		io.to(`ws:${workspaceId}`).emit("chat:message", { message: populated });
	});

	socket.on("chat:typing", ({ workspaceId, isTyping }) => {
		// Broadcast to everyone except sender
		socket.to(`ws:${workspaceId}`).emit("chat:typing", {
			userId: socket.userId,
			name: socket.user.name,
			isTyping,
		});
	});
};
```

**Chat REST endpoint** (`GET /workspaces/:id/messages`) — cursor-based pagination:

```js
const messages = await Message.find({
	workspace: req.params.workspaceId,
	...(before ? { _id: { $lt: before } } : {}),
})
	.sort({ _id: -1 })
	.limit(limit)
	.populate("sender", "name avatar");

return res.json({
	messages: messages.reverse(),
	hasMore: messages.length === limit,
	nextCursor: messages[0]?._id,
});
```

**Frontend Chat component** — on mount, fetch last 50 messages from REST. Then listen to `chat:message` via socket to append new ones. Send via `socket.emit('chat:send', ...)`. Show typing indicator when `chat:typing` event fires (auto-hide after 3s of silence).

---

### 5.2 Bull Queue Setup

**server/src/queues/emailQueue.js:**

```js
import Bull from "bull";

const emailQueue = new Bull("email", {
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
		password: process.env.REDIS_PASSWORD,
	},
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 1000 },
		removeOnComplete: true,
		removeOnFail: false,
	},
});

export default emailQueue;
```

**server/src/queues/activityQueue.js** — same pattern, queue name `'activity'`.

**Usage from controllers (add to existing controllers from Phase 2):**

```js
import emailQueue from "../queues/emailQueue.js";
import activityQueue from "../queues/activityQueue.js";

// In inviteMember controller:
await emailQueue.add("send_workspace_invite", {
	to: invitedUser.email,
	userName: invitedUser.name,
	workspaceName: workspace.name,
	inviterName: req.user.name,
});

// In createTask controller:
await activityQueue.add("log_task_created", {
	workspaceId: task.workspace,
	actorId: req.user._id,
	taskId: task._id,
	taskTitle: task.title,
});
```

---

### 5.3 Email Worker

**server/src/queues/workers/emailWorker.js** — run as a separate process:

```js
import "dotenv/config";
import nodemailer from "nodemailer";
import emailQueue from "../emailQueue.js";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: process.env.SMTP_PORT,
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const templates = {
	send_workspace_invite: (data) => ({
		subject: `You've been invited to ${data.workspaceName}`,
		html: `<p>Hi ${data.userName}, <b>${data.inviterName}</b> invited you to join <b>${data.workspaceName}</b>.</p>`,
	}),
	send_task_assigned: (data) => ({
		subject: `Task assigned: ${data.taskTitle}`,
		html: `<p>Hi ${data.userName}, you've been assigned <b>${data.taskTitle}</b> in <b>${data.boardName}</b>. <a href="${data.taskUrl}">View task →</a></p>`,
	}),
	send_comment_mention: (data) => ({
		subject: `${data.authorName} mentioned you in a comment`,
		html: `<p>Hi ${data.userName}, you were mentioned in a comment on <b>${data.taskTitle}</b>.</p>`,
	}),
	send_password_reset: (data) => ({
		subject: "Reset your CollabBoard password",
		html: `<p>Click <a href="${data.resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
	}),
};

emailQueue.process(async (job) => {
	const { name, data } = job;
	const template = templates[name];
	if (!template) throw new Error(`Unknown email job: ${name}`);

	const { subject, html } = template(data);
	await transporter.sendMail({
		from: process.env.EMAIL_FROM,
		to: data.to,
		subject,
		html,
	});
	console.log(`Email sent [${name}] to ${data.to}`);
});

emailQueue.on("failed", (job, err) => {
	console.error(`Email job failed [${job.name}]:`, err.message);
});

console.log("Email worker running...");
```

Start workers separately:

```json
// package.json
"scripts": {
  "dev": "nodemon server.js",
  "worker:email": "node src/queues/workers/emailWorker.js",
  "worker:activity": "node src/queues/workers/activityWorker.js"
}
```

---

### 5.4 Activity Worker

**server/src/queues/workers/activityWorker.js:**

```js
import activityQueue from "../activityQueue.js";
import ActivityLog from "../../models/ActivityLog.js";

activityQueue.process(async (job) => {
	const { name, data } = job;

	const actionMap = {
		log_task_created: "task.created",
		log_task_moved: "task.moved",
		log_task_deleted: "task.deleted",
		log_member_invited: "member.invited",
		log_comment_added: "comment.added",
	};

	await ActivityLog.create({
		workspace: data.workspaceId,
		actor: data.actorId,
		action: actionMap[name],
		entity: { type: "task", id: data.taskId },
		meta: data,
	});
});
```

---

### 5.5 Scheduled Job — Due Date Reminders

```js
// Add to emailWorker.js — runs daily at 9am
import cron from "node-cron";
import Task from "../../models/Task.js";

cron.schedule("0 9 * * *", async () => {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
	const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

	const dueTasks = await Task.find({
		dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
		status: { $ne: "done" },
	}).populate("assignees", "name email");

	for (const task of dueTasks) {
		for (const assignee of task.assignees) {
			await emailQueue.add("send_task_due_reminder", {
				to: assignee.email,
				userName: assignee.name,
				taskTitle: task.title,
			});
		}
	}
});
```

---

### 5.6 In-App Notification System

**Notification REST** (PRD Section 4.8) — implement `listNotifications`, `markRead`, `markAllRead`, `deleteNotification`.

**Real-time delivery** — when a notification is created (e.g., task assigned), emit to the user's personal socket room:

```js
// In task controller, after creating Notification documents:
const io = req.app.get("io");
io.to(`user:${assigneeId}`).emit("notification:new", { notification });
```

**Frontend** — bell icon in header, red badge with unread count fetched on mount. Socket listener appends new notifications to list and increments badge. Clicking notification navigates to the relevant task/workspace.

---

### Phase 5 Checklist

- [ ] Workspace chat — messages persist to MongoDB via socket handler
- [ ] Chat history loads from REST on page open
- [ ] Typing indicator appears/disappears correctly for other users
- [ ] Bull `emailQueue` and `activityQueue` defined and exported
- [ ] Email worker process sends emails for invite, task assigned, mention
- [ ] Activity worker writes `ActivityLog` documents
- [ ] Due date reminder cron fires and queues emails
- [ ] Failed jobs visible in Bull dashboard (install `bull-board` for dev)
- [ ] In-app notifications appear in bell dropdown
- [ ] `notification:new` socket event received and badge increments
- [ ] Notification REST — mark read, mark all read working

---

## Phase 6 — Polish, Docker & Deployment

**Duration:** Days 27–32  
**Goal:** Containerize everything, add rate limiting, error handling, write the README, and deploy. This phase is what makes the project feel production-grade on your CV.

---

### 6.1 Global Error Handling

**server/src/middleware/errorHandler.js:**

```js
export const errorHandler = (err, req, res, next) => {
	console.error(err.stack);
	const status = err.status || 500;
	const message = err.message || "Internal server error";
	res.status(status).json({ message, ...(process.env.NODE_ENV === "development" && { stack: err.stack }) });
};
```

Add to `app.js` as last middleware. Use `next(err)` pattern consistently in controllers.

**Zod validation middleware:**

```js
export const validate = (schema) => (req, res, next) => {
	const result = schema.safeParse(req.body);
	if (!result.success) {
		return res.status(400).json({ message: "Validation error", errors: result.error.flatten() });
	}
	req.body = result.data;
	next();
};
```

---

### 6.2 Rate Limiting

```js
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../config/redis.js";

export const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 100,
	store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
});

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // 10 login attempts per 15 min
	store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
});

// Apply in app.js
app.use("/api/v1", apiLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
```

---

### 6.3 Docker Compose

**docker-compose.yml:**

```yaml
version: "3.8"
services:
    mongo:
        image: mongo:7
        ports: ["27017:27017"]
        volumes:
            - mongo_data:/data/db

    redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        command: redis-server --requirepass ${REDIS_PASSWORD}

    server:
        build: ./server
        ports: ["5000:5000"]
        env_file: ./server/.env
        depends_on: [mongo, redis]
        volumes:
            - ./server:/app
            - /app/node_modules

    worker_email:
        build: ./server
        command: node src/queues/workers/emailWorker.js
        env_file: ./server/.env
        depends_on: [mongo, redis]

    worker_activity:
        build: ./server
        command: node src/queues/workers/activityWorker.js
        env_file: ./server/.env
        depends_on: [mongo, redis]

    client:
        build: ./client
        ports: ["5173:5173"]
        depends_on: [server]

volumes:
    mongo_data:
```

**server/Dockerfile:**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

---

### 6.4 Bull Board (Dev Dashboard)

Install `@bull-board/api` and `@bull-board/express` to get a visual dashboard for your queues at `/admin/queues` — great for demos.

```js
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";
import emailQueue from "./queues/emailQueue.js";
import activityQueue from "./queues/activityQueue.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullAdapter(emailQueue), new BullAdapter(activityQueue)], serverAdapter });
app.use("/admin/queues", serverAdapter.getRouter());
```

---

### 6.5 MongoDB Indexes

Add these indexes for production performance:

```js
// Task — most queried by board + column + order
taskSchema.index({ board: 1, columnId: 1, order: 1 });

// Message — most queried by workspace, sorted by _id desc
messageSchema.index({ workspace: 1, _id: -1 });

// Notification — most queried by recipient + isRead
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// ActivityLog — most queried by workspace, sorted by date
activityLogSchema.index({ workspace: 1, createdAt: -1 });

// Workspace member lookup
workspaceSchema.index({ "members.user": 1 });
```

---

### 6.6 README.md

Write a README covering:

1. Project overview + features list
2. Architecture diagram (copy from PRD)
3. Tech stack with why each was chosen
4. Local setup (clone → `docker compose up`)
5. Environment variables reference
6. API base URL + link to PRD.md for full docs
7. Screenshots (Kanban, Whiteboard, Chat)

---

### Phase 6 Checklist

- [ ] Global error handler returns consistent JSON errors
- [ ] Zod validation on all POST/PATCH routes
- [ ] Rate limiting on auth + API routes, backed by Redis
- [ ] `docker compose up` starts all services (mongo, redis, server, 2 workers, client)
- [ ] Both email and activity workers run as separate containers
- [ ] Bull board accessible at `/admin/queues` in dev
- [ ] All MongoDB indexes created
- [ ] `.env.example` file committed (no real secrets)
- [ ] README with setup instructions and architecture diagram
- [ ] Deploy to Railway / Render (free tier supports Docker)
- [ ] Test with two different browsers — full real-time flow works end to end

---

## Final CV Description

> **CollabBoard** — Real-Time Collaborative Workspace | MERN · Socket.io · Redis · Bull  
> Built a multiplayer task management platform (Figma meets Notion) with live Kanban, shared whiteboard, and workspace chat. Key engineering highlights: WebSocket horizontal scaling via Redis pub/sub adapter; presence system using Redis TTL hash keys; async email + activity logging via Bull job queues with exponential backoff retry; JWT auth with token blacklisting and refresh rotation in Redis; draggable Kanban with optimistic UI updates. Containerized with Docker Compose.

---

_End of Phase Plan — CollabBoard v1.0_
