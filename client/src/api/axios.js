import axios from "axios";
import useAuthStore from "../store/authStore";

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, withCredentials: true });
const refreshClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL, withCredentials: true });

export const refreshSession = async () => {
	const { data } = await refreshClient.post("/auth/refresh");
	return data;
};

// Attach access token to every request
api.interceptors.request.use((config) => {
	const token = useAuthStore.getState().accessToken;
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

// Auto-refresh on 401
api.interceptors.response.use(null, async (error) => {
	if (error.response?.status === 401 && error.config && !error.config._retry) {
		error.config._retry = true;
		try {
			const { data } = await refreshClient.post("/auth/refresh");
			useAuthStore.getState().setAuth(useAuthStore.getState().user, data.accessToken);
			error.config.headers.Authorization = `Bearer ${data.accessToken}`;
			return api(error.config);
		} catch (refreshError) {
			useAuthStore.getState().clearAuth();
			return Promise.reject(refreshError);
		}
	}
	return Promise.reject(error);
});

export default api;
