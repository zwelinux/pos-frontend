"use client";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { groupModifiersForDisplay } from "@/lib/modifierDisplay";

const STATUSES = ["open", "tab", "paid", "void"];

// one place to keep the same column template for header + rows
const COLS =
  "grid grid-cols-[minmax(210px,1.6fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(200px,1.4fr)_minmax(200px,1.4fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(60px,0.6fr)_minmax(110px,0.9fr)]";

// helper: yyyy-mm-dd in Asia/Bangkok (your store tz)
function todayInBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export default function OrdersDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  // created_* empty by default
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  // paid_* takes precedence; default paidFrom = today (Bangkok)
  const [paidFrom, setPaidFrom] = useState(() => todayInBangkok());
  const [paidTo, setPaidTo] = useState("");

  const [ordering, setOrdering] = useState("-id");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [expanded, setExpanded] = useState({});
  const [detail, setDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState({});

  function buildParams() {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (ordering) p.set("ordering", ordering);

    // 🔑 precedence: if any paid_* present, ignore created_*
    const hasPaidFilter = Boolean(paidFrom || paidTo);
    if (hasPaidFilter) {
      if (paidFrom) p.set("paid_from", paidFrom);
      if (paidTo) p.set("paid_to", paidTo);
    } else {
      if (createdFrom) p.set("created_from", createdFrom);
      if (createdTo) p.set("created_to", createdTo);
    }
    return p;
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await authFetch(`${API}/orders/?${buildParams().toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setRows(json.results || []);
      setCount(json.count || 0);
      setExpanded({});
    } catch {
      setErr("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, ordering]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  async function fetchCompsForOrder(id) {
    try {
      const r = await authFetch(`${API}/orders/${id}/comps/`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setDetail((p) => ({
        ...p,
        [id]: { ...(p[id] || {}), comps: Array.isArray(data) ? data : [] },
      }));
    } catch {
      // ignore (keep comps undefined)
    }
  }

  async function ensureDetail(id) {
    if (detail[id] || detailLoading[id]) return;
    setDetailLoading((p) => ({ ...p, [id]: true }));
    try {
      const r = await authFetch(`${API}/orders/${id}/`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setDetail((p) => ({ ...p, [id]: data }));
      await fetchCompsForOrder(id); // ⬅️ get FOC / comps too
    } catch {
      setDetail((p) => ({ ...p, [id]: null }));
    } finally {
      setDetailLoading((p) => ({ ...p, [id]: false }));
    }
  }

  function toggleExpand(id) {
    setExpanded((p) => {
      const next = { ...p, [id]: !p[id] };
      if (!p[id]) ensureDetail(id);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders</p>
          <h1 className="text-2xl font-semibold text-slate-900">Orders Dashboard</h1>
          <p className="text-sm text-slate-600">Filter by status and date, then drill into each order for full item and FOC details.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="grid items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6 md:p-5">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search (number / customer / table)</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
            placeholder="e.g. POS..., David, Table 3"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Created From</label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Created To</label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Paid From</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={paidFrom}
              onChange={(e) => setPaidFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Paid To</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
          >
            <option value="-id">Newest</option>
            <option value="id">Oldest</option>
            <option value="-paid_at">Paid (newest)</option>
            <option value="paid_at">Paid (oldest)</option>
            <option value="-created_at">Created (newest)</option>
            <option value="created_at">Created (oldest)</option>
            <option value="-total">Total (high→low)</option>
            <option value="total">Total (low→high)</option>
          </select>
        </div>

        <div className="md:col-span-6 flex gap-2">
          <button
            onClick={() => {
              setPage(1);
              load();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setQ("");
              setStatus("");
              setCreatedFrom("");
              setCreatedTo("");
              setPaidFrom(todayInBangkok()); // reset to paid-day default
              setPaidTo("");
              setOrdering("-id");
              setPage(1);
              load();
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </section>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>
      )}
      {loading && <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">Loading orders...</div>}

      {/* Table */}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`${COLS} gap-2 border-b bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700`}>
          <div>#</div>
          <div>Status</div>
          <div>Table</div>
          <div>Customer</div>
          {/* <div>Created</div> */}
          <div>Paid</div>
          <div className="text-right">Total</div>
          <div>Method</div>
          {/* <div className="text-right">Items</div>
          <div>Actions</div> */}
        </div> 

        {rows.map((r) => {
          const open = !!expanded[r.id];
          const d = detail[r.id];
          const dLoading = !!detailLoading[r.id];

          return (
            <div key={r.id} className="border-b border-slate-100 last:border-b-0">
              {/* summary row */}
              <div className={`${COLS} gap-2 px-3 py-2 text-sm items-center`}>
                <button
                  onClick={() => toggleExpand(r.id)}
                  className="text-left font-mono hover:underline truncate"
                  title={open ? "Hide details" : "Show details"}
                >
                  <span className="mr-1">{open ? "▾" : "▸"}</span>
                  {r.number}
                </button>

                <div className="whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      r.status === "paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "tab"
                        ? "bg-amber-100 text-amber-800"
                        : r.status === "open"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="truncate">{r.table_name || "-"}</div>
                <div className="truncate">{r.customer_name || "-"}</div>
                {/* <div className="truncate whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</div> */}
                <div className="truncate whitespace-nowrap">
                  {r.paid_at ? new Date(r.paid_at).toLocaleString() : "-"}
                </div>
                <div className="text-right whitespace-nowrap">{Number(r.total ?? 0).toFixed(2)}</div>
                <div className="truncate">{r.payment_method || "-"}</div>
              </div>

              {/* details row */}
              {open && (
                <div className="bg-slate-50 px-3 pb-3">
                  {dLoading && <div className="text-sm opacity-70">Loading details…</div>}
                  {!dLoading && d === null && (
                    <div className="text-sm text-red-600">Failed to load details.</div>
                  )}
                  {!dLoading && d && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap gap-4 text-sm mb-2">
                        <div>
                          <span className="opacity-60 mr-1">Order:</span>
                          <span className="font-mono">{d.number}</span>
                        </div>
                        <div>
                          <span className="opacity-60 mr-1">Table:</span>
                          {d.table?.name || r.table_name || "-"}
                        </div>
                        <div>
                          <span className="opacity-60 mr-1">Customer:</span>
                          {d.customer_name || "-"}
                        </div>
                        <div className="ml-auto">
                          <a
                            href={`/receipt/${d.id}`}
                            target="_blank"
                            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700"
                          >
                            Open receipt
                          </a>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200">
                        <div className="grid grid-cols-6 gap-2 border-b bg-slate-50 px-2 py-2 text-xs font-medium">
                          <div className="col-span-3">Item</div>
                          <div>Qty</div>
                          <div className="text-right">Unit</div>
                          <div className="text-right">Line</div>
                        </div>

                        {d.items.map((it) => (
                          <div
                            key={it.id}
                            className="grid grid-cols-6 gap-2 px-2 py-2 text-sm border-b last:border-b-0"
                          >
                            <div className="col-span-3">
                              {it.product_name}
                              {it.variant_name ? ` (${it.variant_name})` : ""}
                              {it.notes ? <span className="opacity-60"> — {it.notes}</span> : null}
                              {it.modifiers?.length > 0 && (
                                <div className="mt-2 space-y-1.5 text-xs opacity-80">
                                  {Object.values(groupModifiersForDisplay(it.modifiers)).map((group) => (
                                    <div key={group.key}>
                                      {group.title && (
                                        <div className="mb-0.5 uppercase tracking-wider text-[10px] font-semibold text-slate-500">
                                          {group.title}
                                        </div>
                                      )}
                                      <ul className="list-disc pl-5">
                                        {group.items.map(({ key, label, modifier }) => {
                                          const priceLabel =
                                            modifier?.include && Number(modifier?.price_delta) !== 0
                                              ? ` (+${(Number(modifier.price_delta) * (modifier.qty || 1)).toFixed(2)})`
                                              : "";
                                          return (
                                            <li key={key}>
                                              {label}
                                              {priceLabel}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>{it.qty}</div>
                            <div className="text-right">{Number(it.unit_price ?? 0).toFixed(2)}</div>
                            <div className="text-right">{Number(it.line_total ?? 0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>

                      {/* totals + FOC / comps */}
                      <div className="mt-3 ml-auto max-w-xs text-sm">
                        <div className="flex justify-between">
                          <span className="opacity-70">Subtotal</span>
                          <span>{Number(d.subtotal ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Tax</span>
                          <span>{Number(d.tax ?? 0).toFixed(2)}</span>
                        </div>

                        {/* FOC / Comps Section (improved labels) */}
                        {d.comps?.length > 0 &&
                          (() => {
                            const byId = new Map((d.items || []).map((it) => [it.id, it]));
                            const money = (n) => Number(n || 0).toFixed(2);

                            function compLabel(c) {
                              const reason = c.reason ? ` • ${c.reason}` : "";
                              if (c.scope === "item") {
                                const it = byId.get(c.item_id);
                                const name = it
                                  ? `${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ""}`
                                  : `Item #${c.item_id}`;
                                if (c.mode === "qty") {
                                  return `Item • ${name} • ×${c.qty}${reason}${c.voided_at ? " (voided)" : ""}`;
                                }
                                if (c.mode === "percent") {
                                  return `Item • ${name} • ${Number(c.percent || 0)}%${reason}${
                                    c.voided_at ? " (voided)" : ""
                                  }`;
                                }
                                return `Item • ${name}${reason}${c.voided_at ? " (voided)" : ""}`;
                              }
                              if (c.mode === "percent") {
                                return `Order • ${Number(c.percent || 0)}%${c.reason ? ` • ${c.reason}` : ""}${
                                  c.voided_at ? " (voided)" : ""
                                }`;
                              }
                              return `Order${reason}${c.voided_at ? " (voided)" : ""}`;
                            }

                            const activeFOC = d.comps
                              .filter((c) => !c.voided_at)
                              .reduce((s, c) => s + Number(c.amount || 0), 0);

                            return (
                              <div className="mt-2 border-t pt-2">
                                <div className="mb-1 text-xs font-semibold text-rose-700">FOC / Comps</div>

                                {d.comps.map((c) => (
                                  <div
                                    key={c.id}
                                    className={`flex justify-between text-xs ${
                                      c.voided_at ? "text-slate-400" : "text-rose-700"
                                    }`}
                                  >
                                    <span>{compLabel(c)}</span>
                                    <span>-{money(c.amount)}</span>
                                  </div>
                                ))}

                                <div className="flex justify-between mt-1 font-medium text-rose-600">
                                  <span>Total FOC</span>
                                  <span>-{money(activeFOC)}</span>
                                </div>
                              </div>
                            );
                          })()}

                        <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                          <span>Total</span>
                          <span>{Number(d.total ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && !loading && (
          <div className="px-3 py-2 text-sm text-slate-500">No orders found.</div>
        )}
      </section>

      {/* Pagination */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div>
          Page {page} / {totalPages} &nbsp;•&nbsp; {count} orders
        </div>
        <div className="flex items-center gap-2">
          <label className="opacity-70">Page size</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-2 py-1"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
