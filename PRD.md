# CollabBoard — Product Requirements Document (PRD)

**Version:** 1.0  
**Stack:** MongoDB · Express.js · React · Node.js · Socket.io · Redis · Bull  
**Author:** IIT KGP — CDC Project  
**Status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Data Models](#3-data-models)
4. [API Endpoints](#4-api-endpoints)
    - 4.1 Auth
    - 4.2 Users
    - 4.3 Workspaces
    - 4.4 Boards (Kanban)
    - 4.5 Tasks
    - 4.6 Whiteboard
    - 4.7 Chat / Messages
    - 4.8 Notifications
5. [Socket.io Events](#5-socketio-events)
6. [Redis Usage](#6-redis-usage)
7. [Bull Job Queues](#7-bull-job-queues)
8. [Frontend Routes](#8-frontend-routes)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Environment Variables](#10-environment-variables)
11. [Folder Structure](#11-folder-structure)
12. [Non-Functional Requirements](#12-non-functional-requirements)

---

## 1. Project Overview

CollabBoard is a real-time collaborative workspace where teams can manage tasks on a Kanban board, draw on a shared whiteboard, and communicate via contextual chat — all with live presence indicators showing who is online and what they are viewing.

### Core Features

| Feature       | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| Auth          | JWT + Google OAuth, role-based access                           |
| Workspaces    | Multi-tenant; each workspace has members and boards             |
| Kanban Board  | Columns + draggable tasks with real-time sync                   |
| Whiteboard    | Canvas drawing synced across all users in real time             |
| Live Presence | Online indicators, cursor positions, active-view tracking       |
| Chat          | Per-task threads + global workspace chat with typing indicators |
| Notifications | In-app + email via Bull job queue                               |
| Activity Log  | Every action recorded for audit trail                           |

---

## 2. Tech Stack & Architecture

```
Client (React + Vite)
    │
    ├── REST API calls ──────────────────► Express.js (Node.js)
    │                                           │
    └── WebSocket (Socket.io) ────────────►     │
                                                ├── MongoDB (primary store)
                                                ├── Redis
                                                │     ├── Socket.io Adapter (pub/sub)
                                                │     ├── Session / token cache
                                                │     └── Rate limiting counters
                                                └── Bull Queue
                                                      ├── Email worker
                                                      └── Activity log worker
```

### Key Libraries

| Library                                        | Purpose                                        |
| ---------------------------------------------- | ---------------------------------------------- |
| `socket.io`                                    | Real-time bidirectional events                 |
| `socket.io-redis` / `@socket.io/redis-adapter` | Scale Socket.io across multiple Node instances |
| `ioredis`                                      | Redis client for Node                          |
| `bull`                                         | Redis-backed job queue                         |
| `passport` + `passport-google-oauth20`         | OAuth strategy                                 |
| `jsonwebtoken`                                 | JWT signing and verification                   |
| `bcryptjs`                                     | Password hashing                               |
| `nodemailer`                                   | Email sending from Bull workers                |
| `mongoose`                                     | MongoDB ODM                                    |
| `express-rate-limit` + `rate-limit-redis`      | Rate limiting with Redis store                 |
| `cors`                                         | Cross-origin resource sharing                  |
| `multer` + `cloudinary`                        | File / avatar uploads                          |
| `zod`                                          | Request body validation                        |
| `dayjs`                                        | Date utilities                                 |

---

## 3. Data Models

### 3.1 User

```js
{
  _id: ObjectId,
  name: String,                        // required
  email: String,                       // unique, required
  passwordHash: String,                // null for OAuth users
  avatar: String,                      // URL
  googleId: String,                    // null for email/password users
  isVerified: Boolean,                 // email verification flag
  refreshTokenHash: String,            // hashed refresh token
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 Workspace

```js
{
  _id: ObjectId,
  name: String,
  slug: String,                        // unique, URL-safe
  description: String,
  owner: ObjectId,                     // ref: User
  members: [
    {
      user: ObjectId,                  // ref: User
      role: Enum['owner','admin','editor','viewer'],
      joinedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 Board

```js
{
  _id: ObjectId,
  workspace: ObjectId,                 // ref: Workspace
  name: String,
  columns: [
    {
      _id: ObjectId,
      title: String,
      order: Number,
      color: String                    // hex
    }
  ],
  createdBy: ObjectId,                 // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

### 3.4 Task

```js
{
  _id: ObjectId,
  board: ObjectId,                     // ref: Board
  workspace: ObjectId,                 // ref: Workspace
  columnId: ObjectId,                  // column within board
  title: String,
  description: String,
  order: Number,                       // position within column
  priority: Enum['low','medium','high','urgent'],
  status: Enum['todo','in_progress','review','done'],
  assignees: [ObjectId],               // ref: User
  labels: [String],
  dueDate: Date,
  attachments: [{ name: String, url: String, uploadedAt: Date }],
  comments: [ObjectId],                // ref: Comment
  createdBy: ObjectId,                 // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

### 3.5 Comment

```js
{
  _id: ObjectId,
  task: ObjectId,                      // ref: Task
  author: ObjectId,                    // ref: User
  content: String,
  mentions: [ObjectId],                // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

### 3.6 Message (Chat)

```js
{
  _id: ObjectId,
  workspace: ObjectId,                 // ref: Workspace
  sender: ObjectId,                    // ref: User
  content: String,
  type: Enum['text','system'],
  createdAt: Date
}
```

### 3.7 WhiteboardSnapshot

```js
{
  _id: ObjectId,
  board: ObjectId,                     // ref: Board
  data: String,                        // JSON stringified canvas state
  savedBy: ObjectId,                   // ref: User
  savedAt: Date
}
```

### 3.8 Notification

```js
{
  _id: ObjectId,
  recipient: ObjectId,                 // ref: User
  type: Enum['task_assigned','task_due','comment_mention','workspace_invite'],
  payload: Object,                     // flexible metadata
  isRead: Boolean,
  createdAt: Date
}
```

### 3.9 ActivityLog

```js
{
  _id: ObjectId,
  workspace: ObjectId,                 // ref: Workspace
  actor: ObjectId,                     // ref: User
  action: String,                      // e.g. "task.moved", "comment.created"
  entity: { type: String, id: ObjectId },
  meta: Object,
  createdAt: Date
}
```

---

## 4. API Endpoints

**Base URL:** `/api/v1`  
**Auth:** All protected routes require `Authorization: Bearer <accessToken>` header.

---

### 4.1 Auth

| Method | Route                       | Auth | Description                               |
| ------ | --------------------------- | ---- | ----------------------------------------- |
| POST   | `/auth/register`            | ✗    | Register with email + password            |
| POST   | `/auth/login`               | ✗    | Login, returns accessToken + refreshToken |
| POST   | `/auth/logout`              | ✓    | Invalidate refresh token                  |
| POST   | `/auth/refresh`             | ✗    | Exchange refreshToken for new accessToken |
| GET    | `/auth/google`              | ✗    | Redirect to Google OAuth consent screen   |
| GET    | `/auth/google/callback`     | ✗    | Google OAuth callback, issues tokens      |
| POST   | `/auth/forgot-password`     | ✗    | Send password reset email                 |
| POST   | `/auth/reset-password`      | ✗    | Reset password with token from email      |
| GET    | `/auth/verify-email/:token` | ✗    | Verify email address                      |

#### POST `/auth/register`

**Body:**

```json
{ "name": "string", "email": "string", "password": "string (min 8 chars)" }
```

**Response 201:**

```json
{ "message": "Registration successful. Please verify your email." }
```

#### POST `/auth/login`

**Body:**

```json
{ "email": "string", "password": "string" }
```

**Response 200:**

```json
{
	"accessToken": "string (expires 15m)",
	"refreshToken": "string (expires 7d)",
	"user": { "_id": "...", "name": "...", "email": "...", "avatar": "..." }
}
```

#### POST `/auth/refresh`

**Body:**

```json
{ "refreshToken": "string" }
```

**Response 200:**

```json
{ "accessToken": "string" }
```

---

### 4.2 Users

| Method | Route                | Auth | Description                             |
| ------ | -------------------- | ---- | --------------------------------------- |
| GET    | `/users/me`          | ✓    | Get own profile                         |
| PATCH  | `/users/me`          | ✓    | Update name, avatar                     |
| PATCH  | `/users/me/password` | ✓    | Change password                         |
| GET    | `/users/search?q=`   | ✓    | Search users by name/email (for invite) |

#### GET `/users/me`

**Response 200:**

```json
{
	"_id": "...",
	"name": "...",
	"email": "...",
	"avatar": "...",
	"isVerified": true,
	"createdAt": "..."
}
```

---

### 4.3 Workspaces

| Method | Route                                      | Auth       | Description                         |
| ------ | ------------------------------------------ | ---------- | ----------------------------------- |
| POST   | `/workspaces`                              | ✓          | Create a new workspace              |
| GET    | `/workspaces`                              | ✓          | List workspaces the user belongs to |
| GET    | `/workspaces/:workspaceId`                 | ✓ (member) | Get workspace details + members     |
| PATCH  | `/workspaces/:workspaceId`                 | ✓ (admin+) | Update name / description           |
| DELETE | `/workspaces/:workspaceId`                 | ✓ (owner)  | Delete workspace                    |
| POST   | `/workspaces/:workspaceId/invite`          | ✓ (admin+) | Invite user by email                |
| PATCH  | `/workspaces/:workspaceId/members/:userId` | ✓ (admin+) | Change member role                  |
| DELETE | `/workspaces/:workspaceId/members/:userId` | ✓ (admin+) | Remove member                       |
| GET    | `/workspaces/:workspaceId/activity`        | ✓ (member) | Paginated activity log              |

#### POST `/workspaces`

**Body:**

```json
{ "name": "string", "description": "string (optional)" }
```

**Response 201:**

```json
{ "_id": "...", "name": "...", "slug": "...", "owner": "...", "members": [...] }
```

#### POST `/workspaces/:workspaceId/invite`

**Body:**

```json
{ "email": "string", "role": "editor | viewer | admin" }
```

**Side effect:** Queues an invitation email via Bull.  
**Response 200:**

```json
{ "message": "Invitation sent." }
```

---

### 4.4 Boards (Kanban)

| Method | Route                                                        | Auth        | Description                                 |
| ------ | ------------------------------------------------------------ | ----------- | ------------------------------------------- |
| POST   | `/workspaces/:workspaceId/boards`                            | ✓ (editor+) | Create board                                |
| GET    | `/workspaces/:workspaceId/boards`                            | ✓ (member)  | List all boards in workspace                |
| GET    | `/workspaces/:workspaceId/boards/:boardId`                   | ✓ (member)  | Get board with columns + tasks              |
| PATCH  | `/workspaces/:workspaceId/boards/:boardId`                   | ✓ (editor+) | Rename board                                |
| DELETE | `/workspaces/:workspaceId/boards/:boardId`                   | ✓ (admin+)  | Delete board                                |
| POST   | `/workspaces/:workspaceId/boards/:boardId/columns`           | ✓ (editor+) | Add column to board                         |
| PATCH  | `/workspaces/:workspaceId/boards/:boardId/columns/:columnId` | ✓ (editor+) | Rename / recolor column                     |
| DELETE | `/workspaces/:workspaceId/boards/:boardId/columns/:columnId` | ✓ (editor+) | Delete column (tasks reassigned or deleted) |
| PATCH  | `/workspaces/:workspaceId/boards/:boardId/columns/reorder`   | ✓ (editor+) | Reorder columns (drag-and-drop)             |

#### GET `/workspaces/:workspaceId/boards/:boardId`

**Response 200:**

```json
{
	"_id": "...",
	"name": "...",
	"columns": [
		{
			"_id": "...",
			"title": "To Do",
			"order": 0,
			"tasks": [
				/* task objects */
			]
		}
	]
}
```

#### PATCH `/workspaces/:workspaceId/boards/:boardId/columns/reorder`

**Body:**

```json
{ "orderedColumnIds": ["colId1", "colId2", "colId3"] }
```

**Side effect:** Emits `board:columns_reordered` via Socket.io.

---

### 4.5 Tasks

| Method | Route                                                                        | Auth             | Description                           |
| ------ | ---------------------------------------------------------------------------- | ---------------- | ------------------------------------- |
| POST   | `/workspaces/:workspaceId/boards/:boardId/tasks`                             | ✓ (editor+)      | Create task                           |
| GET    | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId`                     | ✓ (member)       | Get single task details               |
| PATCH  | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId`                     | ✓ (editor+)      | Update task fields                    |
| DELETE | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId`                     | ✓ (editor+)      | Delete task                           |
| PATCH  | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/move`                | ✓ (editor+)      | Move task to another column / reorder |
| POST   | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/assignees`           | ✓ (editor+)      | Add assignee                          |
| DELETE | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/assignees/:userId`   | ✓ (editor+)      | Remove assignee                       |
| POST   | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/comments`            | ✓ (member)       | Add comment                           |
| GET    | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/comments`            | ✓ (member)       | List comments                         |
| DELETE | `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/comments/:commentId` | ✓ (author/admin) | Delete comment                        |

#### POST `/workspaces/:workspaceId/boards/:boardId/tasks`

**Body:**

```json
{
	"title": "string",
	"description": "string",
	"columnId": "string",
	"priority": "low | medium | high | urgent",
	"assignees": ["userId1"],
	"dueDate": "ISO date string",
	"labels": ["string"]
}
```

**Side effects:**

- Emits `task:created` via Socket.io to all board members.
- If `assignees` provided, queues `task_assigned` notification email via Bull.

#### PATCH `/workspaces/:workspaceId/boards/:boardId/tasks/:taskId/move`

**Body:**

```json
{ "targetColumnId": "string", "newOrder": 2 }
```

**Side effect:** Emits `task:moved` via Socket.io.

#### POST `.../tasks/:taskId/comments`

**Body:**

```json
{ "content": "string", "mentions": ["userId1", "userId2"] }
```

**Side effects:**

- Emits `task:comment_added` via Socket.io.
- For each mention, queues `comment_mention` notification email via Bull.

---

### 4.6 Whiteboard

| Method | Route                                                      | Auth        | Description                      |
| ------ | ---------------------------------------------------------- | ----------- | -------------------------------- |
| GET    | `/workspaces/:workspaceId/boards/:boardId/whiteboard`      | ✓ (member)  | Fetch latest whiteboard snapshot |
| POST   | `/workspaces/:workspaceId/boards/:boardId/whiteboard/save` | ✓ (editor+) | Save a whiteboard snapshot       |

**Note:** Live drawing strokes are exchanged exclusively over Socket.io (see Section 5). The REST endpoints handle persistence only.

#### GET `.../whiteboard`

**Response 200:**

```json
{ "data": "{ ...canvas JSON... }", "savedBy": "...", "savedAt": "..." }
```

---

### 4.7 Chat / Messages

| Method | Route                               | Auth       | Description                           |
| ------ | ----------------------------------- | ---------- | ------------------------------------- |
| GET    | `/workspaces/:workspaceId/messages` | ✓ (member) | Paginated chat history (cursor-based) |

**Query params:** `?limit=50&before=<messageId>`

**Response 200:**

```json
{
	"messages": [{ "_id": "...", "sender": { "name": "...", "avatar": "..." }, "content": "...", "createdAt": "..." }],
	"hasMore": true,
	"nextCursor": "messageId"
}
```

**Note:** Sending messages is done via Socket.io only (see Section 5).

---

### 4.8 Notifications

| Method | Route                                 | Auth | Description                                     |
| ------ | ------------------------------------- | ---- | ----------------------------------------------- |
| GET    | `/notifications`                      | ✓    | List notifications for current user (paginated) |
| PATCH  | `/notifications/:notificationId/read` | ✓    | Mark single notification as read                |
| PATCH  | `/notifications/read-all`             | ✓    | Mark all notifications as read                  |
| DELETE | `/notifications/:notificationId`      | ✓    | Delete a notification                           |

#### GET `/notifications`

**Query params:** `?page=1&limit=20&unreadOnly=true`  
**Response 200:**

```json
{
  "notifications": [ { "_id": "...", "type": "task_assigned", "payload": {...}, "isRead": false, "createdAt": "..." } ],
  "unreadCount": 5,
  "totalPages": 3
}
```

---

## 5. Socket.io Events

All Socket.io connections are authenticated: the client sends the JWT as a query param or in the handshake auth object.

```
io(SOCKET_URL, { auth: { token: accessToken } })
```

### 5.1 Connection & Rooms

| Client emits     | Payload           | Server action                       |
| ---------------- | ----------------- | ----------------------------------- |
| `join:workspace` | `{ workspaceId }` | Join socket room `ws:{workspaceId}` |
| `join:board`     | `{ boardId }`     | Join socket room `board:{boardId}`  |
| `leave:board`    | `{ boardId }`     | Leave socket room                   |

### 5.2 Presence

| Direction       | Event                  | Payload                                          | Description                         |
| --------------- | ---------------------- | ------------------------------------------------ | ----------------------------------- |
| Client → Server | `presence:active`      | `{ workspaceId, boardId }`                       | User is actively viewing this board |
| Server → Room   | `presence:update`      | `{ users: [{ userId, name, avatar, boardId }] }` | Updated presence list               |
| Server → Room   | `presence:user_joined` | `{ userId, name, avatar }`                       | User came online                    |
| Server → Room   | `presence:user_left`   | `{ userId }`                                     | User went offline                   |

**Implementation:** Presence state stored in Redis (key: `presence:{workspaceId}`, value: hash of userId → boardId). TTL refreshed on each `presence:active` ping (sent every 30s from client).

### 5.3 Kanban Board

| Direction     | Event                     | Payload                                          | Description                |
| ------------- | ------------------------- | ------------------------------------------------ | -------------------------- |
| Server → Room | `task:created`            | `{ task }`                                       | New task added to board    |
| Server → Room | `task:updated`            | `{ taskId, changes }`                            | Task fields updated        |
| Server → Room | `task:moved`              | `{ taskId, fromColumnId, toColumnId, newOrder }` | Task dragged to new column |
| Server → Room | `task:deleted`            | `{ taskId }`                                     | Task removed               |
| Server → Room | `board:columns_reordered` | `{ orderedColumnIds }`                           | Column order changed       |
| Server → Room | `task:comment_added`      | `{ taskId, comment }`                            | New comment on task        |

### 5.4 Whiteboard

| Direction       | Event                | Payload                                       | Description                    |
| --------------- | -------------------- | --------------------------------------------- | ------------------------------ |
| Client → Server | `whiteboard:stroke`  | `{ boardId, stroke: { path, color, width } }` | User draws a stroke            |
| Server → Room   | `whiteboard:stroke`  | `{ userId, stroke }`                          | Broadcast stroke to all others |
| Client → Server | `whiteboard:cursor`  | `{ boardId, x, y }`                           | User's cursor position         |
| Server → Room   | `whiteboard:cursor`  | `{ userId, name, x, y }`                      | Broadcast cursor to all        |
| Client → Server | `whiteboard:clear`   | `{ boardId }`                                 | Clear canvas (editor+ only)    |
| Server → Room   | `whiteboard:cleared` | `{ clearedBy }`                               | Notify all users of clear      |

### 5.5 Chat

| Direction       | Event          | Payload                      | Description             |
| --------------- | -------------- | ---------------------------- | ----------------------- |
| Client → Server | `chat:send`    | `{ workspaceId, content }`   | Send a message          |
| Server → Room   | `chat:message` | `{ message }`                | Deliver message to room |
| Client → Server | `chat:typing`  | `{ workspaceId, isTyping }`  | Typing indicator toggle |
| Server → Room   | `chat:typing`  | `{ userId, name, isTyping }` | Broadcast typing status |

### 5.6 Notifications

| Direction     | Event              | Payload            | Description                                                                   |
| ------------- | ------------------ | ------------------ | ----------------------------------------------------------------------------- |
| Server → User | `notification:new` | `{ notification }` | Deliver real-time notification to specific user's socket room `user:{userId}` |

---

## 6. Redis Usage

| Use Case               | Key Pattern                | Type                    | TTL           | Description                                  |
| ---------------------- | -------------------------- | ----------------------- | ------------- | -------------------------------------------- |
| Access token blacklist | `blacklist:{jti}`          | String                  | 15 min        | Invalidated tokens on logout                 |
| Refresh token store    | `refresh:{userId}`         | String (hash)           | 7 days        | Hashed refresh token                         |
| Presence               | `presence:{workspaceId}`   | Hash `userId → boardId` | 35s (rolling) | Who's online where                           |
| Rate limit             | `rl:{ip}:{route}`          | String (counter)        | 1 min         | Per-IP request counts                        |
| Board task cache       | `board:{boardId}:tasks`    | String (JSON)           | 5 min         | Avoid DB fetch on every viewer join          |
| Socket.io pub/sub      | Internal (socket.io-redis) | —                       | —             | Scale WebSocket events across Node instances |

---

## 7. Bull Job Queues

All queues backed by Redis. Workers run as separate processes.

### 7.1 Email Queue — `emailQueue`

**Jobs:**

| Job name                 | Trigger                          | Template                            |
| ------------------------ | -------------------------------- | ----------------------------------- |
| `send_workspace_invite`  | POST `/workspaces/:id/invite`    | Invite email with accept link       |
| `send_task_assigned`     | Task assignee added              | "You've been assigned a task" email |
| `send_comment_mention`   | Comment with `@mention`          | "You were mentioned in a comment"   |
| `send_password_reset`    | POST `/auth/forgot-password`     | Reset link email                    |
| `send_task_due_reminder` | Scheduled (cron via Bull repeat) | "Task due tomorrow" digest          |

**Job payload example (`send_task_assigned`):**

```json
{
	"to": "user@example.com",
	"userName": "Priya",
	"taskTitle": "Fix login bug",
	"boardName": "Sprint 3",
	"workspaceName": "Team Alpha",
	"taskUrl": "https://collabboard.io/ws/team-alpha/boards/..."
}
```

**Retry config:** 3 attempts, exponential backoff (1s, 5s, 30s).

### 7.2 Activity Log Queue — `activityQueue`

Decouples writing activity records from the HTTP request cycle.

| Job name             | Trigger               |
| -------------------- | --------------------- |
| `log_task_created`   | Task created          |
| `log_task_moved`     | Task column changed   |
| `log_task_deleted`   | Task deleted          |
| `log_member_invited` | Workspace invite sent |
| `log_comment_added`  | Comment posted        |

---

## 8. Frontend Routes

| Path                                           | Component            | Auth Required | Description                              |
| ---------------------------------------------- | -------------------- | ------------- | ---------------------------------------- |
| `/`                                            | `LandingPage`        | ✗             | Marketing / login CTA                    |
| `/login`                                       | `LoginPage`          | ✗             | Email + Google login                     |
| `/register`                                    | `RegisterPage`       | ✗             | Sign up form                             |
| `/verify-email/:token`                         | `VerifyEmailPage`    | ✗             | Email verification handler               |
| `/app`                                         | `AppShell`           | ✓             | Authenticated app shell (layout wrapper) |
| `/app/workspaces`                              | `WorkspaceList`      | ✓             | List of user's workspaces                |
| `/app/workspaces/new`                          | `CreateWorkspace`    | ✓             | Create workspace form                    |
| `/app/workspaces/:workspaceId`                 | `WorkspaceDashboard` | ✓             | Overview, members, activity feed         |
| `/app/workspaces/:workspaceId/boards`          | `BoardList`          | ✓             | All boards in workspace                  |
| `/app/workspaces/:workspaceId/boards/:boardId` | `BoardPage`          | ✓             | Kanban board + whiteboard tab            |
| `/app/workspaces/:workspaceId/chat`            | `ChatPage`           | ✓             | Workspace-wide chat room                 |
| `/app/workspaces/:workspaceId/settings`        | `WorkspaceSettings`  | ✓ (admin+)    | Members, roles, danger zone              |
| `/app/notifications`                           | `NotificationsPage`  | ✓             | All notifications                        |
| `/app/profile`                                 | `ProfilePage`        | ✓             | Edit name, avatar, password              |
| `*`                                            | `NotFoundPage`       | ✗             | 404                                      |

---

## 9. Authentication & Authorization

### Token Strategy

- **Access token:** JWT, signed with `ACCESS_TOKEN_SECRET`, expires in **15 minutes**. Contains `{ userId, email, jti }`.
- **Refresh token:** JWT, signed with `REFRESH_TOKEN_SECRET`, expires in **7 days**. Hashed copy stored in Redis.
- **Rotation:** On every token refresh, the old refresh token is deleted and a new pair is issued.
- **Logout:** Access token JTI added to Redis blacklist; refresh token deleted from Redis.

### Role Hierarchy

```
owner  > admin  > editor  > viewer
```

| Action              | viewer | editor | admin | owner |
| ------------------- | ------ | ------ | ----- | ----- |
| View boards / tasks | ✓      | ✓      | ✓     | ✓     |
| Create / edit tasks | ✗      | ✓      | ✓     | ✓     |
| Delete tasks        | ✗      | ✓      | ✓     | ✓     |
| Invite members      | ✗      | ✗      | ✓     | ✓     |
| Change member roles | ✗      | ✗      | ✓     | ✓     |
| Delete workspace    | ✗      | ✗      | ✗     | ✓     |

### Middleware Chain (Express)

```
Request → authenticateToken → checkWorkspaceMember → checkRole(minRole) → controller
```

---

## 10. Environment Variables

### Backend (`server/.env`)

```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGO_URI=mongodb://localhost:27017/collabboard

# JWT
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app_password
EMAIL_FROM="CollabBoard <no-reply@collabboard.io>"

# Cloudinary (file uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Client
CLIENT_URL=http://localhost:5173
```

### Frontend (`client/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## 11. Folder Structure

```
collabboard/
├── client/                          # React + Vite frontend
│   ├── public/
│   └── src/
│       ├── api/                     # Axios instance + per-feature API calls
│       ├── components/              # Reusable UI components
│       ├── features/
│       │   ├── auth/
│       │   ├── board/               # Kanban + whiteboard
│       │   ├── chat/
│       │   ├── notifications/
│       │   └── workspace/
│       ├── hooks/                   # Custom React hooks (useSocket, usePresence, etc.)
│       ├── pages/                   # Route-level page components
│       ├── store/                   # Zustand / Redux slices
│       ├── socket/                  # Socket.io client setup + event handlers
│       └── utils/
│
├── server/                          # Node.js + Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                # Mongoose connect
│   │   │   ├── redis.js             # ioredis client
│   │   │   └── socket.js            # Socket.io + Redis adapter setup
│   │   ├── controllers/             # Route handler logic
│   │   ├── middleware/
│   │   │   ├── auth.js              # authenticateToken
│   │   │   ├── checkRole.js
│   │   │   └── rateLimiter.js
│   │   ├── models/                  # Mongoose schemas
│   │   ├── queues/
│   │   │   ├── emailQueue.js        # Bull queue definition
│   │   │   ├── activityQueue.js
│   │   │   └── workers/
│   │   │       ├── emailWorker.js   # Nodemailer jobs
│   │   │       └── activityWorker.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── user.routes.js
│   │   │   ├── workspace.routes.js
│   │   │   ├── board.routes.js
│   │   │   ├── task.routes.js
│   │   │   └── notification.routes.js
│   │   ├── services/                # Business logic separated from controllers
│   │   ├── socket/
│   │   │   ├── handlers/
│   │   │   │   ├── presence.handler.js
│   │   │   │   ├── board.handler.js
│   │   │   │   ├── whiteboard.handler.js
│   │   │   │   └── chat.handler.js
│   │   │   └── index.js             # Register all socket handlers
│   │   └── app.js                   # Express app setup
│   ├── server.js                    # Entry point
│   └── .env
│
├── docker-compose.yml               # MongoDB + Redis + server + client
└── README.md
```

---

## 12. Non-Functional Requirements

| Requirement                    | Target                                        |
| ------------------------------ | --------------------------------------------- |
| API response time (p95)        | < 200ms                                       |
| WebSocket event latency        | < 100ms                                       |
| Uptime                         | 99.5%                                         |
| Concurrent users per workspace | 50+ (horizontally scalable via Redis adapter) |
| Rate limiting                  | 100 requests / minute per IP on public routes |
| Password hashing               | bcrypt, cost factor 12                        |
| HTTPS                          | Enforced in production                        |
| Docker                         | All services containerized via Docker Compose |

---

_End of PRD — CollabBoard v1.0_
