import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function AuthCallbackPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const setAuth = useAuthStore((state) => state.setAuth);
	const token = searchParams.get("token");

	useEffect(() => {
		if (token) {
			setAuth(null, token);
			navigate("/app");
		} else {
			navigate("/login?error=oauth_missing_token");
		}
	}, [navigate, setAuth, token]);

	return (
		<div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			<div className="page-panel fade-in" style={{ width: "100%", maxWidth: 420, padding: 24, textAlign: "center" }}>
				<span className="spinner" style={{ marginBottom: 12 }} />
				<p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Signing you in...</p>
			</div>
		</div>
	);
}
