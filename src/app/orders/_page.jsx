"use client";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

const STATUSES = ["open", "tab", "paid", "void"];

function formatPaymentMethodLabel(value) {
  const method = String(value || "").toLowerCase();
  if (!method) return "-";
  if (method === "pending") return "Pay Later";
  if (method === "qr") return "Thai QR";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

// one place to keep the same column template for header + rows
const COLS =
  "grid grid-cols-[minmax(210px,1.6fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(160px,1.2fr)_minmax(200px,1.4fr)_minmax(200px,1.4fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(60px,0.6fr)_minmax(110px,0.9fr)]";

export default function OrdersDashboard() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [paidFrom, setPaidFrom] = useState("");
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
    if (createdFrom) p.set("created_from", createdFrom);
    if (createdTo) p.set("created_to", createdTo);
    if (paidFrom) p.set("paid_from", paidFrom);
    if (paidTo) p.set("paid_to", paidTo);
    if (ordering) p.set("ordering", ordering);
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, ordering]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  async function ensureDetail(id) {
    if (detail[id] || detailLoading[id]) return;
    setDetailLoading((p) => ({ ...p, [id]: true }));
    try {
      const r = await authFetch(`${API}/orders/${id}/`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setDetail((p) => ({ ...p, [id]: data }));
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
    <main className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-3">Orders Dashboard</h1>

      {/* Filters */}
      <div className="grid md:grid-cols-6 gap-2 items-end mb-3">
        <div className="md:col-span-2">
          <label className="block text-xs mb-1">Search (number / customer / table)</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
            placeholder="e.g. POS..., David, Table 3"
            className="border rounded px-2 py-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Status</label>
          <select className="border rounded px-2 py-1 w-full" value={status} onChange={(e)=>{setStatus(e.target.value); setPage(1);}}>
            <option value="">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1">Created From</label>
          <input type="date" className="border rounded px-2 py-1 w-full" value={createdFrom} onChange={e=>setCreatedFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs mb-1">Created To</label>
          <input type="date" className="border rounded px-2 py-1 w-full" value={createdTo} onChange={e=>setCreatedTo(e.target.value)} />
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1">Paid From</label>
            <input type="date" className="border rounded px-2 py-1 w-full" value={paidFrom} onChange={e=>setPaidFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Paid To</label>
            <input type="date" className="border rounded px-2 py-1 w-full" value={paidTo} onChange={e=>setPaidTo(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1">Sort</label>
          <select className="border rounded px-2 py-1 w-full" value={ordering} onChange={(e)=>setOrdering(e.target.value)}>
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
          <button onClick={()=>{setPage(1); load();}} className="px-3 py-2 rounded bg-slate-800 text-white">Apply</button>
          <button onClick={()=>{
            setQ(""); setStatus(""); setCreatedFrom(""); setCreatedTo(""); setPaidFrom(""); setPaidTo(""); setOrdering("-id"); setPage(1); load();
          }} className="px-3 py-2 rounded border">Reset</button>
        </div>
      </div>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-2">{err}</div>}
      {loading && <div className="mb-2">Loading…</div>}

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <div className={`${COLS} gap-2 px-3 py-2 font-medium border-b text-sm`}>
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

        {rows.map(r => {
          const open = !!expanded[r.id];
          const d = detail[r.id];
          const dLoading = !!detailLoading[r.id];

          return (
            <div key={r.id} className="border-b last:border-b-0">
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
                      r.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                      r.status === "tab"  ? "bg-amber-100 text-amber-800" :
                      r.status === "open" ? "bg-sky-100 text-sky-800" :
                                            "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="truncate">{r.table_name || "-"}</div>
                <div className="truncate">{r.customer_name || "-"}</div>
                {/* <div className="truncate whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</div> */}
                <div className="truncate whitespace-nowrap">{r.paid_at ? new Date(r.paid_at).toLocaleString() : "-"}</div>
                <div className="text-right whitespace-nowrap">{formatMoney(r.total ?? 0)}</div>
                <div className="truncate">{formatPaymentMethodLabel(r.payment_method)}</div>
                {/* <div className="text-right">{r.items_count}</div>
                <div className="flex gap-2">
                  <a href={`/receipt/${r.id}`} className="underline text-sky-700">Receipt</a>
                </div> */}
              </div>

              {/* details row */}
              {open && (
                <div className="px-3 pb-3 bg-white">
                  {dLoading && <div className="text-sm opacity-70">Loading details…</div>}
                  {!dLoading && d === null && (
                    <div className="text-sm text-red-600">Failed to load details.</div>
                  )}
                  {!dLoading && d && (
                    <div className="rounded border p-3">
                      <div className="flex flex-wrap gap-4 text-sm mb-2">
                        <div><span className="opacity-60 mr-1">Order:</span><span className="font-mono">{d.number}</span></div>
                        <div><span className="opacity-60 mr-1">Table:</span>{d.table?.name || r.table_name || "-"}</div>
                        <div><span className="opacity-60 mr-1">Customer:</span>{d.customer_name || "-"}</div>
                        <div className="ml-auto">
                          <a href={`/receipt/${d.id}`} target="_blank" className="px-2 py-1 rounded bg-slate-700 text-white">Open receipt</a>
                        </div>
                      </div>

                      <div className="border rounded">
                        <div className="grid grid-cols-6 gap-2 px-2 py-2 text-xs font-medium bg-slate-50 border-b">
                          <div className="col-span-3">Item</div>
                          <div>Qty</div>
                          <div className="text-right">Unit</div>
                          <div className="text-right">Line</div>
                        </div>

                        {d.items.map((it) => (
                          <div key={it.id} className="grid grid-cols-6 gap-2 px-2 py-2 text-sm border-b last:border-b-0">
                            <div className="col-span-3">
                              {it.product_name}{it.variant_name ? ` (${it.variant_name})` : ""}
                              {it.notes ? <span className="opacity-60"> — {it.notes}</span> : null}
                              {it.modifiers?.length > 0 && (
                                <ul className="list-disc pl-5 text-xs opacity-80">
                                  {it.modifiers.map((m) => (
                                    <li key={m.option_id}>
                                      {m.include ? "" : "No "}
                                      {m.option_name}
                                      {m.include && Number(m.price_delta) !== 0 ? ` (+${formatMoney(m.price_delta)})` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>{it.qty}</div>
                            <div className="text-right">{formatMoney(it.unit_price ?? 0)}</div>
                            <div className="text-right">{formatMoney(it.line_total ?? 0)}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 ml-auto max-w-xs text-sm">
                        <div className="flex justify-between">
                          <span className="opacity-70">Subtotal</span>
                          <span>{formatMoney(d.subtotal ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Tax</span>
                          <span>{formatMoney(d.tax ?? 0)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>{formatMoney(d.total ?? 0)}</span>
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
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-sm">
        <div>
          Page {page} / {totalPages} &nbsp;•&nbsp; {count} orders
        </div>
        <div className="flex items-center gap-2">
          <label className="opacity-70">Page size</label>
          <select
            value={pageSize}
            onChange={(e)=>{setPageSize(Number(e.target.value)); setPage(1);}}
            className="border rounded px-2 py-1"
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            disabled={page <= 1}
            onClick={()=>setPage(p=>Math.max(1, p-1))}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
