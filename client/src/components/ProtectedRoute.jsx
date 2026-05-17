import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function ProtectedRoute() {
	const accessToken = useAuthStore((state) => state.accessToken);
	const isHydrating = useAuthStore((state) => state.isHydrating);
	if (isHydrating) {
		return (
			<div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-amber-100 bg-white/90 p-6 text-center text-sm text-slate-600 shadow-lg">
				Checking your session...
			</div>
		);
	}
	if (!accessToken) {
		return (
			<Navigate
				to="/login"
				replace
			/>
		);
	}
	return <Outlet />;
}
