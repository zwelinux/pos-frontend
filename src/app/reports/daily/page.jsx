"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";

const fmt = (v) => formatMoney(v);

function todayInBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

const pieColors = ["#0f172a", "#334155", "#475569", "#6366f1", "#14b8a6", "#f59e0b"];

export default function DailyReport() {
  const [date, setDate] = useState(todayInBangkok());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openOrders, setOpenOrders] = useState({});

  const toggleOrder = (label) =>
    setOpenOrders((s) => ({ ...s, [label]: !s[label] }));

  const load = async (d) => {
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const r = await authFetch(`${API}/reports/daily/?date=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j);
      setOpenOrders({});
    } catch {
      setErr("Failed to load report. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byPayment = (data?.by_payment ?? []).map((p) => ({
    name: p.payment_method || "unknown",
    value: Number(p.total || 0),
  }));

  const topItems = (data?.items ?? [])
    .slice(0, 8)
    .map((i) => ({
      name: [i.product_name, i.variant_name].filter(Boolean).join(" / "),
      sales: Number(i.sales || 0),
    }));

  const hourly = (data?.hourly ?? []).map((h) => ({
    hour: h.hour,
    total: Number(h.total || 0),
  }));

  const byCategory = (data?.by_category ?? []).map((c) => ({
    category: c.category,
    sales: Number(c.sales || 0),
  }));

  const comps = (data?.comps ?? data?.foc ?? []).map((c) => ({
    ...c,
    order_number: c.order_number ?? null,
    order_id: c.order_id ?? null,
    item_name: c.item_name ?? c.product_name ?? c.name ?? c?.item?.product_name ?? null,
    item_variant: c.item_variant ?? c.variant_name ?? c?.item?.variant_name ?? null,
    amount: Number(c.amount || 0),
    percent: c.percent != null ? Number(c.percent) : undefined,
    qty: c.qty != null ? Number(c.qty) : undefined,
  }));

  const reportedFOC = Number(data?.foc_total ?? data?.comps_total ?? 0);
  const activeFOC = comps
    .filter((c) => !c.voided_at)
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const focValue = comps.length ? activeFOC : reportedFOC;

  const money = (n) => formatMoney(n);
  const sign = (v) => (Number(v) > 0 ? "-" : "");
  const abs = (v) => Math.abs(Number(v || 0));

  const compsByOrder = (() => {
    const m = new Map();
    for (const c of comps) {
      const label =
        (c.order_number && `Order ${c.order_number}`) ||
        (c.order_id != null && `Order #${c.order_id}`) ||
        "Order (unknown)";
      if (!m.has(label)) m.set(label, []);
      m.get(label).push(c);
    }
    return m;
  })();

  function getCompItemName(c) {
    return (
      c.item_name ??
      c.product_name ??
      c.name ??
      c?.item?.product_name ??
      (c.item_id != null ? `Item #${c.item_id}` : "Item")
    );
  }

  function getCompVariantName(c) {
    return c.item_variant ?? c.variant_name ?? c?.item?.variant_name ?? null;
  }

  function compLabel(c) {
    const reason = c.reason ? ` • ${c.reason}` : "";
    const orderRef =
      c.order_id != null
        ? ` (Order #${c.order_id})`
        : c.order_number
          ? ` (Order ${c.order_number})`
          : "";

    if (c.scope === "item") {
      const baseName = getCompVariantName(c)
        ? `${getCompItemName(c)} (${getCompVariantName(c)})`
        : getCompItemName(c);

      let extra = "";
      if (c.mode === "qty" && c.qty != null) extra = ` • ×${c.qty}`;
      else if (c.mode === "percent" && c.percent != null) extra = ` • ${Number(c.percent)}%`;

      return `${baseName}${orderRef}${extra} • FOC${reason}${c.voided_at ? " (voided)" : ""}`;
    }

    const pct = c.mode === "percent" && c.percent != null ? ` ${Number(c.percent)}%` : "";
    return `FOC order${pct}${orderRef}${reason}${c.voided_at ? " (voided)" : ""}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                <Link href="/" className="transition-colors hover:text-indigo-600">Dashboard</Link>
                <span className="opacity-30">/</span>
                <Link href="/reports/dashboard" className="transition-colors hover:text-indigo-600">Reports</Link>
                <span className="opacity-30">/</span>
                <span className="text-slate-800">Daily</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Daily Sales Report</h1>
                <p className="max-w-2xl text-sm text-slate-500">
                  Review daily sales, payment mix, void activity, and FOC/comps in one consistent reporting view.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/reports/dashboard"
                className="flex h-10 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
              >
                Dashboard
              </Link>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const d = e.target.value;
                  setDate(d);
                  load(d);
                }}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500"
              />
              <button
                onClick={() => window.print()}
                className="h-10 rounded-lg bg-slate-900 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700"
              >
                Print
              </button>
            </div>
          </div>

          {data && !loading && !err && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Orders" value={data.orders} tone="text-slate-900" meta="Includes voided" />
              <SummaryCard label="Total Sales" value={fmt(data.total)} tone="text-emerald-600" />
              <SummaryCard label="Total FOC" value={`${sign(focValue)}${fmt(abs(focValue))}`} tone="text-rose-600" meta={comps.length ? "Active non-void comps" : "From report totals"} />
              <SummaryCard label="Voided Value" value={fmt(data.voided?.total ?? 0)} tone="text-amber-600" meta={`${data.voided?.count ?? 0} voided orders`} />
            </div>
          )}
        </header>

        {loading && (
          <Panel>
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            </div>
          </Panel>
        )}

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {err}
          </div>
        )}

        {data && !loading && !err && (
          <>
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-5">
                <Panel title="Payment Mix" icon={<IconPayment />}>
                  {(data.by_payment ?? []).length === 0 ? (
                    <div className="text-sm text-slate-500">No payments</div>
                  ) : (
                    <div className="space-y-3">
                      {(data.by_payment ?? []).map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                              {p.payment_method || "unknown"}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-600">{p.count} payments</div>
                          </div>
                          <div className="text-sm font-black text-slate-900">{fmt(p.total)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="FOC / Comps" icon={<IconAlert />}>
                  {comps.length === 0 ? (
                    <div className="text-sm text-slate-500">No FOC/comps recorded.</div>
                  ) : (
                    <div className="space-y-3">
                      {[...compsByOrder.entries()].map(([orderLabel, rows]) => {
                        const orderFOC = rows
                          .filter((c) => !c.voided_at)
                          .reduce((s, c) => s + Number(c.amount || 0), 0);
                        const open = !!openOrders[orderLabel];

                        return (
                          <div key={orderLabel} className="overflow-hidden rounded-xl border border-slate-200">
                            <button
                              onClick={() => toggleOrder(orderLabel)}
                              className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                            >
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{orderLabel}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                  {rows.length} entries
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-rose-600">
                                  {sign(orderFOC)}{money(abs(orderFOC))}
                                </span>
                                <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
                              </div>
                            </button>

                            {open && (
                              <div className="space-y-2 border-t border-slate-100 bg-white px-4 py-3">
                                {rows.map((c) => (
                                  <div
                                    key={c.id ?? `${c.scope}-${c.mode}-${c.item_id ?? "order"}-${c.amount}-${c.reason ?? ""}`}
                                    className={`flex justify-between gap-4 text-sm ${c.voided_at ? "text-slate-400" : "text-slate-700"}`}
                                  >
                                    <span>{compLabel(c)}</span>
                                    <span className={c.voided_at ? "" : "font-black text-rose-600"}>
                                      {sign(c.amount)}{money(abs(c.amount))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-black text-rose-600">
                        <span>Total FOC</span>
                        <span>{sign(activeFOC)}{money(abs(activeFOC))}</span>
                      </div>
                    </div>
                  )}

                </Panel>
              </div>

              

              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {hourly.length > 0 && (
                    <ChartCard title="Sales by Hour" className="xl:col-span-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 11 }} />
                          <YAxis tickFormatter={fmt} tick={{ fill: "#64748b", fontSize: 11 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  

                  {byCategory.length > 0 && (
                    <ChartCard title="Sales by Category" className="lg:col-span-2 xl:col-span-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byCategory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="category" interval={0} tick={{ fill: "#64748b", fontSize: 11 }} />
                          <YAxis tickFormatter={fmt} tick={{ fill: "#64748b", fontSize: 11 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Bar dataKey="sales" fill="#0f172a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </div>

                <Panel title="Items" icon={<IconList />}>
                  <div className="overflow-hidden rounded-[1.2rem] border border-slate-100">
                    <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      <div>Item</div>
                      <div>Variant</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Sales</div>
                    </div>
                    {(data.items ?? []).map((it, i) => (
                      <div key={i} className="grid grid-cols-4 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-700">
                        <div>{it.product_name}</div>
                        <div>{it.variant_name || "-"}</div>
                        <div className="text-right">{it.qty}</div>
                        <div className="text-right font-black text-slate-900">{fmt(it.sales)}</div>
                      </div>
                    ))}
                    {(data.items ?? []).length === 0 && (
                      <div className="px-4 py-8 text-sm text-slate-500">No items to show</div>
                    )}
                  </div>
                </Panel>

                <ChartCard title="Top Items (by sales)">
                  {topItems.length === 0 ? (
                    <div className="text-sm text-slate-500">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItems}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={70} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis tickFormatter={fmt} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Bar dataKey="sales" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </div>

            <style jsx global>{`
              @media print {
                @page { margin: 10mm; }
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            `}</style>
          </>
        )}
      </div>
    </main>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryCard({ label, value, tone = "text-slate-900", meta = "" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black tracking-tight ${tone}`}>{value}</div>
      {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <section className={`h-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-[calc(100%-28px)]">{children}</div>
    </section>
  );
}

function IconPayment() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7h18M5 11h14M7 15h6M5 19h14" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.65 18h16.7a1 1 0 00.86-1.14l-7.5-13a1 1 0 00-1.72 0z" />
    </svg>
  );
}

function IconList() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
