# CollabBoard — Phase-Wise Build Plan

**Total estimated time:** 5 weeks (part-time, ~3–4 hrs/day)  
**Stack:** MongoDB · Express · React · Node.js · Socket.io · Redis · Bull  
**Reference:** PRD.md (all endpoint specs, models, socket events live there)

---

## Overview

| Phase | Focus | Duration | Deliverable |
|---|---|---|---|
| 1 | Project setup + Auth | Days 1–4 | Working register/login/logout with JWT + Google OAuth |
| 2 | Workspaces + Core API | Days 5–9 | Workspaces, members, boards, tasks (REST only) |
| 2.5 | Member Invite System | Days 10–13 | Email invite flow + live user search + invite acceptance UI |
| 3 | Real-time Kanban (Socket.io + Redis) | Days 14–19 | Live board with drag-and-drop synced across users |
| 4 | Whiteboard + Live Presence | Days 20–24 | Shared canvas, cursor tracking, online indicators |
| 5 | Chat, Notifications + Bull Queues | Days 25–30 | Chat room, email notifications, activity log |
| 6 | Polish, Docker + Deployment | Days 31–36 | Dockerized, deployed, README done |

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
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/v1/auth', authRoutes);

export default app;
```

**server/server.js** — entry point:
```js
import app from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`Server on ${PORT}`)));
```

---

### 1.2 Config Files

**server/src/config/db.js:**
```js
import mongoose from 'mongoose';

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
};
```

**server/src/config/redis.js:**
```js
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD || undefined,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

export default redis;
```

---

### 1.3 User Model

**server/src/models/User.js:**
```js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  email:            { type: String, required: true, unique: true, lowercase: true },
  passwordHash:     { type: String, default: null },
  avatar:           { type: String, default: null },
  googleId:         { type: String, default: null },
  isVerified:       { type: Boolean, default: false },
  refreshTokenHash: { type: String, default: null },
}, { timestamps: true });

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

export default mongoose.model('User', userSchema);
```

---

### 1.4 Auth Utilities

**server/src/services/token.service.js:**
```js
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import redis from '../config/redis.js';

export const generateTokens = async (user) => {
  const jti = uuidv4();

  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, jti },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );

  // Store hashed refresh token in Redis (TTL: 7 days)
  const hash = await bcrypt.hash(refreshToken, 10);
  await redis.set(`refresh:${user._id}`, hash, 'EX', 60 * 60 * 24 * 7);

  return { accessToken, refreshToken };
};

export const blacklistToken = async (jti, expiresInMs) => {
  const ttlSeconds = Math.ceil(expiresInMs / 1000);
  await redis.set(`blacklist:${jti}`, '1', 'EX', ttlSeconds);
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
import jwt from 'jsonwebtoken';
import { isBlacklisted } from '../services/token.service.js';
import User from '../models/User.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Check blacklist (logout)
    if (await isBlacklisted(decoded.jti)) {
      return res.status(401).json({ message: 'Token revoked' });
    }

    req.user = await User.findById(decoded.userId).select('-passwordHash -refreshTokenHash');
    if (!req.user) return res.status(401).json({ message: 'User not found' });

    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
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
import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import passport from 'passport';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', authenticateToken, auth.logout);
router.post('/refresh', auth.refresh);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), auth.googleCallback);

export default router;
```

---

### 1.7 Google OAuth Strategy

**server/src/config/passport.js:**
```js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
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
}));

export default passport;
```

In `googleCallback` controller: generate tokens → redirect to `CLIENT_URL/auth/callback?token=<accessToken>` (frontend picks it up from query param).

---

### 1.8 Frontend — Auth Pages & Store

**Zustand auth store (`client/src/store/authStore.js`):**
```js
import { create } from 'zustand';

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
import axios from 'axios';
import useAuthStore from '../store/authStore';

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
    const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
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
import Workspace from '../models/Workspace.js';

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export const checkWorkspaceMember = async (req, res, next) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

  const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
  if (!member) return res.status(403).json({ message: 'Not a workspace member' });

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
router.use('/:workspaceId', authenticateToken, checkWorkspaceMember);
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
const workspaces = await Workspace.find({ 'members.user': req.user._id })
  .populate('members.user', 'name email avatar');
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
const tasks = await Task.find({ board: board._id })
  .populate('assignees', 'name avatar email')
  .sort({ order: 1 });

// 3. Group tasks by columnId
const tasksByColumn = {};
for (const col of board.columns) {
  tasksByColumn[col._id.toString()] = tasks.filter(
    t => t.columnId.toString() === col._id.toString()
  );
}

// 4. Return merged structure
return res.json({
  ...board.toObject(),
  columns: board.columns.map(col => ({
    ...col.toObject(),
    tasks: tasksByColumn[col._id.toString()] || [],
  }))
});
```

**`reorderColumns`** — receive `orderedColumnIds[]`, update each column's `order` field, save.

---

### 2.4.5 — The Kanban Column System: To Do, In Progress, Review, Done

This section explains what these four columns actually mean, how they connect to the data model, and how every part of the system uses them.

---

#### What Each Column Represents

The four default columns represent the **lifecycle of a single task** — where it currently sits in the team's workflow:

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────┐
│   To Do      │ → │   In Progress    │ → │   Review     │ → │   Done   │
│              │   │                  │   │              │   │          │
│ Planned but  │   │ Actively being   │   │ Work done,   │   │ Verified │
│ not started  │   │ worked on now    │   │ needs check  │   │ shipped  │
└──────────────┘   └──────────────────┘   └──────────────┘   └──────────┘
```

**To Do** — The backlog of planned work. Tasks exist here, nobody has started them yet. The team can see everything that's coming up. Examples: "Design login page", "Write unit tests for auth", "Fix navbar alignment".

**In Progress** — Someone just dragged a card here. It means "I am working on this right now." This is critical for team visibility — if Priya is on a task, nobody else accidentally picks it up. A healthy board usually has 1–2 cards per person here max (too many = overloaded).

**Review** — The developer/designer has finished their part but the task isn't done yet. It needs a second pair of eyes — could be a code review on GitHub, a QA test, design feedback, or client approval. This column exists specifically to separate "I think it's done" from "the team agrees it's done."

**Done** — Fully complete. Verified by whoever owns Review. No more action needed. These cards are the team's progress record for the sprint.

---

#### Why Two Separate Fields: `columnId` vs `status`

Every Task document has both:

```js
{
  columnId: ObjectId,   // which column it visually sits in on THIS board
  status: String,       // semantic state: 'todo' | 'in_progress' | 'review' | 'done'
}
```

They seem redundant but they're not. Here's why both exist:

**`columnId`** is a visual/positional field. It's a foreign key to the `columns` array inside the Board document. It answers: "which column should this card render in right now?" It changes whenever you drag the card, even within the same column (reordering within To Do).

**`status`** is a semantic/business-logic field. It answers: "what is the actual state of this task's work?" It's used by:
- The Bull cron job (`status !== 'done'` → send due date reminder)
- The activity log (`task.moved` records from/to status names)
- Future filtering/reporting ("show me all In Progress tasks assigned to me")
- API consumers who don't care about board layout, just task state

When you drag a card to a new column, the `moveTask` controller updates **both** fields together:

```js
// In moveTask controller:
const statusMap = {
  'To Do':       'todo',
  'In Progress': 'in_progress',
  'Review':      'review',
  'Done':        'done',
};

const targetColumn = board.columns.find(c => c._id.toString() === targetColumnId);
task.columnId = targetColumnId;
task.status   = statusMap[targetColumn.title] || 'todo';  // map column name → status
await task.save();
```

This means status stays in sync with column position automatically on every drag.

---

#### How Each Part of the System Uses the Columns

**1. Due Date Reminder (Bull cron job):**
```js
// Only sends reminder emails for tasks NOT in Done
const dueTasks = await Task.find({
  dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
  status: { $ne: 'done' },   // ← skips Done column tasks
}).populate('assignees');
```
If a task is dragged to Done, it stops showing up in morning reminder emails automatically.

**2. Activity Log (Bull activityQueue):**
```js
// Every time a task crosses a column boundary, log it
await activityQueue.add('log_task_moved', {
  workspaceId: task.workspace,
  actorId: req.user._id,
  taskId: task._id,
  taskTitle: task.title,
  fromColumn: sourceColumnTitle,   // e.g. "In Progress"
  toColumn: targetColumnTitle,     // e.g. "Review"
  fromStatus: task.status,         // e.g. "in_progress"
  toStatus: newStatus,             // e.g. "review"
});
```
This creates a full audit trail — "Arjun moved Fix login bug: In Progress → Review at 3:42pm."

**3. Socket.io broadcast (real-time, Phase 3):**
```js
io.to(`board:${boardId}`).emit('task:moved', {
  taskId,
  fromColumnId,
  toColumnId,
  newOrder,
  newStatus,   // sent so frontend can update task.status in local state too
});
```

**4. Notifications — status-aware wording:**
When creating a `task_assigned` notification, include the current column so the email says "You've been assigned Fix login bug (currently In Progress)" instead of a generic message.

---

#### Columns Are Fully Customizable

The four default columns are just the starting point. They're created when a board is made:

```js
// In createBoard controller:
const defaultColumns = [
  { title: 'To Do',       order: 0, color: '#E2E8F0' },
  { title: 'In Progress', order: 1, color: '#BEE3F8' },
  { title: 'Review',      order: 2, color: '#FEFCBF' },
  { title: 'Done',        order: 3, color: '#C6F6D5' },
];
```

An admin can:
- **Rename** a column (e.g. "To Do" → "Backlog") — PATCH `.../columns/:columnId`
- **Recolor** it — same endpoint
- **Add** new columns (e.g. "Blocked", "Testing", "Deployed") — POST `.../columns`
- **Delete** a column — DELETE `.../columns/:columnId` (tasks in it move to To Do)
- **Reorder** columns — PATCH `.../columns/reorder`

The `statusMap` in `moveTask` handles renames gracefully — if the column is renamed, the map lookup falls back to `'todo'` so the system never breaks.

---

#### The Full Drag-and-Drop Flow with Optimistic Update

This is the most important interaction on the entire board. Here's every step:

```
User grabs "Fix login bug" card from "In Progress" and drops it on "Review"
              │
              ▼
@hello-pangea/dnd fires onDragEnd({ draggableId: taskId, source, destination })
              │
              ▼
Step 1 — OPTIMISTIC UPDATE (instant, no waiting):
  setBoardData(prev => {
    // Remove task from In Progress column in local state
    // Insert task into Review column at drop position
    // Update task.columnId and task.status in local state
    return newBoardState;
  });
  // User sees the card in Review IMMEDIATELY — zero lag
              │
              ▼
Step 2 — REST call fires in background:
  PATCH /workspaces/:wid/boards/:bid/tasks/:taskId/move
  Body: { targetColumnId: reviewColumnId, newOrder: 1 }
              │
              ├── SUCCESS (200):
              │     Server updates MongoDB
              │     Server invalidates Redis cache
              │     Server emits 'task:moved' via Socket.io
              │     → All other users' boards update
              │     Frontend: nothing extra needed (already looks right)
              │
              └── FAILURE (4xx/5xx):
                    Frontend: ROLL BACK optimistic update
                    setBoardData(originalState)
                    Show toast: "Failed to move task. Try again."
```

**Why optimistic update matters:** Without it, the card would freeze mid-drag until the server responds (~200ms+). With it, the UI feels instant — the server catches up silently in the background.

---

#### UI Layout — The Board Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Team Alpha  /  Sprint 3 Board                         👤👤👤  + Add Task  │
├────────────────┬──────────────────┬───────────────┬────────────────────────┤
│   TO DO  (3)   │ IN PROGRESS  (2) │  REVIEW  (1)  │      DONE  (5)        │
│                │                  │               │                        │
│ ┌────────────┐ │ ┌──────────────┐ │ ┌───────────┐ │ ┌──────────────────┐  │
│ │Design nav  │ │ │Fix login bug │ │ │API docs   │ │ │Setup project     │  │
│ │🔴 urgent   │ │ │🟡 medium     │ │ │🟢 low     │ │ │✓                 │  │
│ │👤 Priya    │ │ │👤 Arjun      │ │ │👤 Rahul   │ │ └──────────────────┘  │
│ │Due: tmrw   │ │ │Due: Fri      │ │ └───────────┘ │                        │
│ └────────────┘ │ └──────────────┘ │               │ ┌──────────────────┐  │
│                │                  │               │ │Write unit tests  │  │
│ ┌────────────┐ │ ┌──────────────┐ │               │ │✓                 │  │
│ │Write tests │ │ │Update README │ │               │ └──────────────────┘  │
│ │🟡 medium   │ │ │🟢 low        │ │               │                        │
│ │👤 Rahul    │ │ │👤 Priya      │ │               │  + 3 more...           │
│ └────────────┘ │ └──────────────┘ │               │                        │
│                │                  │               │                        │
│ + Add task     │ + Add task       │ + Add task    │ + Add task             │
└────────────────┴──────────────────┴───────────────┴────────────────────────┘
```

Each task card shows:
- Title (truncated at 2 lines)
- Priority badge (🔴 urgent / 🟡 medium / 🟢 low color coded)
- Assignee avatar(s) — max 3 shown, "+2" if more
- Due date — turns red if overdue, amber if due today/tomorrow
- Comment count icon if comments exist

Clicking a card opens the **Task Detail Modal**:

```
┌──────────────────────────────────────────────────────────┐
│  Fix login bug                              [Edit] [✕]   │
│  ─────────────────────────────────────────────────────── │
│  Status:   [ In Progress ▼ ]   Priority: [ Medium ▼ ]   │
│  Due date: [ Jun 15, 2025  ]                             │
│                                                          │
│  Assignees:                                              │
│  👤 Arjun Kumar  ✕     + Assign someone                 │
│                                                          │
│  Description:                                            │
│  The JWT token isn't being sent correctly on mobile...   │
│  [Edit description]                                      │
│                                                          │
│  ── Comments ──────────────────────────────────────────  │
│  👤 Priya:  Can you check the interceptor logic?         │
│             2 hours ago                                  │
│  👤 Arjun:  Yes, working on it now                       │
│             1 hour ago                                   │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │ Write a comment... @mention someone     │            │
│  └─────────────────────────────────────────┘            │
│                                        [Post Comment]    │
└──────────────────────────────────────────────────────────┘
```

The "Status" dropdown in the modal is wired to the same `moveTask` endpoint — changing it here is equivalent to dragging the card to that column. Both update `columnId` and `status` together.

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
  $or: [
    { name: { $regex: q, $options: 'i' } },
    { email: { $regex: q, $options: 'i' } },
  ]
}).select('name email avatar').limit(10);
```

---

### 2.7 Wire All Routes in app.js

```js
import workspaceRoutes from './routes/workspace.routes.js';
import boardRoutes from './routes/board.routes.js';
import taskRoutes from './routes/task.routes.js';
import userRoutes from './routes/user.routes.js';

app.use('/api/v1/users', authenticateToken, userRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);
// Board and task routes nested under workspaces
app.use('/api/v1/workspaces/:workspaceId/boards', authenticateToken, checkWorkspaceMember, boardRoutes);
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
- [ ] Board created with 4 default columns (To Do, In Progress, Review, Done) with colors
- [ ] `getBoardWithTasks` returns tasks grouped by column in correct order
- [ ] `moveTask` updates both `columnId` AND `status` fields together
- [ ] `statusMap` handles column renames gracefully (fallback to 'todo')
- [ ] Task order recalculated correctly when moving within and across columns
- [ ] Column CRUD — add, rename, recolor, delete, reorder
- [ ] Deleting a column moves its tasks to To Do (not deletes them)
- [ ] Comment creation with mention parsing
- [ ] User search endpoint working
- [ ] Frontend renders Kanban board with all 4 columns
- [ ] Drag-and-drop with optimistic update — card moves instantly
- [ ] Optimistic rollback on API failure with toast notification
- [ ] Task detail modal opens with status dropdown wired to moveTask
- [ ] Priority badges color-coded on cards
- [ ] Due date turns red if overdue, amber if due today/tomorrow
- [ ] All routes tested with Postman / Thunder Client

---

## Phase 2.5 — Member Invite System

**Duration:** Days 10–13  
**Goal:** Build the complete system for adding users to a workspace — both via email invite link (for users who may not have an account yet) and via a live name/email search (for users who already have accounts). By the end of this phase, an admin can invite anyone and that person lands inside the workspace correctly — whether they're a new user or existing one.

This phase has **3 distinct parts:**
1. Backend — invite token logic, new routes, new model
2. Backend — user search endpoint
3. Frontend — the full Invite UI inside WorkspaceSettings

---

### 2.5.1 New Model — WorkspaceInvite

We need a dedicated model to track pending invitations (so we can list them, revoke them, and check expiry).

**server/src/models/WorkspaceInvite.js:**
```js
import mongoose from 'mongoose';

const workspaceInviteSchema = new mongoose.Schema({
  workspace:   { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  email:       { type: String, required: true, lowercase: true },
  role:        { type: String, enum: ['editor', 'viewer', 'admin'], default: 'editor' },
  invitedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token:       { type: String, required: true, unique: true },   // signed JWT stored here too
  status:      { type: String, enum: ['pending', 'accepted', 'revoked', 'expired'], default: 'pending' },
  expiresAt:   { type: Date, required: true },
}, { timestamps: true });

// Index for fast lookup by token
workspaceInviteSchema.index({ token: 1 });
// Index to list all pending invites for a workspace
workspaceInviteSchema.index({ workspace: 1, status: 1 });

export default mongoose.model('WorkspaceInvite', workspaceInviteSchema);
```

Why store in MongoDB AND Redis? MongoDB is the source of truth (lets you list/revoke pending invites in the UI). Redis is the fast lookup layer on accept (avoids a DB query on the hot accept path, and handles expiry automatically via TTL).

---

### 2.5.2 New Environment Variable

```env
# server/.env
INVITE_TOKEN_SECRET=your_invite_secret_here
INVITE_TOKEN_EXPIRY=7d
```

---

### 2.5.3 New Routes

Add these to **server/src/routes/workspace.routes.js:**

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/workspaces/:workspaceId/invite` | ✓ | admin+ | Send invite (email or direct add) |
| GET | `/workspaces/:workspaceId/invites` | ✓ | admin+ | List all pending invites |
| DELETE | `/workspaces/:workspaceId/invites/:inviteId` | ✓ | admin+ | Revoke a pending invite |
| GET | `/invite/preview?token=` | ✗ | — | Preview invite details before accepting |
| POST | `/invite/accept` | ✗ | — | Accept invite (existing user) |
| POST | `/invite/accept-register` | ✗ | — | Accept invite + register new account |

Register the preview/accept routes on the **root** app level (not under workspaceId) since the user doesn't have membership yet:
```js
// server/src/app.js
app.use('/api/v1/invite', inviteRoutes);
```

---

### 2.5.4 Invite Controller — Full Implementation

**server/src/controllers/invite.controller.js:**

#### `sendInvite` — POST `/workspaces/:workspaceId/invite`

This single endpoint handles both cases: email-only invite AND direct add by search.

```js
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis.js';
import WorkspaceInvite from '../models/WorkspaceInvite.js';
import User from '../models/User.js';
import emailQueue from '../queues/emailQueue.js';

export const sendInvite = async (req, res) => {
  const { email, role = 'editor' } = req.body;
  const workspace = req.workspace; // attached by checkWorkspaceMember middleware

  // 1. Validate role
  if (!['viewer', 'editor', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // 2. Check if email is already a member
  const existingMember = workspace.members.find(
    m => m.user.email === email  // need populated members for this check
  );
  // Re-check via User lookup to be safe:
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const alreadyMember = workspace.members.some(
      m => m.user.toString() === existingUser._id.toString()
    );
    if (alreadyMember) {
      return res.status(409).json({ message: 'User is already a member of this workspace' });
    }
  }

  // 3. Check if a pending invite already exists for this email
  const existingInvite = await WorkspaceInvite.findOne({
    workspace: workspace._id,
    email,
    status: 'pending',
  });
  if (existingInvite) {
    return res.status(409).json({ message: 'An invitation has already been sent to this email' });
  }

  // 4. Generate invite token (unique id embedded so we can blacklist it)
  const tokenId = uuidv4();
  const inviteToken = jwt.sign(
    { tokenId, workspaceId: workspace._id, email, role },
    process.env.INVITE_TOKEN_SECRET,
    { expiresIn: process.env.INVITE_TOKEN_EXPIRY || '7d' }
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // 5. Save to MongoDB (for listing/revoking in UI)
  const invite = await WorkspaceInvite.create({
    workspace: workspace._id,
    email,
    role,
    invitedBy: req.user._id,
    token: inviteToken,
    expiresAt,
  });

  // 6. Store token in Redis for fast accept lookup (TTL = 7 days)
  await redis.set(
    `invite:${tokenId}`,
    JSON.stringify({ inviteId: invite._id, workspaceId: workspace._id, email, role }),
    'EX', 60 * 60 * 24 * 7
  );

  // 7a. If user already exists → direct add path
  if (existingUser) {
    // Add them to workspace immediately
    workspace.members.push({ user: existingUser._id, role, joinedAt: new Date() });
    await workspace.save();

    // Update invite status
    invite.status = 'accepted';
    await invite.save();

    // Delete from Redis (no longer needed)
    await redis.del(`invite:${tokenId}`);

    // Create in-app notification
    await Notification.create({
      recipient: existingUser._id,
      type: 'workspace_invite',
      payload: {
        workspaceName: workspace.name,
        workspaceId: workspace._id,
        inviterName: req.user.name,
        role,
      },
      isRead: false,
    });

    // Push real-time notification via Socket.io
    const io = req.app.get('io');
    io.to(`user:${existingUser._id}`).emit('notification:new', {
      type: 'workspace_invite',
      message: `${req.user.name} added you to ${workspace.name}`,
      workspaceId: workspace._id,
    });

    return res.status(200).json({
      message: `${existingUser.name} has been added to the workspace`,
      type: 'direct_add',
      user: { _id: existingUser._id, name: existingUser.name, email: existingUser.email, avatar: existingUser.avatar },
    });
  }

  // 7b. User doesn't exist → send email invite
  await emailQueue.add('send_workspace_invite', {
    to: email,
    inviterName: req.user.name,
    workspaceName: workspace.name,
    role,
    inviteUrl: `${process.env.CLIENT_URL}/invite/accept?token=${inviteToken}`,
  });

  return res.status(200).json({
    message: `Invitation sent to ${email}`,
    type: 'email_invite',
    invite: { _id: invite._id, email, role, expiresAt },
  });
};
```

#### `listPendingInvites` — GET `/workspaces/:workspaceId/invites`

```js
export const listPendingInvites = async (req, res) => {
  const invites = await WorkspaceInvite.find({
    workspace: req.params.workspaceId,
    status: 'pending',
  }).populate('invitedBy', 'name avatar').sort({ createdAt: -1 });

  return res.json({ invites });
};
```

#### `revokeInvite` — DELETE `/workspaces/:workspaceId/invites/:inviteId`

```js
export const revokeInvite = async (req, res) => {
  const invite = await WorkspaceInvite.findOne({
    _id: req.params.inviteId,
    workspace: req.params.workspaceId,
    status: 'pending',
  });
  if (!invite) return res.status(404).json({ message: 'Invite not found' });

  // Decode tokenId from the JWT to delete from Redis
  const decoded = jwt.decode(invite.token);
  await redis.del(`invite:${decoded.tokenId}`);

  invite.status = 'revoked';
  await invite.save();

  return res.json({ message: 'Invitation revoked' });
};
```

#### `previewInvite` — GET `/invite/preview?token=`

Called by the frontend before showing the accept page — tells it what workspace/role the invite is for without accepting it yet.

```js
export const previewInvite = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token required' });

  try {
    const decoded = jwt.verify(token, process.env.INVITE_TOKEN_SECRET);

    // Check Redis — if missing, token was revoked or already used
    const cached = await redis.get(`invite:${decoded.tokenId}`);
    if (!cached) return res.status(410).json({ message: 'This invitation has expired or been revoked' });

    const workspace = await Workspace.findById(decoded.workspaceId).select('name');
    const inviter = await User.findOne({ /* from invite record */ });

    // Check if email already has an account
    const existingUser = await User.findOne({ email: decoded.email }).select('name email avatar');

    return res.json({
      workspaceName: workspace.name,
      role: decoded.role,
      email: decoded.email,
      hasAccount: !!existingUser,
      existingUser: existingUser ? { name: existingUser.name, avatar: existingUser.avatar } : null,
    });
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired invitation link' });
  }
};
```

#### `acceptInvite` — POST `/invite/accept`

For users who already have an account and are logged in (or log in during acceptance).

```js
export const acceptInvite = async (req, res) => {
  const { token } = req.body;

  const decoded = jwt.verify(token, process.env.INVITE_TOKEN_SECRET);
  const cached = await redis.get(`invite:${decoded.tokenId}`);
  if (!cached) return res.status(410).json({ message: 'Invitation expired or already used' });

  const { workspaceId, email, role } = decoded;

  // Verify the logged-in user matches the invited email
  if (req.user.email !== email) {
    return res.status(403).json({
      message: `This invitation was sent to ${email}. Please log in with that account.`
    });
  }

  const workspace = await Workspace.findById(workspaceId);

  // Check not already a member
  const alreadyMember = workspace.members.some(m => m.user.toString() === req.user._id.toString());
  if (alreadyMember) {
    await redis.del(`invite:${decoded.tokenId}`);
    return res.json({ message: 'You are already a member', workspaceId });
  }

  // Add to workspace
  workspace.members.push({ user: req.user._id, role, joinedAt: new Date() });
  await workspace.save();

  // Mark invite accepted in MongoDB
  await WorkspaceInvite.findOneAndUpdate(
    { token },
    { status: 'accepted' }
  );

  // Consume token from Redis (single-use)
  await redis.del(`invite:${decoded.tokenId}`);

  return res.json({ message: 'You have joined the workspace!', workspaceId, workspaceName: workspace.name });
};
```

#### `acceptInviteAndRegister` — POST `/invite/accept-register`

For brand new users who don't have an account.

```js
export const acceptInviteAndRegister = async (req, res) => {
  const { token, name, password } = req.body;

  const decoded = jwt.verify(token, process.env.INVITE_TOKEN_SECRET);
  const cached = await redis.get(`invite:${decoded.tokenId}`);
  if (!cached) return res.status(410).json({ message: 'Invitation expired or already used' });

  const { workspaceId, email, role } = decoded;

  // Make sure email isn't already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      message: 'An account with this email already exists. Please log in and accept the invite.'
    });
  }

  // Create the account
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, isVerified: true });

  // Add to workspace
  const workspace = await Workspace.findById(workspaceId);
  workspace.members.push({ user: user._id, role, joinedAt: new Date() });
  await workspace.save();

  // Mark invite accepted
  await WorkspaceInvite.findOneAndUpdate({ token }, { status: 'accepted' });
  await redis.del(`invite:${decoded.tokenId}`);

  // Issue tokens so they're logged in immediately
  const { accessToken, refreshToken } = await generateTokens(user);
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'strict' });

  return res.status(201).json({
    message: 'Account created and joined workspace!',
    accessToken,
    user,
    workspaceId,
    workspaceName: workspace.name,
  });
};
```

---

### 2.5.5 User Search Endpoint

Already defined in PRD Section 4.2 but implement it fully now since it powers the invite UI:

**GET `/api/v1/users/search?q=priya&workspaceId=xxx`**

The `workspaceId` param lets the server exclude users who are already members from results.

```js
export const searchUsers = async (req, res) => {
  const { q, workspaceId } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Query must be at least 2 characters' });
  }

  // Get current member IDs to exclude from results
  let excludeIds = [req.user._id];
  if (workspaceId) {
    const workspace = await Workspace.findById(workspaceId).select('members');
    if (workspace) {
      excludeIds = workspace.members.map(m => m.user);
    }
  }

  const users = await User.find({
    _id: { $nin: excludeIds },
    $or: [
      { name:  { $regex: q.trim(), $options: 'i' } },
      { email: { $regex: q.trim(), $options: 'i' } },
    ],
  })
    .select('name email avatar')
    .limit(8);

  return res.json({ users });
};
```

---

### 2.5.6 Frontend — UI Design & Implementation

This is the full UI for the invite system, living inside the **WorkspaceSettings page** and a standalone **InviteAcceptPage**.

---

#### UI Part A — WorkspaceSettings Page (`/app/workspaces/:workspaceId/settings`)

The settings page has three tabs: **General**, **Members**, **Danger Zone**. The invite system lives entirely in the **Members tab**.

```
┌─────────────────────────────────────────────────────────────┐
│  Team Alpha                                    ⚙ Settings   │
│  ─────────────────────────────────────────────────────────  │
│  [ General ]  [ Members ]  [ Danger Zone ]                  │
│                                                             │
│  ── Members tab active ──────────────────────────────────── │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Invite people to Team Alpha                        │   │
│  │                                                     │   │
│  │  ┌───────────────────────────────────┐  ┌────────┐  │   │
│  │  │ 🔍 Search by name or email...     │  │ Invite │  │   │
│  │  └───────────────────────────────────┘  └────────┘  │   │
│  │                                                     │   │
│  │  Role: [ Editor ▼ ]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Current Members (4) ─────────────────────────────────── │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  👤 Arjun Kumar        arjun@gmail.com    Owner  —  │   │
│  │  👤 Priya Sharma       priya@gmail.com    Editor  ▼ │   │
│  │  👤 Rahul Verma        rahul@iitk.ac.in   Viewer  ▼ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Pending Invitations (2) ─────────────────────────────── │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✉ neha@gmail.com     Editor    Expires in 6 days  ✕│   │
│  │  ✉ jay@iitb.ac.in     Viewer    Expires in 2 days  ✕│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**The search input — live search dropdown:**

As the user types in the search box, after a 300ms debounce, it calls `GET /users/search?q=...&workspaceId=...` and shows a dropdown below the input:

```
┌───────────────────────────────────────┐
│ 🔍 priya                              │
└───────────────────────────────────────┘
┌───────────────────────────────────────┐
│  👤 Priya Sharma    priya@gmail.com   │  ← click to select
│  👤 Priyanka Nair   pk@outlook.com    │
└───────────────────────────────────────┘
```

When a result is clicked, the input transforms into a **chip/tag** showing the selected user:

```
┌─────────────────────────────────────────────────┐
│  👤 Priya Sharma  priya@gmail.com  ✕             │
└─────────────────────────────────────────────────┘
```

If the user types an email address that doesn't match any search results (no account found), instead of showing "no results", show an email invite option:

```
┌───────────────────────────────────────┐
│ 🔍 neha@gmail.com                     │
└───────────────────────────────────────┘
┌───────────────────────────────────────┐
│  ✉ Invite neha@gmail.com by email     │  ← click to select
│    (No account found)                 │
└───────────────────────────────────────┘
```

**Full component implementation:**

```jsx
// client/src/features/workspace/InviteInput.jsx
import { useState, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import api from '../../api/axios';

export default function InviteInput({ workspaceId, onInvite }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [selected, setSelected]     = useState(null);  // { type: 'user'|'email', ... }
  const [role, setRole]             = useState('editor');
  const [loading, setLoading]       = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  const search = useDebouncedCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    const { data } = await api.get(`/users/search?q=${q}&workspaceId=${workspaceId}`);
    setResults(data.users);
    setShowDropdown(true);
  }, 300);

  const handleChange = (e) => {
    setQuery(e.target.value);
    setSelected(null);
    search(e.target.value);
  };

  const handleSelectUser = (user) => {
    setSelected({ type: 'user', ...user });
    setQuery('');
    setShowDropdown(false);
  };

  const handleSelectEmail = () => {
    setSelected({ type: 'email', email: query });
    setQuery('');
    setShowDropdown(false);
  };

  const isValidEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

  const handleInvite = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const email = selected.type === 'user' ? selected.email : selected.email;
      const { data } = await api.post(`/workspaces/${workspaceId}/invite`, { email, role });
      onInvite(data);  // parent updates member list or pending invites list
      setSelected(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invite-input-container">
      {selected ? (
        // Show chip when a user/email is selected
        <div className="selected-chip">
          {selected.type === 'user' && (
            <img src={selected.avatar} alt="" className="chip-avatar" />
          )}
          {selected.type === 'email' ? `✉ ${selected.email}` : `${selected.name} · ${selected.email}`}
          <button onClick={() => setSelected(null)}>✕</button>
        </div>
      ) : (
        <div className="search-box">
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search by name or email..."
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {showDropdown && (
            <div className="dropdown">
              {results.map(user => (
                <div key={user._id} className="dropdown-item" onMouseDown={() => handleSelectUser(user)}>
                  <img src={user.avatar || '/default-avatar.png'} alt="" />
                  <div>
                    <span className="name">{user.name}</span>
                    <span className="email">{user.email}</span>
                  </div>
                </div>
              ))}
              {results.length === 0 && isValidEmail(query) && (
                <div className="dropdown-item email-invite" onMouseDown={handleSelectEmail}>
                  <span className="email-icon">✉</span>
                  <div>
                    <span className="name">Invite {query} by email</span>
                    <span className="email">No account found — they'll get an invite link</span>
                  </div>
                </div>
              )}
              {results.length === 0 && !isValidEmail(query) && query.length >= 2 && (
                <div className="dropdown-empty">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      <select value={role} onChange={e => setRole(e.target.value)}>
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>

      <button onClick={handleInvite} disabled={!selected || loading}>
        {loading ? 'Sending...' : 'Invite'}
      </button>
    </div>
  );
}
```

**Member list with role change and remove:**

```jsx
// client/src/features/workspace/MemberRow.jsx
export default function MemberRow({ member, currentUserRole, workspaceId, onRoleChange, onRemove }) {
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = member.role === 'owner';

  return (
    <div className="member-row">
      <img src={member.user.avatar || '/default-avatar.png'} className="member-avatar" />
      <div className="member-info">
        <span className="member-name">{member.user.name}</span>
        <span className="member-email">{member.user.email}</span>
      </div>
      <div className="member-actions">
        {canManage && !isOwner ? (
          <>
            <select
              value={member.role}
              onChange={e => onRoleChange(member.user._id, e.target.value)}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button className="remove-btn" onClick={() => onRemove(member.user._id)}>
              Remove
            </button>
          </>
        ) : (
          <span className={`role-badge role-${member.role}`}>{member.role}</span>
        )}
      </div>
    </div>
  );
}
```

**Pending invites list:**

```jsx
// client/src/features/workspace/PendingInvites.jsx
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

export default function PendingInvites({ invites, onRevoke }) {
  if (!invites.length) return null;
  return (
    <div className="pending-invites">
      <h3>Pending Invitations ({invites.length})</h3>
      {invites.map(invite => (
        <div key={invite._id} className="invite-row">
          <span className="invite-icon">✉</span>
          <div className="invite-info">
            <span className="invite-email">{invite.email}</span>
            <span className="invite-meta">
              {invite.role} · Expires {dayjs(invite.expiresAt).fromNow()}
              · Sent by {invite.invitedBy.name}
            </span>
          </div>
          <button className="revoke-btn" onClick={() => onRevoke(invite._id)} title="Revoke invite">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Full WorkspaceSettings Members tab** wires these together:

```jsx
// client/src/pages/WorkspaceSettings.jsx (Members tab section)
const [members, setMembers] = useState([]);
const [pendingInvites, setPendingInvites] = useState([]);

// Load on mount
useEffect(() => {
  api.get(`/workspaces/${workspaceId}`).then(r => setMembers(r.data.members));
  api.get(`/workspaces/${workspaceId}/invites`).then(r => setPendingInvites(r.data.invites));
}, [workspaceId]);

const handleInviteResult = (result) => {
  if (result.type === 'direct_add') {
    // User was added immediately — append to members list
    setMembers(prev => [...prev, { user: result.user, role: result.role }]);
  } else {
    // Email invite sent — append to pending invites list
    setPendingInvites(prev => [...prev, result.invite]);
  }
};

const handleRevoke = async (inviteId) => {
  await api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`);
  setPendingInvites(prev => prev.filter(i => i._id !== inviteId));
};

const handleRoleChange = async (userId, newRole) => {
  await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role: newRole });
  setMembers(prev => prev.map(m => m.user._id === userId ? { ...m, role: newRole } : m));
};

const handleRemove = async (userId) => {
  if (!confirm('Remove this member?')) return;
  await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  setMembers(prev => prev.filter(m => m.user._id !== userId));
};
```

---

#### UI Part B — Invite Accept Page (`/invite/accept?token=...`)

This is a standalone public page (no auth required to view). The token in the URL determines what to show.

**Flow on page load:**

```
1. Read token from URL query param
2. Call GET /api/v1/invite/preview?token=...
3. Show appropriate UI based on response
```

**State 1 — Loading:**
```
┌─────────────────────────────────────┐
│         CollabBoard                 │
│                                     │
│         Checking your invitation... │
│         [ spinner ]                 │
└─────────────────────────────────────┘
```

**State 2 — Valid invite, user has an account, is already logged in:**
```
┌─────────────────────────────────────┐
│         CollabBoard                 │
│                                     │
│   👥 You've been invited!           │
│                                     │
│   Arjun Kumar invited you to join   │
│   Team Alpha  as  Editor            │
│                                     │
│   Logged in as: Priya (priya@..)   │
│                                     │
│        [ Join Workspace ]           │
│                                     │
│   Not you? Log in with a different  │
│   account                           │
└─────────────────────────────────────┘
```

Clicking "Join Workspace" calls `POST /invite/accept` with the token, then redirects to `/app/workspaces/:workspaceId`.

**State 3 — Valid invite, user has an account, NOT logged in:**
```
┌─────────────────────────────────────┐
│         CollabBoard                 │
│                                     │
│   👥 You've been invited to         │
│      Team Alpha  as  Editor         │
│                                     │
│   Log in to accept this invitation  │
│                                     │
│   Email: priya@gmail.com (locked)   │
│   Password: [ ______________ ]      │
│                                     │
│        [ Log In & Join ]            │
│                                     │
│   ── or ──────────────────────────  │
│   [ Continue with Google ]          │
└─────────────────────────────────────┘
```

**State 4 — Valid invite, user does NOT have an account:**
```
┌─────────────────────────────────────┐
│         CollabBoard                 │
│                                     │
│   👥 You've been invited to         │
│      Team Alpha  as  Editor         │
│                                     │
│   Create your account to join       │
│                                     │
│   Email: neha@gmail.com (locked)    │
│   Name:  [ __________________ ]     │
│   Password: [ ________________ ]    │
│   Confirm:  [ ________________ ]    │
│                                     │
│      [ Create Account & Join ]      │
└─────────────────────────────────────┘
```

Submitting calls `POST /invite/accept-register`, gets back tokens, logs them in, redirects to workspace.

**State 5 — Invalid / expired / revoked token:**
```
┌─────────────────────────────────────┐
│         CollabBoard                 │
│                                     │
│   ⚠ This invitation is no longer   │
│     valid                           │
│                                     │
│   It may have expired or been       │
│   revoked by the workspace admin.   │
│                                     │
│   Ask for a new invite, or          │
│   [ Go to Home ]                    │
└─────────────────────────────────────┘
```

**InviteAcceptPage implementation:**

```jsx
// client/src/pages/InviteAcceptPage.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { user, accessToken } = useAuthStore();

  const [preview, setPreview]   = useState(null);   // invite details
  const [status, setStatus]     = useState('loading'); // loading | valid | invalid
  const [form, setForm]         = useState({ name: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get(`/invite/preview?token=${token}`)
      .then(r => { setPreview(r.data); setStatus('valid'); })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post('/invite/accept', { token });
      navigate(`/app/workspaces/${data.workspaceId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAndJoin = async () => {
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/invite/accept-register', {
        token, name: form.name, password: form.password,
      });
      useAuthStore.getState().setAuth(data.user, data.accessToken);
      navigate(`/app/workspaces/${data.workspaceId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') return <div className="invite-page">Checking your invitation...</div>;
  if (status === 'invalid') return (
    <div className="invite-page">
      <h2>⚠ This invitation is no longer valid</h2>
      <p>It may have expired or been revoked. Ask for a new invite.</p>
      <button onClick={() => navigate('/')}>Go to Home</button>
    </div>
  );

  return (
    <div className="invite-page">
      <h2>👥 You've been invited!</h2>
      <p>Join <strong>{preview.workspaceName}</strong> as <strong>{preview.role}</strong></p>

      {error && <div className="error-msg">{error}</div>}

      {/* User is logged in with the right email */}
      {accessToken && user?.email === preview.email && (
        <button onClick={handleAccept} disabled={submitting}>
          {submitting ? 'Joining...' : 'Join Workspace'}
        </button>
      )}

      {/* User has account but needs to log in */}
      {!accessToken && preview.hasAccount && (
        <LoginForm
          lockedEmail={preview.email}
          onSuccess={() => handleAccept()}
        />
      )}

      {/* No account — show register form */}
      {!accessToken && !preview.hasAccount && (
        <div className="register-form">
          <input disabled value={preview.email} />
          <input placeholder="Your name" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <input type="password" placeholder="Password"
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          <input type="password" placeholder="Confirm password"
            onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} />
          <button onClick={handleRegisterAndJoin} disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account & Join'}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 2.5.7 Add New Frontend Route

```jsx
// client/src/App.jsx
<Route path="/invite/accept" element={<InviteAcceptPage />} />
```

This route must be **outside** the `ProtectedRoute` wrapper — unauthenticated users need to reach it.

---

### 2.5.8 Install New Dependencies

```bash
# Frontend
npm install use-debounce

# Backend
npm install nanoid   # for tokenId (already have uuid, either works)
```

---

### Phase 2.5 Checklist

- [ ] `WorkspaceInvite` model created with proper indexes
- [ ] `INVITE_TOKEN_SECRET` added to `.env`
- [ ] `POST /workspaces/:id/invite` handles both direct-add and email-invite in one endpoint
- [ ] Direct-add: user added to workspace immediately + in-app notification sent via socket
- [ ] Email-invite: token stored in Redis + MongoDB + Bull email queued
- [ ] `GET /workspaces/:id/invites` returns pending invites with sender info
- [ ] `DELETE /workspaces/:id/invites/:inviteId` revokes token from Redis + marks DB record
- [ ] `GET /invite/preview?token=` returns workspace/role info without consuming token
- [ ] `POST /invite/accept` validates token, checks email match, adds to workspace, consumes token
- [ ] `POST /invite/accept-register` creates account + joins workspace + returns auth tokens
- [ ] `GET /users/search?q=&workspaceId=` excludes existing members from results
- [ ] Search input debounces at 300ms, shows live dropdown
- [ ] Email fallback shown when no search results but valid email typed
- [ ] Selected user/email renders as chip with remove button
- [ ] Pending invites list shows with expiry time and revoke button
- [ ] Member list shows role dropdown (admin/owner only) and remove button
- [ ] `/invite/accept` page handles all 5 states: loading, join, login+join, register+join, invalid
- [ ] After accepting, user is redirected directly into the workspace

---

## Phase 3 — Real-Time Kanban with Socket.io + Redis

**Duration:** Days 14–19  
**Goal:** Make the Kanban board live. Every task create, move, update, and delete is instantly reflected for all users on the same board — across multiple browser tabs and (via Redis adapter) across multiple server instances.

---

### 3.1 Socket.io Server Setup

**server/src/config/socket.js:**
```js
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const initSocket = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true }
  });

  // Redis adapter — critical for horizontal scaling
  // Two separate Redis clients required (pub + sub)
  const pubClient = createClient({ url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}` });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Socket.io using Redis adapter');

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded.userId;
      socket.user = await User.findById(decoded.userId).select('name avatar email');
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Register event handlers
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId}`);

    // Join a personal room for user-specific events (notifications)
    socket.join(`user:${socket.userId}`);

    // Register all handlers
    registerBoardHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerWhiteboardHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => handleDisconnect(io, socket));
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

  socket.on('join:board', ({ boardId }) => {
    socket.join(`board:${boardId}`);
    socket.currentBoardId = boardId;
  });

  socket.on('leave:board', ({ boardId }) => {
    socket.leave(`board:${boardId}`);
  });

};
```

Then in each REST controller, after DB write, emit to the board room:

**In `createTask` controller (server):**
```js
// After task is saved and populated:
req.io.to(`board:${task.board}`).emit('task:created', { task });
```

**In `moveTask` controller:**
```js
req.io.to(`board:${boardId}`).emit('task:moved', {
  taskId,
  fromColumnId: oldColumnId,
  toColumnId: targetColumnId,
  newOrder,
});
```

**In `updateTask` controller:**
```js
req.io.to(`board:${boardId}`).emit('task:updated', { taskId, changes: updatedFields });
```

**In `deleteTask` controller:**
```js
req.io.to(`board:${boardId}`).emit('task:deleted', { taskId });
```

**In `reorderColumns` controller:**
```js
req.io.to(`board:${boardId}`).emit('board:columns_reordered', { orderedColumnIds });
```

To make `req.io` available, attach io to app in server.js:
```js
app.set('io', io);
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
await redis.set(cacheKey, JSON.stringify(boardData), 'EX', 300); // 5 min TTL
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
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};
```

**client/src/hooks/useBoardSocket.js:**
```js
import { useEffect } from 'react';
import { getSocket } from '../socket';

export const useBoardSocket = (boardId, { onTaskCreated, onTaskMoved, onTaskUpdated, onTaskDeleted, onColumnsReordered }) => {
  useEffect(() => {
    if (!boardId) return;
    const socket = getSocket();
    socket.emit('join:board', { boardId });

    socket.on('task:created', onTaskCreated);
    socket.on('task:moved', onTaskMoved);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('board:columns_reordered', onColumnsReordered);

    return () => {
      socket.emit('leave:board', { boardId });
      socket.off('task:created');
      socket.off('task:moved');
      socket.off('task:updated');
      socket.off('task:deleted');
      socket.off('board:columns_reordered');
    };
  }, [boardId]);
};
```

**In BoardPage component:**
```js
useBoardSocket(boardId, {
  onTaskCreated: ({ task }) => setBoardData(prev => addTaskToColumn(prev, task)),
  onTaskMoved: ({ taskId, toColumnId, newOrder }) => setBoardData(prev => moveTask(prev, taskId, toColumnId, newOrder)),
  onTaskUpdated: ({ taskId, changes }) => setBoardData(prev => updateTask(prev, taskId, changes)),
  onTaskDeleted: ({ taskId }) => setBoardData(prev => removeTask(prev, taskId)),
  onColumnsReordered: ({ orderedColumnIds }) => setBoardData(prev => reorderColumns(prev, orderedColumnIds)),
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

**Duration:** Days 20–24  
**Goal:** Add the shared drawing canvas and the live presence system (who's online, where they are, cursor positions).

---

### 4.1 Presence Handler

**server/src/socket/handlers/presence.handler.js:**

Presence state is stored entirely in Redis — no MongoDB writes needed.

```js
const PRESENCE_TTL = 35; // seconds — client pings every 30s

export const registerPresenceHandlers = (io, socket) => {

  socket.on('join:workspace', async ({ workspaceId }) => {
    socket.join(`ws:${workspaceId}`);
    socket.currentWorkspaceId = workspaceId;

    // Add to Redis presence hash
    await redis.hset(`presence:${workspaceId}`, socket.userId, JSON.stringify({
      name: socket.user.name,
      avatar: socket.user.avatar,
      boardId: null,
    }));
    await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);

    // Broadcast updated presence to workspace
    const presenceData = await getPresenceList(workspaceId);
    io.to(`ws:${workspaceId}`).emit('presence:update', { users: presenceData });
  });

  socket.on('presence:active', async ({ workspaceId, boardId }) => {
    // Update which board user is currently on + refresh TTL
    await redis.hset(`presence:${workspaceId}`, socket.userId, JSON.stringify({
      name: socket.user.name,
      avatar: socket.user.avatar,
      boardId,
    }));
    await redis.expire(`presence:${workspaceId}`, PRESENCE_TTL);
  });
};

// On disconnect:
export const handleDisconnect = async (io, socket) => {
  if (socket.currentWorkspaceId) {
    await redis.hdel(`presence:${socket.currentWorkspaceId}`, socket.userId);
    const presenceData = await getPresenceList(socket.currentWorkspaceId);
    io.to(`ws:${socket.currentWorkspaceId}`).emit('presence:update', { users: presenceData });
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
    socket.emit('join:workspace', { workspaceId });
    socket.on('presence:update', ({ users }) => setOnlineUsers(users));

    // Heartbeat — refresh presence every 30s
    const interval = setInterval(() => {
      socket.emit('presence:active', { workspaceId, boardId: currentBoardId });
    }, 30000);

    return () => {
      clearInterval(interval);
      socket.off('presence:update');
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

  socket.on('whiteboard:stroke', ({ boardId, stroke }) => {
    // Broadcast stroke to everyone else in the board room
    socket.to(`board:${boardId}`).emit('whiteboard:stroke', {
      userId: socket.userId,
      stroke,
    });
  });

  socket.on('whiteboard:cursor', ({ boardId, x, y }) => {
    socket.to(`board:${boardId}`).emit('whiteboard:cursor', {
      userId: socket.userId,
      name: socket.user.name,
      x,
      y,
    });
  });

  socket.on('whiteboard:clear', async ({ boardId }) => {
    // Verify user has editor+ role before clearing
    socket.to(`board:${boardId}`).emit('whiteboard:cleared', {
      clearedBy: socket.user.name,
    });
  });
};
```

**Frontend Whiteboard component:**

```jsx
// client/src/features/board/Whiteboard.jsx
import { useEffect, useRef } from 'react';
import { getSocket } from '../../socket';

export default function Whiteboard({ boardId }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const socket = getSocket();

    // Draw strokes received from other users
    socket.on('whiteboard:stroke', ({ stroke }) => {
      drawStroke(ctx, stroke);
    });

    // Show other users' cursors (render name labels on canvas overlay)
    socket.on('whiteboard:cursor', ({ userId, name, x, y }) => {
      updateRemoteCursor(userId, name, x, y);
    });

    socket.on('whiteboard:cleared', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    const handleMouseDown = (e) => { isDrawing.current = true; /* start stroke */ };
    const handleMouseMove = (e) => {
      if (!isDrawing.current) return;
      const stroke = buildStroke(e);
      drawStroke(ctx, stroke);  // draw locally immediately
      socket.emit('whiteboard:stroke', { boardId, stroke });
      socket.emit('whiteboard:cursor', { boardId, x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => { isDrawing.current = false; };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      socket.off('whiteboard:stroke');
      socket.off('whiteboard:cursor');
      socket.off('whiteboard:cleared');
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [boardId]);

  return <canvas ref={canvasRef} width={1200} height={700} style={{ border: '1px solid #eee' }} />;
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

**Duration:** Days 25–30  
**Goal:** Add the workspace chat room with typing indicators, build the in-app notification system, and wire up Bull for async email delivery. This phase introduces the queue workers which run as separate Node processes.

---

### 5.1 Chat Handler

**server/src/socket/handlers/chat.handler.js:**
```js
import Message from '../models/Message.js';

export const registerChatHandlers = (io, socket) => {

  socket.on('chat:send', async ({ workspaceId, content }) => {
    // Persist message to MongoDB
    const message = await Message.create({
      workspace: workspaceId,
      sender: socket.userId,
      content,
      type: 'text',
    });

    const populated = await message.populate('sender', 'name avatar');

    // Broadcast to workspace room
    io.to(`ws:${workspaceId}`).emit('chat:message', { message: populated });
  });

  socket.on('chat:typing', ({ workspaceId, isTyping }) => {
    // Broadcast to everyone except sender
    socket.to(`ws:${workspaceId}`).emit('chat:typing', {
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
  .populate('sender', 'name avatar');

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
import Bull from 'bull';

const emailQueue = new Bull('email', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default emailQueue;
```

**server/src/queues/activityQueue.js** — same pattern, queue name `'activity'`.

**Usage from controllers (add to existing controllers from Phase 2):**
```js
import emailQueue from '../queues/emailQueue.js';
import activityQueue from '../queues/activityQueue.js';

// In inviteMember controller:
await emailQueue.add('send_workspace_invite', {
  to: invitedUser.email,
  userName: invitedUser.name,
  workspaceName: workspace.name,
  inviterName: req.user.name,
});

// In createTask controller:
await activityQueue.add('log_task_created', {
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
import 'dotenv/config';
import nodemailer from 'nodemailer';
import emailQueue from '../emailQueue.js';

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
    subject: 'Reset your CollabBoard password',
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

emailQueue.on('failed', (job, err) => {
  console.error(`Email job failed [${job.name}]:`, err.message);
});

console.log('Email worker running...');
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
import activityQueue from '../activityQueue.js';
import ActivityLog from '../../models/ActivityLog.js';

activityQueue.process(async (job) => {
  const { name, data } = job;

  const actionMap = {
    log_task_created: 'task.created',
    log_task_moved: 'task.moved',
    log_task_deleted: 'task.deleted',
    log_member_invited: 'member.invited',
    log_comment_added: 'comment.added',
  };

  await ActivityLog.create({
    workspace: data.workspaceId,
    actor: data.actorId,
    action: actionMap[name],
    entity: { type: 'task', id: data.taskId },
    meta: data,
  });
});
```

---

### 5.5 Scheduled Job — Due Date Reminders

```js
// Add to emailWorker.js — runs daily at 9am
import cron from 'node-cron';
import Task from '../../models/Task.js';

cron.schedule('0 9 * * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  const dueTasks = await Task.find({
    dueDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
    status: { $ne: 'done' },
  }).populate('assignees', 'name email');

  for (const task of dueTasks) {
    for (const assignee of task.assignees) {
      await emailQueue.add('send_task_due_reminder', {
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
const io = req.app.get('io');
io.to(`user:${assigneeId}`).emit('notification:new', { notification });
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

**Duration:** Days 31–36  
**Goal:** Containerize everything, add rate limiting, error handling, write the README, and deploy. This phase is what makes the project feel production-grade on your CV.

---

### 6.1 Global Error Handling

**server/src/middleware/errorHandler.js:**
```js
export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
};
```

Add to `app.js` as last middleware. Use `next(err)` pattern consistently in controllers.

**Zod validation middleware:**
```js
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: 'Validation error', errors: result.error.flatten() });
  }
  req.body = result.data;
  next();
};
```

---

### 6.2 Rate Limiting

```js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis.js';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 login attempts per 15 min
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
});

// Apply in app.js
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
```

---

### 6.3 Docker Compose

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  mongo:
    image: mongo:7
    ports: ['27017:27017']
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    command: redis-server --requirepass ${REDIS_PASSWORD}

  server:
    build: ./server
    ports: ['5000:5000']
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
    ports: ['5173:5173']
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
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import emailQueue from './queues/emailQueue.js';
import activityQueue from './queues/activityQueue.js';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullAdapter(emailQueue), new BullAdapter(activityQueue)], serverAdapter });
app.use('/admin/queues', serverAdapter.getRouter());
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
workspaceSchema.index({ 'members.user': 1 });
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
> Built a multiplayer task management platform (Figma meets Notion) with live Kanban, shared whiteboard, workspace chat, and a full member invite system. Key engineering highlights: WebSocket horizontal scaling via Redis pub/sub adapter; presence system using Redis TTL hash keys; JWT-signed single-use invite tokens stored in Redis with MongoDB audit trail; async email + activity logging via Bull job queues with exponential backoff retry; live user search with debounced autocomplete; draggable Kanban with optimistic UI updates. Containerized with Docker Compose.

---

*End of Phase Plan — CollabBoard v1.0*