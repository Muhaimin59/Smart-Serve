/* SmartServe API client - token storage, fetch wrapper, uploads. */

const TOKEN_KEY = "ss-token";
const USER_KEY = "ss-user";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setSession(token: string, user: unknown): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode */
  }
}
export function getStoredUser(): any {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

export async function api<T = any>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? (res.status === 401 ? "Please log in again." : "Request failed.");
    throw new ApiError(res.status, json?.error?.code ?? "error", message);
  }
  return (json ?? {}) as T;
}

export const get = <T = any>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T = any>(path: string, body?: unknown, signal?: AbortSignal) => api<T>(path, { method: "POST", body, signal });
export const put = <T = any>(path: string, body?: unknown, signal?: AbortSignal) => api<T>(path, { method: "PUT", body, signal });
export const patch = <T = any>(path: string, body?: unknown, signal?: AbortSignal) => api<T>(path, { method: "PATCH", body, signal });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });

/** Read a File into a data URL (validated server-side too). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File, purpose: string): Promise<string> {
  const data = await fileToDataUrl(file);
  const res = await post<{ url: string }>("/uploads", { data, purpose });
  return res.url;
}
