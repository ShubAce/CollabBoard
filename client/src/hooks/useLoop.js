import { useEffect, useState } from "react";

/** Cycles 0..length-1 every `interval` ms, but only while `active` (e.g. in view). */
export default function useLoop(active, length, interval) {
	const [index, setIndex] = useState(0);
	useEffect(() => {
		if (!active) return undefined;
		const id = window.setInterval(() => setIndex((i) => (i + 1) % length), interval);
		return () => window.clearInterval(id);
	}, [active, length, interval]);
	return index;
}
