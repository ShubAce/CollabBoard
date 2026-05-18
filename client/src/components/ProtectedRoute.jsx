import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function ProtectedRoute() {
	const accessToken = useAuthStore((state) => state.accessToken);
	const isHydrating = useAuthStore((state) => state.isHydrating);
	if (isHydrating) {
		return (
			<div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
				<div className="page-panel fade-in" style={{ width: "100%", maxWidth: 420, padding: 24, textAlign: "center" }}>
					<span className="spinner" style={{ marginBottom: 12 }} />
					<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Checking your session...</p>
				</div>
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
