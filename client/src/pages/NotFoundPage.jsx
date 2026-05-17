import { Link } from "react-router-dom";

export default function NotFoundPage() {
	return (
		<div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-ghost-white-200 bg-white/90 p-8 text-center shadow-lg">
			<h1 className="text-2xl font-semibold text-jet-black-900 font-display">Page not found</h1>
			<p className="mt-2 text-sm text-jet-black-600">The page you are looking for does not exist.</p>
			<Link
				to="/"
				className="mt-4 inline-flex items-center justify-center rounded-xl border border-ghost-white-200 bg-white px-4 py-2 text-sm font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
			>
				Go back home
			</Link>
		</div>
	);
}
