import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BootLoader from "../components/BootLoader.jsx";
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

	return <BootLoader label="Signing you in…" />;
}
