import { Link } from "react-router-dom";

export default function NotFoundPage() {
	return (
		<div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-amber-100 bg-white/90 p-8 text-center shadow-lg">
			<h1 className="text-2xl font-semibold text-slate-900 font-['Fraunces']">Page not found</h1>
			<p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist.</p>
			<Link
				to="/"
				className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Go back home
			</Link>
		</div>
	);
}
