import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams, useOutletContext } from "react-router-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "usehooks-ts";
import api from "../api/axios";
import FlipNumber from "../components/motion/FlipNumber.jsx";
import Icon from "../components/ui/Icon.jsx";
import { DURATION, EASE_IN, EASE_OUT, EASE_SPRING, fadeUp, MOBILE_QUERY, popover, SPRING_SOFT } from "../lib/motion";
import { useToast } from "../hooks/useToast.jsx";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

/* ── helpers ─────────────────────────────────────────────────── */
const WS_COLORS = ["#3b82f6", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#2dd4bf", "#FB923C", "#F472B6"];

function getInitials(name = "") {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function getColor(name = "") {
	let h = 0;
	for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
	return WS_COLORS[Math.abs(h) % WS_COLORS.length];
}

const MENTION_REGEX = /@([a-zA-Z0-9._-]{2,})/g;
const normalizeMention = (v) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");

const getMentionKeys = (user) => {
	if (!user) return new Set();
	const keys = new Set();
	if (user.name) {
		const parts = user.name.split(/\s+/).filter(Boolean);
		keys.add(normalizeMention(user.name));
		parts.forEach((p) => keys.add(normalizeMention(p)));
	}
	if (user.email) {
		keys.add(normalizeMention(user.email));
		keys.add(normalizeMention(user.email.split("@")[0] || ""));
	}
	return keys;
};

function renderContent(content, currentUser) {
	const value = String(content || "");
	const keys = getMentionKeys(currentUser);
	const regex = new RegExp(MENTION_REGEX);
	const parts = [];
	let lastIndex = 0;
	let match;
	while ((match = regex.exec(value)) !== null) {
		const start = match.index;
		const end = start + match[0].length;
		if (start > lastIndex) parts.push(value.slice(lastIndex, start));
		const isSelf = keys.size > 0 && keys.has(normalizeMention(match[1] || ""));
		parts.push(
			<span
				key={`m-${start}`}
				style={{
					color: isSelf ? "#8af1a5ff" : "#51f0a5ff",
					fontWeight: 600,
				}}
			>
				{match[0]}
			</span>,
		);
		lastIndex = end;
	}
	if (!parts.length) return value;
	if (lastIndex < value.length) parts.push(value.slice(lastIndex));
	return parts;
}

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso) => {
	const d = new Date(iso);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) return "Today";
	const yest = new Date(today);
	yest.setDate(today.getDate() - 1);
	if (d.toDateString() === yest.toDateString()) return "Yesterday";
	return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
};

const ELLIPSIS = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function isSameMinute(a, b) {
	const da = new Date(a);
	const db = new Date(b);
	return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
}

/* How a message row should mount:
   - null      part of a fetched history batch: render in place, no animation
   - "enter"   a live arrival (someone else's message, or our optimistic send)
   - "confirm" the server echo of our own send. It replaces the optimistic copy under a
               new id, so it continues from that copy's dimmed state instead of
               animating in a second time. */
function getArrival(msg, loadedIds, currentUser) {
	if (loadedIds.has(msg._id)) return null;
	if (!msg.isOptimistic && msg.sender?._id === currentUser?._id) return "confirm";
	return "enter";
}

const ARRIVAL_INITIAL = {
	enter: { opacity: 0, y: 8 },
	confirm: { opacity: 0.75, y: 0 },
};

/* ── Avatar ───────────────────────────────────────────────────── */
function MsgAvatar({ sender, visible }) {
	if (!visible) return <div className="chat-msg-avatar-placeholder" />;
	return sender?.avatar ? (
		<img src={sender.avatar} alt={sender.name} className="chat-msg-avatar" style={{ objectFit: "cover" }} />
	) : (
		<div className="chat-msg-avatar" style={{ background: getColor(sender?.name || "") }}>
			{getInitials(sender?.name || "?")}
		</div>
	);
}

/* ── Reaction pill ────────────────────────────────────────────── */
// Always mounted (even when empty) so AnimatePresence can tell a freshly added pill
// from the ones that came with the message — only the former pops in.
function Reactions({ reactions = [], currentUserId, onReact }) {
	return (
		<div
			className="chat-reactions"
			style={reactions.length ? undefined : { marginTop: 0 }}
		>
			<AnimatePresence initial={false}>
				{reactions.map((r) => {
					const isMine = r.users?.includes(currentUserId);
					return (
						<motion.button
							key={r.emoji}
							type="button"
							className={`chat-reaction${isMine ? " mine" : ""}`}
							onClick={() => onReact(r.emoji)}
							title={isMine ? "Remove reaction" : "Add reaction"}
							// .chat-reaction transitions `all`; keep CSS off transform so it doesn't fight framer
							style={{ transitionProperty: "background-color, border-color, color" }}
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_SPRING } }}
							exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12, ease: EASE_IN } }}
							whileTap={{ scale: 0.9 }}
						>
							<span>{r.emoji}</span>
							<span className="chat-reaction-count">
								<FlipNumber
									value={r.users?.length || 0}
									max={Infinity}
								/>
							</span>
						</motion.button>
					);
				})}
			</AnimatePresence>
		</div>
	);
}

/* Portal to <body> as a component, so it can sit inside AnimatePresence and still
   receive the exit animation (presence context flows through portals). */
function BodyPortal({ children }) {
	return createPortal(children, document.body);
}

/* ── Emoji picker ─────────────────────────────────────────────── */
function EmojiPicker({ onPick, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		const h = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		// slight delay so the button click doesn't immediately close it
		const id = setTimeout(() => document.addEventListener("mousedown", h), 50);
		return () => {
			clearTimeout(id);
			document.removeEventListener("mousedown", h);
		};
	}, [onClose]);

	return (
		<div ref={ref} className="emoji-picker-popup" style={{ zIndex: 300 }}>
			<Picker
				data={data}
				onEmojiSelect={(emoji) => onPick(emoji.native)}
				theme="dark"
				set="native"
				previewPosition="none"
				skinTonePosition="none"
				perLine={8}
				maxFrequentRows={2}
			/>
		</div>
	);
}

/* ── Message row ──────────────────────────────────────────────── */
function MessageRow({ msg, prevMsg, currentUser, onReact, onReply, onDelete, onEdit, threadCount, arrival = null }) {
	const [emojiOpen, setEmojiOpen] = useState(false);
	const [pickerCoords, setPickerCoords] = useState(null);
	const [menuCoords, setMenuCoords] = useState(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(msg.content);
	
	const bubbleRef = useRef(null);

	const isOwn = msg.sender?._id === currentUser?._id;
	const showHeader = !prevMsg || prevMsg.sender?._id !== msg.sender?._id || !isSameMinute(prevMsg.createdAt, msg.createdAt);
	const isOnlyEmoji = /^\p{Emoji}+$/u.test((msg.content || "").trim()) && (msg.content || "").trim().length <= 4;

	const handleMessageClick = (e) => {
		e.preventDefault();
		e.stopPropagation();
		
		let x = e.clientX;
		let y = e.clientY;
		if (x + 150 > window.innerWidth) x = window.innerWidth - 150;
		if (y + 50 > window.innerHeight) y = window.innerHeight - 50;
		
		setMenuCoords({ x, y });
		if (emojiOpen) {
			setEmojiOpen(false);
			setPickerCoords(null);
		}
	};

	const toggleEmoji = (e) => {
		e.stopPropagation();
		if (emojiOpen) {
			setEmojiOpen(false);
			setPickerCoords(null);
		} else {
			// Get button's exact position before unmounting menu
			const rect = e.currentTarget.getBoundingClientRect();
			
			// Close menu if open
			setMenuCoords(null);
			
			const pickerHeight = 435; 
			const pickerWidth = 358; 
			
			// Default to opening directly to the RIGHT of the button
			let left = rect.right + 8;
			let top = rect.top;
			let origin = "top left";

			// Horizontal boundary: If it overflows the right side of the screen
			if (left + pickerWidth > window.innerWidth - 8) {
				// Flip it to the LEFT of the button
				left = rect.left - pickerWidth - 8;
				origin = "top right";

				// Absolute screen edge fallback
				if (left < 8) {
					left = 8;
					origin = "top center";
				}
			}
			
			// Vertical boundary: Ensure it fully fits on the screen
			if (top + pickerHeight > window.innerHeight - 8) {
				top = window.innerHeight - pickerHeight - 8;
			}
			if (top < 8) top = 8;

			setPickerCoords({ top, left, origin });
			setEmojiOpen(true);
		}
	};

	return (
		<motion.div
			className={`chat-msg-group${showHeader ? " first-in-group" : ""}${emojiOpen ? " has-picker-open" : ""}${isOwn ? " own-message" : ""}`}
			// Only live arrivals animate; history renders in place. Optimistic sends sit
			// slightly dimmed until the server echo replaces them (UI.md §18.5).
			initial={ARRIVAL_INITIAL[arrival] || false}
			animate={{ opacity: msg.isOptimistic ? 0.75 : 1, y: 0 }}
			transition={{ duration: 0.25, ease: EASE_OUT }}
		>
			<MsgAvatar sender={msg.sender} visible={showHeader} />

			<div className="chat-msg-body">
				{showHeader && (
					<div className="chat-msg-meta">
						<span className="chat-msg-author">{msg.sender?.name || "Unknown"}</span>
						<span className="chat-msg-time">{fmtTime(msg.createdAt)}</span>
					</div>
				)}
				{isEditing ? (
					<div style={{ marginTop: 4, marginBottom: 8 }}>
						<textarea className="input" style={{ width: "100%", resize: "none", fontSize: 14 }} rows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								onEdit(msg._id, editContent);
								setIsEditing(false);
							}
							if (e.key === "Escape") setIsEditing(false);
						}} autoFocus />
						<div style={{ display: "flex", gap: 8, marginTop: 6 }}>
							<button type="button" className="btn btn-primary btn-sm" onClick={() => { onEdit(msg._id, editContent); setIsEditing(false); }}>Save</button>
							<button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
						</div>
					</div>
				) : (
					<div ref={bubbleRef} className="chat-msg-text-wrapper">
						<p
							className={`chat-msg-text${isOnlyEmoji ? " only-emoji" : ""}`}
							onClick={handleMessageClick}
						>
							{renderContent(msg.content, currentUser)}
							{msg.isEdited && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(edited)</span>}
						</p>
					</div>

				)}

				<Reactions
					reactions={msg.reactions || []}
					currentUserId={currentUser?._id}
					onReact={(emoji) => onReact(msg._id, emoji)}
				/>

				{threadCount > 0 && (
					<button type="button" className="chat-thread-bar" onClick={() => onReply(msg)}>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							<span style={{ fontWeight: 600 }}>{threadCount} {threadCount === 1 ? "reply" : "replies"}</span>
							<span style={{ color: "var(--text-muted)" }}>· View thread →</span>
						</div>
					</button>
				)}
			</div>

			{/* Menu Backdrop */}
			{menuCoords && createPortal(
				<div 
					style={{ position: "fixed", inset: 0, zIndex: 99998 }} 
					onClick={(e) => { e.stopPropagation(); setMenuCoords(null); }} 
					onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenuCoords(null); }}
				/>,
				document.body
			)}

			{/* 4-Options Menu Portal */}
			<AnimatePresence>
				{menuCoords && (
					<BodyPortal key="msg-menu">
						<motion.div
							className="chat-msg-actions-popup"
							style={{
								position: "fixed",
								top: menuCoords.y,
								left: menuCoords.x,
								zIndex: 99999,
								background: "var(--bg-surface-1)",
								border: "1px solid var(--border-default)",
								borderRadius: "8px",
								boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
								display: "flex",
								padding: "4px",
								gap: "4px",
								transformOrigin: "top left",
							}}
							variants={popover}
							initial="initial"
							animate="animate"
							exit="exit"
							onClick={(e) => e.stopPropagation()}
						>
							<button type="button" className="chat-action-btn" title="Add reaction" onClick={(e) => toggleEmoji(e)}>
								<Icon
									name="smile"
									size={13}
								/>
							</button>
							<button type="button" className="chat-action-btn" title="Reply in thread" onClick={() => { onReply(msg); setMenuCoords(null); }}>
								<Icon name="chat" size={13} />
							</button>
							{isOwn && (
								<>
									<button type="button" className="chat-action-btn" title="Edit message" onClick={() => { setIsEditing(true); setEditContent(msg.content); setMenuCoords(null); }}>
										<Icon name="pencil" size={13} />
									</button>
									<button type="button" className="chat-action-btn" title="Delete message" style={{ color: "var(--red)" }} onClick={() => { onDelete(msg._id); setMenuCoords(null); }}>
										<Icon name="trash" size={13} />
									</button>
								</>
							)}
						</motion.div>
					</BodyPortal>
				)}
			</AnimatePresence>

			{/* Render EmojiPicker via Portal in document.body so it is NEVER clipped by scrollable parents */}
			<AnimatePresence>
				{emojiOpen && pickerCoords && (
					<BodyPortal key="emoji-picker">
						<motion.div
							style={{
								position: "fixed",
								top: pickerCoords.top,
								left: pickerCoords.left,
								zIndex: 99999,
								transformOrigin: pickerCoords.origin,
							}}
							variants={popover}
							initial="initial"
							animate="animate"
							exit="exit"
						>
							<EmojiPicker
								onPick={(em) => {
									onReact(msg._id, em);
									setEmojiOpen(false);
									setPickerCoords(null);
								}}
								onClose={() => {
									setEmojiOpen(false);
									setPickerCoords(null);
								}}
							/>
						</motion.div>
					</BodyPortal>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

/* ── Thread panel ─────────────────────────────────────────────── */
const THREAD_PANEL_WIDTH = 360;

// Desktop: grow the column so the channel narrows smoothly while the panel slides in (UI.md §18.4).
const threadPanelDesktop = {
	initial: { width: 0, opacity: 0 },
	animate: { width: THREAD_PANEL_WIDTH, opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
	exit: { width: 0, opacity: 0, transition: { duration: DURATION.default, ease: EASE_IN } },
};

// Mobile: full-screen overlay pushed in from the right, like a navigation push.
const threadPanelMobile = {
	initial: { x: "100%" },
	animate: { x: 0, transition: SPRING_SOFT },
	exit: { x: "100%", transition: { duration: DURATION.default, ease: EASE_IN } },
};

function ThreadPanel({ parentMsg, currentUser, onClose }) {
	const [replies, setReplies] = useState([]);
	// Ids that arrived with the initial fetch; anything else is a live reply and animates in.
	const [loadedReplyIds, setLoadedReplyIds] = useState(() => new Set());
	const [input, setInput] = useState("");
	const { workspaceId } = useParams();
	const accessToken = useAuthStore((s) => s.accessToken);
	const endRef = useRef(null);
	const isMobile = useMediaQuery(MOBILE_QUERY);

	useEffect(() => {
		if (!parentMsg) return;
		api.get(`/workspaces/${workspaceId}/messages?threadId=${parentMsg._id}&limit=100`)
			.then((res) => {
				setReplies(res.data.messages);
				setLoadedReplyIds(new Set(res.data.messages.map((m) => m._id)));
				setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
			})
			.catch((err) => console.error("Failed to load thread replies:", err));
	}, [parentMsg?._id, workspaceId]);

	const send = () => {
		const content = input.trim();
		if (!content) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		
		// Send reply
		socket.emit("chat:send", { workspaceId, content, threadId: parentMsg._id });
		
		// Optimistic Update: Push temporary reply instantly!
		const tempId = `temp-${Date.now()}`;
		const tempReply = {
			_id: tempId,
			workspace: workspaceId,
			sender: currentUser,
			content,
			type: "text",
			createdAt: new Date().toISOString(),
			threadId: parentMsg._id,
			isOptimistic: true,
		};
		setReplies((prev) => [...prev, tempReply]);
		setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
		
		setInput("");
	};

	const handleKey = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	const parentMsgRef = useRef(parentMsg);
	useEffect(() => {
		parentMsgRef.current = parentMsg;
	}, [parentMsg]);

	useEffect(() => {
		const socket = getSocket(accessToken);
		if (!socket) return;
		const handle = ({ message }) => {
			if (message.threadId === parentMsgRef.current?._id) {
				setReplies((prev) => {
					// Remove the optimistic temporary message from the state
					const filtered = prev.filter((r) => !r.isOptimistic || r.content !== message.content);
					return [...filtered, message];
				});
				setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
			}
		};
		socket.on("chat:message", handle);
		return () => socket.off("chat:message", handle);
	}, [accessToken]);

	if (!parentMsg) return null;

	return (
		<motion.div
			className="chat-thread-panel"
			// Framer owns the entrance; switch off the CSS panelSlideIn keyframe.
			style={{ animation: "none", overflow: "hidden" }}
			variants={isMobile ? threadPanelMobile : threadPanelDesktop}
			initial="initial"
			animate="animate"
			exit="exit"
		>
			{/* Fixed-width inner column: as the outer width grows the content slides in
			    from the right instead of reflowing. */}
			<div
				style={{
					width: isMobile ? "100%" : THREAD_PANEL_WIDTH,
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div className="chat-thread-header">
					<span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Thread</span>
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						onClick={onClose}
						aria-label="Close thread"
					>
						<Icon name="close" size={14} />
					</button>
				</div>

				<div className="chat-thread-messages">
					{/* Original message */}
					<div style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)", marginBottom: 12 }}>
						<MessageRow
							msg={parentMsg}
							prevMsg={null}
							currentUser={currentUser}
							onReact={() => {}}
							onReply={() => {}}
							onDelete={() => {}}
							threadCount={0}
						/>
					</div>

					{replies.length === 0 && (
						<p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
							No replies yet. Be the first to reply!
						</p>
					)}
					{replies.map((r, i) => (
						<MessageRow
							key={r._id}
							msg={r}
							prevMsg={replies[i - 1] || null}
							currentUser={currentUser}
							onReact={() => {}}
							onReply={() => {}}
							onDelete={() => {}}
							threadCount={0}
							arrival={getArrival(r, loadedReplyIds, currentUser)}
						/>
					))}
					<div ref={endRef} />
				</div>

				<div className="chat-input-area">
					<div className="chat-input-box">
						<textarea
							className="chat-input-textarea"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKey}
							placeholder="Reply in thread..."
							rows={2}
						/>
						<div className="chat-input-footer">
							<span className="chat-input-hint">Enter to send</span>
							<button
								type="button"
								onClick={send}
								disabled={!input.trim()}
								className="btn btn-primary btn-sm"
								style={{ padding: "0 10px" }}
							>
								<Icon name="send" size={13} />
							</button>
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

/* ── Typing dots ──────────────────────────────────────────────── */
// Height animates too, so the message list eases up instead of jumping by a row.
function TypingDots({ names }) {
	if (!names.length) return null;
	return (
		<motion.div
			style={{ overflow: "hidden", flexShrink: 0 }}
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: "auto", opacity: 1, transition: { duration: DURATION.default, ease: EASE_OUT } }}
			exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: EASE_IN } }}
		>
			<div style={{ padding: "2px 20px 6px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
				<div
					className="typing-dots"
					style={{ flexShrink: 0 }}
				>
					<span />
					<span />
					<span />
				</div>
				<span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", ...ELLIPSIS }}>
					{names.join(", ")} {names.length === 1 ? "is" : "are"} typing…
				</span>
			</div>
		</motion.div>
	);
}

/* ── Main page ────────────────────────────────────────────────── */
export default function ChatPage() {
	const { workspaceId } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const { workspace } = useOutletContext();
	const accessToken = useAuthStore((s) => s.accessToken);
	const currentUser = useAuthStore((s) => s.user);
	const toast = useToast();

	const channelIdParam = searchParams.get("channelId");
	const dmUserId = searchParams.get("dm");

	const [activeChannel, setActiveChannel] = useState(null);
	const [messages, setMessages] = useState([]);
	const [hasMore, setHasMore] = useState(false);
	const [nextCursor, setNextCursor] = useState(null);
	const [input, setInput] = useState("");
	const [status, setStatus] = useState("loading");
	const [typingUsers, setTypingUsers] = useState({});
	const [loadingMore, setLoadingMore] = useState(false);
	const [threadMsg, setThreadMsg] = useState(null);
	// Ids delivered by history fetches (initial page + "load older"). Those render in
	// place; only messages that show up afterwards get the arrival animation.
	const [loadedIds, setLoadedIds] = useState(() => new Set());
	const isMobile = useMediaQuery(MOBILE_QUERY);

	const dmUser = useMemo(() => {
		if (!workspace?.members || !currentUser) return null;
		if (activeChannel?.name?.startsWith("dm_")) {
			const parts = activeChannel.name.split("_");
			const otherId = parts[1] === currentUser._id ? parts[2] : parts[1];
			return workspace.members.find((m) => (m.user?._id || m.user) === otherId)?.user || workspace.members.find((m) => (m.user?._id || m.user) === otherId);
		}
		if (dmUserId) {
			return workspace.members.find((m) => (m.user?._id || m.user) === dmUserId)?.user || workspace.members.find((m) => (m.user?._id || m.user) === dmUserId);
		}
		return null;
	}, [activeChannel, dmUserId, workspace, currentUser]);

	const messagesEndRef = useRef(null);
	const typingTimers = useRef({});
	const isFirstLoad = useRef(true);
	const inputRef = useRef(null);

	const activeChannelRef = useRef(activeChannel);
	useEffect(() => {
		activeChannelRef.current = activeChannel;
	}, [activeChannel]);

	/* Load messages */
	useEffect(() => {
		if (!workspaceId) return;
		let active = true;

		const fetchMessages = (cId) => {
			const url = cId ? `/workspaces/${workspaceId}/messages?limit=60&channelId=${cId}` : `/workspaces/${workspaceId}/messages?limit=60`;
			api.get(url).then(({ data }) => {
				if (!active) return;
				setMessages(data.messages);
				setLoadedIds(new Set(data.messages.map((m) => m._id)));
				setActiveChannel(data.channel);
				setHasMore(data.hasMore);
				setNextCursor(data.nextCursor);
				setStatus("ready");
			}).catch(() => {
				if (active) setStatus("error");
			});
		};

		if (dmUserId) {
			api.post(`/workspaces/${workspaceId}/dms`, { userId: dmUserId })
				.then(({ data }) => {
					if (!active) return;
					setSearchParams({ channelId: data._id }, { replace: true });
				})
				.catch(() => {
					if (active) setStatus("error");
				});
		} else {
			fetchMessages(channelIdParam);
		}

		return () => {
			active = false;
		};
	}, [workspaceId, channelIdParam, dmUserId, setSearchParams]);

	/* Scroll to bottom on first load */
	useEffect(() => {
		if (status === "ready" && isFirstLoad.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
			isFirstLoad.current = false;
		}
	}, [status]);

	/* Socket */
	useEffect(() => {
		if (!workspaceId || !accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("join:workspace", { workspaceId });

		const handleMessage = ({ message }) => {
			if (message.threadId) return;
			// Only show if it matches the current channel
			if (message.channel !== activeChannelRef.current?._id) return;
			setMessages((prev) => {
				// Remove the optimistic temporary message from the state
				const filtered = prev.filter((m) => !m.isOptimistic || m.content !== message.content);
				return [...filtered, message];
			});
			setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
		};

		const handleReaction = ({ messageId, reactions }) => {
			setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
		};

		const handleDeleted = ({ messageId }) => {
			setMessages((prev) => prev.filter((m) => m._id !== messageId));
		};

		const handleEdited = ({ message }) => {
			setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, content: message.content, isEdited: true } : m)));
		};

		const handleTyping = ({ userId, name, isTyping }) => {
			if (userId === currentUser?._id) return;
			setTypingUsers((prev) => {
				if (!isTyping) {
					const next = { ...prev };
					delete next[userId];
					return next;
				}
				return { ...prev, [userId]: name };
			});
			clearTimeout(typingTimers.current[userId]);
			if (isTyping) {
				typingTimers.current[userId] = setTimeout(() => {
					setTypingUsers((prev) => {
						const next = { ...prev };
						delete next[userId];
						return next;
					});
				}, 3000);
			}
		};

		const handleThreadUpdated = ({ messageId, threadCount, lastReplyAt }) => {
			setMessages((prev) =>
				prev.map((m) =>
					m._id === messageId
						? { ...m, threadCount, lastReplyAt }
						: m
				)
			);
		};

		socket.on("chat:message", handleMessage);
		socket.on("chat:reaction_updated", handleReaction);
		socket.on("chat:deleted", handleDeleted);
		socket.on("chat:edited", handleEdited);
		socket.on("chat:typing", handleTyping);
		socket.on("chat:thread_updated", handleThreadUpdated);
		return () => {
			socket.off("chat:message", handleMessage);
			socket.off("chat:reaction_updated", handleReaction);
			socket.off("chat:deleted", handleDeleted);
			socket.off("chat:edited", handleEdited);
			socket.off("chat:typing", handleTyping);
			socket.off("chat:thread_updated", handleThreadUpdated);
		};
	}, [workspaceId, accessToken, currentUser]);

	const handleSend = () => {
		const content = input.trim();
		if (!content || !workspaceId || !accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		
		// Emit standard socket event
		socket.emit("chat:send", { workspaceId, channelId: activeChannel?._id, content });
		
		// Optimistic Update: Push temporary message instantly!
		const tempId = `temp-${Date.now()}`;
		const tempMessage = {
			_id: tempId,
			workspace: workspaceId,
			channel: activeChannel?._id,
			sender: currentUser,
			content,
			type: "text",
			createdAt: new Date().toISOString(),
			isOptimistic: true,
		};
		
		setMessages((prev) => [...prev, tempMessage]);
		setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
		
		setInput("");
		inputRef.current?.focus();
	};

	const handleInputChange = (e) => {
		setInput(e.target.value);
		const socket = getSocket(accessToken);
		if (!socket || !workspaceId) return;
		socket.emit("chat:typing", { workspaceId, isTyping: true });
		clearTimeout(typingTimers.current._self);
		typingTimers.current._self = setTimeout(() => {
			socket.emit("chat:typing", { workspaceId, isTyping: false });
		}, 2500);
	};

	const handleKey = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleReact = (messageId, emoji) => {
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("chat:react", { workspaceId, messageId, emoji });
		// Optimistic update
		setMessages((prev) =>
			prev.map((m) => {
				if (m._id !== messageId) return m;
				let reactions = [...(m.reactions || [])];
				const uid = currentUser?._id;
				
				let existingEmojiIndex = -1;
				for (let i = 0; i < reactions.length; i++) {
					if ((reactions[i].users || []).includes(uid)) {
						existingEmojiIndex = i;
						break;
					}
				}

				if (existingEmojiIndex >= 0) {
					const existingEmoji = reactions[existingEmojiIndex].emoji;
					reactions[existingEmojiIndex] = {
						...reactions[existingEmojiIndex],
						users: (reactions[existingEmojiIndex].users || []).filter((u) => u !== uid)
					};
					if (!reactions[existingEmojiIndex].users.length) {
						reactions.splice(existingEmojiIndex, 1);
					}
					if (existingEmoji !== emoji) {
						const newIdx = reactions.findIndex((r) => r.emoji === emoji);
						if (newIdx >= 0) {
							reactions[newIdx] = {
								...reactions[newIdx],
								users: [...(reactions[newIdx].users || []), uid]
							};
						} else {
							reactions.push({ emoji, users: [uid] });
						}
					}
				} else {
					const newIdx = reactions.findIndex((r) => r.emoji === emoji);
					if (newIdx >= 0) {
						reactions[newIdx] = {
							...reactions[newIdx],
							users: [...(reactions[newIdx].users || []), uid]
						};
					} else {
						reactions.push({ emoji, users: [uid] });
					}
				}
				return { ...m, reactions };
			}),
		);
	};

	const handleDelete = (messageId) => {
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("chat:delete", { workspaceId, messageId });
		setMessages((prev) => prev.filter((m) => m._id !== messageId));
		toast.success("Message deleted");
	};

	const handleEdit = (messageId, newContent) => {
		if (!newContent.trim()) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("chat:edit", { workspaceId, messageId, content: newContent });
		// Optimistic update
		setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, content: newContent, isEdited: true } : m)));
	};

	const loadMore = async () => {
		if (!hasMore || loadingMore || !nextCursor) return;
		setLoadingMore(true);
		try {
			const url = activeChannel?._id ? `/workspaces/${workspaceId}/messages?limit=60&channelId=${activeChannel._id}&before=${nextCursor}` : `/workspaces/${workspaceId}/messages?limit=60&before=${nextCursor}`;
			const { data } = await api.get(url);
			setMessages((prev) => [...data.messages, ...prev]);
			setLoadedIds((prev) => new Set([...prev, ...data.messages.map((m) => m._id)]));
			setHasMore(data.hasMore);
			setNextCursor(data.nextCursor);
		} catch {
			/* ignore */
		} finally {
			setLoadingMore(false);
		}
	};

	const typingNames = Object.values(typingUsers);

	/* Group messages by date */
	const grouped = messages.reduce((acc, msg) => {
		const label = fmtDate(msg.createdAt);
		if (!acc.length || acc[acc.length - 1].date !== label) {
			acc.push({ date: label, items: [msg] });
		} else {
			acc[acc.length - 1].items.push(msg);
		}
		return acc;
	}, []);

	const currentMember = workspace?.members?.find((m) => (m.user?._id || m.user) === currentUser?._id);
	const role = currentMember?.role || "member";
	const canPost = !activeChannel?.isReadOnly || role === "admin" || role === "owner";

	return (
		<div className="chat-layout fade-in">
			{/* Main chat area */}
			<div className="chat-main">
				{/* Header */}
				<div className="chat-header">
					<div
						className="chat-header-left"
						style={{ flex: 1, minWidth: 0 }}
					>
						<span style={{ fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", flexShrink: 0 }}>
							{dmUser ? <Icon name="user" size={18} /> : activeChannel?.isPrivate ? <Icon name="lock" size={16} /> : "#"}
						</span>
						{/* Keyed on the conversation so switching channels/DMs eases the title in */}
						<motion.div
							key={activeChannel?._id || "loading"}
							style={{ minWidth: 0 }}
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: DURATION.default, ease: EASE_OUT }}
						>
							<div
								className="chat-header-name"
								style={ELLIPSIS}
							>
								{dmUser ? dmUser.name : (activeChannel?.name || "...")}
							</div>
							<div
								className="chat-header-desc"
								style={ELLIPSIS}
							>
								{dmUser ? "Direct Message" : (activeChannel?.description || "All workspace members")}
							</div>
						</motion.div>
					</div>
					<div
						className="chat-header-right"
						style={{ flexShrink: 0, marginLeft: 12 }}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								background: "var(--green-muted)",
								border: "1px solid var(--green-border)",
								borderRadius: "var(--r-full)",
								padding: "3px 10px",
							}}
						>
							<div
								className="lp-live-dot"
								style={{ width: 6, height: 6 }}
							/>
							<span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>Live</span>
						</div>
					</div>
				</div>

				{/* Messages */}
				<div className="chat-messages">
					{status === "loading" && (
						<div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 20 }}>
							{[1, 2, 3, 4].map((i) => (
								<div key={i} style={{ display: "flex", gap: 12 }}>
									<div className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
									<div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
										<div className="skeleton" style={{ height: 14, width: "20%" }} />
										<div className="skeleton" style={{ height: 16, width: `${40 + i * 10}%` }} />
									</div>
								</div>
							))}
						</div>
					)}

					{status === "error" && (
						<p style={{ textAlign: "center", color: "var(--red)", fontSize: 14, paddingTop: 32 }}>Failed to load messages.</p>
					)}

					{status === "ready" && (
						<>
							{hasMore && (
								<div style={{ textAlign: "center", marginBottom: 16 }}>
									<button type="button" onClick={loadMore} disabled={loadingMore} className="btn btn-ghost btn-sm">
										{loadingMore ? (
											<>
												<span className="spinner" style={{ width: 11, height: 11 }} /> Loading…
											</>
										) : (
											"Load older messages"
										)}
									</button>
								</div>
							)}

							{messages.length === 0 && (
								<motion.div
									className="empty-state"
									variants={fadeUp}
									initial="hidden"
									animate="show"
								>
									<div className="icon-box icon-box-accent empty-state-icon empty-float">
										<Icon name="chat" size={24} />
									</div>
									<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
										No messages yet
									</p>
									<p>Be the first to say hello! 👋</p>
								</motion.div>
							)}

							{grouped.map((group) => (
								<div key={group.date}>
									<div className="chat-date-divider">
										<span className="chat-date-label">{group.date}</span>
									</div>
									{group.items.map((msg, idx) => (
										<MessageRow
											key={msg._id}
											msg={msg}
											prevMsg={group.items[idx - 1] || null}
											currentUser={currentUser}
											onReact={handleReact}
											onReply={setThreadMsg}
											onDelete={handleDelete}
											onEdit={handleEdit}
											threadCount={msg.threadCount || 0}
											arrival={getArrival(msg, loadedIds, currentUser)}
										/>
									))}
								</div>
							))}

							<div ref={messagesEndRef} />
						</>
					)}
				</div>

				{/* Typing indicator */}
				<AnimatePresence initial={false}>
					{typingNames.length > 0 && (
						<TypingDots
							key="typing"
							names={typingNames}
						/>
					)}
				</AnimatePresence>

				{/* Input */}
				<div className="chat-input-area">
					{!canPost ? (
						<div className="chat-readonly-banner" style={{ textAlign: "center", padding: "12px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", color: "var(--text-muted)" }}>
							<Icon name="lock" size={14} style={{ marginRight: 8, verticalAlign: "middle", marginBottom: -2 }} />
							Only admins and owners can post in this channel.
						</div>
					) : (
						<div className="chat-input-box">
							<textarea
								ref={inputRef}
								id="chat-input"
								className="chat-input-textarea"
								value={input}
								onChange={handleInputChange}
								onKeyDown={handleKey}
								rows={1}
								placeholder={`Message ${activeChannel?.isPrivate ? "user" : "#" + (activeChannel?.name || "channel")}...`}
							/>
							<div className="chat-input-footer">
								<span
									className="chat-input-hint"
									style={{ ...ELLIPSIS, minWidth: 0, marginRight: 8 }}
								>
									Enter to send · Shift+Enter for new line
								</span>
								<motion.button
									type="button"
									onClick={handleSend}
									disabled={!input.trim()}
									aria-label="Send message"
									whileTap={input.trim() ? { scale: 0.88 } : undefined}
									style={{
										flexShrink: 0,
										width: isMobile ? 36 : 30,
										height: isMobile ? 36 : 30,
										borderRadius: "var(--r-md)",
										background: input.trim() ? "var(--accent)" : "var(--bg-surface-3)",
										border: "none",
										cursor: input.trim() ? "pointer" : "not-allowed",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										color: "#fff",
										// Not `all`: transform belongs to framer (press feedback).
										transition: "background-color var(--duration-fast) var(--ease-out)",
									}}
								>
									<Icon
										name="send"
										size={14}
									/>
								</motion.button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Thread panel */}
			<AnimatePresence>
				{threadMsg && (
					<ThreadPanel
						key="thread-panel"
						parentMsg={threadMsg}
						currentUser={currentUser}
						onClose={() => setThreadMsg(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
