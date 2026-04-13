import { create } from "zustand";

type AuthState = {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: sessionStorage.getItem("token"),
  setToken: (token) => {
    sessionStorage.setItem("token", token);
    set({ token });
  },
  logout: () => {
    sessionStorage.removeItem("token");
    set({ token: null });
  },
}));