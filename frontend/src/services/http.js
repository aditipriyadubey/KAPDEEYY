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

/**
 * Turn an Axios failure into something a person can act on. Axios reports a
 * blocked/unreachable backend as a bare "Network Error", which previously
 * reached the UI and told the user nothing.
 */
export function friendlyError(err, fallback = "Something went wrong. Please try again.") {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 413) return "That image is larger than 10 MB. Try a smaller photo.";
  if (status === 415) return "Use a JPG, PNG or WebP photo.";
  if (status === 503) return detail || "A required service is unavailable. Please try again shortly.";
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;

  const code = err?.code || "";
  if (code === "ERR_NETWORK" || /network error/i.test(err?.message || "")) {
    return "Can't reach the server. Check that the backend is running, then try again.";
  }
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
    return "The request took too long. Please try again.";
  }
  return err?.message || fallback;
}
