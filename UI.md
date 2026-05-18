# CollabBoard — Complete UI Layout Reference

**Purpose:** This is the single source of truth for every page, route, component, and interaction in CollabBoard. Read this before building any frontend file. Every screen is described in full — layout, contents, states, interactions, and what API calls it makes.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Global App Shell](#2-global-app-shell)
3. [Route: `/` — Landing Page](#3-route----landing-page)
4. [Route: `/login` — Login](#4-route-login--login)
5. [Route: `/register` — Register](#5-route-register--register)
6. [Route: `/verify-email/:token`](#6-route-verify-emailtoken)
7. [Route: `/invite/accept?token=`](#7-route-inviteaccepttoken)
8. [Route: `/app/workspaces` — Workspace List](#8-route-appworkspaces--workspace-list)
9. [Route: `/app/workspaces/:id` — Workspace Dashboard](#9-route-appworkspacesid--workspace-dashboard)
10. [Route: `/app/workspaces/:id/boards/:boardId` — Board (Kanban)](#10-route-appworkspacesidbboardsboardid--board-kanban)
11. [Route: same board — Whiteboard tab](#11-route-same-board--whiteboard-tab)
12. [Route: `/app/workspaces/:id/chat` — Chat](#12-route-appworkspacesidchat--chat)
13. [Route: `/app/workspaces/:id/settings` — Workspace Settings](#13-route-appworkspacesidsettings--workspace-settings)
14. [Route: `/app/notifications` — Notifications](#14-route-appnotifications--notifications)
15. [Route: `/app/profile` — Profile](#15-route-appprofile--profile)
16. [Global Components](#16-global-components)

---

## 1. Design System

Apply these tokens globally in a `index.css` or `theme.js`. Every component references these — no hardcoded colors.

### 1.1 Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-base:        #0F1117;   /* entire app background */
  --bg-surface:     #1A1D27;   /* cards, sidebar, modals */
  --bg-surface-2:   #222533;   /* input backgrounds, hover states */
  --bg-surface-3:   #2A2D3E;   /* selected states, active rows */

  /* Borders */
  --border:         #2E3146;   /* default dividers and card outlines */
  --border-focus:   #6C63FF;   /* input focus ring */

  /* Text */
  --text-primary:   #F0F2FF;   /* headings, body text */
  --text-secondary: #8B8FA8;   /* labels, meta, placeholders */
  --text-muted:     #555870;   /* disabled, timestamps */

  /* Accent */
  --accent:         #6C63FF;   /* primary buttons, active nav, links */
  --accent-hover:   #5A52E0;   /* button hover */
  --accent-muted:   #2D2A5E;   /* accent backgrounds (badges, highlights) */

  /* Semantic */
  --success:        #34D399;   /* Done column, success toasts */
  --success-muted:  #172E24;   /* Done column background */
  --warning:        #FBBF24;   /* Due soon, review column */
  --warning-muted:  #2A2010;   /* warning backgrounds */
  --danger:         #F87171;   /* overdue, destructive actions */
  --danger-muted:   #2E1A1A;   /* danger backgrounds */
  --info:           #60A5FA;   /* in progress column, info toasts */
  --info-muted:     #172035;   /* in progress column background */

  /* Priority */
  --priority-urgent: #F87171;
  --priority-high:   #FB923C;
  --priority-medium: #FBBF24;
  --priority-low:    #34D399;
}
```

### 1.2 Column Colors

| Column | Header accent | Card background | Column background |
|---|---|---|---|
| To Do | `#8B8FA8` | `#1E2235` | `#181B28` |
| In Progress | `#60A5FA` | `#172035` | `#151C2E` |
| Review | `#A78BFA` | `#1E1B2E` | `#1A172A` |
| Done | `#34D399` | `#172E24` | `#142A20` |

### 1.3 Typography

| Element | Size | Weight | Color |
|---|---|---|---|
| Page title | 20px | 600 | `--text-primary` |
| Section heading | 14px | 600 | `--text-primary` |
| Card title | 14px | 500 | `--text-primary` |
| Body text | 14px | 400 | `--text-primary` |
| Label / meta | 12px | 400 | `--text-secondary` |
| Badge / tag | 11px | 500 | varies |
| Timestamp | 12px | 400 | `--text-muted` |

Font: `Inter` (Google Fonts). Fallback: `system-ui, sans-serif`.

### 1.4 Spacing Scale

Base unit = 4px. Use only multiples: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

### 1.5 Radius & Shadow

```css
--radius-sm:   6px;   /* badges, chips */
--radius-md:   8px;   /* inputs, buttons */
--radius-lg:   12px;  /* cards, panels */
--radius-xl:   16px;  /* modals */
--radius-full: 9999px; /* pills, avatars */

--shadow-card:    0 2px 12px rgba(0,0,0,0.35);
--shadow-modal:   0 8px 48px rgba(0,0,0,0.65);
--shadow-dropdown:0 4px 20px rgba(0,0,0,0.45);
```

### 1.6 Reusable Component Specs

**Primary button:**
```
background: --accent | padding: 8px 16px | radius: --radius-md
font: 14px 500 | color: white
hover: background --accent-hover, translateY(-1px)
disabled: opacity 0.4, cursor not-allowed
loading state: spinner icon replaces label text
```

**Input field:**
```
background: --bg-surface-2 | border: 1px solid --border
radius: --radius-md | padding: 8px 12px
focus: border-color --border-focus, box-shadow 0 0 0 3px rgba(108,99,255,0.15)
error state: border-color --danger, error message below in --danger color 12px
```

**Avatar:**
```
sizes: 24px (xs), 32px (sm), 40px (md), 48px (lg), 64px (xl)
shape: circle (border-radius 50%)
fallback: colored circle with initials (color derived from name hash)
online indicator: 10px green dot, bottom-right, white border
```

**Badge / chip:**
```
padding: 2px 8px | radius: --radius-full | font: 11px 500
priority-urgent: bg --danger-muted, color --danger
priority-high:   bg rgba(251,146,60,0.15), color #FB923C
priority-medium: bg rgba(251,191,36,0.15), color --warning
priority-low:    bg rgba(52,211,153,0.15), color --success
```

---

## 2. Global App Shell

Every page under `/app/*` renders inside this shell. It never unmounts.

### 2.1 Shell Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOP BAR  (56px, fixed)                          │
├────────────────────┬────────────────────────────────────────────────────┤
│                    │                                                     │
│   SIDEBAR          │          CENTER CONTENT AREA                       │
│   (240px fixed)    │          (fills rest, scrollable)                  │
│                    │                                                     │
│                    │                                                     │
│                    │                                                     │
└────────────────────┴────────────────────────────────────────────────────┘
```

### 2.2 Sidebar — Full Detail

```
┌──────────────────────────┐
│                          │
│  ⬡  CollabBoard          │  16px logo icon + 16px 600 text
│                          │  clicking goes to /app/workspaces
├──────────────────────────┤
│                          │
│  TEAM ALPHA         ···  │  workspace name 13px 600, options (···) on hover
│                          │
│  ┌──────────────────┐    │  active nav item:
│  │ 📋  Boards       │    │  bg --bg-surface-3, left border 2px --accent
│  └──────────────────┘    │
│    💬  Chat              │  inactive: no bg, hover: bg --bg-surface-2
│    🔔  Notifications  3  │  unread badge: --accent bg, white 11px, pill
│    📊  Activity          │
│    ⚙   Settings          │
│                          │
├──────────────────────────┤
│                          │
│  YOUR WORKSPACES         │  12px uppercase --text-secondary, letter-spacing 0.08em
│                          │
│  ● Team Alpha       ✓    │  colored dot (workspace color) + checkmark if current
│  ○ Design Studio         │  click → switches active workspace
│  ○ Personal              │
│                          │
│  + New Workspace         │  14px --accent, hover underline
│                          │
├──────────────────────────┤
│                          │
│  ┌──┐ Arjun Kumar        │  32px avatar + name 14px + email 12px --text-secondary
│  └──┘ arjun@gmail.com    │
│  Log out                 │  12px --danger on hover
│                          │
└──────────────────────────┘
```

**Workspace options menu (··· click):**
```
┌──────────────────┐
│ ✏  Rename        │
│ 🎨 Change color   │
│ ⚙  Settings      │
│ ─────────────    │
│ 🚪 Leave         │
└──────────────────┘
```

### 2.3 Top Bar — Full Detail

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [≡]  Team Alpha / Sprint 3 Board       [🔍 Search...]   [🔔3] [👤👤+2] [+ Add Task] │
└─────────────────────────────────────────────────────────────────────────┘
```

| Element | Position | Detail |
|---|---|---|
| Hamburger `≡` | Far left | Mobile only — opens sidebar drawer |
| Breadcrumb | Left | `Workspace Name / Page Name` — workspace name links back to dashboard |
| Search bar | Center | Placeholder "Search tasks, boards, members…" — click opens command palette overlay |
| Bell `🔔` | Right group | Notification icon, red badge with unread count. Click opens notification dropdown (max 5 items + "View all") |
| Avatar stack | Right group | Up to 3 avatars of online workspace members, overlap by 8px. `+2` badge if more. Hover shows tooltip: "Priya, Rahul, and 2 others are online" |
| Primary CTA | Far right | Context-aware: `+ Add Task` on board, `+ New Board` on board list, `+ New Workspace` on workspace list |

---

## 3. Route: `/` — Landing Page

**Auth required:** No  
**Component:** `LandingPage`  
**API calls:** None

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NAVBAR (sticky, blurred backdrop)                                      │
│  ⬡ CollabBoard                          [Log in]  [Get started →]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  HERO SECTION (full viewport height, centered)                         │
│                                                                         │
│                Work together.                                           │
│                In real time.                                            │
│                                                                         │
│    Kanban boards, shared whiteboard, and team chat —                    │
│    all synced live across your whole team.                              │
│                                                                         │
│         [ Get started free ]      [ Watch demo ▶ ]                     │
│                                                                         │
│    ┌────────────────────────────────────────────────────────┐          │
│    │   [  App screenshot / animated GIF of board in use  ] │          │
│    │   (shadow, slight tilt, border-radius 16px)            │          │
│    └────────────────────────────────────────────────────────┘          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FEATURES STRIP (3 columns)                                            │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │  ⚡              │  │  🎨             │  │  💬             │        │
│  │  Real-time sync │  │  Live whiteboard│  │  Team chat      │        │
│  │                 │  │                 │  │                 │        │
│  │  Changes appear │  │  Draw together, │  │  One chat room  │        │
│  │  instantly for  │  │  see cursors    │  │  per workspace  │        │
│  │  everyone       │  │  move live      │  │  with mentions  │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FOOTER                                                                 │
│  © 2025 CollabBoard · Built with MERN + Socket.io + Redis              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- "Get started free" → `/register`
- "Log in" → `/login`
- If already authenticated → redirect to `/app/workspaces`

---

## 4. Route: `/login` — Login

**Auth required:** No (redirect to `/app/workspaces` if already logged in)  
**Component:** `LoginPage`  
**API calls:** `POST /auth/login`, `GET /auth/google`

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  (full-screen, centered vertically and horizontally)                    │
│  background: --bg-base with subtle grid pattern                         │
│                                                                         │
│                    ⬡  CollabBoard                                       │
│                    (20px, links to /)                                   │
│                                                                         │
│         ┌───────────────────────────────────────┐                      │
│         │                                       │                      │
│         │  Welcome back                         │  20px 600            │
│         │  Sign in to continue                  │  14px --text-secondary│
│         │                                       │                      │
│         │  ────────── Error banner ──────────── │  (hidden by default) │
│         │  ⚠ Incorrect email or password        │  red bg, 14px        │
│         │                                       │                      │
│         │  Email                                │  12px label          │
│         │  ┌─────────────────────────────────┐  │                      │
│         │  │  arjun@gmail.com                │  │  input field         │
│         │  └─────────────────────────────────┘  │                      │
│         │                                       │                      │
│         │  Password                Forgot?      │  label + link right  │
│         │  ┌─────────────────────────────────┐  │                      │
│         │  │  ••••••••••         [👁 show]  │  │  toggle visibility   │
│         │  └─────────────────────────────────┘  │                      │
│         │                                       │                      │
│         │  ┌─────────────────────────────────┐  │                      │
│         │  │  [◌]  Logging in...             │  │  primary button      │
│         │  │   →   Log in                    │  │  spinner while req   │
│         │  └─────────────────────────────────┘  │                      │
│         │                                       │                      │
│         │  ────────────── or ─────────────────  │                      │
│         │                                       │                      │
│         │  ┌─────────────────────────────────┐  │                      │
│         │  │  G   Continue with Google       │  │  white border btn    │
│         │  └─────────────────────────────────┘  │                      │
│         │                                       │                      │
│         │  Don't have an account?  Sign up →    │  14px, link --accent  │
│         │                                       │                      │
│         └───────────────────────────────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Validation states:**

| Field | Condition | UI feedback |
|---|---|---|
| Email | Blur with invalid format | Red border + "Please enter a valid email" below |
| Password | Submit with empty | Red border + "Password is required" |
| Both | API returns 401 | Red banner above form: "Incorrect email or password" |
| Form | Submitting | Button shows spinner, all inputs disabled |

**After success:** Store `accessToken` in Zustand, set `refreshToken` cookie (httpOnly), redirect to `/app/workspaces` (or the `?redirect=` param if it exists).

---

## 5. Route: `/register` — Register

**Auth required:** No  
**Component:** `RegisterPage`  
**API calls:** `POST /auth/register`

### Layout

Same centered card as login. Card contents:

```
│  Create your account                  │  20px 600
│  Start collaborating in minutes       │  14px --text-secondary
│                                       │
│  Full name                            │
│  ┌─────────────────────────────────┐  │
│  │  Arjun Kumar                    │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Email                                │
│  ┌─────────────────────────────────┐  │
│  │  arjun@gmail.com                │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Password                 8+ chars    │  hint right-aligned
│  ┌─────────────────────────────────┐  │
│  │  ••••••••••       [👁 show]   │  │
│  └─────────────────────────────────┘  │
│  [████████░░░]  Strong                │  password strength bar
│                                       │  4 levels: Weak(red) Fair(orange)
│                                       │  Good(yellow) Strong(green)
│                                       │
│  ┌─────────────────────────────────┐  │
│  │   Create account                │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ────────── or ──────────             │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │  G   Continue with Google       │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Already have an account?  Log in →   │
```

**After success:** Show a separate "Check your email" screen (not a modal):

```
         ┌──────────────────────────────────┐
         │  ✉  Check your email             │  24px
         │                                  │
         │  We sent a verification link to  │
         │  arjun@gmail.com                 │  email in bold
         │                                  │
         │  Click the link to activate      │
         │  your account.                   │
         │                                  │
         │  Didn't get it?                  │
         │  [Resend email]                  │  link button, cooldown 60s
         │                                  │
         │  Wrong email? Go back            │
         └──────────────────────────────────┘
```

---

## 6. Route: `/verify-email/:token`

**Auth required:** No  
**Component:** `VerifyEmailPage`  
**API calls:** `GET /auth/verify-email/:token`

### Layout — 3 states

**Loading:**
```
         ⬡ CollabBoard
         Verifying your email...  [ spinner ]
```

**Success:**
```
         ✓  Email verified!
         Your account is ready.
         [ Go to app → ]          ← links to /app/workspaces
```

**Error (invalid/expired token):**
```
         ⚠  Verification failed
         This link may have expired.
         [ Resend verification email ]
```

---

## 7. Route: `/invite/accept?token=`

**Auth required:** No  
**Component:** `InviteAcceptPage`  
**API calls:** `GET /invite/preview?token=`, `POST /invite/accept`, `POST /invite/accept-register`

### Layout — 5 states

All states share a centered card (same as login page). Card width: 440px.

---

**State 1 — Loading (token being validated):**

```
         ┌──────────────────────────────────┐
         │  ⬡  CollabBoard                  │
         │                                  │
         │  Checking your invitation...     │
         │          [ ◌ spinner ]           │
         └──────────────────────────────────┘
```

---

**State 2 — Valid, user is already logged in with the correct email:**

```
         ┌──────────────────────────────────┐
         │  ⬡  CollabBoard                  │
         │                                  │
         │          👥                      │
         │  You've been invited!            │  20px 600
         │                                  │
         │  Arjun Kumar invited you to join │  14px --text-secondary
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  🟣  Team Alpha          │   │  workspace card
         │  │  Role: Editor            │   │
         │  └──────────────────────────┘   │
         │                                  │
         │  Logged in as:                   │  12px --text-secondary
         │  👤 Priya  ·  priya@gmail.com    │  32px avatar + name + email
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  Join Workspace →        │   │  primary button
         │  └──────────────────────────┘   │
         │                                  │
         │  Not you?  Switch account        │  12px link
         └──────────────────────────────────┘
```

Clicking "Join Workspace" → `POST /invite/accept` → redirect to `/app/workspaces/:id`.

---

**State 3 — Valid, user has account but is NOT logged in:**

```
         ┌──────────────────────────────────┐
         │  ⬡  CollabBoard                  │
         │                                  │
         │  Join Team Alpha as Editor       │  18px 600
         │  Log in to accept this invite    │  14px --text-secondary
         │                                  │
         │  Email                           │
         │  ┌──────────────────────────┐   │
         │  │  priya@gmail.com  🔒      │   │  locked — from token
         │  └──────────────────────────┘   │
         │                                  │
         │  Password                        │
         │  ┌──────────────────────────┐   │
         │  │  ••••••••      [👁]      │   │
         │  └──────────────────────────┘   │
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  Log in & Join →         │   │  primary button
         │  └──────────────────────────┘   │
         │                                  │
         │  ──────── or ────────            │
         │  ┌──────────────────────────┐   │
         │  │  G  Continue with Google  │   │
         │  └──────────────────────────┘   │
         └──────────────────────────────────┘
```

---

**State 4 — Valid, user has NO account (new user):**

```
         ┌──────────────────────────────────┐
         │  ⬡  CollabBoard                  │
         │                                  │
         │  Join Team Alpha as Editor       │  18px 600
         │  Create your account to join     │  14px --text-secondary
         │                                  │
         │  Email                           │
         │  ┌──────────────────────────┐   │
         │  │  neha@gmail.com  🔒       │   │  locked — from token
         │  └──────────────────────────┘   │
         │                                  │
         │  Full name                       │
         │  ┌──────────────────────────┐   │
         │  │  Neha Joshi              │   │
         │  └──────────────────────────┘   │
         │                                  │
         │  Password              8+ chars  │
         │  ┌──────────────────────────┐   │
         │  │  ••••••••      [👁]      │   │
         │  └──────────────────────────┘   │
         │  [████████░░]  Strong            │  strength bar
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  Create Account & Join → │   │  primary button
         │  └──────────────────────────┘   │
         └──────────────────────────────────┘
```

After submit → `POST /invite/accept-register` → receives `accessToken` → stores in Zustand → redirects to workspace.

---

**State 5 — Invalid / expired / revoked token:**

```
         ┌──────────────────────────────────┐
         │  ⬡  CollabBoard                  │
         │                                  │
         │          ⚠                       │  40px --warning
         │  Invitation not valid            │  20px 600
         │                                  │
         │  This link has expired or been   │  14px --text-secondary
         │  revoked by the workspace admin. │
         │                                  │
         │  Ask for a new invite link, or   │
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  Go to Home              │   │  secondary button
         │  └──────────────────────────┘   │
         └──────────────────────────────────┘
```

---

## 8. Route: `/app/workspaces` — Workspace List

**Auth required:** Yes  
**Component:** `WorkspaceListPage`  
**API calls:** `GET /workspaces`

### Layout

```
CENTER CONTENT AREA:
┌─────────────────────────────────────────────────────────────────────────┐
│  Your Workspaces                              [ + New Workspace ]       │
│  3 workspaces                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  │
│  │  🟣               │  │  🟦               │  │  🟩               │  │
│  │                   │  │                   │  │                   │  │
│  │  Team Alpha       │  │  Design Studio    │  │  Personal         │  │
│  │                   │  │                   │  │                   │  │
│  │  4 members        │  │  2 members        │  │  1 member         │  │
│  │  3 boards         │  │  1 board          │  │  2 boards         │  │
│  │                   │  │                   │  │                   │  │
│  │  👤👤👤           │  │  👤👤             │  │  👤               │  │
│  │                   │  │                   │  │                   │  │
│  │  2 hours ago      │  │  1 day ago        │  │  Just now         │  │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘  │
│                                                                         │
│  Loading state: 3 skeleton cards (shimmer animation, same dimensions)  │
│  Empty state: centered illustration + "Create your first workspace"     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Workspace card — anatomy:**
- Top-left: large colored circle (workspace identity color, 40px)
- Title: 16px 600 `--text-primary`
- Stats: "4 members · 3 boards" 12px `--text-secondary`
- Avatar row: up to 3 member avatars (24px, overlapping -6px)
- Timestamp: "Last active 2h ago" 12px `--text-muted`
- Hover: `translateY(-3px)`, shadow increases, cursor pointer
- Border: `1px solid --border`, radius `--radius-lg`

**"+ New Workspace" modal** (renders over page with dark overlay):

```
┌───────────────────────────────────────┐
│  Create workspace               [✕]  │  16px 600
├───────────────────────────────────────┤
│                                       │
│  Workspace name                       │
│  ┌───────────────────────────────┐   │
│  │  My Team                      │   │
│  └───────────────────────────────┘   │
│                                       │
│  Description  (optional)              │
│  ┌───────────────────────────────┐   │
│  │                               │   │  3 rows textarea
│  └───────────────────────────────┘   │
│                                       │
│  Color                                │
│  ● ● ● ● ● ● ● ●                     │  8 color swatches, click to select
│  🟣 🟦 🟩 🟥 🟧 🩷 🩶 ⬛             │  selected: white ring around it
│                                       │
│  [ Cancel ]         [ Create →  ]     │
└───────────────────────────────────────┘
```

After create → new workspace card appears via optimistic update → redirect to `/app/workspaces/:newId`.

---

## 9. Route: `/app/workspaces/:id` — Workspace Dashboard

**Auth required:** Yes (member)  
**Component:** `WorkspaceDashboard`  
**API calls:** `GET /workspaces/:id`, `GET /workspaces/:id/boards`, `GET /workspaces/:id/activity`

### Layout

```
CENTER CONTENT AREA:
┌─────────────────────────────────────────────────────────────────────────┐
│  🟣  Team Alpha                                        [ + New Board ]  │
│  4 members  ·  3 boards  ·  You're an Owner                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BOARDS ───────────────────────────────────────────────────────────── │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  📋              │  │  📋               │  │  📋              │     │
│  │  Sprint 3        │  │  Bug Tracker      │  │  Design Review   │     │
│  │                  │  │                   │  │                  │     │
│  │  12 tasks        │  │  5 tasks          │  │  8 tasks         │     │
│  │  ■ 4 Todo        │  │  ■ 3 Todo         │  │  ■ 2 Todo        │     │
│  │  ■ 3 In Progress │  │  ■ 2 In Progress  │  │  ■ 1 In Progress │     │
│  │  ■ 2 Review      │  │  ■ 0 Review       │  │  ■ 3 Review      │     │
│  │  ■ 3 Done        │  │  ■ 0 Done         │  │  ■ 2 Done        │     │
│  │                  │  │                   │  │                  │     │
│  │  2 mins ago      │  │  1 hour ago       │  │  3 days ago      │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY ──────────────────────────────────────────────────── │
│                                                                         │
│  👤 Arjun moved "Fix login bug"  In Progress → Review       2m ago    │
│  👤 Priya commented on "Design nav"  "Looks good!"          15m ago   │
│  👤 Rahul created "Write unit tests" in Sprint 3            1h ago    │
│  👤 Priya joined Team Alpha as Editor                       2h ago    │
│  👤 Arjun created board "Bug Tracker"                       1d ago    │
│                                                 [ View all activity ]  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  MEMBERS ONLINE NOW ───────────────────────────────────────────────── │
│                                                                         │
│  👤 Arjun Kumar    🟢 Online  ·  Viewing Sprint 3                      │
│  👤 Priya Sharma   🟢 Online  ·  Viewing Sprint 3                      │
│  👤 Rahul Verma    ⚫ Offline  ·  Last seen 3h ago                      │
│  👤 Neha Joshi     ⚫ Offline  ·  Last seen 1d ago                      │
│                                              [ Manage members → ]      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Board mini-card:**
- The colored bar chart (■■■■) is a tiny horizontal stacked bar showing tasks by column — color matches each column color
- Hover shows `···` options menu: Rename, Delete
- Click → navigates to `/app/workspaces/:id/boards/:boardId`

**Activity row format:**
```
[avatar 24px]  [Name]  [action text]  [relative time right-aligned]
```
Actions are human-readable: "moved X to Review", "commented on X", "created X", "joined as Editor".

**"+ New Board" modal:**
```
┌──────────────────────────────────────┐
│  Create board                  [✕]  │
├──────────────────────────────────────┤
│                                      │
│  Board name                          │
│  ┌────────────────────────────────┐  │
│  │  Sprint 4                      │  │
│  └────────────────────────────────┘  │
│                                      │
│  Starts with default columns:        │
│  [To Do] [In Progress] [Review] [Done]  ← non-interactive pills │
│  (you can rename/add after creation) │
│                                      │
│  [ Cancel ]      [ Create board → ]  │
└──────────────────────────────────────┘
```

---

## 10. Route: `/app/workspaces/:id/boards/:boardId` — Board (Kanban)

**Auth required:** Yes (member)  
**Component:** `BoardPage` with `KanbanView` tab active  
**API calls:** `GET /workspaces/:id/boards/:boardId`  
**Socket events:** `join:board`, listens to all `task:*` and `board:*` events

### 10.1 Page Header

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Team Alpha / Sprint 3 Board    🔍   [ Board | Whiteboard ]  👤👤  [+ Add Task] │
└─────────────────────────────────────────────────────────────────────────┘
```

"Board | Whiteboard" is a two-segment toggle. Active segment has `--accent` background, inactive is transparent. Switching tabs does NOT navigate — it replaces the center content area in place.

### 10.2 Filter Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [ 🔽 All priorities ]  [ 👤 All assignees ]  [ 📅 Due date ]  [Clear] │
└─────────────────────────────────────────────────────────────────────────┘
```

- All filters are applied **client-side** (no re-fetch) against the loaded board data
- Dropdowns use checkbox lists (multi-select for priorities and assignees)
- Active filters become dismissable chips: `🔴 Urgent ✕  👤 Arjun ✕`
- "Clear" button only visible when ≥1 filter is active
- Filtered-out cards disappear with a fade-out animation (opacity 0, height 0)

### 10.3 Kanban Columns

```
┌────────────────┬───────────────────┬─────────────────┬─────────────────────┐
│  TO DO    (3)  │  IN PROGRESS  (2) │  REVIEW    (1)  │  DONE          (5)  │
│  ─ grey bar ─  │  ─ blue bar ──   │  ─ purple bar ─  │  ─ green bar ──    │
│                │                   │                  │                     │
│  [task cards]  │  [task cards]     │  [task cards]    │  [task cards]       │
│                │                   │                  │                     │
│  + Add task    │  + Add task       │  + Add task      │  + Add task         │
└────────────────┴───────────────────┴─────────────────┴─────────────────────┘
```

**Column header:**
```
┌──────────────────────────────┐
│  ═══  IN PROGRESS   (2)  ··· │
└──────────────────────────────┘
  ↑                         ↑
  3px colored top border    hover to see options menu
  (--info for In Progress)
```

Column count `(2)` updates in real time as tasks move in/out via socket events.

**Column options menu (··· hover):**
```
┌─────────────────────┐
│  ✏  Rename          │
│  🎨  Change color   │
│  +  Add task        │
│  ───────────────    │
│  🗑  Delete column  │  → confirmation required
└─────────────────────┘
```

"Delete column" modal says: "This will move all tasks in this column to To Do. This cannot be undone."

### 10.4 Task Card — Full Anatomy

```
┌──────────────────────────────────┐
│  🔴  Design nav component        │  priority dot (4px) + title (14px 500)
│                                  │  2 line max, text-overflow ellipsis
│  📎 Authentication  📎 Frontend  │  label pills (11px, --accent-muted bg)
│                                  │  max 2 shown, "+1 more" if overflow
│  👤 Priya               💬 3    │  assignee avatar(s) left, comment count right
│  Due tmrw  🔴                    │  due date: red if overdue, amber if ≤2 days
└──────────────────────────────────┘
```

**Card states:**

| State | Visual |
|---|---|
| Default | `--bg-surface`, `1px solid --border` |
| Hover | `--bg-surface-2`, shadow increases |
| Dragging | Slight rotation `rotate(2deg)`, blue glow, opacity 0.9 |
| Drop target gap | Blue line between cards showing insert position |
| Being dragged over column | Column border turns `--accent`, bg lightens |

**Quick-add card** (appears at bottom of column when "+ Add task" clicked):
```
┌──────────────────────────────────┐
│  Task title...                   │  auto-focused input
│                      [Add] [Esc] │  Enter = submit, Esc = cancel
└──────────────────────────────────┘
```

Creates task immediately (optimistic) in that column with default priority Medium.

### 10.5 Task Detail Modal

Opens when a task card is clicked. Does not navigate. URL stays the same. Renders in a centered modal with dark overlay. Width: 860px. Max-height: 90vh with internal scroll.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  overlay (click outside → close)                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Fix login bug                                      [✏ Edit] [✕]  │  │
│  │  Sprint 3  ›  In Progress                                          │  │
│  │  ────────────────────────────────────────────────────────────────  │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────┐  ┌────────────────────────┐  │  │
│  │  │  LEFT PANEL (58%)               │  │  RIGHT PANEL (42%)     │  │  │
│  │  │                                 │  │                        │  │  │
│  │  │  Status                         │  │  ASSIGNEES             │  │  │
│  │  │  ┌─────────────────────────┐   │  │  👤 Arjun Kumar  [✕]   │  │  │
│  │  │  │  🔵 In Progress     ▼  │   │  │  + Assign someone      │  │  │
│  │  │  └─────────────────────────┘   │  │                        │  │  │
│  │  │                                 │  │  DUE DATE              │  │  │
│  │  │  Priority                       │  │  [ Jun 15, 2025  📅 ] │  │  │
│  │  │  ┌─────────────────────────┐   │  │                        │  │  │
│  │  │  │  🟡 Medium          ▼  │   │  │  LABELS                │  │  │
│  │  │  └─────────────────────────┘   │  │  🔵 Auth  🟢 Bug  +   │  │  │
│  │  │                                 │  │                        │  │  │
│  │  │  Description                    │  │  ─────────────────     │  │  │
│  │  │  ┌─────────────────────────┐   │  │                        │  │  │
│  │  │  │  The JWT token isn't    │   │  │  Created by            │  │  │
│  │  │  │  being sent correctly   │   │  │  👤 Priya · 2 days ago │  │  │
│  │  │  │  on mobile safari...    │   │  │                        │  │  │
│  │  │  │                  [Edit] │   │  │  Last updated          │  │  │
│  │  │  └─────────────────────────┘   │  │  1 hour ago            │  │  │
│  │  │                                 │  └────────────────────────┘  │  │
│  │  │  ── ACTIVITY & COMMENTS ─────  │                               │  │
│  │  │                                 │                               │  │
│  │  │  👤 Priya                 2h   │                               │  │
│  │  │  Can you check the              │                               │  │
│  │  │  interceptor?                   │                               │  │
│  │  │                                 │                               │  │
│  │  │  👤 Arjun                 1h   │                               │  │
│  │  │  Yes, on it now                 │                               │  │
│  │  │                                 │                               │  │
│  │  │  ── System events ───────────   │                               │  │
│  │  │  ↕ Priya moved to Review  3h   │                               │  │
│  │  │  ↕ Arjun moved to In Prog 4h   │                               │  │
│  │  │                                 │                               │  │
│  │  │  ┌─────────────────────────┐   │                               │  │
│  │  │  │  Write a comment...     │   │                               │  │
│  │  │  │  (@ to mention)        │   │                               │  │
│  │  │  └─────────────────────────┘   │                               │  │
│  │  │                    [Comment]   │                               │  │
│  │  └─────────────────────────────────┘                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Status dropdown options:**
```
  🔘 To Do
  🔵 In Progress  ← currently selected (checkmark)
  🟣 Review
  ✅ Done
```
Selecting a new status calls `PATCH .../tasks/:id/move` AND updates the board behind the modal via the socket event (card visually moves column).

**"+ Assign someone" search:**
```
┌──────────────────────────┐
│ 🔍 Search members...     │
├──────────────────────────┤
│  👤 Priya Sharma         │
│  👤 Rahul Verma          │
└──────────────────────────┘
```
Only shows workspace members not already assigned. Selecting → `POST .../assignees`.

**Comment `@` mention:**
When user types `@` in the comment box, a floating dropdown appears above the cursor:
```
┌──────────────────────────┐
│  👤 Arjun Kumar          │
│  👤 Priya Sharma         │
│  👤 Rahul Verma          │
└──────────────────────────┘
```
Selecting inserts `@Arjun` as a purple chip inside the text. On submit, mentioned users get a notification.

**System events** (in the activity section, visually distinct from comments):
- Lighter background `--bg-surface-2`
- Icon: `↕` for moves, `✏` for edits, `👤` for assignments
- Text: "Priya moved this to Review" with timestamp

---

## 11. Route: Same Board — Whiteboard Tab

**Auth required:** Yes (member)  
**Component:** `WhiteboardView` (replaces KanbanView in same route)  
**API calls:** `GET /workspaces/:id/boards/:boardId/whiteboard` (load snapshot)  
**Socket events:** `whiteboard:stroke`, `whiteboard:cursor`, `whiteboard:clear`, `whiteboard:cleared`

### 11.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Team Alpha / Sprint 3    [ Board | Whiteboard ]  👤👤  [💾 Save]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────┐  ┌──────────────────────────────────────────────────────┐   │
│  │ TOOL │  │  CANVAS  (flex-grow, full height)                     │   │
│  │ BAR  │  │                                                        │   │
│  │      │  │   ↖ Arjun  (cursor dot + name label, moves live)      │   │
│  │  ✏️  │  │                                                        │   │
│  │  ○   │  │   ≋≋≋≋≋≋≋  (Priya's live stroke, in her color)       │   │
│  │  ─   │  │                                                        │   │
│  │  ⬜  │  │                                                        │   │
│  │  T   │  │            [ your own drawing area ]                  │   │
│  │  🖐  │  │                                                        │   │
│  │ ───  │  │                                                        │   │
│  │  🎨  │  │                                                        │   │
│  │ ───  │  │                                                        │   │
│  │ ●●○  │  │                                                        │   │
│  │ ───  │  │                                                        │   │
│  │ 2px  │  │                                                        │   │
│  │ 4px  │  │                                                        │   │
│  │ 8px  │  │                                                        │   │
│  │ ───  │  │                                                        │   │
│  │  🗑  │  │                                                        │   │
│  └──────┘  └──────────────────────────────────────────────────────┘   │
│                                                                         │
│  COLOR SWATCHES (horizontal, below toolbar):                           │
│  ■ ■ ■ ■ ■ ■ ■ ■   (black · white · red · blue · green · yellow · purple · pink) │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Toolbar Tools

| Icon | Tool | What it does |
|---|---|---|
| ✏️ | Pen | Freehand draw. Default tool. Cursor = crosshair. |
| ○ | Ellipse | Click and drag to draw oval/circle. Shift = perfect circle. |
| ─ | Line | Click start, drag to end. Straight line. |
| ⬜ | Rectangle | Click and drag. Shift = perfect square. |
| T | Text | Click to place cursor. Type. Click elsewhere to confirm. 16px default. |
| 🖐 | Pan | Click and drag canvas to scroll. No drawing. Cursor = grab. |
| 🎨 | Color | Opens a small color wheel picker. Updates active color swatch. |
| ●●○ | Fill | Toggle: filled shape vs outline only (applies to ○ and ⬜) |
| 2px/4px/8px | Width | Stroke thickness — thin/medium/thick. Active = highlighted. |
| 🗑 | Clear | Editor+ only. Opens confirmation: "Clear the whiteboard?" [Cancel] [Clear all]. Broadcasts to all users. |

Active tool: highlighted with `--accent-muted` background.

### 11.3 Other Users' Cursors

Each connected user gets a unique color (assigned by server on join — cycle through: `#F87171, #FB923C, #34D399, #60A5FA, #A78BFA, #F472B6`).

Their cursor:
- Small filled circle (8px) in their color
- Their first name in a pill label beside it, same color
- Moves in real time as they move mouse
- Disappears if they stop moving for 5 seconds (fade out)
- Disappears if they leave the board

### 11.4 Save Behavior

The "💾 Save" button in the top bar:
- Captures all current strokes as a JSON array
- Calls `POST /whiteboard/save` with the JSON
- Button shows spinner during save
- On success: green "✓ Saved" toast for 2 seconds, button returns to normal
- Auto-save: fires every 5 minutes if `isDirty` (any new strokes since last save)
- On page load: `GET /whiteboard` fetches latest snapshot and paints it to canvas

---

## 12. Route: `/app/workspaces/:id/chat` — Chat

**Auth required:** Yes (member)  
**Component:** `ChatPage`  
**API calls:** `GET /workspaces/:id/messages?limit=50`  
**Socket events:** `chat:send`, listens to `chat:message`, `chat:typing`

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  # general  ·  Team Alpha                        [ 👤👤👤 online ]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MESSAGES AREA (flex-grow, overflow-y scroll, newest at bottom)        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  ─────────────────  Today  ─────────────────────────────────    │  │
│  │  (date divider: 12px --text-muted, hr lines either side)        │  │
│  │                                                                  │  │
│  │  👤  Priya Sharma                                 9:14 AM       │  │
│  │      Hey, can someone review the login PR?                      │  │
│  │                                                                  │  │
│  │  👤  Arjun Kumar                                  9:16 AM       │  │
│  │      Sure, I'll take a look after standup                       │  │
│  │      Also, the Redis cache bug is fixed now                     │  │  ← grouped (same user, <5 min)
│  │      Check the latest commit                                    │  │
│  │                                                                  │  │
│  │  👤  Rahul Verma                                  9:20 AM       │  │
│  │      @Arjun the whiteboard has the new flow layout              │  │  ← @mention in --accent color
│  │                                                                  │  │
│  │  ──────────────── 1 hour ago ──────────────────────────────     │  │
│  │                                                                  │  │
│  │                                                                  │  │
│  │  👤  Priya is typing...                                         │  │  ← typing indicator
│  │     animated dots  ···                                          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Message #general...                          [@ Mention]  [↵] │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Message Grouping Rules

Consecutive messages from the **same user** within **5 minutes** are grouped:
- First message: shows 40px avatar + bold name + timestamp
- Following messages in same group: indented 48px (avatar width + gap), no avatar, no name, no timestamp
- Hovering any message in the group shows its timestamp as a tooltip

```
  👤  Arjun Kumar                                  9:16 AM
      Sure, I'll take a look after standup                    ← first message
      Also, the Redis cache bug is fixed now                  ← grouped (no avatar)
      Check the latest commit                                 ← grouped (no avatar)
```

### Input Bar Behavior

| Action | Result |
|---|---|
| Type text | Updates input value, emits `chat:typing` after 300ms debounce |
| Stop typing 3s | Emits `chat:typing { isTyping: false }` |
| Press Enter | Sends message via `socket.emit('chat:send', ...)`, clears input |
| Press Shift+Enter | Newline (multiline message) |
| Type `@` | Opens floating mention dropdown above input (user search) |
| Select mention | Inserts `@Name` as purple highlight in input text |
| Paste image | Shows preview chip in input (file upload — Phase 6 stretch goal) |

### Loading Behavior

On mount:
1. Fetch last 50 messages from REST (`GET /messages?limit=50`)
2. Render them, scroll to bottom
3. Attach socket listener for `chat:message`
4. New messages via socket are appended to bottom, auto-scroll if user is within 100px of bottom
5. "Scroll to bottom ↓" floating button appears if user has scrolled up and new messages arrive
6. Infinite scroll upward: when user scrolls to top, fetch next 50 (`?before=<firstMessageId>`)

---

## 13. Route: `/app/workspaces/:id/settings` — Workspace Settings

**Auth required:** Yes (admin+)  
**Component:** `WorkspaceSettingsPage`  
**API calls:** Various workspace/member endpoints

### 13.1 Tab: General

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings  ·  Team Alpha                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  [ General ✓ ]  [ Members ]  [ Danger Zone ]                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WORKSPACE DETAILS ──────────────────────────────────────────────────  │
│                                                                         │
│  Name                                                                   │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  Team Alpha                                                    │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Description                                                            │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  Our main product team workspace                               │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Workspace color                                                        │
│  ● ● ● ● ● ● ● ●    (8 swatches, selected has white ring)             │
│  🟣 🟦 🟩 🟥 🟧 🩷 🩶 ⬛                                               │
│                                                                         │
│                                             [ Save changes ]            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

"Save changes" only appears active (not greyed) when any field has been modified from its original value. On save: success toast "Workspace updated". Sidebar workspace name updates immediately via Zustand.

### 13.2 Tab: Members

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [ General ]  [ Members ✓ ]  [ Danger Zone ]                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INVITE PEOPLE ──────────────────────────────────────────────────────  │
│                                                                         │
│  ┌──────────────────────────────────────────┐  ┌────────────────────┐ │
│  │  🔍 Search by name or email...           │  │  Role:             │ │
│  └──────────────────────────────────────────┘  │  [ Editor      ▼ ] │ │
│                                                  └────────────────────┘ │
│  ┌──────────────────────────────────────────┐                          │
│  │  👤 Priya Sharma    priya@gmail.com       │  ← result row           │
│  │  👤 Priyanka Nair   pk@outlook.com        │  ← result row           │
│  │  ✉  Invite "priya@new.com" by email      │  ← email fallback row   │
│  └──────────────────────────────────────────┘                          │
│                                                                         │
│  (after selection, input becomes a chip:)                              │
│  ┌──────────────────────────────────────────┐  ┌──────────┐           │
│  │  👤 Priya Sharma  priya@gmail.com  [✕]  │  │  Invite  │           │
│  └──────────────────────────────────────────┘  └──────────┘           │
│                                                                         │
│  CURRENT MEMBERS (4) ─────────────────────────────────────────────── │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  👤 Arjun Kumar    arjun@gmail.com    Owner     🟢 Online     │    │
│  │                                       (no dropdown, no remove) │    │
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  👤 Priya Sharma   priya@gmail.com    [Editor ▼]  🟢 Online  [Remove]│
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  👤 Rahul Verma    rahul@iitk.ac.in   [Viewer ▼]  ⚫ Offline [Remove]│
│  ├───────────────────────────────────────────────────────────────┤    │
│  │  👤 Neha Joshi     neha@gmail.com     [Admin  ▼]  ⚫ Offline [Remove]│
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  PENDING INVITATIONS (2) ─────────────────────────────────────────── │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  ✉  jay@iitb.ac.in     Editor    Sent by Arjun   6d left  [Revoke]│
│  │  ✉  sam@company.com    Viewer    Sent by Arjun   2d left  [Revoke]│
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Role change behavior:** Selecting a new role from the dropdown calls `PATCH /members/:userId` immediately (no extra confirm step). Shows brief "✓" checkmark beside the dropdown on success.

**Remove behavior:** Clicking [Remove] shows inline confirmation replacing the row:
```
│  👤 Priya Sharma   Remove Priya from Team Alpha?  [Cancel]  [Remove]  │
```

**Invite result behavior:**
- Direct add: new member appears at bottom of "Current Members" list via optimistic update
- Email invite: new row appears at bottom of "Pending Invitations" list

**Revoke behavior:** Row fades out and disappears. Toast: "Invitation revoked."

### 13.3 Tab: Danger Zone

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [ General ]  [ Members ]  [ Danger Zone ✓ ]                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Leave workspace                                                  │  │
│  │  ─────────────────────────────────────────────────────────────   │  │
│  │  You'll lose access to all boards and data.                      │  │
│  │  You can be re-invited by an admin.                              │  │
│  │                                                  [ Leave ] ←red  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Delete workspace                           (Owner only)          │  │
│  │  ─────────────────────────────────────────────────────────────   │  │
│  │  Permanently deletes all boards, tasks, messages, and files.     │  │
│  │  This cannot be undone.                                          │  │
│  │                                              [ Delete ] ← red    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  (Delete button only shows for workspace owner. Others see it greyed   │
│  with tooltip "Only the owner can delete this workspace")              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Both buttons open a **type-to-confirm modal**:

```
┌───────────────────────────────────────────┐
│  Delete "Team Alpha"?                [✕]  │
├───────────────────────────────────────────┤
│                                           │
│  This will permanently delete:            │
│  • 3 boards                               │
│  • 42 tasks                               │
│  • All chat history                       │
│                                           │
│  This cannot be undone.                   │
│                                           │
│  Type  Team Alpha  to confirm:            │
│  ┌───────────────────────────────────┐   │
│  │                                   │   │  input
│  └───────────────────────────────────┘   │
│                                           │
│  [ Cancel ]      [ Delete workspace ]    │
│                  ↑ disabled until name    │
│                    matches exactly        │
└───────────────────────────────────────────┘
```

---

## 14. Route: `/app/notifications` — Notifications

**Auth required:** Yes  
**Component:** `NotificationsPage`  
**API calls:** `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`  
**Socket events:** Listens to `notification:new`

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Notifications                          [ ✓ Mark all read ]  [ 🗑 Clear ]│
├─────────────────────────────────────────────────────────────────────────┤
│  [ All (8) ]  [ Unread (3) ]  [ Mentions ]  [ Tasks ]  [ Workspace ]   │
│  (tabs filter client-side, no re-fetch)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ── UNREAD ──────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ▌ 🔔  👤 Priya mentioned you in "Fix login bug"     2 min ago   │  │ ← blue left border
│  │ ▌     "Check the @Arjun interceptor logic"                       │  │
│  │ ▌     Sprint 3  ·  Team Alpha              [View task →]        │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ▌ 📋  You were assigned "Design nav"       15 min ago           │  │
│  │ ▌     Assigned by Priya Sharma                                   │  │
│  │ ▌     Sprint 3  ·  Team Alpha              [View task →]        │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ▌ ⏰  "Write unit tests" is due tomorrow   1 hour ago           │  │
│  │ ▌     Sprint 3  ·  Team Alpha              [View task →]        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ── READ ────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   👥  You joined Team Alpha as Editor       2 days ago           │  │ ← no left border, dimmer bg
│  │       Invited by Priya Sharma                                    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │   📋  Arjun assigned you "Setup CI"         5 days ago           │  │
│  │       Sprint 1  ·  Team Alpha               [View task →]       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Notification row interactions:**
- Click anywhere on row → marks read (blue border fades out) + navigates to the linked page
- Hover → shows `[✕ Dismiss]` icon on the right edge

**Notification icons by type:**
| Type | Icon |
|---|---|
| `comment_mention` | 💬 with user avatar |
| `task_assigned` | 📋 |
| `task_due` | ⏰ |
| `workspace_invite` | 👥 |

**Bell dropdown** (from top bar — max 5 items):

```
           ┌────────────────────────────────────────┐
           │  Notifications                 [✓ All] │
           ├────────────────────────────────────────┤
           │  💬 Priya mentioned you in…    2m ago  │
           │  📋 Assigned: Design nav…     15m ago  │
           │  ⏰ Due tomorrow: Tests…       1h ago  │
           ├────────────────────────────────────────┤
           │        View all notifications →        │
           └────────────────────────────────────────┘
```

Clicking outside the dropdown closes it. "View all" links to `/app/notifications`.

---

## 15. Route: `/app/profile` — Profile

**Auth required:** Yes  
**Component:** `ProfilePage`  
**API calls:** `PATCH /users/me`, `PATCH /users/me/password`

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Profile                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  AVATAR ─────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌────────────┐                                                        │
│  │            │  Arjun Kumar                   14px 600               │
│  │  [64px     │  arjun@gmail.com               12px --text-secondary  │
│  │   avatar]  │                                                        │
│  │            │  [ Change avatar ]  [ Remove ] ← links                │
│  └────────────┘                                                        │
│  (Change avatar opens file picker, previews immediately,               │
│  uploads to Cloudinary on save)                                        │
│                                                                         │
│  ACCOUNT INFO ───────────────────────────────────────────────────────  │
│                                                                         │
│  Full name                                                              │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  Arjun Kumar                                                  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Email address  (cannot be changed)                                    │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  arjun@gmail.com                                   🔒         │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
│                                               [ Save changes ]          │
│                                                                         │
│  CHANGE PASSWORD ────────────────────────────────────────────────────  │
│  (Hidden for Google OAuth users — shows "Signed in with Google 🔵"     │
│   with a note: "Password managed by Google")                           │
│                                                                         │
│  Current password                                                       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  ••••••••                                          [👁 show]  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  New password                                           8+ chars       │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  ••••••••                                          [👁 show]  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│  [████████░░]  Strong                                                  │
│                                                                         │
│  Confirm new password                                                   │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  ••••••••                                                     │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                         │
│                                               [ Update password ]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

On "Update password" success: toast "Password updated", all three fields clear.  
On wrong current password: red border on current password field + "Incorrect current password" below it.

---

## 16. Global Components

These components appear across multiple pages. Build them once in `components/ui/`.

### 16.1 Toast Notifications

Position: fixed, bottom-right, z-index 9999. Stack from bottom upward (max 3 visible).

```
                    ┌────────────────────────────────┐
                    │  ✓  Task moved to Review        │  ← success (green left border)
                    └────────────────────────────────┘
                    ┌────────────────────────────────┐
                    │  ✕  Failed to save whiteboard   │  ← error (red left border)
                    └────────────────────────────────┘
                    ┌────────────────────────────────┐
                    │  ℹ  Priya joined the board      │  ← info (blue left border)
                    └────────────────────────────────┘
```

- Slide-in from right (CSS `translateX` transition, 200ms ease-out)
- Auto-dismiss after 4 seconds (progress bar drains across the bottom of the toast)
- `[✕]` button on hover for manual dismiss
- API: `toast.success('msg')`, `toast.error('msg')`, `toast.info('msg')` via Zustand or Context

### 16.2 Loading Skeleton

Used on pages where data is fetching. Matches the shape of the content.

```
Board list skeleton:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  ░░░░░░░░░░░░░   │  │  ░░░░░░░░░░░░░   │  │  ░░░░░░░░░░░░░   │
│  ░░░░░░░         │  │  ░░░░░░░         │  │  ░░░░░░░         │
│  ░░░░░░░░░       │  │  ░░░░░░░░░       │  │  ░░░░░░░░░       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Shimmer: `background: linear-gradient(90deg, --bg-surface 25%, --bg-surface-2 50%, --bg-surface 75%)`, animated `background-position` from -200% to 200%.

### 16.3 Empty States

Used inside columns and on pages when no data exists.

```
  ┌───────────────────────────────┐
  │           🗒️                  │  48px emoji
  │   No tasks here yet           │  16px 500
  │   Drag a task here or         │  14px --text-secondary
  │   [+ Add first task]          │  link button
  └───────────────────────────────┘
```

Customize text per context: "No boards yet", "No messages", "No notifications".

### 16.4 Confirmation Modal

Used for all destructive actions.

```
┌──────────────────────────────────────────┐
│  Delete "Sprint 3"?                 [✕]  │  16px 600
├──────────────────────────────────────────┤
│                                          │
│  This action cannot be undone.           │  14px --text-secondary
│                                          │
│  [optional: list of consequences]        │
│  · 12 tasks will be deleted              │
│                                          │
│  [optional: type-to-confirm input]       │
│  Type "Sprint 3" to confirm:             │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [ Cancel ]       [ Delete board ]      │
│                   ↑ --danger button      │
└──────────────────────────────────────────┘
```

### 16.5 Command Palette (`Ctrl+K`)

Global overlay. Triggered by clicking the search bar in the top bar OR pressing `Ctrl+K` / `⌘+K`. Closes on `Esc` or clicking the backdrop.

```
┌──────────────────────────────────────────────────────────────┐
│  🔍  Search tasks, boards, members...                  [Esc] │  input, auto-focused
├──────────────────────────────────────────────────────────────┤
│  RECENT                                                       │  12px uppercase label
│                                                               │
│  📋  Fix login bug              Sprint 3 · Team Alpha        │
│  📋  Design nav component       Sprint 3 · Team Alpha        │
│  🗂   Sprint 3 board            Team Alpha                    │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                                │
│                                                               │
│  ➕  New task                                                 │
│  ➕  New board                                                │
│  👤  Invite member                                            │
│  ⚙   Workspace settings                                      │
└──────────────────────────────────────────────────────────────┘
```

As user types, "RECENT" section is replaced by live search results filtered by name/title. Arrow keys navigate results. Enter selects.

### 16.6 Avatar Stack

Used in top bar and presence indicators.

```
  [👤][👤][👤]  +2
```

- Each avatar: 28px circle, overlapping -8px (negative margin-left)
- Tooltip on hover over the whole stack: "Priya, Rahul, Neha, and 2 others are online"
- The `+2` badge is a 28px circle with `--bg-surface-2` bg and `--text-secondary` text

### 16.7 Role Badge

```
  [  Owner  ]    → --warning-muted bg, --warning color
  [  Admin  ]    → --accent-muted bg, --accent color
  [  Editor ]    → --bg-surface-2 bg, --text-primary color
  [  Viewer ]    → --bg-surface-2 bg, --text-secondary color
```

### 16.8 Priority Dot / Badge

Used on task cards and inside the task detail modal.

```
Dot (4px circle, for cards):
  🔴 Urgent   🟠 High   🟡 Medium   🟢 Low

Badge (for detail modal):
  ┌────────────────┐
  │  🟡  Medium  ▼ │   ← dropdown select, 12px pill
  └────────────────┘
```

### 16.9 Responsive / Mobile

On screens **< 768px**:

- Sidebar collapses to a **bottom tab bar** (5 icons: Home, Boards, Chat, Notifications, Profile)
- Board columns scroll horizontally via touch swipe — one column visible at a time with snap scroll
- Task cards: min-height 56px (touch target), larger font
- Modals: full-screen bottom sheet (slides up from bottom)
- Top bar: hides breadcrumb text, shows only workspace name + bell icon + avatar
- Command palette: full-screen overlay with large touch-friendly result rows

---
