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
		<div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-amber-100 bg-white/90 p-6 text-center text-sm text-slate-600 shadow-lg">
			Signing you in...
		</div>
	);
}
