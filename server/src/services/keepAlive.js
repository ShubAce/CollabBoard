// Render's free tier spins a web service down after ~15 min without inbound HTTP.
// Pinging our own public URL goes back in through Render's proxy, so it counts as
// traffic. This only keeps an awake instance awake — it cannot wake a sleeping one;
// the GitHub Actions workflow (.github/workflows/keep-render-awake.yml) covers that.

const INTERVAL_MS = 10 * 60 * 1000;

export const startKeepAlive = () => {
	// Render sets RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL overrides it.
	const baseUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
	if (!baseUrl || process.env.KEEP_ALIVE === "false") return null;

	const url = `${baseUrl.replace(/\/$/, "")}/health`;
	const ping = async () => {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
			if (!res.ok) console.warn(`[keep-alive] ${url} -> ${res.status}`);
		} catch (err) {
			console.warn(`[keep-alive] ping failed: ${err.message}`);
		}
	};

	const timer = setInterval(ping, INTERVAL_MS);
	timer.unref(); // never keep the process alive just for this timer
	console.log(`[keep-alive] pinging ${url} every ${INTERVAL_MS / 60000} min`);
	return timer;
};
