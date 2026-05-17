import { Link } from "react-router-dom";

export default function LandingPage() {
	return (
		<div className="mx-auto mt-20 w-full max-w-xl rounded-3xl border border-amber-100 bg-white/90 p-10 shadow-xl">
			<h1 className="text-4xl font-semibold tracking-tight text-slate-900 font-['Fraunces']">CollabBoard</h1>
			<p className="mt-3 text-sm text-slate-600">Real-time collaboration for tasks, whiteboards, and team chat.</p>
			<div className="mt-6 flex flex-wrap gap-3">
				<Link
					to="/login"
					className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
				>
					Log in
				</Link>
				<Link
					to="/register"
					className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
				>
					Create account
				</Link>
			</div>
		</div>
	);
}
