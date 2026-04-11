"use client";

export function setAuth(auth) {
  // expected: { token: string, roles?: string[], scheme?: "Bearer"|"Token" }
  localStorage.setItem("auth", JSON.stringify(auth || {}));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function getAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "{}"); } catch { return {}; }
}

function detectScheme(token, explicit) {
  if (explicit) return explicit;
  if (!token) return "";
  // Heuristic: JWTs usually have 3 dot-separated parts
  return token.split(".").length === 3 ? "Bearer" : "Token";
}

export async function authFetch(url, options = {}) {
  const { token, scheme } = getAuth();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `${detectScheme(token, scheme)} ${token}`;

  // convenience: auto-JSON if body is a plain object
  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }
  return fetch(url, { ...options, headers, body });
}

export function hasRole(role) {
  const { roles = [] } = getAuth();
  return roles.includes(role) || roles.includes("Manager");
}

export function logout() {
  localStorage.removeItem("auth");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}
export function isAuthed() { return !!getAuth().token; }
