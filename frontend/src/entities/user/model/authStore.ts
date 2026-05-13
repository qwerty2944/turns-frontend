import { create } from "zustand";
import { storage } from "@/shared/lib/storage";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  hydrate: () => void;
  setSession: (token: string, user: User) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  hydrate: () => {
    const token = storage.getToken();
    const user = storage.getUser<User>();
    set({ token, user, hydrated: true });
  },
  setSession: (token, user) => {
    storage.setToken(token);
    storage.setUser(user);
    set({ token, user });
  },
  clear: () => {
    storage.clear();
    set({ token: null, user: null });
  },
}));
