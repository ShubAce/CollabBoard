import { create } from "zustand";

const useAuthStore = create((set) => ({
	user: null,
	accessToken: null,
	setAuth: (user, accessToken) => set({ user, accessToken }),
	clearAuth: () => set({ user: null, accessToken: null }),
}));

export default useAuthStore;