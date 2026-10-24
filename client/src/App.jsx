import { lazy, Suspense, useEffect } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import api, { refreshSession } from "./api/axios";
import BootLoader from "./components/BootLoader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import useAuthStore from "./store/authStore";

// Everything past the landing page is code-split so first paint stays light.
const AppShell = lazy(() => import("./pages/AppShell.jsx"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage.jsx"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage.jsx"));
const BoardList = lazy(() => import("./pages/BoardList.jsx"));
const BoardPage = lazy(() => import("./pages/BoardPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const CreateWorkspace = lazy(() => import("./pages/CreateWorkspace.jsx"));
const InviteAcceptPage = lazy(() => import("./pages/InviteAcceptPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const MyWorkPage = lazy(() => import("./pages/MyWorkPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const WorkspaceDashboard = lazy(() => import("./pages/WorkspaceDashboard.jsx"));
const WorkspaceList = lazy(() => import("./pages/WorkspaceList.jsx"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings.jsx"));

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
		<div className="min-h-screen bg-base text-primary font-sans">
			<Suspense fallback={<BootLoader />}>
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
					<Route
						path="/invite/accept"
						element={<InviteAcceptPage />}
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
								path="workspaces/:workspaceId/activity"
								element={<ActivityLogPage />}
							/>
							<Route
								path="workspaces/:workspaceId/chat"
								element={<ChatPage />}
							/>
							<Route
								path="workspaces/:workspaceId/settings"
								element={<WorkspaceSettings />}
							/>
							<Route
								path="my-work"
								element={<MyWorkPage />}
							/>
							<Route
								path="notifications"
								element={<NotificationsPage />}
							/>
							<Route
								path="profile"
								element={<ProfilePage />}
							/>
						</Route>
					</Route>
					<Route
						path="*"
						element={<NotFoundPage />}
					/>
				</Routes>
			</Suspense>
		</div>
	);
}

export default App;
