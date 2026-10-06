const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function getToken(): string | null {
  return localStorage.getItem("rr_token");
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem("rr_token", token);
  else localStorage.removeItem("rr_token");
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });

  if (!res.ok) {
    let msg = await res.text();
    try {
      const j = JSON.parse(msg) as { detail?: string | unknown };
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map(String).join("; ");
    } catch {
      /* keep text */
    }
    throw new Error(msg || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export async function uploadAdminFile(
  kind: "logo" | "login_bg" | "splash" | "favicon" | "promotion",
  file: File,
): Promise<{ filename: string; url: string }> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const headers = new Headers();
  const token = getToken();
  if (!token) throw new Error("未登录");
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl("/api/admin/uploads"), {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "上传失败");
  }
  return res.json() as Promise<{ filename: string; url: string }>;
}
