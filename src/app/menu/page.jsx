"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function PublicMenu() {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <PublicMenuInner />
    </Suspense>
  );
}

function MenuSkeleton() {
  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="glass rounded-[2.5rem] border-white/30 p-6 shadow-2xl shadow-indigo-100/20 md:p-8">
          <div className="h-4 w-28 rounded-full bg-indigo-200/60" />
          <div className="mt-4 h-10 w-56 rounded-2xl bg-white/70" />
          <div className="mt-3 h-5 w-full max-w-2xl rounded-xl bg-white/60" />
        </section>

        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-28 shrink-0 rounded-2xl bg-white/70" />
          ))}
        </div>

        <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-[2.5rem] glass border-white/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function PublicMenuInner() {
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [canScroll, setCanScroll] = useState({ left: false, right: false });
  const catScrollRef = useRef(null);

  const loadCats = async () => {
    try {
      const r = await authFetch(`${getApiBase()}/categories/`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const c = Array.isArray(j?.results) ? j.results : Array.isArray(j) ? j : [];
      setCats(c);
      setActive(c[0]?.id ?? "");
      setErr("");
    } catch (e) {
      console.error("Failed to load guest categories", e);
      setCats([]);
      setActive("");
      setErr("Unable to load menu categories.");
      setLoading(false);
    }
  };

  const loadProducts = async (cid) => {
    if (!cid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await authFetch(`${getApiBase()}/products/?category=${cid}&is_active=true`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const arr = Array.isArray(j?.results) ? j.results : Array.isArray(j) ? j : [];
      setItems(arr);
      setErr("");
    } catch (e) {
      console.error("Failed to load guest products", e);
      setItems([]);
      setErr("Unable to load products right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCats();
  }, []);

  useEffect(() => {
    if (active) loadProducts(active);
  }, [active]);

  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return;

    const updateButtons = () => {
      setCanScroll({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };

    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [cats.length]);

  const scrollCategories = (dir) => {
    const el = catScrollRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl px-5">


        <section className="mt-8 rounded-[1.5rem] glass border-white/30 p-4 shadow-xl shadow-indigo-100/10 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Categories
              </div>
              <div className="mt-1 text-sm font-bold text-slate-700">
                Tap a category to filter available items
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCategories("left")}
                disabled={!canScroll.left}
                className="h-10 w-10 rounded-2xl border border-white/50 bg-white/70 text-slate-500 transition hover:text-indigo-600 disabled:opacity-40"
                aria-label="Scroll categories left"
              >
                <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollCategories("right")}
                disabled={!canScroll.right}
                className="h-10 w-10 rounded-2xl border border-white/50 bg-white/70 text-slate-500 transition hover:text-indigo-600 disabled:opacity-40"
                aria-label="Scroll categories right"
              >
                <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={catScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={[
                  "shrink-0 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition-all duration-300",
                  active === c.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "glass border-white/40 text-slate-600 hover:bg-white/60 hover:text-indigo-600",
                ].join(" ")}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          {!!err && (
            <div className="mb-6 rounded-[2rem] border border-rose-200 bg-rose-50/90 px-5 py-4 text-sm font-medium text-rose-700 shadow-sm">
              {err}
            </div>
          )}

          {loading ? (
            <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[2.5rem] glass border-white/30 animate-pulse"
                />
              ))}
            </div>
          ) : items.length ? (
            <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => (
                <article key={p.id}>
                  <Link
                    href={`/menu/${p.id}`}
                    className="group relative flex aspect-square flex-col overflow-hidden rounded-[2.5rem] glass border-white/40 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-100"
                  >
                    <div className="absolute inset-x-4 top-4 bottom-24 flex items-center justify-center overflow-hidden rounded-[1.8rem] bg-indigo-50/60 text-center transition-colors group-hover:bg-indigo-100/50">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <span className="text-5xl font-black text-indigo-200 transition-transform duration-500 group-hover:scale-110">
                          {p.name?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="absolute right-8 top-8 flex h-10 w-10 translate-y-4 items-center justify-center rounded-xl bg-indigo-600 text-white opacity-0 shadow-xl transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    <div className="mt-auto p-6 text-center">
                      <h2 className="line-clamp-1 text-lg font-black tracking-tight text-slate-800">
                        {p.name}
                      </h2>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Starting At
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-sm font-black text-indigo-600">
                          ฿{Number(p.base_price ?? 0).toFixed(2)}
                        </span>
                      </div>

                      {!!p.variants?.length && (
                        <div className="mt-3 inline-flex max-w-full items-center justify-center rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          {p.variants.length} Variant{p.variants.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[2.5rem] glass border border-white/30 px-6 py-16 text-center shadow-xl shadow-indigo-100/10">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                No Products
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-800">
                Nothing is published in this category yet.
              </h2>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Try another category to continue browsing the guest menu.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
