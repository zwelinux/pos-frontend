"use client";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function TabsClient() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [open, setOpen] = useState({}); // id -> expanded?

  // open vs paid + date filters for paid list
  const [mode, setMode] = useState("open"); // "open" | "paid"
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const buildUrl = (query = "") => {
    if (mode === "open") {
      return `${API}/orders/tabs/${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    }
    // paid mode
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return `${API}/orders/tabs/paid/${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const load = async (query = "") => {
    setLoading(true);
    setErr("");
    try {
      const url = buildUrl(query);
      const r = await authFetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(data);
    } catch {
      setErr("Failed to load tabs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(q); }, [mode, fromDate, toDate]); // reload when mode/date changes
  useEffect(() => { load(); }, []); // initial

  const toggle = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const summarizeItems = (order) =>
    (order.items || [])
      .map(it => `${it.qty}× ${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ""}`)
      .join(", ");

  // Outstanding total (open) or total sum (paid)
  const totalOutstanding = useMemo(
    () => rows.reduce((s, r) => s + Number(r.total || 0), 0),
    [rows]
  );
  const tabCount = rows.length;

  const settle = async (id, method) => {
    setBusyId(id);
    try {
      const r = await authFetch(`${API}/orders/${id}/settle/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method, free_table: true }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(prev => prev.filter(x => x.id !== id));
      alert("Settled.");
    } catch {
      alert("Settle failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billing Overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Tabs (Eat Now, Pay Later)</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track open tabs, review paid tabs, and settle balances quickly.
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Showing</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{tabCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {mode === "open" ? "Outstanding" : "Paid Sum"}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{totalOutstanding.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "open" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              onClick={() => setMode("open")}
            >
              Open Tabs
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "paid" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              onClick={() => setMode("paid")}
            >
              Paid Tabs
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            placeholder="Search by name / table / number"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />

          {mode === "paid" && (
            <>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="From date"
              />
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="To date"
              />
            </>
          )}

          <button
            onClick={() => load(q)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Search
          </button>
        </div>
      </section>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
          Loading tabs...
        </div>
      ) : null}

      <section className="space-y-3">
        {rows.map((r) => {
          const itemsTxt = summarizeItems(r);
          const expanded = !!open[r.id];
          return (
            <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Order #</p>
                    <p className="text-sm font-medium text-slate-900">{r.number}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Table</p>
                    <p className="text-sm text-slate-800">{r.table?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                    <p className="text-sm text-slate-800">{r.customer_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {mode === "paid" ? "Paid At" : "Opened"}
                    </p>
                    <p className="text-sm text-slate-800">
                      {mode === "paid"
                        ? (r.paid_at ? new Date(r.paid_at).toLocaleString() : "-")
                        : (r.tab_opened_at ? new Date(r.tab_opened_at).toLocaleString() : "-")}
                    </p>
                  </div>
                  {mode === "paid" && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Recipient</p>
                      <p className="text-sm text-slate-800">{r.paid_by_name || "-"}</p>
                    </div>
                  )}
                  {mode === "paid" && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Method</p>
                      <p className="text-sm text-slate-800">{(r.payment_method || "-").toUpperCase()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-sm font-semibold text-slate-900">{Number(r.total).toFixed(2)}</p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Remark</p>
                    <p className="text-sm text-slate-700">{r.credit_remark || "-"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {mode === "open" ? (
                    <>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => settle(r.id, "cash")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        title="Settle as Cash"
                      >
                        {busyId === r.id ? "..." : "Cash"}
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => settle(r.id, "card")}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-60"
                        title="Settle as Card"
                      >
                        {busyId === r.id ? "..." : "Card"}
                      </button>
                    </>
                  ) : (
                    <a
                      href={`/receipt/${r.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      title="Open receipt"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  onClick={() => toggle(r.id)}
                  className="w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  title="Click to expand"
                >
                  <span className="font-medium">Items:</span> {itemsTxt || "-"}
                  <span className="ml-2 text-xs opacity-70">{expanded ? "Hide details ▲" : "Show details ▼"}</span>
                </button>

                {expanded && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs">
                    {(r.items || []).map((it) => (
                      <div key={it.id} className="mb-2">
                        <div className="flex justify-between gap-3">
                          <div>
                            {it.qty}x {it.product_name}
                            {it.variant_name ? ` (${it.variant_name})` : ""}
                          </div>
                          <div>{Number(it.line_total ?? 0).toFixed(2)}</div>
                        </div>

                        {it.modifiers?.length > 0 && (
                          <ul className="list-disc pl-6 opacity-80">
                            {it.modifiers.map((m) => {
                              const qtyLabel = m.qty > 1 ? ` x${m.qty}` : "";
                              const priceLabel =
                                m.include && Number(m.price_delta) !== 0
                                  ? ` (+${(Number(m.price_delta) * (m.qty || 1)).toFixed(2)})`
                                  : "";
                              return (
                                <li key={m.option_id}>
                                  {m.include ? "" : "No "}
                                  {m.option_name}
                                  {qtyLabel}
                                  {priceLabel}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {it.notes && (
                          <div className="italic opacity-75">Note: {it.notes}</div>
                        )}
                      </div>
                    ))}

                    <hr className="my-2 border-slate-200" />
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{Number(r.subtotal ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{Number(r.tax ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{Number(r.total ?? 0).toFixed(2)}</span>
                    </div>

                    <a
                      href={`/receipt/${r.id}`}
                      className="mt-2 inline-block text-sky-700 underline"
                    >
                      Open receipt
                    </a>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {rows.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
          {mode === "open" ? "No open tabs." : "No paid tabs in this range."}
        </div>
      )}
    </main>
  );
}
