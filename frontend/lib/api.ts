// One place that talks to the FastAPI backend.
// Every page uses these functions instead of calling fetch() itself.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'opsguard_token';

/* ---------- login token (saved in the browser) ---------- */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

/* ---------- data shapes (they match the backend responses) ---------- */

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Endpoint {
  id: number;
  user_id: number;
  name: string;
  url: string;
  check_interval: number;
  fast_check_interval: number;
  current_state: string; // UNKNOWN | HEALTHY | SUSPECTED_DOWN | DOWN
  consecutive_failures: number;
  enabled: boolean;
  last_check_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryItem {
  id: number;
  endpoint_id: number;
  checked_at: string;
  is_success: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  error: string | null;
}

export interface Incident {
  id: number;
  endpoint_id: number;
  endpoint_name: string | null;
  started_at: string;
  resolved_at: string | null;
  status: string; // OPEN | RESOLVED
  duration_seconds: number | null;
}

export interface DashboardSummary {
  total_monitored: number;
  healthy: number;
  down: number;
  active_incidents: number;
  total_incidents: number;
  average_response_time_ms: number | null;
  overall_uptime_percent: number | null;
}

export interface AlertConfig {
  endpoint_id: number;
  email_enabled: boolean;
  slack_enabled: boolean;
  email_address: string | null;
  slack_webhook: string | null;
}

export interface NewEndpoint {
  name: string;
  url: string;
  check_interval?: number;
  fast_check_interval?: number;
}

/* ---------- errors ---------- */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Turns the backend's error body into one readable sentence.
function readError(data: any, status: number): string {
  const err = data?.error;
  if (err) {
    if (Array.isArray(err.details) && err.details.length > 0) {
      return err.details
        .map((d: any) => (d.field && d.field !== 'body' ? `${d.field}: ${d.message}` : d.message))
        .join(' · ');
    }
    if (err.message) return String(err.message);
  }
  if (typeof data?.detail === 'string') return data.detail;
  return `Request failed (${status})`;
}

/* ---------- the one function that sends requests ---------- */

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }

  // Token missing or expired: go back to the login page.
  if (res.status === 401 && auth) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/';
    throw new ApiError(401, 'Please sign in again');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, readError(data, res.status));
  return data as T;
}

/* ---------- the backend calls the pages use ---------- */

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<User>('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }, false),

  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false
    ),

  me: () => request<User>('/auth/me'),

  listEndpoints: () => request<Endpoint[]>('/endpoints'),
  getEndpoint: (id: number) => request<Endpoint>(`/endpoints/${id}`),
  createEndpoint: (data: NewEndpoint) =>
    request<Endpoint>('/endpoints', { method: 'POST', body: JSON.stringify(data) }),
  updateEndpoint: (id: number, data: Partial<NewEndpoint> & { enabled?: boolean }) =>
    request<Endpoint>(`/endpoints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEndpoint: (id: number) => request<void>(`/endpoints/${id}`, { method: 'DELETE' }),

  history: (id: number, limit = 100) => request<HistoryItem[]>(`/endpoints/${id}/history?limit=${limit}`),

  incidents: () => request<Incident[]>('/incidents'),

  summary: () => request<DashboardSummary>('/dashboard/summary'),

  getAlerts: (id: number) => request<AlertConfig>(`/endpoints/${id}/alerts`),
  saveAlerts: (
    id: number,
    data: { email_enabled: boolean; slack_enabled: boolean; email_address: string | null; slack_webhook: string | null }
  ) => request<AlertConfig>(`/endpoints/${id}/alerts`, { method: 'PUT', body: JSON.stringify(data) }),
};
