import axios from "axios";

// Single Axios instance for the FastAPI backend. Not used while
// VITE_USE_MOCK is true (Phase 1). Phase 2 adds the Supabase JWT header.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 60000,
});

let tokenProvider = null;
export function setTokenProvider(fn) {
  tokenProvider = fn;
}

http.interceptors.request.use(async (config) => {
  const token = tokenProvider ? await tokenProvider() : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.detail || err?.message || fallback;
}
