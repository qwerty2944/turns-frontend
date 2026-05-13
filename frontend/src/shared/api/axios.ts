import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { storage } from "../lib/storage";

export const apiClient = axios.create({
  baseURL: env.backendUrl,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const extractApiError = (e: unknown): string => {
  if (e instanceof AxiosError) {
    const data = e.response?.data as { error?: string } | undefined;
    return data?.error || e.message;
  }
  if (e instanceof Error) return e.message;
  return "알 수 없는 오류";
};
