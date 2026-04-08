import { create } from "zustand";

interface Store {
  userId: string;
  setUserId: (id: string) => void;
}

export const useStore = create<Store>((set) => ({
  userId: "",
  setUserId: (id) => set({ userId: id }),
}));