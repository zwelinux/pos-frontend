"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

function money(n) {
  return formatMoney(n);
}

function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

function fmtShort(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsDashboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [active, setActive] = useState(null);
  const [orders, setOrders] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [subLoading, setSubLoading] = useState(false);

  async function loadSessions() {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/cash-sessions/?ordering=-id`);
      const js = r.ok ? await r.json() : [];
      const data = Array.isArray(js) ? js : js?.results || [];
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(ses) {
    setActive(ses);
    setSubLoading(true);
    try {
      const [oRes, eRes] = await Promise.all([
        authFetch(`${API}/cash-sessions/${ses.id}/orders/`),
        authFetch(`${API}/cash-sessions/${ses.id}/expenses/`),
      ]);
      setOrders(oRes.ok ? await oRes.json() : []);
      setExpenses(eRes.ok ? await eRes.json() : []);
    } catch {
      setOrders([]);
      setExpenses([]);
    } finally {
      setSubLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  const filtered = useMemo(() => {
    let x = rows;
    if (q.trim()) {
      const k = q.toLowerCase();
      x = x.filter((r) =>
        (`#${r.id}`.includes(k)) ||
        (r.note || "").toLowerCase().includes(k) ||
        (r.opened_by || "").toString().toLowerCase().includes(k) ||
        (r.closed_by || "").toString().toLowerCase().includes(k)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      x = x.filter((r) => new Date(r.opened_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      x = x.filter((r) => new Date(r.opened_at) <= to);
    }
    return x;
  }, [rows, q, dateFrom, dateTo]);

  function exportCSV() {
    const headers = [
      "ID","Opened At","Opened By","Closed At","Closed By","Starting Balance",
      "Actual Sales","Tab Sales (Today)","Previous Tabs","Expenses",
      "Expected Cash","Counted Cash","Over/Short","Note"
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push([
        r.id,
        r.opened_at,
        r.opened_by ?? "",
        r.closed_at ?? "",
        r.closed_by ?? "",
        r.starting_balance,
        r.sales_actual,
        r.sales_tab_today,
        r.sales_tab_previous,
        r.expenses_total,
        r.expected_cash,
        r.counted_cash ?? "",
        r.over_short ?? "",
        `"${(r.note || "").replaceAll('"', '""')}"`,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openCount = rows.filter((r) => !r.closed_at).length;
  const closedCount = rows.filter((r) => !!r.closed_at).length;
  const totalExpected = filtered.reduce((sum, r) => sum + Number(r.expected_cash || 0), 0);
  const totalVariance = filtered.reduce((sum, r) => sum + Number(r.over_short || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                <Link href="/" className="transition-colors hover:text-indigo-600">Dashboard</Link>
                <span className="opacity-30">/</span>
                <Link href="/cash" className="transition-colors hover:text-indigo-600">Cash</Link>
                <span className="opacity-30">/</span>
                <span className="text-slate-800">Sessions</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Cash Sessions</h1>
                <p className="max-w-2xl text-sm text-slate-500">
                  Review past drawer sessions, inspect session totals, and drill into orders and expenses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/cash"
                className="flex h-10 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
              >
                Back To Cash
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Filtered Sessions" value={filtered.length} tone="text-slate-900" />
            <SummaryCard label="Open Sessions" value={openCount} tone="text-amber-600" />
            <SummaryCard label="Expected Cash" value={`฿ ${money(totalExpected)}`} tone="text-indigo-600" />
            <SummaryCard label="Net Variance" value={`฿ ${money(totalVariance)}`} tone={totalVariance < 0 ? "text-rose-600" : "text-emerald-600"} />
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7h18M6 11h12M8 15h8M5 19h14" />
              </svg>
            </div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Filters & Export</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            <label className="md:col-span-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Search</span>
              <input
                placeholder="Search #id / note / user"
                className="w-full bg-transparent p-0 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <label className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">From</span>
              <input
                type="date"
                className="w-full bg-transparent p-0 text-sm font-semibold text-slate-800 outline-none"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>

            <label className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">To</span>
              <input
                type="date"
                className="w-full bg-transparent p-0 text-sm font-semibold text-slate-800 outline-none"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>

            <button
              className="md:col-span-1 flex h-full min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
              onClick={exportCSV}
            >
              Export
            </button>

            <button
              className="md:col-span-2 flex h-full min-h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700"
              onClick={loadSessions}
            >
              Refresh Data
            </button>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17v-6m3 6V7m3 10v-4m3 6H6a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">Session List</h2>
            </div>

            <div className="overflow-hidden rounded-[1.25rem] border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>ID</Th>
                      <Th>Opened</Th>
                      <Th>Closed</Th>
                      <Th>Start</Th>
                      <Th>Actual</Th>
                      <Th>Tab Today</Th>
                      <Th>Prev Tabs</Th>
                      <Th>Expenses</Th>
                      <Th>Expected</Th>
                      <Th>Counted</Th>
                      <Th>Variance</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm font-medium text-slate-400" colSpan={12}>Loading sessions…</td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm font-medium text-slate-400" colSpan={12}>No sessions found.</td>
                      </tr>
                    ) : (
                      filtered.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                          <Td className="font-black text-slate-900">#{r.id}</Td>
                          <Td>{fmtShort(r.opened_at)}</Td>
                          <Td>
                            {r.closed_at ? (
                              fmtShort(r.closed_at)
                            ) : (
                              <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
                                Open
                              </span>
                            )}
                          </Td>
                          <Td>฿ {money(r.starting_balance)}</Td>
                          <Td>฿ {money(r.sales_actual)}</Td>
                          <Td>฿ {money(r.sales_tab_today)}</Td>
                          <Td>฿ {money(r.sales_tab_previous)}</Td>
                          <Td className="text-rose-600">฿ {money(r.expenses_total)}</Td>
                          <Td className="font-black text-indigo-600">฿ {money(r.expected_cash)}</Td>
                          <Td>{r.counted_cash != null ? `฿ ${money(r.counted_cash)}` : "—"}</Td>
                          <Td className={Number(r.over_short || 0) === 0 ? "text-slate-700" : Number(r.over_short) > 0 ? "text-emerald-600" : "text-rose-600"}>
                            {r.over_short != null ? `฿ ${money(r.over_short)}` : "—"}
                          </Td>
                          <Td>
                            <button
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
                              onClick={() => openDetail(r)}
                            >
                              View
                            </button>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H9l-5 5v9a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">Session Detail</h2>
            </div>

            {!active ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">No Session Selected</div>
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Select a session from the list to inspect totals, orders, and expenses.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Session</div>
                    <div className="text-2xl font-black tracking-tight text-slate-900">#{active.id}</div>
                  </div>
                  <div className="ml-auto">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
                      onClick={() => setActive(null)}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <KV k="Opened" v={fmtDateTime(active.opened_at)} />
                  <KV k="Closed" v={active.closed_at ? fmtDateTime(active.closed_at) : "OPEN"} />
                  <KV k="Opened By" v={active.opened_by ?? "-"} />
                  <KV k="Closed By" v={active.closed_by ?? "-"} />
                  <KV k="Starting Balance" v={`฿ ${money(active.starting_balance)}`} />
                  <KV k="Expected Cash" v={`฿ ${money(active.expected_cash)}`} />
                  <KV k="Counted Cash" v={active.counted_cash != null ? `฿ ${money(active.counted_cash)}` : "—"} />
                  <KV k="Over / Short" v={active.over_short != null ? `฿ ${money(active.over_short)}` : "—"} />
                </div>

                <KV k="Note" v={active.note || "—"} full />

                <DetailPanel title="Orders In Session">
                  {subLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
                  ) : orders?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <Th>#</Th>
                            <Th>Paid At</Th>
                            <Th>Total</Th>
                            <Th>Customer</Th>
                            <Th>Tab Opened</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orders.map((o) => (
                            <tr key={o.id}>
                              <Td>{o.number}</Td>
                              <Td>{fmtShort(o.paid_at)}</Td>
                              <Td className="font-black text-indigo-600">฿ {money(o.total)}</Td>
                              <Td>{o.customer_name || "—"}</Td>
                              <Td>{o.tab_opened_at ? fmtShort(o.tab_opened_at) : "—"}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No orders in this session.</div>
                  )}
                </DetailPanel>

                <DetailPanel title="Expenses In Session">
                  {subLoading ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">Loading…</div>
                  ) : expenses?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[460px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <Th>Time</Th>
                            <Th>Amount</Th>
                            <Th>Category</Th>
                            <Th>Note</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {expenses.map((e) => (
                            <tr key={e.id}>
                              <Td>{fmtShort(e.created_at)}</Td>
                              <Td className="font-black text-rose-600">฿ {money(e.amount)}</Td>
                              <Td>{e.category || "—"}</Td>
                              <Td>{e.note || "—"}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No expenses in this session.</div>
                  )}
                </DetailPanel>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-black tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}

function DetailPanel({ title, children }) {
  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {title}
      </div>
      {children}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 text-[12px] font-semibold text-slate-700 ${className}`}>{children}</td>;
}

function KV({ k, v, full = false }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{k}</div>
      <div className="mt-1 text-[13px] font-semibold text-slate-800">{v}</div>
    </div>
  );
}
