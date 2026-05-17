import { Link, Outlet, useNavigate } from "react-router-dom";
import api from "../api/axios";
import useAuthStore from "../store/authStore";

export default function AppShell() {
	const navigate = useNavigate();
	const user = useAuthStore((state) => state.user);
	const clearAuth = useAuthStore((state) => state.clearAuth);

	const handleLogout = async () => {
		try {
			await api.post("/auth/logout");
		} finally {
			clearAuth();
			navigate("/login");
		}
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-6 py-8">
			<header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-white/90 p-6 shadow-sm">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-slate-900 font-['Fraunces']">CollabBoard</h1>
					<p className="text-sm text-slate-500">{user ? `Signed in as ${user.name}` : "Signed in"}</p>
				</div>
				<nav className="flex gap-2 text-sm font-medium">
					<Link
						to="/app/workspaces"
						className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-slate-700 transition hover:bg-amber-100"
					>
						Workspaces
					</Link>
				</nav>
				<button
					type="button"
					onClick={handleLogout}
					className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
				>
					Log out
				</button>
			</header>
			<main className="mt-6 grid gap-6">
				<Outlet />
			</main>
		</div>
	);
}
