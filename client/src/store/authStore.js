import { create } from "zustand";

const useAuthStore = create((set) => ({
	user: null,
	accessToken: null,
	isHydrating: true,
	setAuth: (user, accessToken) => set({ user, accessToken }),
	clearAuth: () => set({ user: null, accessToken: null }),
	setHydrating: (isHydrating) => set({ isHydrating }),
}));

export default useAuthStore;
