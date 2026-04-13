// src/lib/api.js

/**
 * Resolve API base without touching window during SSR/prerender.
 * Prefer an explicit env var in all environments.
 */
export function getApiBase() {
  const env = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");

  // Fallbacks:
  // - On the client, you *could* derive from window if you proxy /api — not needed here.
  // - During build/SSR, never throw. Use a safe local default.
  // return "http://localhost:8000/api";
  return "https://admin.jusbackend.store/api";
  // Thank you
}

/**
 * A tiny wrapper that is safe to import server-side.
 * Do NOT call this from Server Components unless you intend to hit your API from the server.
 * For client components, call it inside useEffect or event handlers.
 */
export async function clientFetch(input, init = {}) {
  // Ensure no accidental caching for live menu data
  const opts = { cache: "no-store", ...init };
  return fetch(input, opts);
}

/** ---- Data helpers (safe to import; only call them on the client) ---- */

export async function getCategories() {
  if (typeof window === "undefined") return [];

  const r = await clientFetch(`${getApiBase()}/categories/`);
  const j = await r.json();

  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.results)) return j.results;
  return [];
}


export async function getProducts(categoryId) {
  if (typeof window === "undefined") return [];

  const base = getApiBase();
  const url = categoryId
    ? `${base}/products/?category=${categoryId}&is_active=true`
    : `${base}/products/`;

  const r = await clientFetch(url);
  const j = await r.json();

  // Always return an array of products
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.results)) return j.results;
  return [];
}


export async function getProduct(id) {
  if (typeof window === "undefined") return null;

  const r = await clientFetch(`${getApiBase()}/products/${id}/`);
  try {
    return await r.json();
  } catch {
    return null;
  }
}

// For convenience if you still want a constant:
export const API = getApiBase();
