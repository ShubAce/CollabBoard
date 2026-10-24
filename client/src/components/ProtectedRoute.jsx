import { Navigate, Outlet } from "react-router-dom";
import useAuthStore from "../store/authStore";
import BootLoader from "./BootLoader.jsx";

export default function ProtectedRoute() {
	const accessToken = useAuthStore((state) => state.accessToken);
	const isHydrating = useAuthStore((state) => state.isHydrating);
	if (isHydrating) {
		return <BootLoader label="Checking your session…" />;
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
