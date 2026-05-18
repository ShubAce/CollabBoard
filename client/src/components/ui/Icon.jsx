const ICONS = {
	activity: "M3 12h4l3-8 4 16 3-8h4",
	alert: "M12 9v4m0 4h.01M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
	arrowLeft: "M19 12H5m7-7-7 7 7 7",
	arrowRight: "M5 12h14m-7-7 7 7-7 7",
	bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
	board: "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 2v10m4-10v10m4-10v10",
	briefcase: "M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1m-9 0h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
	chat: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
	check: "m5 12 4 4L19 6",
	chevronDown: "m6 9 6 6 6-6",
	close: "M18 6 6 18M6 6l12 12",
	edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z",
	eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
	eyeOff: "m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18.2 18.2 0 0 1-2.7 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8c1.2 0 2.3-.2 3.3-.6",
	home: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z",
	lock: "M7 11V8a5 5 0 0 1 10 0v3m-11 0h12v10H6V11Z",
	logOut: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
	mail: "M4 4h16v16H4V4Zm0 3 8 6 8-6",
	menu: "M4 6h16M4 12h16M4 18h16",
	plus: "M12 5v14M5 12h14",
	search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
	send: "M22 2 11 13m11-11-7 20-4-9-9-4 20-7Z",
	settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h0a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1Z",
	spark: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
	user: "M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
	users: "M17 21a5 5 0 0 0-10 0m5-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 9a4 4 0 0 0-3-3.9M17 4.1a4 4 0 0 1 0 7.8",
	whiteboard: "M4 4h16v12H4V4Zm4 16h8m-4-4v4",
};

export default function Icon({ name, size = 18, strokeWidth = 2, className = "", style, title }) {
	const path = ICONS[name] || ICONS.board;
	return (
		<svg
			className={className}
			style={style}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden={title ? undefined : true}
			role={title ? "img" : undefined}
		>
			{title && <title>{title}</title>}
			<path d={path} />
		</svg>
	);
}
