import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      setSession: (user, accessToken) => set({ user, accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
      updateUser: (partialUser) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partialUser } : state.user })),
    }),
    {
      name: "smartbuy-auth",
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
