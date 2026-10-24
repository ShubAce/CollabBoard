// Loads .env and sanitizes values that are easy to paste wrong. Import this FIRST in
// every entry point (server.js and the workers) — before anything that reads Redis config.
import "dotenv/config";

const hostOf = (url) => url.replace(/^rediss?:\/\/[^@]*@/, "").split("/")[0];

/**
 * Upstash's dashboard shows the connection as a CLI command
 * (`redis-cli --tls -u redis://default:<pw>@<host>:6379`). Pasting that whole line into
 * REDIS_URL crashes every Redis client, and a `redis://` URL to Upstash fails because
 * Upstash requires TLS. Extract the URL and upgrade it to `rediss://` when TLS is needed.
 */
const normalizeRedisUrl = (raw) => {
	const trimmed = raw.trim().replace(/^["']|["']$/g, "");
	const match = trimmed.match(/rediss?:\/\/\S+/);
	if (!match) {
		throw new Error("REDIS_URL is not a redis URL. Use the form rediss://default:<password>@<host>:6379 (no `redis-cli` prefix).");
	}
	let url = match[0];
	const needsTls = /(^|\s)--tls(\s|$)/.test(trimmed) || /\.upstash\.io(:\d+)?$/.test(hostOf(url));
	if (needsTls && url.startsWith("redis://")) url = `rediss://${url.slice("redis://".length)}`;
	if (url !== raw) {
		// Never log the password — host only.
		console.warn(`[env] REDIS_URL was normalized to a ${url.split(":")[0]}:// URL for ${hostOf(url)}. Set it to exactly that to silence this warning.`);
	}
	return url;
};

if (process.env.REDIS_URL) {
	process.env.REDIS_URL = normalizeRedisUrl(process.env.REDIS_URL);
}
