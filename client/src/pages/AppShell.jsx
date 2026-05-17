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
			<header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ghost-white-200 bg-white/80 p-6 shadow-sm">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-jet-black-900 font-display">CollabBoard</h1>
					<p className="text-sm text-jet-black-500">{user ? `Signed in as ${user.name}` : "Signed in"}</p>
				</div>
				<nav className="flex gap-2 text-sm font-medium">
					<Link
						to="/app/workspaces"
						className="rounded-xl border border-ghost-white-200 bg-ghost-white-100 px-3 py-2 text-jet-black-700 transition hover:bg-ghost-white-200"
					>
						Workspaces
					</Link>
				</nav>
				<button
					type="button"
					onClick={handleLogout}
					className="rounded-xl border border-ghost-white-200 bg-white px-4 py-2 text-sm font-semibold text-jet-black-700 transition hover:bg-ghost-white-100"
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
