const SESSION_KEY = "forge_session";

export function setSession(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function getSession() {
  return localStorage.getItem(SESSION_KEY) || "";
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  const token = getSession();
  if (token) headers.set("Cookie", `session=${token}`);
  // Also send as custom header for environments that strip Cookie
  if (token) headers.set("X-Session", token);

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  return res;
}
