"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

const pieColors = ["#0f172a", "#334155", "#475569", "#6366f1", "#14b8a6", "#f59e0b"];

export default function ReportsDashboardClient() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const weekAgoISO = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [start, setStart] = useState(weekAgoISO);
  const [end, setEnd] = useState(todayISO);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load(s, e) {
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const url = `${API}/reports/range/?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;
      const r = await authFetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch {
      setErr("Failed to load dashboard. Check backend logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(start, end);
  }, []); // initial

  const salesDaily = (data?.totals_by_day ?? []).map((d) => ({ date: d.date, total: Number(d.total || 0) }));
  const paymentsPie = (data?.payments ?? []).map((p) => ({ name: p.payment_method || "unknown", value: Number(p.total || 0) }));

  const days = useMemo(() => {
    const out = [];
    const d0 = new Date(data?.range?.start || start);
    const d1 = new Date(data?.range?.end || end);
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
    return out;
  }, [data, start, end]);

  const { qtyRows, salesRows } = useMemo(() => {
    const qtyMap = new Map();
    const salesMap = new Map();
    const addIfMissing = (map, name) => {
      if (!map.has(name)) {
        const base = { name, total_qty: 0, total_sales: 0 };
        days.forEach((d) => {
          base[d] = 0;
        });
        map.set(name, base);
      }
      return map.get(name);
    };
    for (const rec of data?.products_by_day ?? []) {
      const name = [rec.product_name, rec.variant_name].filter(Boolean).join(" / ");
      const qRow = addIfMissing(qtyMap, name);
      const sRow = addIfMissing(salesMap, name);
      qRow[rec.date] = (qRow[rec.date] || 0) + Number(rec.qty || 0);
      sRow[rec.date] = (sRow[rec.date] || 0) + Number(rec.sales || 0);
      qRow.total_qty += Number(rec.qty || 0);
      sRow.total_sales += Number(rec.sales || 0);
    }
    return {
      qtyRows: Array.from(qtyMap.values()).sort((a, b) => b.total_qty - a.total_qty),
      salesRows: Array.from(salesMap.values()).sort((a, b) => b.total_sales - a.total_sales),
    };
  }, [data, days]);

  const topItems = (data?.top_items ?? []).slice(0, 10).map((t) => ({
    name: [t.product_name, t.variant_name].filter(Boolean).join(" / "),
    sales: Number(t.sales || 0),
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                <Link href="/" className="transition-colors hover:text-indigo-600">Dashboard</Link>
                <span className="opacity-30">/</span>
                <Link href="/reports/daily" className="transition-colors hover:text-indigo-600">Reports</Link>
                <span className="opacity-30">/</span>
                <span className="text-slate-800">Overview</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Reports Dashboard</h1>
                <p className="max-w-2xl text-sm text-slate-500">
                  Explore range-based sales performance, payment distribution, top products, and FOC activity.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500"
              />
              <button
                onClick={() => load(start, end)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
              >
                Apply
              </button>
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
              <SummaryCard label="Paid Orders" value={data.overall?.orders ?? 0} tone="text-slate-900" />
              <SummaryCard label="Total Sales" value={fmt(data.overall?.total)} tone="text-emerald-600" />
              <SummaryCard label="FOC / Comps" value={fmt(data.foc_total)} tone="text-rose-600" />
              <SummaryCard label="Range" value={`${data.range?.start ?? start} → ${data.range?.end ?? end}`} tone="text-indigo-600" meta="Applied date span" />
            </div>
          )}
        </header>

        {loading ? (
          <Panel>
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
            </div>
          </Panel>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {err}
          </div>
        ) : null}

        {data && !loading && !err && (
          <>
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-5">
                <Panel title="Payment Mix" icon={<IconPayment />}>
                  {paymentsPie.length === 0 ? (
                    <div className="text-sm text-slate-500">No payment data in this range.</div>
                  ) : (
                    <div className="space-y-3">
                      {paymentsPie.map((p, i) => (
                        <div key={`${p.name}-${i}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: pieColors[i % pieColors.length] }}
                            />
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {p.name}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-700">{fmt(p.value)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Top Product Highlights" icon={<IconList />}>
                  {topItems.length === 0 ? (
                    <div className="text-sm text-slate-500">No top item data.</div>
                  ) : (
                    <div className="space-y-3">
                      {topItems.slice(0, 5).map((item, i) => (
                        <div key={`${item.name}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            Rank {i + 1}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">{item.name}</div>
                          <div className="mt-1 text-sm font-black text-indigo-600">{fmt(item.sales)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="FOC / Comp Details" icon={<IconAlert />}>
                  <div className="overflow-hidden rounded-[1.2rem] border border-slate-100">
                    <div className="grid grid-cols-5 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                      <div>Order</div>
                      <div>Item</div>
                      <div>Mode</div>
                      <div className="text-right">Amount</div>
                      <div>Reason</div>
                    </div>
                    {(data?.comps || []).map((c) => (
                      <div key={c.id} className="grid grid-cols-5 border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-700">
                        <div>{c.order_number}</div>
                        <div>{[c.item_name, c.item_variant].filter(Boolean).join(" / ") || "-"}</div>
                        <div>{c.mode}</div>
                        <div className="text-right font-black text-rose-600">{fmt(c.amount)}</div>
                        <div>{c.reason}</div>
                      </div>
                    ))}
                    {(data?.comps || []).length === 0 && (
                      <div className="px-4 py-8 text-sm text-slate-500">No FOC / Comp records in this range.</div>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  <ChartCard title="Daily Sales" className="xl:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesDaily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Payments (Total)">
                    {paymentsPie.length === 0 ? (
                      <div className="text-sm text-slate-500">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentsPie} dataKey="value" nameKey="name" outerRadius={90} label>
                            {paymentsPie.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard title="Top Items (by sales)" className="lg:col-span-2 xl:col-span-3">
                    {topItems.length === 0 ? (
                      <div className="text-sm text-slate-500">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={70} tick={{ fill: "#64748b", fontSize: 11 }} />
                          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="sales" fill="#0f172a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <Panel title="Product Report — Qty per day" icon={<IconTable />}>
                  <div className="overflow-hidden rounded-[1.2rem] border border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr>
                            <th className="border-b border-slate-100 p-3 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Item</th>
                            {days.map((d) => <th key={d} className="border-b border-slate-100 p-3 text-right text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{d.slice(5)}</th>)}
                            <th className="border-b border-slate-100 p-3 text-right text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Total Qty</th>
                            <th className="border-b border-slate-100 p-3 text-right text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Total Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qtyRows.map((row, idx) => (
                            <tr key={idx} className="odd:bg-white even:bg-slate-50/70">
                              <td className="border-b border-slate-100 p-3 text-[12px] font-semibold text-slate-700">{row.name}</td>
                              {days.map((d) => <td key={d} className="border-b border-slate-100 p-3 text-right text-[12px] font-semibold text-slate-700">{row[d] || 0}</td>)}
                              <td className="border-b border-slate-100 p-3 text-right text-[12px] font-black text-slate-900">{row.total_qty}</td>
                              <td className="border-b border-slate-100 p-3 text-right text-[12px] font-black text-indigo-600">{fmt(salesRows[idx]?.total_sales)}</td>
                            </tr>
                          ))}
                          {qtyRows.length === 0 && (
                            <tr>
                              <td className="p-4 text-sm text-slate-500" colSpan={days.length + 3}>No items in this range.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
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

function IconTable() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M9 21V10M15 21V10M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}
