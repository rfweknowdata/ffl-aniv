const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // Only declare a JSON content-type when a body is actually being sent — Fastify's
    // strict JSON parser rejects a declared application/json with an empty body.
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });

  if (!res.ok) {
    let body: { error?: string; details?: unknown } | null = null;
    try {
      body = await res.json();
    } catch {
      // response had no JSON body — fall back to statusText below
    }
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
