# CollabBoard — Professional Product Design

**Purpose:** This document defines the professional-grade UI, UX, and feature set for CollabBoard.
It covers what real production apps like Slack, Linear, and Notion do — and how CollabBoard
implements those patterns. Read this before building any screen.

---

## Table of Contents

1. [Why This Redesign — What Was Missing](#1-why-this-redesign)
2. [Design Philosophy](#2-design-philosophy)
3. [Design System — Production Grade](#3-design-system)
4. [Global App Shell — Slack-style](#4-global-app-shell)
5. [Onboarding Flow](#5-onboarding-flow)
6. [Landing Page](#6-landing-page)
7. [Auth Pages](#7-auth-pages)
8. [Workspace Home](#8-workspace-home)
9. [Board Page — Kanban](#9-board-page)
10. [Board Page — Whiteboard](#10-whiteboard)
11. [Chat — Threaded, Slack-style](#11-chat)
12. [Notifications Center](#12-notifications)
13. [My Work — Personal Dashboard](#13-my-work)
14. [Search — Command Palette](#14-search)
15. [Workspace Settings](#15-workspace-settings)
16. [Profile & Preferences](#16-profile)
17. [Realistic Features Added](#17-realistic-features-added)
18. [Micro-interactions & Animations](#18-micro-interactions)
19. [Mobile Experience](#19-mobile)
20. [Accessibility](#20-accessibility)

---

## 1. Why This Redesign

The previous UI.md had the right structure but missed what makes apps like Slack, Linear,
and Notion feel premium. Here is exactly what was missing and why it matters:

### What Was Missing

**No information hierarchy in the sidebar.**
Slack's sidebar has sections, channels grouped by category, unread bolding, muted items,
and a clear visual difference between active and inactive items. The old design was a flat list.

**Chat had no threads.**
Every real team chat (Slack, Discord, Teams) supports threaded replies. Without threads,
a busy chat becomes impossible to follow. Threads keep conversations organized without
polluting the main channel.

**No "My Work" view.**
Linear's "My Issues" and Notion's "Home" exist because people need a personal dashboard —
tasks assigned to me, tasks I created, tasks due this week — across all boards. Without this,
finding your own work requires opening every board manually.

**No reactions on messages.**
Emoji reactions (👍 ✅ 🔥) are a zero-interruption response mechanism. They're in every
modern team tool. They reduce noise while still acknowledging messages.

**No rich text in descriptions or messages.**
Markdown rendering, inline code blocks, bold/italic, bullet lists — all expected in 2025.
A plain textarea feels like 2010.

**No file attachments.**
Tasks need files. Messages need files. Without attachments, the team emails each other
the files and the context lives outside the tool.

**No keyboard navigation.**
Power users in Slack, Linear, Notion never touch the mouse. `Ctrl+K` command palette,
`J/K` to navigate, `C` to create task, `E` to edit — these are expected.

**No status indicators beyond online/offline.**
Slack has custom statuses ("In a meeting 🗓", "On vacation 🌴"). Users need to communicate
availability without being interrupted.

**Boards had no multiple views.**
Linear has list view, board view, and timeline. Good PM tools let you look at the same
tasks in the format that suits the moment.

**No task dependencies.**
Real projects have tasks that block other tasks. Without dependencies, the tool has
no way to model the actual work graph.

**No sub-tasks.**
Every task management tool since 2015 supports sub-tasks. A task like "Build auth" has
10 smaller steps. Without sub-tasks, the board gets overloaded or the work gets lost.

**No workspace-level analytics.**
Managers need to see burn-down, cycle time, and velocity. Without analytics, CollabBoard
is just a visual sticky-note board.

---

## 2. Design Philosophy

### 2.1 Three Principles

**Density without clutter.**
Slack shows a lot on screen but nothing feels crowded because spacing, typography weight,
and color are used precisely. Every pixel has a job.
→ Use tight spacing inside components (8px) but generous spacing between sections (32px).
→ Use font weight (400 vs 500 vs 600) to create hierarchy before reaching for color.

**Immediate feedback.**
Every action should produce a visible reaction in under 100ms.
→ Optimistic updates on all writes.
→ Skeleton loaders that match content shape.
→ Micro-animations on state changes.
→ No blank screens — always show loading state.

**Progressive disclosure.**
Show the minimum needed. Reveal more on demand.
→ Task card shows only title, assignee, priority, due date.
→ Full detail opens in a modal/panel — don't navigate away.
→ Settings tabs hide advanced options until the user opens them.
→ Keyboard shortcuts visible on hover, not always visible.

### 2.2 Visual Language

Inspired by Linear's dark theme and Slack's layout density.

- **Dark background** (#0F1117) — reduces eye strain for long sessions
- **Surface layers** — 3 levels of surface create depth without shadows everywhere
- **Accent is rare** — `--accent` (#6C63FF) is used only for interactive elements and active states, never for decoration
- **Typography does the heavy lifting** — weight and opacity create hierarchy, not size
- **Borders are faint** — barely visible, just enough to separate, never decorative

---

## 3. Design System

### 3.1 Full Color Palette

```css
:root {
	/* ── Backgrounds ─────────────────────────────────────────── */
	--bg-app: #0d0f17; /* outermost — behind everything */
	--bg-sidebar: #111320; /* sidebar specifically */
	--bg-base: #0f1117; /* main content area background */
	--bg-surface-1: #161925; /* cards, panels, modals */
	--bg-surface-2: #1d2130; /* inputs, dropdown items */
	--bg-surface-3: #242838; /* hover states, selected rows */
	--bg-surface-4: #2b2f45; /* active/pressed states */

	/* ── Borders ──────────────────────────────────────────────── */
	--border-subtle: #1e2235; /* barely visible, structural dividers */
	--border-default: #2a2d45; /* cards, panels */
	--border-strong: #3d4166; /* emphasis borders */
	--border-focus: #6c63ff; /* focus rings on inputs */

	/* ── Text ─────────────────────────────────────────────────── */
	--text-primary: #e8eaff; /* main content */
	--text-secondary: #8892b0; /* labels, meta, secondary info */
	--text-muted: #4a5178; /* disabled, timestamps, placeholders */
	--text-inverse: #0f1117; /* text on light backgrounds */

	/* ── Accent (Interactive) ─────────────────────────────────── */
	--accent: #7c72ff; /* primary CTA, active nav, links */
	--accent-light: #9b93ff; /* hover state of accent text */
	--accent-muted: #2a2660; /* accent background (badges, highlights) */
	--accent-border: #3d38a0; /* accent-colored borders */

	/* ── Semantic ─────────────────────────────────────────────── */
	--green: #3dd68c; /* success, done, online */
	--green-muted: #0f2a1e;
	--green-border: #1a4a30;

	--yellow: #f0c040; /* warning, review, medium priority */
	--yellow-muted: #2a2000;
	--yellow-border: #4a3800;

	--red: #ff6b6b; /* error, overdue, urgent */
	--red-muted: #2a1010;
	--red-border: #4a2020;

	--orange: #ff8c42; /* high priority */
	--orange-muted: #2a1800;

	--blue: #60a5fa; /* in progress, info */
	--blue-muted: #0f1e35;
	--blue-border: #1a3255;

	--purple: #a78bfa; /* review, mentions */
	--purple-muted: #1e1535;

	/* ── Priority ─────────────────────────────────────────────── */
	--p-urgent: #ff6b6b;
	--p-high: #ff8c42;
	--p-medium: #f0c040;
	--p-low: #3dd68c;
	--p-none: #4a5178;

	/* ── Column ───────────────────────────────────────────────── */
	--col-todo: #4a5178;
	--col-inprogress: #60a5fa;
	--col-review: #a78bfa;
	--col-done: #3dd68c;
	--col-blocked: #ff6b6b;
}
```

### 3.2 Typography

Font stack: `'Inter', 'SF Pro Text', system-ui, -apple-system, sans-serif`
Load Inter from Google Fonts with weights 400, 500, 600, 700.

| Role                   | Size | Weight | Line height | Color                       |
| ---------------------- | ---- | ------ | ----------- | --------------------------- |
| Display (landing hero) | 48px | 700    | 1.15        | primary                     |
| Page title             | 22px | 600    | 1.3         | primary                     |
| Section heading        | 13px | 600    | 1.4         | secondary (UPPERCASE)       |
| Card title             | 14px | 500    | 1.4         | primary                     |
| Body                   | 14px | 400    | 1.6         | primary                     |
| Secondary body         | 13px | 400    | 1.5         | secondary                   |
| Label / caption        | 12px | 400    | 1.4         | secondary                   |
| Badge                  | 11px | 600    | 1           | varies                      |
| Code (inline)          | 13px | 400    | 1.5         | `--text-primary`, monospace |

### 3.3 Spacing

All spacing is multiples of 4px.
Common values: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.

**Component internal padding:**

- Compact (badges, chips): 2px 8px
- Default (inputs, buttons): 8px 14px
- Comfortable (cards): 14px 16px
- Spacious (modals, panels): 24px

**Between-section gaps:** always 32px or 48px

### 3.4 Elevation (Surface Layers)

Instead of drop shadows everywhere (which looks cheap in dark UIs), use surface layers:

| Layer   | Background                                                   | Used for               |
| ------- | ------------------------------------------------------------ | ---------------------- |
| Layer 0 | `--bg-app`                                                   | Behind everything      |
| Layer 1 | `--bg-base`                                                  | Main content area      |
| Layer 2 | `--bg-surface-1`                                             | Sidebar, cards, panels |
| Layer 3 | `--bg-surface-2`                                             | Dropdowns, inputs      |
| Layer 4 | `--bg-surface-3`                                             | Hover, active          |
| Modal   | `--bg-surface-1` + `box-shadow: 0 16px 70px rgba(0,0,0,0.8)` | Modals only            |

### 3.5 Radius

```
--r-xs:   4px    /* badges inside inputs */
--r-sm:   6px    /* badges, chips, small elements */
--r-md:   8px    /* inputs, buttons, dropdowns */
--r-lg:   10px   /* cards, panels */
--r-xl:   14px   /* modals, large panels */
--r-full: 9999px /* pills, avatars, toggles */
```

### 3.6 Animation Timing

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1); /* elements entering */
--ease-in: cubic-bezier(0.4, 0, 1, 1); /* elements leaving */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* bouncy micro-interactions */

--duration-fast: 100ms; /* hover states */
--duration-default: 200ms; /* most transitions */
--duration-slow: 350ms; /* page transitions, modals */
```

### 3.7 Reusable Component Specs

**Primary Button:**

```
height: 34px
padding: 0 14px
border-radius: --r-md
background: --accent
font: 14px 500 white
hover: background --accent-light, transform translateY(-1px)
active: transform translateY(0), background darken(--accent, 10%)
focus: outline 2px --accent, outline-offset 2px
disabled: opacity 0.38, cursor not-allowed, no hover effects
loading: spinner (14px) replaces label, keeps button width
```

**Secondary Button (ghost):**

```
Same dimensions
background: transparent
border: 1px solid --border-default
color: --text-primary
hover: background --bg-surface-3
```

**Destructive Button:**

```
Same dimensions
background: --red-muted
border: 1px solid --red-border
color: --red
hover: background darken(--red-muted, 5%), border --red
```

**Input Field:**

```
height: 34px
padding: 0 12px
border: 1px solid --border-default
border-radius: --r-md
background: --bg-surface-2
color: --text-primary
font: 14px 400

focus: border-color --border-focus, box-shadow 0 0 0 3px rgba(124,114,255,0.18)
error: border-color --red, box-shadow 0 0 0 3px rgba(255,107,107,0.15)
disabled: opacity 0.5, cursor not-allowed
placeholder: color --text-muted
```

**Avatar:**

```
sizes: 20, 24, 28, 32, 40, 48, 64px
shape: 50% (circle)
fallback: initials (1-2 chars) on colored bg (color = hash of user ID)
online ring: 3px solid --green, 2px offset (box-shadow: 0 0 0 2px --bg-sidebar, 0 0 0 4px --green)
tooltip on hover: full name + status
```

**Keyboard Shortcut Chip:**

```
bg: --bg-surface-3
border: 1px solid --border-default
border-radius: --r-xs
padding: 1px 5px
font: 11px 500 monospace --text-muted
```

Shown in tooltips and the command palette.

---

## 4. Global App Shell

The entire app after login is one shell that never re-mounts.
Only the center content area replaces itself on navigation.
This gives instant navigation (no full-page loads) like Slack.

### 4.1 Shell Dimensions

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (260px, fixed left, full height)                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  WORKSPACE SWITCHER (48px tall strip at very top of sidebar)     │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  SIDEBAR BODY (scrollable, fills remaining height)               │   │
│  │  Contains: nav sections, board list, direct messages             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  MAIN AREA (fills rest, flex column)                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  TOP BAR (48px, fixed, full width of main area)                  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  CENTER CONTENT (fills rest, overflow-y auto)                    │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Workspace Switcher (top of sidebar)

This is the strip at the very top that shows the current workspace name and lets you switch.
Inspired by Slack's workspace name / team name header.

```
┌───────────────────────────────────────┐
│  🟣  Team Alpha                   ∨  │  ← 48px tall, click opens switcher menu
└───────────────────────────────────────┘
```

Clicking opens a dropdown below it:

```
┌───────────────────────────────────────┐
│  🟣  Team Alpha              ✓       │  ← current workspace (checkmark)
│  🟦  Design Studio                   │
│  🟩  Personal                        │
│  ─────────────────────────────────── │
│  + Create new workspace              │
│  + Join a workspace                  │  ← future: join via invite code
└───────────────────────────────────────┘
```

Keyboard shortcut: `Ctrl+Shift+[number]` to switch to workspace 1, 2, 3...
Show shortcut chip next to workspace name on hover.

### 4.3 Sidebar Body — Full Detail

The sidebar is organized into **collapsible sections** just like Slack's channels sidebar.
Each section has a header with a toggle arrow and an action button.

```
┌────────────────────────────────────────┐
│                                        │
│  ▾  MAIN                               │  ← section header (12px uppercase, muted)
│                                        │
│     🏠  Home                           │  → /app/workspaces/:id (dashboard)
│     🔍  Search                         │  → opens command palette
│     📥  My Work                        │  → /app/my-work (personal dashboard)
│     🔔  Notifications        3         │  → /app/notifications
│                                        │
│  ▾  BOARDS                        +   │  ← + creates new board
│                                        │
│  ┌─────────────────────────────────┐  │  ← active item
│  │  📋  Sprint 3                   │  │    bg --bg-surface-3
│  └─────────────────────────────────┘  │    left accent bar 2px --accent
│     📋  Bug Tracker             2     │  ← "2" = unread activity badge
│     📋  Design Review                 │
│     📋  Roadmap                       │
│                                        │
│  ▾  CHANNELS                      +   │  ← + creates new channel
│                                        │
│     #  general                  12    │  ← 12 unread messages (bold)
│     #  dev-updates                    │
│     #  design                         │
│                                        │
│  ▾  DIRECT MESSAGES               +   │
│                                        │
│     👤  Priya Sharma        🟢         │  ← green dot = online
│     👤  Rahul Verma         ⚫         │  ← grey dot = offline
│                                        │
│  ─────────────────────────────────    │
│                                        │
│  👤  Arjun Kumar                  ⚙   │  ← bottom: avatar + name + settings gear
│  🟢  Available                        │  ← user's own status (clickable)
│                                        │
└────────────────────────────────────────┘
```

**Section behavior:**

- Clicking the `▾` arrow collapses/expands the section (persisted in localStorage)
- Collapsed section with unread items shows the section header in bold with total count
- Right-clicking a board/channel in the sidebar shows a context menu:
    ```
    ┌──────────────────────┐
    │ Open in new tab      │
    │ Copy link            │
    │ Mark as read         │
    │ ────────────────     │
    │ Rename               │
    │ Delete               │
    └──────────────────────┘
    ```

**Unread indicators:**

- Board with new activity: bold name + right-aligned count badge (--accent bg)
- Channel with unread messages: bold name + count
- Direct message with unread: bold name + count + green/orange dot

**User status at bottom:**

```
┌────────────────────────────────────────┐
│  👤 [32px avatar]                      │
│  Arjun Kumar                    ⚙     │  ← ⚙ opens profile/settings
│  🟢 Available                    ∨    │  ← ∨ opens status picker
└────────────────────────────────────────┘
```

Status picker dropdown:

```
┌────────────────────────────────────────┐
│  Set a status                          │
│  ┌────────────────────────────────┐   │
│  │  🔍  What's your status?       │   │  ← searchable
│  └────────────────────────────────┘   │
│                                        │
│  SUGGESTIONS                          │
│  🟢  Available                        │
│  🔴  Busy                             │
│  🗓  In a meeting                     │
│  🎧  Focusing — do not disturb        │
│  🌴  On vacation                      │
│  🏠  Working from home                │
│  ─────────────────────────────────    │
│  ✏  Write a custom status...         │
└────────────────────────────────────────┘
```

Custom status: emoji picker + text input + expiry ("Clear after: 30min / 1hr / Today / This week").
Status appears under user's name in all avatars across the app (tooltip shows it on hover).

### 4.4 Top Bar — Full Detail

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [← →]  Team Alpha / Sprint 3        [🔍 Search  Ctrl+K]   [🔔] [👤 ▾]  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Element            | Position    | Detail                                                                                                                    |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Back/Forward `← →` | Far left    | Browser-style history navigation within the app. Click `←` to go to the previous view. Show disabled state if no history. |
| Breadcrumb         | Left center | `Workspace / Page`. Workspace name is a link. Page name is the current item. On narrow screens, only show current page.   |
| Search             | Center      | Placeholder `Search  Ctrl+K`. Clicking opens command palette. Not a real input — just a styled button.                    |
| Bell `🔔`          | Right group | Badge with unread count. Clicking opens notification popover (not navigate).                                              |
| User avatar + `▾`  | Far right   | Clicking opens user menu: Profile, Preferences, Keyboard shortcuts, What's new, Help, Sign out.                           |

**User menu dropdown:**

```
┌──────────────────────────────────────┐
│  👤 [48px avatar]                    │
│  Arjun Kumar                         │
│  arjun@gmail.com                     │
│  🟢 Available        Change status ▸ │
├──────────────────────────────────────┤
│  Profile & account                   │
│  Preferences                         │
│  Keyboard shortcuts    Ctrl+/        │
├──────────────────────────────────────┤
│  What's new                          │
│  Help & support                      │
├──────────────────────────────────────┤
│  Sign out of Team Alpha              │  ← signs out of current workspace only
│  Sign out everywhere                 │  ← full logout
└──────────────────────────────────────┘
```

---

## 5. Onboarding Flow

New users need to be guided into the product. Without onboarding, they land on an empty
screen and don't know what to do. This is one of the top reasons users churn immediately.

### 5.1 First Login (New Account)

After email verification, instead of dumping the user on an empty workspace list:

**Step 1 — Welcome + workspace creation:**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Welcome to CollabBoard, Arjun 👋                              │
│   Let's set up your first workspace                              │
│                                                                  │
│   What's your team called?                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  My Team                                                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   What kind of work does your team do?                           │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │  💻     │  │  🎨     │  │  📊     │  │  📦     │          │
│   │ Software│  │ Design  │  │Marketing│  │ Product │          │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                  │
│                              [ Continue → ]                      │
└──────────────────────────────────────────────────────────────────┘
```

**Step 2 — Invite teammates:**

```
│   Who else is on your team?                                      │
│   (You can skip this and invite later)                           │
│                                                                  │
│   ┌────────────────────────────────────┐                        │
│   │  teammate@email.com                │                        │
│   └────────────────────────────────────┘                        │
│   + Add another                                                  │
│                                                                  │
│   [ Skip ]                  [ Send invites → ]                   │
```

**Step 3 — Create first board (with template):**

```
│   Choose a template to get started                               │
│                                                                  │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│   │  🚀              │  │  🐛              │  │  📋          │ │
│   │  Sprint Board    │  │  Bug Tracker     │  │  Blank Board │ │
│   │  Todo/In Progress│  │  Open/Triaged/   │  │  Start empty │ │
│   │  /Review/Done    │  │  Fixed/Closed    │  │              │ │
│   └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                  │
│                              [ Create board → ]                  │
```

Templates pre-populate the board with example tasks so the user sees a real board
immediately instead of an empty one.

### 5.2 Onboarding Checklist (Persistent)

After the initial setup, show a dismissable checklist in the sidebar under the nav items.
Inspired by Linear's "Getting started" section and Notion's onboarding checklist.

```
▾  GETTING STARTED         2/5
   ✅ Create your workspace
   ✅ Create your first board
   ○  Invite a teammate
   ○  Create your first task
   ○  Try the whiteboard
                [Dismiss]
```

Each item is a link that navigates to the relevant action. Progress bar fills as items complete.
Disappears permanently once all items are checked or user clicks Dismiss.

---

## 6. Landing Page

The landing page is the first impression. It needs to communicate value in under 5 seconds.

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NAVBAR (sticky, glassmorphism blur)                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ⬡ CollabBoard          Features  Pricing  Docs    [Log in]  [→ Try]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HERO (100vh, centered, dark bg with subtle radial gradient purple glow) │
│                                                                          │
│         BETA  🟣 Now in public beta                                      │  ← pill badge
│                                                                          │
│                 Where your team actually                                 │
│                 gets work done.                                          │  ← 56px 700
│                                                                          │
│      Real-time boards, shared whiteboard, and threaded chat.            │  ← 20px 400 secondary
│      Everything your team needs. Nothing it doesn't.                    │
│                                                                          │
│            [ Start for free → ]        [ See it in action ▶ ]          │
│                                                                          │
│      Trusted by teams at                                                │  ← 13px muted
│      [IIT]  [BITS]  [NIT]  [IIIT]  [placeholder logos]                 │
│                                                                          │
│      ┌──────────────────────────────────────────────────────────┐      │
│      │  [App screenshot — full board with tasks, dark theme]     │      │
│      │  Floating: real-time cursor dots moving                   │      │
│      │  Shadow: 0 32px 120px rgba(124,114,255,0.25)              │      │
│      └──────────────────────────────────────────────────────────┘      │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FEATURE SECTIONS (alternating left/right, full-width)                  │
│                                                                          │
│  ── Section 1: Real-time Kanban ─────────────────────────────────────── │
│  [screenshot left]    ⚡ Kanban that thinks fast                         │
│                       Move tasks, see changes. No refresh.              │
│                       Everything syncs in under 50ms.                   │
│                                                                          │
│  ── Section 2: Whiteboard ────────────────────────────────────────────  │
│                       🎨 Draw together, in real time                    │
│  [screenshot right]   See your teammates' cursors move.                 │
│                       Sketch ideas, wireframes, diagrams.               │
│                                                                          │
│  ── Section 3: Threaded Chat ─────────────────────────────────────────  │
│  [screenshot left]    💬 Chat that doesn't get in the way               │
│                       Threads keep conversations organized.             │
│                       React with emoji. Mention teammates.              │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CTA STRIP                                                               │
│  Ready to work better together?                                          │
│  [ Create free workspace → ]                                             │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                                  │
│  ⬡ CollabBoard    Product  Docs  GitHub  Privacy  Terms                 │
│  © 2025 · Built with ♥ for teams                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Navbar glassmorphism CSS:**

```css
.navbar {
	background: rgba(13, 15, 23, 0.75);
	backdrop-filter: blur(16px);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
```

---

## 7. Auth Pages

### 7.1 Login

Same centered card layout but more polished:

```
Full page background: --bg-app with subtle animated gradient mesh
(three blurred radial gradients in accent/purple/blue slowly moving)

Card:
  width: 420px
  background: --bg-surface-1
  border: 1px solid --border-default
  border-radius: --r-xl
  padding: 32px
  box-shadow: 0 8px 48px rgba(0,0,0,0.6)
```

Card contents:

```
┌───────────────────────────────────────────────────────┐
│  ⬡ CollabBoard                                        │  ← centered logo 24px
│                                                       │
│  Sign in to your account                             │  ← 22px 600
│  Welcome back                                         │  ← 14px secondary
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  ⚠  Incorrect email or password              │    │  ← error banner (hidden default)
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Email address                                        │  ← 13px 500 label
│  ┌──────────────────────────────────────────────┐    │
│  │  arjun@gmail.com                             │    │
│  └──────────────────────────────────────────────┘    │
│  ↑ red border + "Enter a valid email" on blur error  │
│                                                       │
│  Password                      Forgot password?       │
│  ┌──────────────────────────────────────────────┐    │
│  │  ••••••••••••                       [👁]     │    │  ← show/hide toggle
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  Sign in                                      │    │  ← primary button, full width
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ─────────────────── or ──────────────────────────   │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  G  Continue with Google                     │    │  ← ghost button, full width
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Don't have an account?  Create one  →               │  ← 14px, link --accent
└───────────────────────────────────────────────────────┘
```

### 7.2 Register

Same card, different content:

- Name, Email, Password fields
- Password strength bar (4-level: Weak / Fair / Good / Strong with color fill)
- Terms checkbox: "I agree to the Terms of Service and Privacy Policy" (required)
- After submit → animated success card: "✉ Check your inbox" with Resend button

---

## 8. Workspace Home (Dashboard)

Route: `/app/workspaces/:id`

This is the landing page when you open a workspace. Think of it as the workspace's
"home channel" — a high-level overview.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Good morning, Arjun ☀️                         Monday, May 18          │
│  Here's what's happening in Team Alpha                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  MY TASKS DUE THIS WEEK ─────────────────────────────────────────────  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🔴  Fix login bug                Sprint 3         Due today       │  │
│  │  🟡  Design nav component         Sprint 3         Due tomorrow    │  │
│  │  🟠  Write API documentation      Sprint 3         Due Thu         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  [ View all my tasks → ]                                                 │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BOARDS ─────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  Sprint 3        │  │  Bug Tracker     │  │  Design Review   │     │
│  │  ─────────────   │  │  ─────────────   │  │  ─────────────   │     │
│  │  ████░░░░ 40%    │  │  ██░░░░░░ 20%    │  │  ██████░░ 70%    │     │
│  │  4 Todo          │  │  3 Todo          │  │  1 Todo          │     │
│  │  2 In Progress   │  │  2 In Progress   │  │  1 In Progress   │     │
│  │  Updated 2m ago  │  │  Updated 1h ago  │  │  Updated 3d ago  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RECENT ACTIVITY ────────────────────────────────────────────────────  │
│                                                                          │
│  👤  Arjun       moved Fix login bug to Review          2m              │
│  👤  Priya       commented on Design nav                15m             │
│  👤  Rahul       created Write unit tests               1h              │
│  👤  Priya       joined as Editor                       2h              │
│                                          [View all activity]            │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TEAM STATUS ─────────────────────────────────────────────────────────  │
│                                                                          │
│  👤  Arjun Kumar      🟢 Available            On Sprint 3              │
│  👤  Priya Sharma     🔴 Busy                  "In standup until 10:30" │
│  👤  Rahul Verma      🎧 Focusing              Last seen 3h ago        │
│  👤  Neha Joshi       🌴 On vacation           Back Mon Jun 3          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Progress bar on board cards:**
The `████░░░░ 40%` bar shows percentage of tasks in Done column vs total tasks.
Color: `--green` for the fill, `--border-default` for the empty part.

**Greeting changes by time of day:**

- Before 12pm: "Good morning, Arjun ☀️"
- 12–5pm: "Good afternoon, Arjun 🌤"
- After 5pm: "Good evening, Arjun 🌙"

---

## 9. Board Page — Kanban

Route: `/app/workspaces/:id/boards/:boardId`

### 9.1 Board Toolbar

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Sprint 3                                                      ··· ⚙    │
│                                                                          │
│  [ 🗂 Board | 📋 List | 📅 Timeline ]   ─────────────────────────────  │
│                                                                          │
│  Filters: [ 👤 Assignee ▼ ] [ 🏷 Label ▼ ] [ 📅 Due date ▼ ] [ More ▼]│
│           [Group by: None ▼]   [Sort by: Manual ▼]    [Clear filters]   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Three views — what each does:**

`🗂 Board` — The classic Kanban column view. Default.

`📋 List` — All tasks in a flat list, grouped by column. Better for scanning many tasks.
Each row: `[priority dot] [task title] [assignee] [due date] [labels]`
Clicking any row opens the task detail panel (slides in from right, not a modal).

`📅 Timeline` — A Gantt-chart style view. Tasks with due dates shown as bars on a date axis.
Groups by assignee. Lets you see workload distribution visually. Read-only (drag bars to reschedule — stretch goal).

### 9.2 Kanban Columns

```
┌────────────────┬─────────────────────┬─────────────────┬────────────────────┐
│  TO DO   (4)   │  IN PROGRESS  (2)   │  REVIEW  (1)    │  DONE        (8)   │
│  ─ grey ───    │  ─ blue ─────────   │  ─ purple ────  │  ─ green ────────  │
│                │                     │                  │                    │
│  [cards]       │  [cards]            │  [cards]         │  [cards]           │
│                │                     │                  │                    │
│  + Add task    │  + Add task         │  + Add task      │  + Add task        │
└────────────────┴─────────────────────┴─────────────────┴────────────────────┘
```

Columns can be added via the `+ Add column` button at the end (scrolled to on horizontal scroll).
Column drag reordering: grab the column header to move the entire column.

### 9.3 Task Card — Production Level

This is the most important component in the app. Design it carefully.

```
┌──────────────────────────────────────────────┐
│                                              │
│  Fix login bug                               │  14px 500
│                                              │
│  🔵 Auth   🟢 Backend                        │  label pills 11px
│                                              │
│  ──────────────────────────────────────────  │  1px --border-subtle
│                                              │
│  👤 Arjun   📎 2   💬 3   Due today 🔴       │  12px secondary
│                                              │
└──────────────────────────────────────────────┘
```

**Card metadata bar (bottom row):**

- `👤 Arjun` — Assignee avatar(s). Up to 3 shown, `+N` if more.
- `📎 2` — Attachment count. Click opens task to attachments tab.
- `💬 3` — Comment count. Click opens task to comments.
- Due date — Plain text if future. Orange if ≤2 days. Red + `🔴` if overdue.

**Card hover state:**

- Background lightens to `--bg-surface-3`
- `···` options button appears top-right: `Edit / Copy link / Move to / Delete`
- Cursor changes to `grab`

**Card drag state:**

```css
.task-card.dragging {
	transform: rotate(2deg) scale(1.02);
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
	opacity: 0.9;
	cursor: grabbing;
}
```

### 9.4 Task Detail Panel — Slide-in (Production Style)

In the old design, task detail was a modal. For a production app, it should be a
**side panel** that slides in from the right, keeping the board visible on the left.
This is exactly what Linear does.

```
BOARD VIEW (reduced to ~55% width when panel open):
┌─────────────────────────────────┬──────────────────────────────────────┐
│  [board columns, slightly dim]  │  TASK DETAIL PANEL (45%, slides in) │
│                                 │                                      │
│                                 │  [✕]  [↗ Open full page]            │
│                                 │                                      │
│                                 │  Fix login bug                       │  20px 600
│                                 │  Sprint 3  ›  In Progress            │  12px secondary
│                                 │  ────────────────────────────────    │
│                                 │                                      │
│                                 │  [ 🔵 In Progress ▼ ]  [ 🟡 Med ▼ ] │
│                                 │  [ 👤 Add assignee    ]  [ 📅 Date ] │
│                                 │  [ 🏷 Add labels      ]             │
│                                 │                                      │
│                                 │  DESCRIPTION                         │
│                                 │  The JWT token isn't being sent      │
│                                 │  correctly on mobile safari. Check   │
│                                 │  the axios interceptor...            │
│                                 │  [Edit description]                  │
│                                 │                                      │
│                                 │  SUB-TASKS (2/4 done)               │  ← NEW
│                                 │  ✅ Reproduce the bug                │
│                                 │  ✅ Identify root cause              │
│                                 │  ○  Fix interceptor                  │
│                                 │  ○  Add mobile-specific test         │
│                                 │  + Add sub-task                      │
│                                 │                                      │
│                                 │  ATTACHMENTS                         │  ← NEW
│                                 │  📎 screenshot.png     1.2MB  [↓][✕]│
│                                 │  📎 error-log.txt       4KB   [↓][✕]│
│                                 │  + Attach file  (drag or click)      │
│                                 │                                      │
│                                 │  ACTIVITY & COMMENTS                 │
│                                 │  [Comments] [History] (tabs)         │
│                                 │                                      │
│                                 │  👤 Priya  · 2h                      │
│                                 │  Can you check the interceptor?      │
│                                 │  [👍 1]  [Add reaction]              │  ← reactions
│                                 │                                      │
│                                 │  ↕ Priya moved: Todo → In Progress  │  ← history event
│                                 │  ↕ Arjun assigned Arjun             │
│                                 │                                      │
│                                 │  ┌──────────────────────────────┐   │
│                                 │  │ Write a comment...     Aa @ ↵│   │
│                                 │  └──────────────────────────────┘   │
└─────────────────────────────────┴──────────────────────────────────────┘
```

`↗ Open full page` navigates to `/app/workspaces/:id/tasks/:taskId` — a dedicated full-page
task view for when you need more space (writing long descriptions, lots of sub-tasks).

### 9.5 Sub-tasks

Every task can have sub-tasks. Sub-tasks are lightweight — just a title + done/not done.
A progress bar in the task card shows `2/4` sub-tasks complete when any exist.

```
On the task card:
┌──────────────────────────────────────────────┐
│  Fix login bug                               │
│  🔵 Auth                                     │
│  [██░░] 2/4 sub-tasks                        │  ← progress bar when sub-tasks exist
│  👤 Arjun    Due today 🔴                    │
└──────────────────────────────────────────────┘
```

**API:** Sub-tasks are stored as an embedded array in the Task document:

```js
subTasks: [{ _id, title, isDone, order, createdAt }];
```

Not a separate collection — they don't need their own comments, assignees, etc.

### 9.6 Task Dependencies (Blocked by / Blocking)

This is a realistic feature that makes the tool useful for real project management.
Tasks can be marked as blocking other tasks.

In the task detail panel, under Description:

```
│  RELATIONS                                                    │
│  ─────────────────────────────────────────────────────────   │
│  🚫 Blocked by:   [ Set up database schema ]  →             │  ← task link
│  ⛔ Blocking:     [ Write API tests ]          →             │
│  + Add relation                                               │
```

"Add relation" opens a search dropdown to find and link another task.
A task that is blocked shows a `🚫 Blocked` badge in the top-right of its card.
Blocked tasks are visually dimmed in the column.

**Data model addition to Task:**

```js
dependencies: {
  blockedBy: [ObjectId],   // ref: Task
  blocking:  [ObjectId],   // ref: Task
}
```

### 9.7 Blocked Column (Optional)

Alongside the default columns, allow admins to add a `Blocked` column (red accent).
When a task is marked blocked, it turns red. Clicking the `🚫` badge on a card opens
the task and scrolls to the Relations section.

---

## 10. Whiteboard

Route: Same as board (`/app/workspaces/:id/boards/:boardId`), Whiteboard tab

### Additions beyond the original design

**Sticky notes:**
Click the sticky note tool → click anywhere on canvas → a 200×200px yellow sticky note appears.
Type text inside it. Drag to move. Resize from corner. Right-click → change color.
Sticky notes are stored as objects in the canvas JSON snapshot (not just path strokes).

**Shapes library:**
Pre-drawn shapes panel: arrows, flowchart shapes (diamond for decision, parallelogram for I/O),
database cylinder, user/person icon, server icon. Drag onto canvas.

**Zoom & pan:**

- Scroll wheel to zoom in/out
- Space + drag to pan (like Figma)
- `Ctrl+0` to fit canvas to screen
- Zoom level indicator bottom-right: `75% [-][+]`

**Undo/redo:**
`Ctrl+Z` / `Ctrl+Shift+Z`. Undo history stored locally (last 50 actions).
Undo is local — your undo doesn't undo someone else's strokes.

**Export:**
Top-right: `Export ▼` button → `Save as PNG` / `Save as SVG` / `Copy to clipboard`.
Calls `canvas.toBlob()` and triggers a download.

---

## 11. Chat — Threaded, Slack-style

Route: `/app/workspaces/:id/channels/:channelId`

The previous design had a single "general" chat. Professional teams need:

- Multiple channels (organized by topic)
- Threaded replies (keep main channel clean)
- Message reactions (lightweight acknowledgment)
- File sharing
- Message editing and deletion
- Pinned messages
- Message search

### 11.1 Channel List

The sidebar `CHANNELS` section shows all channels. Clicking opens that channel.
Every workspace starts with `# general` and `# announcements`.
`# announcements` is read-only for non-admins — only admins can post.

**Creating a channel:**

```
┌─────────────────────────────────────────┐
│  Create channel                   [✕]  │
├─────────────────────────────────────────┤
│                                         │
│  Name                                   │
│  ┌─────────────────────────────────┐   │
│  │ # channel-name                  │   │  ← auto-lowercased, hyphens only
│  └─────────────────────────────────┘   │
│                                         │
│  Description (optional)                 │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Visibility                             │
│  ● Public  (anyone in workspace)        │
│  ○ Private  (invite-only)               │
│                                         │
│  [ Cancel ]       [ Create channel ]    │
└─────────────────────────────────────────┘
```

### 11.2 Channel Layout

````
┌──────────────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                                 │
│  # general                 [🔍 Search in channel]  [📌 Pins]  [👥 4]   │
│  General team discussion                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [pinned messages bar if any]                                            │
│  📌  1 pinned message         [View]                                    │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  MESSAGES AREA                                                           │
│                                                                          │
│  ─────────────────── Monday, May 18 ─────────────────────────────────  │
│                                                                          │
│  👤  Priya Sharma                                          9:14 AM       │
│      Can someone review the login PR before standup?                    │
│      [👍 2]  [✅ 1]  [Add reaction]  [Reply in thread]  [···]           │
│             ↑ reactions shown inline    ↑ thread button   ↑ message opts│
│                                                                          │
│  │   2 replies · Last reply 9:20 AM                  View thread →    │  ← thread preview bar
│                                                                          │
│  👤  Arjun Kumar                                           9:30 AM      │
│      I'll take a look now. Also dropping the deploy notes here:         │
│                                                                          │
│      ```                                                                 │  ← code block
│      npm run build && pm2 restart app                                   │
│      ```                                                                 │
│                                                                          │
│      [Add reaction]  [Reply in thread]  [···]                           │
│                                                                          │
│  👤  Priya is typing...  ···                                            │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  MESSAGE INPUT                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  B  I  S  ~~  </>  🔗  ─────  @  #  📎  😊                        │ │  ← formatting toolbar
│  │                                                                    │ │
│  │  Message # general...                                              │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  Enter to send  ·  Shift+Enter for new line  ·  Markdown supported      │
└──────────────────────────────────────────────────────────────────────────┘
````

### 11.3 Thread Panel

Clicking "Reply in thread" or "View thread →" opens a panel on the right side
(same slide-in pattern as task detail):

```
CHANNEL (reduced width)        THREAD PANEL (40%)
┌─────────────────────────┐  ┌───────────────────────────────────────────┐
│                         │  │  Thread                              [✕]  │
│  [main messages]        │  │                                           │
│                         │  │  ORIGINAL MESSAGE                         │
│                         │  │  👤 Priya · 9:14 AM                       │
│                         │  │  Can someone review the login PR?         │
│                         │  │  [👍 2][✅ 1]                              │
│                         │  │  ─────────────────────────────────────    │
│                         │  │                                           │
│                         │  │  2 REPLIES                                │
│                         │  │                                           │
│                         │  │  👤 Arjun · 9:16 AM                       │
│                         │  │  Sure, I'll review after standup          │
│                         │  │  [👍 1]  [React]  [···]                   │
│                         │  │                                           │
│                         │  │  👤 Rahul · 9:20 AM                       │
│                         │  │  +1, will check too                       │
│                         │  │                                           │
│                         │  │  ─────────────────────────────────────    │
│                         │  │                                           │
│                         │  │  ┌─────────────────────────────────────┐ │
│                         │  │  │  Reply in thread...            ↵    │ │
│                         │  │  └─────────────────────────────────────┘ │
└─────────────────────────┘  └───────────────────────────────────────────┘
```

### 11.4 Message Reactions

Hovering a message shows a reaction bar:

```
[😊 +]  →  opens emoji picker
```

Emoji picker (top 8 most used + search):

```
┌────────────────────────────────────────┐
│  👍  ✅  🔥  👀  🎉  💯  ❤️  🤔       │  ← frequent
│  ┌────────────────────────────────┐   │
│  │ 🔍 Search emoji               │   │
│  └────────────────────────────────┘   │
│  [Full emoji grid below]              │
└────────────────────────────────────────┘
```

Selected reaction appears inline on the message:

```
[👍 2]  [✅ 1]  [🔥 1]  [+]
```

Hovering a reaction shows tooltip: "Arjun, Priya reacted with 👍"

### 11.5 Message Formatting

The input bar supports markdown-like formatting:

- `**bold**` → **bold**
- `*italic*` → _italic_
- `` `code` `` → inline code
- ` ```language ``` ` → syntax-highlighted code block
- `- item` → bullet list
- `@Name` → mention (notification to user)
- `#channel-name` → channel link

Use `marked.js` or `react-markdown` to render. Sanitize with `DOMPurify` to prevent XSS.

### 11.6 Message Options (··· menu)

On hover, a `···` button appears top-right of each message:

```
┌──────────────────────────────┐
│  Reply in thread             │
│  Edit message                │  ← only visible on your own messages
│  Delete message              │  ← only visible on your own messages
│  ──────────────────────────  │
│  📌 Pin to channel           │  ← admin/editor+
│  🔗 Copy link to message     │
│  ─────────────────────────── │
│  🚩 Report message           │
└──────────────────────────────┘
```

Edited messages show `(edited)` in small text beside the timestamp.
Deleted messages show `"This message was deleted"` in muted italic (not fully removed).

### 11.7 File Sharing in Chat

Drag a file onto the chat area → it uploads and appears as a message:

```
👤 Arjun  · 9:45 AM
   ┌───────────────────────────────────────┐
   │  📎 design-mockup-v3.png    2.4 MB   │
   │  [Preview thumbnail if image]         │
   │  [ Download ]   [ View in browser ]   │
   └───────────────────────────────────────┘
```

Images show a preview thumbnail inline. PDFs show a PDF icon with filename and size.
Other files show a generic icon.

---

## 12. Notifications

Route: `/app/notifications`

### 12.1 Notification Types

| Type                 | Icon | Trigger                           | Action                      |
| -------------------- | ---- | --------------------------------- | --------------------------- |
| Task assigned        | 📋   | You were added as assignee        | Open task panel             |
| Task due soon        | ⏰   | Task due in ≤24h                  | Open task panel             |
| Task overdue         | 🔴   | Task past due date                | Open task panel             |
| Comment on your task | 💬   | New comment on task you own       | Open task → comments        |
| Mentioned in comment | @️    | `@yourname` in a comment          | Open task → that comment    |
| Mentioned in chat    | @️    | `@yourname` in a message          | Open channel → that message |
| Workspace invite     | 👥   | Added to workspace                | Go to workspace             |
| Task status change   | ↕    | Task you own moved to new column  | Open task panel             |
| Sub-task completed   | ✅   | Sub-task in your task checked off | Open task panel             |

### 12.2 Full Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Notifications                   [ ✓ Mark all read ]  [ Settings ⚙ ]   │
│                                                                          │
│  [ All (12) ]  [ Unread (4) ]  [ Mentions (2) ]  [ Tasks (8) ]         │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TODAY ─────────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │▌ @  👤 Priya mentioned you in "Fix login bug"        2 min ago  │   │
│  │▌    "…check the @Arjun interceptor logic before…"              │   │ ← quote preview
│  │▌    Sprint 3  ·  Team Alpha                  [ View comment ]  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │▌ 📋 You were assigned "Design nav"          15 min ago          │   │
│  │▌    by Priya Sharma  ·  Sprint 3                                │   │
│  │▌    Priority: 🔴 Urgent  ·  Due: Today      [ Open task → ]    │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │▌ ⏰ "Write unit tests" is due today          1 hour ago         │   │
│  │▌    Sprint 3  ·  Team Alpha                  [ Open task → ]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  YESTERDAY ─────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👥 Priya added you to Team Alpha as Editor   Yesterday 3:21 PM │   │ ← read (no border)
│  │     Invited by Priya Sharma                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 12.3 Notification Preferences

`[ Settings ⚙ ]` in the notifications page header opens a preferences panel:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Notification Preferences                                          [✕]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  NOTIFY ME ABOUT                                                         │
│                                                                          │
│  Task assigned to me               [✅ In-app]  [✅ Email]              │
│  Task due today                    [✅ In-app]  [✅ Email]              │
│  Task overdue                      [✅ In-app]  [✅ Email]              │
│  Comment on my tasks               [✅ In-app]  [☐  Email]              │
│  @mentions in comments             [✅ In-app]  [✅ Email]              │
│  @mentions in chat                 [✅ In-app]  [☐  Email]              │
│  Workspace invitations             [✅ In-app]  [✅ Email]              │
│                                                                          │
│  EMAIL DIGEST                                                            │
│  Instead of individual emails, send a daily summary                     │
│  Send digest: [ Daily at 9am ▼ ]  [ Off ▼ ]                            │
│                                                                          │
│  DO NOT DISTURB                                                          │
│  Pause all notifications           [  toggle  ]                         │
│  Schedule: Off between [10:00 PM ▼] and [8:00 AM ▼]                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 13. My Work — Personal Dashboard

Route: `/app/my-work`

This is the killer feature that most Kanban tools skip. Every user needs a
cross-board view of their own tasks. Linear calls this "My Issues". Jira calls it
"My Work". Without it, you have to open every board to find your own tasks.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  My Work                                                                 │
│  Everything assigned to you, across all boards                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [ All tasks (14) ]  [ Due this week (4) ]  [ Overdue (2) ]  [ Done (5)]│
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  OVERDUE ──────────────────────────────────────────────────────────── │
│                                                                          │
│  🔴  Fix login bug         Sprint 3   In Progress    Due 2 days ago    │
│  🟡  Update README         Sprint 3   To Do          Due yesterday     │
│                                                                          │
│  DUE TODAY ────────────────────────────────────────────────────────── │
│                                                                          │
│  🔴  Write unit tests      Sprint 3   In Progress    Due today 5pm     │
│  🟡  Design nav component  Sprint 3   Review         Due today 5pm     │
│                                                                          │
│  DUE THIS WEEK ────────────────────────────────────────────────────── │
│                                                                          │
│  🟠  API documentation     Sprint 3   To Do          Due Thu           │
│  🟢  Setup staging env     Bug Tracker To Do         Due Fri           │
│                                                                          │
│  NO DUE DATE ──────────────────────────────────────────────────────── │
│                                                                          │
│  🟢  Refactor auth service Sprint 3   To Do          —                 │
│  🟢  Add error boundaries  Sprint 3   To Do          —                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Each row is clickable — opens the task detail panel (slides in from right).
Row quick-actions on hover: `[ Mark done ✓ ]  [ Change due date 📅 ]`

**API for this page:**

```
GET /api/v1/users/me/tasks?workspaceId=xxx
```

Finds all tasks where `assignees` contains `req.user._id`, across all boards in the workspace.
Grouped and sorted by due date on the frontend.

---

## 14. Search — Command Palette

Triggered by `Ctrl+K` or `⌘+K` anywhere in the app. Also by clicking the search bar in the top bar.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  (full-screen overlay, dark backdrop, palette centered at ~25% from top) │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  🔍  Search or run a command...                         [Esc]    │  │  ← auto-focus
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  RECENT                                                          │  │  ← before typing
│  │  📋  Fix login bug              Sprint 3  ·  In Progress        │  │
│  │  📋  Design nav component       Sprint 3  ·  Review             │  │
│  │  🗂   Sprint 3                  Team Alpha                       │  │
│  │                                                                  │  │
│  │  QUICK ACTIONS                                                   │  │
│  │  ➕  Create new task            C                                │  │  ← shortcut shown
│  │  ➕  Create new board           B                                │  │
│  │  👤  Invite member              I                                │  │
│  │  📋  Switch board               [list]                           │  │
│  │  ⚙   Open settings             ,                                │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

While typing, results update in real time:

```
│  🔍  login                                                           │
│                                                                      │
│  TASKS (3)                                                           │
│  📋  Fix login bug              In Progress  ·  Sprint 3            │  ← best match first
│  📋  Login page design          To Do  ·  Design Review             │
│  📋  Add login rate limiting    To Do  ·  Sprint 3                  │
│                                                                      │
│  BOARDS (0)                                                          │
│  No boards match "login"                                             │
│                                                                      │
│  MEMBERS (1)                                                         │
│  👤  Rahul Verma   rahul@login.iit.ac.in                            │
```

**Keyboard navigation:**

- `↑ / ↓` — navigate results
- `Enter` — open selected result
- `Esc` — close palette
- `Tab` — switch between result sections

**Result actions:**
Hovering a result shows context actions on the right:

```
│  📋  Fix login bug     ··· [Open panel] [Copy link] [Assign to me]  │
```

---

## 15. Workspace Settings

Route: `/app/workspaces/:id/settings`

Four tabs: **General, Members, Channels, Danger Zone**

### 15.1 General Tab

Same as before but with these additions:

**Workspace URL slug:**

```
Workspace URL
https://app.collabboard.io/ [team-alpha    ]
                             ↑ editable slug, must be unique
```

**Workspace icon upload:**

```
Icon
┌────────┐
│  🟣    │  ← current (emoji or uploaded image)
└────────┘
[ Upload image ]  [ Use emoji ]  [ Remove ]
```

### 15.2 Members Tab

Same as before but with these additions:

**Members table columns:** Avatar · Name · Email · Role · Status · Last active · Actions

**Bulk actions:**
When multiple members are selected via checkboxes:

```
2 members selected    [ Change role ▼ ]  [ Remove from workspace ]
```

### 15.3 Channels Tab (New)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CHANNELS (4) ───────────────────────────────────────────────   + New  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  #  general          Public  ·  4 members   ·  Workspace chat  │    │
│  │  #  announcements    Public  ·  4 members   ·  Admin only      │    │
│  │  #  dev-updates      Public  ·  3 members   ·  Created by Arjun│    │
│  │  #  design           Private ·  2 members   ·  🔒             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│  (Clicking a row → channel settings: rename, archive, manage members)  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Archiving a channel:**
Archived channels are hidden from the sidebar but not deleted.
Messages are preserved and searchable. An `ARCHIVED` badge shows on the channel.

### 15.4 Danger Zone Tab

Same as before. Additional item:

**Transfer ownership:**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Transfer ownership                                                       │
│  Pass workspace ownership to another admin.                              │
│  You will be downgraded to Admin.                                        │
│                                               [ Transfer ownership ]    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Profile & Preferences

Route: `/app/profile`
Also accessible from the user menu in the top bar.

Two tabs: **Profile, Preferences**

### 16.1 Profile Tab

Same as before. Additions:

**Bio field:**

```
Bio  (optional, shown in hover cards)
┌──────────────────────────────────────────────────────────────┐
│  Full-stack dev at IIT KGP. Working on CollabBoard.          │
└──────────────────────────────────────────────────────────────┘
```

**Linked accounts:**

```
LINKED ACCOUNTS
Google    arjun@gmail.com    [Unlink]
GitHub    @arjunkumar        [Unlink]      ← stretch goal
```

### 16.2 Preferences Tab (New)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  APPEARANCE ──────────────────────────────────────────────────────────  │
│                                                                          │
│  Theme                                                                   │
│  ● Dark (default)                                                        │
│  ○ Light                                                                 │
│  ○ System (matches OS setting)                                           │
│                                                                          │
│  Sidebar density                                                         │
│  ● Comfortable (default)                                                 │
│  ○ Compact (smaller items, fit more)                                     │
│                                                                          │
│  ACCESSIBILITY ────────────────────────────────────────────────────── │
│                                                                          │
│  Reduce motion (disable animations)          [  toggle  ]               │
│  Dyslexia-friendly font (OpenDyslexic)       [  toggle  ]               │
│  High contrast mode                          [  toggle  ]               │
│                                                                          │
│  LANGUAGE & REGION ──────────────────────────────────────────────────  │
│                                                                          │
│  Language          [ English ▼ ]                                        │
│  Date format       [ DD/MM/YYYY ▼ ]                                     │
│  Time format       [ 24-hour ▼ ]                                        │
│  Start of week     [ Monday ▼ ]                                         │
│                                                                          │
│  KEYBOARD SHORTCUTS ─────────────────────────────────────────────────  │
│                                                                          │
│  [ View all keyboard shortcuts ]  ← opens a shortcuts overlay           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Realistic Features Added

This section lists every feature added beyond the original PRD and explains
exactly why it belongs in a production-grade app.

### 17.1 Sub-tasks

**Why:** Tasks like "Build auth" have many steps. Without sub-tasks, you either
create 10 cluttering cards or lose the detail. Every task management tool
(Jira, Linear, Asana, ClickUp) has sub-tasks.

**Where:** In the task detail panel, below Description.

**How it works:**

- Sub-tasks are an embedded array in the Task MongoDB document
- No separate collection needed — they're lightweight
- Check off a sub-task → `PATCH /tasks/:id` updates the `subTasks` array
- Progress shows on the card: `[██░░] 2/4`
- A task is not automatically moved to Done when all sub-tasks complete —
  the team decides when to close the parent task

### 17.2 Task Dependencies

**Why:** In real projects, Task B can't start until Task A is done.
Without dependencies, the board has no way to model "this is blocked."
Engineers know this from JIRA's "blocks/is blocked by" links.

**Where:** In the task detail panel, "Relations" section.

**How it works:**

- `dependencies.blockedBy` and `dependencies.blocking` arrays in Task schema
- Blocked tasks show a `🚫 Blocked` badge on their card
- Blocked tasks are slightly dimmed in the column
- "Add relation" searches tasks within the same workspace

### 17.3 Multiple Board Views (Board / List / Timeline)

**Why:** Kanban is great for daily flow but terrible for planning and reporting.
Linear has board + list + timeline. This is a standard feature now.

**Board view** — default Kanban columns (already built)
**List view** — flat table of tasks, easier to read many tasks at once
**Timeline view** — Gantt-style date bars, shows workload visually

### 17.4 Threaded Chat

**Why:** A single-stream chat becomes unreadable fast. Threads are the
single most important Slack feature. Without threads, important questions
get lost in general conversation.

**How it works:**

- Messages have an optional `threadId` field
- Threads are fetched via `GET /messages?threadId=xxx`
- Thread replies don't appear in the main channel stream
- A thread preview row shows under the parent message: "2 replies"

### 17.5 Message Reactions

**Why:** Reactions reduce noise. Instead of sending "👍 noted" as a message,
you react. Every team communication tool has this since 2016.

**How it works:**

- Message document has `reactions: [{ emoji, users: [userId] }]`
- `POST /messages/:id/react` toggles a reaction (adds if not present, removes if present)
- Socket emits `message:reaction_updated` to channel room
- Frontend updates the reaction counts optimistically

### 17.6 Rich Text in Messages and Descriptions

**Why:** Plain text is unreadable for technical communication. Code blocks,
bullet lists, bold/italic — these are expected.

**How it works:**

- Input bar renders markdown preview in real time
- `marked.js` renders the stored markdown to HTML for display
- `DOMPurify` sanitizes all HTML before rendering (XSS prevention)
- Code blocks use `highlight.js` for syntax highlighting

### 17.7 File Attachments

**Why:** Tasks need screenshots, mockups, logs. Messages need shared files.
Without file sharing, the team uses email or a separate Drive link.

**How it works:**

- Files uploaded to Cloudinary (already configured in PRD)
- Task attachments: `POST /tasks/:id/attachments` — multipart upload
- Message attachments: sent as part of the socket message payload
- Stored as `[{ name, url, size, type, uploadedAt }]` array

### 17.8 User Status

**Why:** Knowing if a teammate is in a meeting or on vacation before you ping
them saves interruptions. Slack's status system is heavily used.

**How it works:**

- `User.status: { emoji, text, expiresAt }` field added
- `PATCH /users/me/status` updates it
- Status shown under avatar in sidebar, in member lists, on hover cards
- Socket emits `user:status_changed` to all workspace rooms when updated

### 17.9 My Work (Cross-board Personal View)

**Why:** The #1 workflow in any task tool: "What are my tasks today?"
Without a cross-board view, you have to open every board to find your work.

**How it works:**

- `GET /users/me/tasks?workspaceId=xxx`
- Queries tasks where `assignees` contains `req.user._id`
- Grouped client-side: Overdue / Due today / Due this week / No due date

### 17.10 Board Templates

**Why:** An empty board is intimidating. Templates get new users to value
faster. Notion's templates are a major onboarding tool.

**How it works:**

- `POST /workspaces/:id/boards` accepts optional `templateId`
- Templates are stored in a `templates` collection (seeded at startup)
- Each template has predefined columns and optional sample tasks

### 17.11 Notification Preferences

**Why:** Notification spam is the #1 reason users mute tools and miss important alerts.
Control over what notifications you receive is a basic professional feature.

**How it works:**

- `User.notificationPrefs: { taskAssigned: { inApp, email }, mentions: { inApp, email }, ... }`
- Bull email worker checks prefs before sending
- Socket notification handler checks `inApp` prefs before emitting

### 17.12 Keyboard Shortcuts

**Why:** Power users in Linear, Notion, Slack heavily use keyboard shortcuts.
It's a signal that the app respects developers.

| Shortcut                 | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| `Ctrl+K`                 | Open command palette                                    |
| `C` (on board)           | Create new task in first column                         |
| `E` (on task card hover) | Edit task title inline                                  |
| `←` / `→`                | Move selected task to previous/next column              |
| `J` / `K`                | Navigate between task cards in a column                 |
| `Enter`                  | Open task detail for focused card                       |
| `Delete`                 | Delete focused task (with confirm)                      |
| `1-4`                    | Switch columns (1=Todo, 2=InProgress, 3=Review, 4=Done) |
| `,`                      | Open workspace settings                                 |
| `?`                      | Show keyboard shortcuts overlay                         |

### 17.13 Pinned Messages

**Why:** Important messages (meeting notes, standup summaries, links) get buried.
Pinning keeps them accessible. Slack's pins are used heavily.

**How it works:**

- `Message.isPinned: Boolean`
- `PATCH /messages/:id/pin`
- Pinned messages shown in a collapsible banner at top of channel
- Channel top bar shows "📌 1 pinned message · View"

### 17.14 Activity Log Page

Route: `/app/workspaces/:id/activity`

A full audit trail of everything that has happened in the workspace.
Useful for managers and post-mortems.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Activity Log                                                            │
│  Filter: [ All members ▼ ]  [ All boards ▼ ]  [ Date range ▼ ]         │
├──────────────────────────────────────────────────────────────────────────┤
│  TODAY                                                                   │
│                                                                          │
│  👤 Arjun  moved Fix login bug: In Progress → Review        2m ago     │
│  👤 Priya  added comment on Design nav                      15m ago    │
│  👤 Rahul  created task Write unit tests in Sprint 3        1h ago     │
│  👤 System  due date reminder sent for Write unit tests     9am        │
│                                                                          │
│  YESTERDAY                                                               │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Micro-interactions & Animations

These are the details that make an app feel polished vs clunky.
Every transition should have a purpose — not decorative.

### 18.1 Task Card Transitions

**Dragging a card:**

```css
.card.dragging {
	transform: rotate(2deg) scale(1.02);
	box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
	transition:
		transform 100ms var(--ease-spring),
		box-shadow 100ms var(--ease-out);
}
```

**Card appearing (after creation):**

```css
@keyframes cardEnter {
	from {
		opacity: 0;
		transform: translateY(-8px) scale(0.96);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}
.card.entering {
	animation: cardEnter 200ms var(--ease-out) forwards;
}
```

**Card disappearing (after deletion):**

```css
@keyframes cardLeave {
	from {
		opacity: 1;
		max-height: 200px;
		margin-bottom: 8px;
	}
	to {
		opacity: 0;
		max-height: 0;
		margin-bottom: 0;
	}
}
```

### 18.2 Sidebar

Collapsing a section: items slide up with `height: 0, opacity: 0` transition (200ms).
Unread count badge: appears with a `scale(0) → scale(1)` pop animation (150ms spring).
Active nav item: left accent bar slides down from top with 200ms ease.

### 18.3 Notifications

Incoming real-time notification: slides down from top of bell dropdown with 200ms ease-out.
Bell icon: bounces slightly when new notification arrives (`rotate: 0 → 15 → -15 → 0` in 400ms).
Unread count badge: number change animates with a flip-up (like a countdown clock digit).

### 18.4 Task Detail Panel

Opening: slides in from right with `translateX(100%) → translateX(0)` (250ms ease-out).
Closing: slides out to right (200ms ease-in).
Board behind it: shrinks to ~55% width with a smooth `width` transition (same 250ms).

### 18.5 Loading States

**Page skeleton:** content-shaped grey blocks with shimmer.

```css
@keyframes shimmer {
	0% {
		background-position: -200% 0;
	}
	100% {
		background-position: 200% 0;
	}
}
.skeleton {
	background: linear-gradient(90deg, var(--bg-surface-2) 25%, var(--bg-surface-3) 50%, var(--bg-surface-2) 75%);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
}
```

**Button loading:** spinner replaces text, button width stays constant (no layout shift).
**Optimistic update:** card appears immediately at 80% opacity, reaches 100% on API success,
rolls back to 0 with a red flash on failure.

### 18.6 Toast Notifications

```
Appearing:  translateX(120%) → translateX(0)  ease-out 200ms
Disappearing: translateX(0) → translateX(120%)  ease-in 150ms
Progress bar: width 100% → 0% over 4s linear (countdown to dismiss)
```

---

## 19. Mobile Experience

At < 768px, the layout fundamentally changes.

### 19.1 Navigation

The sidebar becomes a **bottom navigation bar** (5 tabs):

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT AREA                                 │
└────────┬────────┬────────┬──────────┬───────────────────────────┘
│ 🏠 Home│ 📋 Boards│ 💬 Chat│ 🔔 Notif│ 👤 Profile │
└────────┴────────┴────────┴──────────┴───────────────────────────┘
```

Active tab: icon in `--accent` color, label visible.
Inactive tabs: icon in `--text-muted` color, label hidden on very small screens.

### 19.2 Board View on Mobile

Kanban columns become a **horizontal swipe carousel**.
One column visible at a time, snap scroll.

```
[← To Do (3) →]   [← In Progress (2) →]   ...
       ↑
  swipe left/right
```

Column indicator at top: dots showing which column you're on (like a photo gallery).

### 19.3 Modals → Bottom Sheets

All modals on mobile become **bottom sheets** that slide up:

```
┌───────────────────────────────────┐
│  ─────── (drag handle)            │  ← 4px rounded pill handle
│                                   │
│  Create task                      │
│  ...                              │
│                                   │  slides up from bottom
└───────────────────────────────────┘
```

Task detail panel: full-screen slide-up instead of side panel.

### 19.4 Touch Targets

All interactive elements minimum 44×44px (Apple HIG standard).
Task cards: min-height 60px.
Drag-and-drop on mobile: long-press (500ms) to activate drag, then drag finger.

### 19.5 Command Palette on Mobile

Full-screen overlay. Input at top, results fill screen. Large touch-friendly result rows (56px height).

---

## 20. Accessibility

### 20.1 Keyboard Navigation

Every interactive element is keyboard-accessible.
Tab order follows visual layout.

Custom focus rings:

```css
:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
	border-radius: 4px;
}
/* Hide focus ring for mouse users but show for keyboard */
:focus:not(:focus-visible) {
	outline: none;
}
```

Board keyboard shortcuts (active when board is focused):

- `Tab` — move between task cards
- `Space` — "pick up" a card for keyboard drag
- `Arrow keys` — move picked-up card
- `Space` again — drop card at new position

### 20.2 Screen Reader Support

All interactive elements have `aria-label` attributes.
Live regions for real-time updates:

```html
<div
	aria-live="polite"
	aria-atomic="true"
>
	<!-- New socket events described here for screen readers -->
	"Priya moved Fix login bug to Review"
</div>
```

Task cards: `role="article"`, `aria-label="Fix login bug, urgent, assigned to Arjun, due today"`
Column: `role="region"`, `aria-label="In Progress column, 2 tasks"`

### 20.3 Color Independence

Priority is never communicated by color alone — always accompanied by a label or icon.

```
🔴 Urgent   (not just a red dot)
🟡 Medium   (not just a yellow dot)
```

Due date urgency: not just red color, also `⏰` icon and text like "Overdue 2 days".

### 20.4 Reduce Motion

When `prefers-reduced-motion: reduce` is set (user's OS setting):

- Disable all transition animations
- Replace animated spinners with static indicators
- Disable the shimmer skeleton animation (show flat grey instead)

```css
@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		animation-duration: 0.01ms !important;
		transition-duration: 0.01ms !important;
	}
}
```

---

_End of Professional Product Design — CollabBoard v2.0_
