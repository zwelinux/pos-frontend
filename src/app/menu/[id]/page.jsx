"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

export default function ProductDetail() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetailInner />
    </Suspense>
  );
}

function DetailSkeleton() {
  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-10 w-28 rounded-2xl bg-white/70" />
        <section className="rounded-[2.5rem] glass border-white/30 p-5 shadow-xl shadow-indigo-100/10 md:p-8">
          <div className="aspect-[4/3] rounded-[2rem] bg-white/70" />
          <div className="mt-6 h-10 w-2/3 rounded-2xl bg-white/70" />
          <div className="mt-3 h-6 w-28 rounded-xl bg-indigo-100/70" />
        </section>
      </div>
    </main>
  );
}

function money(v) {
  return formatMoney(v);
}

function ProductDetailInner() {
  const route = useParams();
  const id = Array.isArray(route?.id) ? route.id[0] : route?.id;

  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const r = await authFetch(`${getApiBase()}/products/${id}/`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setP(j);
        setErr("");
      } catch (e) {
        console.error("Failed to load guest product detail", e);
        setErr("Failed to load product.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl px-5">
        <Link
          href="/menu"
          className="mb-5 inline-flex items-center gap-2 rounded-2xl glass border-white/40 px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-slate-600 transition hover:bg-white/70 hover:text-indigo-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back To Menu
        </Link>

        {loading && <DetailSkeleton />}

        {!loading && err && (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50/90 px-6 py-14 text-center shadow-sm">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Product unavailable</h1>
            <p className="mt-3 text-sm font-medium text-slate-500">{err}</p>
          </div>
        )}

        {!loading && !err && p && (
          <div className="space-y-6">
            <section className="rounded-[2.5rem] glass border-white/30 p-5 shadow-xl shadow-indigo-100/10 md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
                <div className="overflow-hidden rounded-[2rem] bg-indigo-50/60">
                  <div className="flex aspect-[4/4.5] items-center justify-center p-6 text-center">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full rounded-[1.6rem] object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-[1.6rem] border border-white/60 bg-white/70">
                        <span className="text-7xl font-black text-indigo-200">
                          {p.name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                      {p.name}
                    </h1>
                    <div className="mt-3 text-2xl font-black text-indigo-600">
                      ฿{money(p.base_price)}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-500">
                      Browse this item and its available choices. This page is for customers and guests to view the menu only.
                    </p>
                  </div>

                  {!!p.variants?.length && (
                    <div className="rounded-[1.8rem] border border-white/60 bg-white/75 p-4">
                      <h2 className="text-lg font-black tracking-tight text-slate-900">
                        Available Sizes / Variants
                      </h2>
                      <div className="mt-4 space-y-3">
                        {p.variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between rounded-[1.2rem] bg-slate-50/80 px-4 py-3"
                          >
                            <span className="text-sm font-bold text-slate-800">{v.name}</span>
                            <span className="text-sm font-black text-indigo-600">
                              {Number(v.price_delta) === 0
                                ? "Included"
                                : `${Number(v.price_delta) > 0 ? "+" : "-"}฿${money(Math.abs(v.price_delta))}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!p.modifier_groups?.length && (
                    <div className="rounded-[1.8rem] border border-white/60 bg-white/75 p-4">
                      <h2 className="text-lg font-black tracking-tight text-slate-900">
                        Extras / Options
                      </h2>
                      <div className="mt-4 space-y-4">
                        {p.modifier_groups.map((g) => (
                          <div key={g.id} className="rounded-[1.3rem] bg-slate-50/80 p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <h3 className="text-base font-black text-slate-800">{g.name}</h3>
                              <div className="text-xs font-bold text-slate-400">
                                {g.selection_type === "single" ? "Choose 1" : "Choose any"}
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {(g.options || []).map((o) => (
                                <div
                                  key={o.id}
                                  className="flex items-center justify-between rounded-[1rem] bg-white px-4 py-3"
                                >
                                  <span className="text-sm font-medium text-slate-700">{o.name}</span>
                                  <span className="text-sm font-bold text-indigo-600">
                                    {Number(o.price_delta) === 0
                                      ? "Included"
                                      : `${Number(o.price_delta) > 0 ? "+" : "-"}฿${money(Math.abs(o.price_delta))}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
