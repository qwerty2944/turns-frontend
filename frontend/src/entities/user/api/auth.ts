import { apiClient } from "@/shared/api/axios";
import type { User } from "../model/types";

type AuthResponse = { token: string; user: User };

export const authApi = {
  signup: (body: {
    email: string;
    password: string;
    passwordConfirm: string;
    nickname?: string;
  }) =>
    apiClient
      .post<AuthResponse>("/auth/signup", body)
      .then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    apiClient
      .post<AuthResponse>("/auth/login", body)
      .then((r) => r.data),

  me: () =>
    apiClient.get<{ user: User }>("/auth/me").then((r) => r.data.user),

  updateNickname: (nickname: string) =>
    apiClient
      .patch<AuthResponse>("/auth/me/nickname", { nickname })
      .then((r) => r.data),

  updatePassword: (currentPassword: string, newPassword: string) =>
    apiClient
      .patch<{ ok: true }>("/auth/me/password", {
        currentPassword,
        newPassword,
      })
      .then((r) => r.data),
};
