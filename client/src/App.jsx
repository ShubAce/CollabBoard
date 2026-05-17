import { useEffect } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import api, { refreshSession } from "./api/axios";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./pages/AppShell.jsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.jsx";
import BoardList from "./pages/BoardList.jsx";
import BoardPage from "./pages/BoardPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import CreateWorkspace from "./pages/CreateWorkspace.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import WorkspaceDashboard from "./pages/WorkspaceDashboard.jsx";
import WorkspaceList from "./pages/WorkspaceList.jsx";
import useAuthStore from "./store/authStore";

function App() {
	const accessToken = useAuthStore((state) => state.accessToken);
	const user = useAuthStore((state) => state.user);
	const setAuth = useAuthStore((state) => state.setAuth);
	const clearAuth = useAuthStore((state) => state.clearAuth);
	const setHydrating = useAuthStore((state) => state.setHydrating);

	useEffect(() => {
		let isActive = true;
		const hydrate = async () => {
			if (accessToken && user) {
				setHydrating(false);
				return;
			}
			if (accessToken && !user) {
				try {
					const { data: me } = await api.get("/users/me", {
						headers: { Authorization: `Bearer ${accessToken}` },
					});
					if (isActive) setAuth(me, accessToken);
				} catch {
					if (isActive) clearAuth();
				} finally {
					if (isActive) setHydrating(false);
				}
				return;
			}
			try {
				const { accessToken: newToken } = await refreshSession();
				if (!newToken) {
					if (isActive) clearAuth();
					return;
				}
				const { data: user } = await api.get("/users/me", {
					headers: { Authorization: `Bearer ${newToken}` },
				});
				if (isActive) setAuth(user, newToken);
			} catch {
				if (isActive) clearAuth();
			} finally {
				if (isActive) setHydrating(false);
			}
		};

		hydrate();
		return () => {
			isActive = false;
		};
	}, [accessToken, clearAuth, setAuth, setHydrating, user]);

	return (
		<div className="min-h-screen bg-linear-to-b from-ghost-white-50 via-ghost-white-100 to-space-indigo-50 text-jet-black-900 font-sans">
			<Routes>
				<Route
					path="/"
					element={<LandingPage />}
				/>
				<Route
					path="/login"
					element={<LoginPage />}
				/>
				<Route
					path="/register"
					element={<RegisterPage />}
				/>
				<Route
					path="/auth/callback"
					element={<AuthCallbackPage />}
				/>
				<Route element={<ProtectedRoute />}>
					<Route
						path="/app"
						element={<AppShell />}
					>
						<Route
							index
							element={
								<Navigate
									to="workspaces"
									replace
								/>
							}
						/>
						<Route
							path="workspaces"
							element={<WorkspaceList />}
						/>
						<Route
							path="workspaces/new"
							element={<CreateWorkspace />}
						/>
						<Route
							path="workspaces/:workspaceId"
							element={<WorkspaceDashboard />}
						/>
						<Route
							path="workspaces/:workspaceId/boards"
							element={<BoardList />}
						/>
						<Route
							path="workspaces/:workspaceId/boards/:boardId"
							element={<BoardPage />}
						/>
						<Route
							path="workspaces/:workspaceId/chat"
							element={<ChatPage />}
						/>
						<Route
							path="notifications"
							element={<NotificationsPage />}
						/>
					</Route>
				</Route>
				<Route
					path="*"
					element={<NotFoundPage />}
				/>
			</Routes>
		</div>
	);
}

export default App;
