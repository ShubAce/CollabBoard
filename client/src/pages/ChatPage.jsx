import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/ui/Icon.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

/* ── helpers ─────────────────────────────────────────────────── */
const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];

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
					color: isSelf ? "#fff" : "var(--accent)",
					background: isSelf ? "var(--accent)" : "transparent",
					padding: isSelf ? "1px 5px" : 0,
					borderRadius: isSelf ? 4 : 0,
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

const QUICK_EMOJIS = ["👍", "✅", "🔥", "👀", "🎉", "💯", "❤️", "🤔", "😄", "🚀"];

function isSameMinute(a, b) {
	const da = new Date(a);
	const db = new Date(b);
	return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
}

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
function Reactions({ reactions = [], currentUserId, onReact }) {
	if (!reactions.length) return null;
	return (
		<div className="chat-reactions">
			{reactions.map((r) => {
				const isMine = r.users?.includes(currentUserId);
				return (
					<button
						key={r.emoji}
						type="button"
						className={`chat-reaction${isMine ? " mine" : ""}`}
						onClick={() => onReact(r.emoji)}
						title={isMine ? "Remove reaction" : "Add reaction"}
					>
						<span>{r.emoji}</span>
						<span className="chat-reaction-count">{r.users?.length || 0}</span>
					</button>
				);
			})}
		</div>
	);
}

/* ── Emoji picker ─────────────────────────────────────────────── */
function EmojiPicker({ onPick, onClose }) {
	const ref = useRef(null);
	useEffect(() => {
		const h = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		document.addEventListener("mousedown", h);
		return () => document.removeEventListener("mousedown", h);
	}, [onClose]);

	return (
		<div ref={ref} className="emoji-picker-popup">
			<div className="emoji-picker-row">
				{QUICK_EMOJIS.map((em) => (
					<button key={em} type="button" className="emoji-btn" onClick={() => onPick(em)}>
						{em}
					</button>
				))}
			</div>
		</div>
	);
}

/* ── Message row ──────────────────────────────────────────────── */
function MessageRow({ msg, prevMsg, currentUser, onReact, onReply, onDelete, onEdit, threadCount }) {
	const [emojiOpen, setEmojiOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(msg.content);
	const isOwn = msg.sender?._id === currentUser?._id;
	const showHeader = !prevMsg || prevMsg.sender?._id !== msg.sender?._id || !isSameMinute(prevMsg.createdAt, msg.createdAt);
	const isOnlyEmoji = /^\p{Emoji}+$/u.test((msg.content || "").trim()) && (msg.content || "").trim().length <= 4;

	return (
		<div className={`chat-msg-group${showHeader ? " first-in-group" : ""}`}>
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
					<p className={`chat-msg-text${isOnlyEmoji ? " only-emoji" : ""}`}>
						{renderContent(msg.content, currentUser)}
						{msg.isEdited && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(edited)</span>}
					</p>
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

			{/* Hover action bar */}
			<div className="chat-msg-actions">
				<div style={{ position: "relative" }}>
					<button type="button" className="chat-action-btn" title="Add reaction" onClick={() => setEmojiOpen((o) => !o)}>
						😊
					</button>
					{emojiOpen && (
						<EmojiPicker
							onPick={(em) => {
								onReact(msg._id, em);
								setEmojiOpen(false);
							}}
							onClose={() => setEmojiOpen(false)}
						/>
					)}
				</div>
				<button type="button" className="chat-action-btn" title="Reply in thread" onClick={() => onReply(msg)}>
					<Icon name="chat" size={13} />
				</button>
				{isOwn && (
					<>
						<button type="button" className="chat-action-btn" title="Edit message" onClick={() => { setIsEditing(true); setEditContent(msg.content); }}>
							<Icon name="pencil" size={13} />
						</button>
						<button
							type="button"
							className="chat-action-btn"
							title="Delete message"
							style={{ color: "var(--red)" }}
							onClick={() => onDelete(msg._id)}
						>
							<Icon name="trash" size={13} />
						</button>
					</>
				)}
			</div>
		</div>
	);
}

/* ── Thread panel ─────────────────────────────────────────────── */
function ThreadPanel({ parentMsg, currentUser, onClose }) {
	const [replies, setReplies] = useState([]);
	const [input, setInput] = useState("");
	const { workspaceId } = useParams();
	const accessToken = useAuthStore((s) => s.accessToken);
	const endRef = useRef(null);

	useEffect(() => {
		if (!parentMsg) return;
		api.get(`/workspaces/${workspaceId}/messages?threadId=${parentMsg._id}&limit=100`)
			.then((res) => {
				setReplies(res.data.messages);
				setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
			})
			.catch((err) => console.error("Failed to load thread replies:", err));
	}, [parentMsg?._id, workspaceId]);

	const send = () => {
		const content = input.trim();
		if (!content) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("chat:send", { workspaceId, content, threadId: parentMsg._id });
		setInput("");
	};

	const handleKey = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	useEffect(() => {
		const socket = getSocket(accessToken);
		if (!socket || !parentMsg) return;
		const handle = ({ message }) => {
			if (message.threadId === parentMsg._id) {
				setReplies((prev) => [...prev, message]);
				setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
			}
		};
		socket.on("chat:message", handle);
		return () => socket.off("chat:message", handle);
	}, [accessToken, parentMsg?._id]);

	if (!parentMsg) return null;

	return (
		<div className="chat-thread-panel">
			<div className="chat-thread-header">
				<span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Thread</span>
				<button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
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
	);
}

/* ── Typing dots ──────────────────────────────────────────────── */
function TypingDots({ names }) {
	if (!names.length) return null;
	return (
		<div style={{ padding: "2px 20px 6px", display: "flex", alignItems: "center", gap: 8 }}>
			<div className="typing-dots">
				<span />
				<span />
				<span />
			</div>
			<span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
				{names.join(", ")} {names.length === 1 ? "is" : "are"} typing…
			</span>
		</div>
	);
}

/* ── Main page ────────────────────────────────────────────────── */
export default function ChatPage() {
	const { workspaceId } = useParams();
	const accessToken = useAuthStore((s) => s.accessToken);
	const currentUser = useAuthStore((s) => s.user);
	const toast = useToast();

	const [messages, setMessages] = useState([]);
	const [hasMore, setHasMore] = useState(false);
	const [nextCursor, setNextCursor] = useState(null);
	const [input, setInput] = useState("");
	const [status, setStatus] = useState("loading");
	const [typingUsers, setTypingUsers] = useState({});
	const [loadingMore, setLoadingMore] = useState(false);
	const [threadMsg, setThreadMsg] = useState(null);

	const messagesEndRef = useRef(null);
	const typingTimers = useRef({});
	const isFirstLoad = useRef(true);
	const inputRef = useRef(null);

	/* Load messages */
	useEffect(() => {
		if (!workspaceId) return;
		let active = true;
		api
			.get(`/workspaces/${workspaceId}/messages?limit=60`)
			.then(({ data }) => {
				if (!active) return;
				setMessages(data.messages);
				setHasMore(data.hasMore);
				setNextCursor(data.nextCursor);
				setStatus("ready");
			})
			.catch(() => {
				if (active) setStatus("error");
			});
		return () => {
			active = false;
		};
	}, [workspaceId]);

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
			if (message.threadId) return; // thread replies handled in ThreadPanel
			setMessages((prev) => [...prev, message]);
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

		socket.on("chat:message", handleMessage);
		socket.on("chat:reaction_updated", handleReaction);
		socket.on("chat:deleted", handleDeleted);
		socket.on("chat:edited", handleEdited);
		socket.on("chat:typing", handleTyping);
		return () => {
			socket.off("chat:message", handleMessage);
			socket.off("chat:reaction_updated", handleReaction);
			socket.off("chat:deleted", handleDeleted);
			socket.off("chat:edited", handleEdited);
			socket.off("chat:typing", handleTyping);
		};
	}, [workspaceId, accessToken, currentUser]);

	const handleSend = () => {
		const content = input.trim();
		if (!content || !workspaceId || !accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;
		socket.emit("chat:send", { workspaceId, content });
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
				const reactions = [...(m.reactions || [])];
				const idx = reactions.findIndex((r) => r.emoji === emoji);
				const uid = currentUser?._id;
				if (idx >= 0) {
					const users = reactions[idx].users || [];
					if (users.includes(uid)) {
						reactions[idx] = { ...reactions[idx], users: users.filter((u) => u !== uid) };
						if (!reactions[idx].users.length) reactions.splice(idx, 1);
					} else {
						reactions[idx] = { ...reactions[idx], users: [...users, uid] };
					}
				} else {
					reactions.push({ emoji, users: [uid] });
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
			const { data } = await api.get(`/workspaces/${workspaceId}/messages?limit=60&before=${nextCursor}`);
			setMessages((prev) => [...data.messages, ...prev]);
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

	return (
		<div className="chat-layout fade-in">
			{/* Main chat area */}
			<div className="chat-main">
				{/* Header */}
				<div className="chat-header">
					<div className="chat-header-left">
						<span style={{ fontSize: 18, color: "var(--text-muted)" }}>#</span>
						<div>
							<div className="chat-header-name">general</div>
							<div className="chat-header-desc">All workspace members</div>
						</div>
					</div>
					<div className="chat-header-right">
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
							<div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
							<span style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>Live</span>
						</div>
					</div>
				</div>

				<div style={{ padding: "8px 20px", background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
					<span style={{ color: "var(--accent)" }}>📌</span>
					<span style={{ fontWeight: 600, color: "var(--text-primary)" }}>1 pinned message</span>
					<button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 6px", height: 22 }}>View</button>
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
								<div className="empty-state">
									<div className="icon-box icon-box-accent empty-state-icon">
										<Icon name="chat" size={24} />
									</div>
									<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
										No messages yet
									</p>
									<p>Be the first to say hello! 👋</p>
								</div>
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
										/>
									))}
								</div>
							))}

							<div ref={messagesEndRef} />
						</>
					)}
				</div>

				{/* Typing indicator */}
				<TypingDots names={typingNames} />

				{/* Input */}
				<div className="chat-input-area">
					<div className="chat-input-box">
						<textarea
							ref={inputRef}
							id="chat-input"
							className="chat-input-textarea"
							value={input}
							onChange={handleInputChange}
							onKeyDown={handleKey}
							rows={1}
							placeholder="Message #general..."
						/>
						<div className="chat-input-footer">
							<span className="chat-input-hint">Enter to send · Shift+Enter for new line</span>
							<button
								type="button"
								onClick={handleSend}
								disabled={!input.trim()}
								aria-label="Send message"
								style={{
									width: 30,
									height: 30,
									borderRadius: "var(--r-md)",
									background: input.trim() ? "var(--accent)" : "var(--bg-surface-3)",
									border: "none",
									cursor: input.trim() ? "pointer" : "not-allowed",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#fff",
									transition: "all 0.15s",
									flexShrink: 0,
								}}
							>
								<Icon name="send" size={14} />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Thread panel */}
			{threadMsg && <ThreadPanel parentMsg={threadMsg} currentUser={currentUser} onClose={() => setThreadMsg(null)} />}
		</div>
	);
}
