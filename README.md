# CollabBoard

A real-time collaborative project management platform built with the MERN stack, Socket.io, Redis, and Bull queues.

## ✨ Features

- **Authentication** — JWT with refresh-token rotation, Google OAuth, Redis token blacklisting
- **Workspaces & Boards** — role-based access (owner / admin / editor / viewer), full CRUD
- **Real-time Kanban** — drag-and-drop columns and tasks synced via Socket.io + Redis adapter
- **Whiteboard** — collaborative canvas drawing with live cursors and snapshot persistence
- **Live Presence** — avatar stack showing who is online in the same board
- **Workspace Chat** — real-time messaging with typing indicators and cursor-based history
- **Notifications** — in-app bell + socket push for task assignments and @mentions
- **Email Queues** — async invite / assignment / mention emails via Bull + Nodemailer
- **Activity Log** — audit trail of all task and member events via Bull worker

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Vite + React)           │
│  Zustand · React Router · Socket.io-client        │
└───────────────────┬─────────────────────────────-┘
                    │ HTTP / WebSocket
┌───────────────────▼──────────────────────────────┐
│         Express API  (Node 20 / ESM)              │
│  Passport JWT · Zod · Bull Board (dev)            │
│  Rate-limit-redis · express-rate-limit            │
└──────┬────────────┬───────────────────────────────┘
       │            │
  ┌────▼────┐  ┌────▼───────────────┐
  │ MongoDB │  │  Redis             │
  │ Atlas / │  │  • Socket adapter  │
  │ Docker  │  │  • Presence TTL    │
  └─────────┘  │  • Board cache     │
               │  • Rate-limit store│
               │  • Bull queues     │
               └────────────────────┘
                      │ (Bull)
          ┌───────────┴────────────┐
          │                        │
   ┌──────▼──────┐        ┌────────▼──────┐
   │ Email Worker│        │Activity Worker│
   │ (Nodemailer)│        │ (ActivityLog) │
   └─────────────┘        └───────────────┘
```

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)
- Redis running on `localhost:6379`
- MongoDB Atlas URI (or local `mongod`)

### 1. Clone & install

```bash
git clone https://github.com/your-username/collabboard.git
cd collabboard

# Install server deps
cd server && pnpm install

# Install client deps
cd ../client && pnpm install
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Fill in MONGO_URI, JWT secrets, Google OAuth, SMTP creds

# Client (optional — defaults work for local dev)
cp client/.env.example client/.env
```

### 3. Run everything

```bash
# Terminal 1 — API server
cd server && pnpm run dev

# Terminal 2 — Email worker
cd server && pnpm run worker:email

# Terminal 3 — Activity worker
cd server && pnpm run worker:activity

# Terminal 4 — React frontend
cd client && pnpm run dev
```

Open **http://localhost:5173** in your browser.

Bull Board (queue dashboard) available at **http://localhost:5000/admin/queues** in development.

---

## 🐳 Docker (all services in one command)

```bash
# Copy and fill in your secrets first
cp server/.env.example server/.env

docker compose up --build
```

Services started:

| Service | URL |
|---------|-----|
| React client (nginx) | http://localhost |
| Express API | http://localhost:5000 |
| Bull Board | http://localhost:5000/admin/queues |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |
| Email worker | (background) |
| Activity worker | (background) |

---

## 📁 Project Structure

```
collabboard/
├── client/                   # Vite + React frontend
│   ├── src/
│   │   ├── api/              # Axios instance + interceptors
│   │   ├── components/       # Shared components (ProtectedRoute etc.)
│   │   ├── features/         # board state helpers, Whiteboard canvas
│   │   ├── hooks/            # useBoardSocket, usePresence
│   │   ├── pages/            # Route-level pages
│   │   ├── socket/           # Socket.io singleton
│   │   └── store/            # Zustand auth store
│   └── Dockerfile
│
├── server/                   # Express + Socket.io API
│   ├── src/
│   │   ├── config/           # db, redis, passport, socket
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # auth, checkRole, errorHandler, rateLimiter
│   │   ├── models/           # Mongoose schemas (9 models)
│   │   ├── queues/           # Bull queue definitions + workers
│   │   ├── routes/           # Express routers
│   │   ├── services/         # token.service.js
│   │   └── socket/           # Socket.io event handlers
│   ├── server.js             # Entry point
│   └── Dockerfile
│
└── docker-compose.yml        # Full-stack orchestration
```

## 🔑 API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register with email/password |
| POST | `/api/v1/auth/login` | Login, returns access token |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Blacklist token |
| GET | `/api/v1/auth/google` | Google OAuth redirect |
| GET/POST/PATCH/DELETE | `/api/v1/workspaces` | Workspace CRUD + member management |
| GET/POST/PATCH/DELETE | `/api/v1/workspaces/:id/boards` | Board + column management |
| GET/POST/PATCH/DELETE | `/api/v1/workspaces/:id/boards/:id/tasks` | Task CRUD, move, comments |
| GET | `/api/v1/workspaces/:id/messages` | Chat history (cursor-paginated) |
| GET/PATCH/DELETE | `/api/v1/notifications` | Notification list + read state |

## 🔌 Socket.io Events

| Emitted by | Event | Room |
|------------|-------|------|
| Client → Server | `join:board`, `leave:board` | — |
| Server → Room | `task:created/moved/updated/deleted` | `board:{boardId}` |
| Client → Server | `join:workspace`, `presence:heartbeat` | — |
| Server → Room | `presence:update` | `workspace:{workspaceId}` |
| Client → Server | `whiteboard:stroke/cursor/clear` | — |
| Server → Room | same events | `board:{boardId}` |
| Client → Server | `chat:send`, `chat:typing` | — |
| Server → Room | `chat:message`, `chat:typing` | `workspace:{workspaceId}` |
| Server → User | `notification:new` | `user:{userId}` |

## 🛡️ Rate Limiting

| Route | Limit |
|-------|-------|
| `/api/v1/*` | 100 req / minute |
| `/api/v1/auth/login` | 10 req / 15 minutes |
| `/api/v1/auth/register` | 10 req / 15 minutes |

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, Zustand, Socket.io-client |
| Backend | Node.js 20, Express 5, Mongoose, Passport.js |
| Real-time | Socket.io 4, @socket.io/redis-adapter |
| Database | MongoDB (Atlas or self-hosted) |
| Cache / Pub-Sub | Redis (ioredis) |
| Queues | Bull 4, Nodemailer |
| Auth | JWT (access + refresh), Google OAuth 2.0 |
| DevOps | Docker, docker-compose, nginx |

## 📝 License

MIT
