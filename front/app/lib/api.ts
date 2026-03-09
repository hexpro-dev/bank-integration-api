import Client from "./client";
import type { gateway } from "./client";

export const API_URL = typeof window !== "undefined"
  ? (window as any).__ENV__?.VITE_API_URL || "http://localhost:4000"
  : process.env.VITE_API_URL || "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export const client = new Client(API_URL, {
  auth(): gateway.AuthParams | undefined {
    const token = getToken();
    if (!token) return undefined;
    return { authorization: `Bearer ${token}` };
  },
  async fetcher(input, init) {
    const response = await fetch(input, init);
    if (response.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return response;
  },
});
