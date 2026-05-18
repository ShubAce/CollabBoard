import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

const WS_COLORS = ["#6C63FF", "#60A5FA", "#34D399", "#F87171", "#FBBF24", "#A78BFA", "#FB923C", "#F472B6"];
function getInitials(name = "") { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }
function getColor(name = "") {
	let h = 0;
	for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
	return WS_COLORS[Math.abs(h) % WS_COLORS.length];
}

const formatTime = (iso) => {
	const d = new Date(iso);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const formatDate = (iso) => {
	const d = new Date(iso);
	const today = new Date();
	if (d.toDateString() === today.toDateString()) return "Today";
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

function TypingDots({ names }) {
	if (!names.length) return null;
	return (
		<div style={{ padding: "4px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
			<div className="typing-dots">
				<span /><span /><span />
			</div>
			<span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
				{names.join(", ")} {names.length === 1 ? "is" : "are"} typing
			</span>
		</div>
	);
}

export default function ChatPage() {
	const { workspaceId } = useParams();
	const accessToken = useAuthStore((s) => s.accessToken);
	const currentUser = useAuthStore((s) => s.user);

	const [messages, setMessages] = useState([]);
	const [hasMore, setHasMore] = useState(false);
	const [nextCursor, setNextCursor] = useState(null);
	const [input, setInput] = useState("");
	const [status, setStatus] = useState("loading");
	const [typingUsers, setTypingUsers] = useState({});
	const [loadingMore, setLoadingMore] = useState(false);

	const messagesEndRef = useRef(null);
	const typingTimers = useRef({});
	const isFirstLoad = useRef(true);
	const inputRef = useRef(null);

	useEffect(() => {
		if (!workspaceId) return;
		let active = true;
		api
			.get(`/workspaces/${workspaceId}/messages?limit=50`)
			.then(({ data }) => {
				if (!active) return;
				setMessages(data.messages);
				setHasMore(data.hasMore);
				setNextCursor(data.nextCursor);
				setStatus("ready");
			})
			.catch(() => { if (active) setStatus("error"); });
		return () => { active = false; };
	}, [workspaceId]);

	useEffect(() => {
		if (status === "ready" && isFirstLoad.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
			isFirstLoad.current = false;
		}
	}, [status]);

	useEffect(() => {
		if (!workspaceId || !accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;

		socket.emit("join:workspace", { workspaceId });

		const handleMessage = ({ message }) => {
			setMessages((prev) => [...prev, message]);
			setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
		};

		const handleTyping = ({ userId, name, isTyping }) => {
			if (userId === currentUser?._id) return;
			setTypingUsers((prev) => {
				if (!isTyping) { const next = { ...prev }; delete next[userId]; return next; }
				return { ...prev, [userId]: name };
			});
			clearTimeout(typingTimers.current[userId]);
			if (isTyping) {
				typingTimers.current[userId] = setTimeout(() => {
					setTypingUsers((prev) => { const next = { ...prev }; delete next[userId]; return next; });
				}, 3000);
			}
		};

		socket.on("chat:message", handleMessage);
		socket.on("chat:typing", handleTyping);
		return () => {
			socket.off("chat:message", handleMessage);
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

	const handleKeyDown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
	};

	const loadMore = async () => {
		if (!hasMore || loadingMore || !nextCursor) return;
		setLoadingMore(true);
		try {
			const { data } = await api.get(`/workspaces/${workspaceId}/messages?limit=50&before=${nextCursor}`);
			setMessages((prev) => [...data.messages, ...prev]);
			setHasMore(data.hasMore);
			setNextCursor(data.nextCursor);
		} catch {/* ignore */}
		finally { setLoadingMore(false); }
	};

	const typingNames = Object.values(typingUsers);

	const grouped = messages.reduce((acc, msg) => {
		const dateLabel = formatDate(msg.createdAt);
		if (!acc.length || acc[acc.length - 1].date !== dateLabel) {
			acc.push({ date: dateLabel, items: [msg] });
		} else {
			acc[acc.length - 1].items.push(msg);
		}
		return acc;
	}, []);

	return (
		<div
			className="fade-in"
			style={{
				display: "flex",
				flexDirection: "column",
				height: "calc(100vh - 56px - 48px)", // topbar + content padding
				background: "var(--bg-surface)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius-lg)",
				overflow: "hidden",
			}}
		>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
				<div>
					<h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>💬 Workspace Chat</h1>
					<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>All messages visible to workspace members</p>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--success-muted)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "var(--radius-full)", padding: "3px 10px" }}>
					<div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
					<span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>Live</span>
				</div>
			</div>

			{/* Messages area */}
			<div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
				{status === "loading" && (
					<div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
						{[1, 2, 3].map((i) => (
							<div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
								<div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
								<div className="skeleton" style={{ height: 44, width: `${120 + i * 60}px`, borderRadius: "var(--radius-lg)" }} />
							</div>
						))}
					</div>
				)}
				{status === "error" && (
					<p style={{ textAlign: "center", color: "var(--danger)", fontSize: 14, paddingTop: 32 }}>Failed to load messages.</p>
				)}
				{status === "ready" && (
					<>
						{hasMore && (
							<div style={{ textAlign: "center", marginBottom: 16 }}>
								<button type="button" onClick={loadMore} disabled={loadingMore} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
									{loadingMore ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Loading...</> : "↑ Load older messages"}
								</button>
							</div>
						)}
						{messages.length === 0 && (
							<div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-secondary)" }}>
								<div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
								<p style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No messages yet</p>
								<p style={{ fontSize: 13 }}>Be the first to say hello!</p>
							</div>
						)}
						{grouped.map((group) => (
							<div key={group.date}>
								{/* Date separator */}
								<div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 12px" }}>
									<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
									<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg-surface)", padding: "0 8px" }}>{group.date}</span>
									<div style={{ flex: 1, height: 1, background: "var(--border)" }} />
								</div>

								{group.items.map((msg) => {
									const isOwn = msg.sender?._id === currentUser?._id;
									const avatarColor = getColor(msg.sender?.name || "");
									return (
										<div
											key={msg._id}
											style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10, flexDirection: isOwn ? "row-reverse" : "row" }}
										>
											{/* Avatar */}
											<div style={{ width: 30, height: 30, borderRadius: "50%", background: msg.sender?.avatar ? "transparent" : avatarColor, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", overflow: "hidden" }}>
												{msg.sender?.avatar ? (
													<img src={msg.sender.avatar} alt={msg.sender.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
												) : getInitials(msg.sender?.name || "?")}
											</div>

											{/* Bubble */}
											<div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
												{!isOwn && (
													<span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 3 }}>
														{msg.sender?.name || "Unknown"}
													</span>
												)}
												<div style={{
													background: isOwn ? "var(--accent)" : "var(--bg-surface-2)",
													color: isOwn ? "#fff" : "var(--text-primary)",
													padding: "9px 14px",
													borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
													fontSize: 14,
													lineHeight: 1.5,
													wordBreak: "break-word",
												}}>
													{msg.content}
												</div>
												<span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{formatTime(msg.createdAt)}</span>
											</div>
										</div>
									);
								})}
							</div>
						))}
						<div ref={messagesEndRef} />
					</>
				)}
			</div>

			{/* Typing indicator */}
			<TypingDots names={typingNames} />

			{/* Input */}
			<div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
				<div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "var(--bg-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "8px 8px 8px 14px", transition: "border-color 0.15s" }}
					onFocusCapture={(e) => e.currentTarget.style.borderColor = "var(--border-focus)"}
					onBlurCapture={(e) => e.currentTarget.style.borderColor = "var(--border)"}
				>
					<textarea
						ref={inputRef}
						id="chat-input"
						value={input}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						rows={1}
						placeholder="Type a message... (Enter to send)"
						style={{
							flex: 1,
							resize: "none",
							background: "transparent",
							border: "none",
							outline: "none",
							fontSize: 14,
							color: "var(--text-primary)",
							fontFamily: "inherit",
							maxHeight: 120,
							lineHeight: 1.5,
							padding: 0,
						}}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim()}
						aria-label="Send message"
						style={{
							width: 34,
							height: 34,
							borderRadius: "var(--radius-md)",
							background: input.trim() ? "var(--accent)" : "var(--bg-surface-3)",
							border: "none",
							cursor: input.trim() ? "pointer" : "not-allowed",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#fff",
							fontSize: 16,
							transition: "all 0.15s",
							flexShrink: 0,
						}}
					>
						↑
					</button>
				</div>
				<p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>Enter to send · Shift+Enter for newline</p>
			</div>
		</div>
	);
}
