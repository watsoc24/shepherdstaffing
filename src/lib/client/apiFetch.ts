// Browser-side JSON helper. Same-origin only; the browser adds Origin for the CSRF check.
export interface ApiError {
  code: string;
  message: string;
  details?: { path: string; message: string }[];
}

export async function apiFetch<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: init.body ? { "content-type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = data.error ?? { code: "NETWORK", message: "Something went wrong. Please try again." };
    if (res.status === 429 && res.headers.get("Retry-After")) {
      err.message = `${err.message} (try again in ${res.headers.get("Retry-After")}s)`;
    }
    throw err;
  }
  return data as T;
}

export const fieldError = (err: ApiError | null, path: string) => err?.details?.find((d) => d.path === path)?.message;
