import { Link } from "react-router-dom";

export default function LandingPage() {
	return (
		<div className="mx-auto mt-20 w-full max-w-xl rounded-3xl border border-ghost-white-200 bg-white/90 p-10 shadow-xl">
			<h1 className="text-4xl font-semibold tracking-tight text-jet-black-900 font-display">CollabBoard</h1>
			<p className="mt-3 text-sm text-jet-black-600">Real-time collaboration for tasks, whiteboards, and team chat.</p>
			<div className="mt-6 flex flex-wrap gap-3">
				<Link
					to="/login"
					className="inline-flex items-center justify-center rounded-xl bg-space-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-space-indigo-600"
				>
					Log in
				</Link>
				<Link
					to="/register"
					className="inline-flex items-center justify-center rounded-xl border border-ghost-white-200 bg-white px-4 py-2 text-sm font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
				>
					Create account
				</Link>
			</div>
		</div>
	);
}
