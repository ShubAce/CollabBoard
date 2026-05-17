import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { getSocket } from "../socket";
import useAuthStore from "../store/authStore";

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

	// Load initial messages
	useEffect(() => {
		if (!workspaceId) return;
		let isActive = true;
		const load = async () => {
			try {
				const { data } = await api.get(`/workspaces/${workspaceId}/messages?limit=50`);
				if (!isActive) return;
				setMessages(data.messages);
				setHasMore(data.hasMore);
				setNextCursor(data.nextCursor);
				setStatus("ready");
			} catch {
				if (isActive) setStatus("error");
			}
		};
		load();
		return () => {
			isActive = false;
		};
	}, [workspaceId]);

	// Auto-scroll to bottom on new message (first load)
	useEffect(() => {
		if (status === "ready" && isFirstLoad.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
			isFirstLoad.current = false;
		}
	}, [status]);

	// Socket: real-time message + typing
	useEffect(() => {
		if (!workspaceId || !accessToken) return;
		const socket = getSocket(accessToken);
		if (!socket) return;

		socket.emit("join:workspace", { workspaceId });

		const handleMessage = ({ message }) => {
			setMessages((prev) => [...prev, message]);
			// Scroll to bottom if already near it
			setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
			// Auto-clear after 3s of silence
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
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const loadMore = async () => {
		if (!hasMore || loadingMore || !nextCursor) return;
		setLoadingMore(true);
		try {
			const { data } = await api.get(`/workspaces/${workspaceId}/messages?limit=50&before=${nextCursor}`);
			setMessages((prev) => [...data.messages, ...prev]);
			setHasMore(data.hasMore);
			setNextCursor(data.nextCursor);
		} catch {
			// ignore
		} finally {
			setLoadingMore(false);
		}
	};

	const typingNames = Object.values(typingUsers);

	// Group messages by date
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
		<section className="flex h-[calc(100vh-120px)] flex-col rounded-2xl border border-ghost-white-200 bg-white/90 shadow-sm overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-ghost-white-200 px-6 py-4">
				<div>
					<h2 className="text-lg font-semibold text-jet-black-900 font-display">Workspace Chat</h2>
					<p className="text-xs text-jet-black-500 mt-0.5">Messages are visible to all workspace members</p>
				</div>
				<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
					Live
				</span>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
				{status === "loading" && (
					<p className="text-sm text-jet-black-400 text-center pt-8">Loading messages...</p>
				)}
				{status === "error" && (
					<p className="text-sm text-red-500 text-center pt-8">Failed to load messages.</p>
				)}
				{status === "ready" && (
					<>
						{hasMore && (
							<div className="flex justify-center mb-4">
								<button
									type="button"
									onClick={loadMore}
									disabled={loadingMore}
									className="rounded-lg border border-ghost-white-200 px-4 py-1.5 text-xs font-semibold text-jet-black-600 hover:bg-ghost-white-100 transition disabled:opacity-50"
								>
									{loadingMore ? "Loading..." : "Load older messages"}
								</button>
							</div>
						)}
						{messages.length === 0 && (
							<p className="text-sm text-jet-black-400 text-center pt-16">No messages yet. Say hello! 👋</p>
						)}
						{grouped.map((group) => (
							<div key={group.date}>
								<div className="flex items-center gap-3 my-4">
									<div className="flex-1 h-px bg-ghost-white-200" />
									<span className="text-[11px] font-semibold text-jet-black-400">{group.date}</span>
									<div className="flex-1 h-px bg-ghost-white-200" />
								</div>
								{group.items.map((msg) => {
									const isOwn = msg.sender?._id === currentUser?._id;
									return (
										<div
											key={msg._id}
											className={`flex items-end gap-2.5 mb-3 ${isOwn ? "flex-row-reverse" : ""}`}
										>
											{/* Avatar */}
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ghost-white-200 text-xs font-semibold text-jet-black-700 overflow-hidden">
												{msg.sender?.avatar ? (
													<img
														src={msg.sender.avatar}
														alt={msg.sender.name}
														className="h-full w-full object-cover"
													/>
												) : (
													(msg.sender?.name || "?").slice(0, 1).toUpperCase()
												)}
											</div>
											{/* Bubble */}
											<div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
												{!isOwn && (
													<span className="mb-0.5 text-[11px] font-semibold text-jet-black-500">
														{msg.sender?.name}
													</span>
												)}
												<div
													className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
														isOwn
															? "rounded-br-sm bg-space-indigo-500 text-white"
															: "rounded-bl-sm bg-ghost-white-100 text-jet-black-900"
													}`}
												>
													{msg.content}
												</div>
												<span className="mt-0.5 text-[10px] text-jet-black-400">
													{formatTime(msg.createdAt)}
												</span>
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
			<div className="min-h-[22px] px-6">
				{typingNames.length > 0 && (
					<p className="text-xs text-jet-black-400 italic">
						{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
						<span className="ml-1 inline-flex gap-0.5">
							<span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
							<span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
							<span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
						</span>
					</p>
				)}
			</div>

			{/* Input */}
			<div className="border-t border-ghost-white-200 px-4 py-3">
				<div className="flex items-end gap-3 rounded-xl border border-ghost-white-200 bg-ghost-white-50 px-4 py-2.5 focus-within:border-space-indigo-400 transition">
					<textarea
						id="chat-input"
						value={input}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						rows={1}
						placeholder="Type a message... (Enter to send)"
						className="flex-1 resize-none bg-transparent text-sm text-jet-black-900 placeholder-jet-black-400 outline-none"
						style={{ maxHeight: "120px" }}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim()}
						className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-space-indigo-500 text-white transition hover:bg-space-indigo-600 disabled:opacity-40"
						aria-label="Send message"
					>
						<svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
							<path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.89H10.5a.75.75 0 010 1.5H4.182l-1.903 6.89a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
						</svg>
					</button>
				</div>
			</div>
		</section>
	);
}
