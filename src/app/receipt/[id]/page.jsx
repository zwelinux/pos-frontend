"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { groupModifiersForDisplay } from "@/lib/modifierDisplay";
import { formatMoney } from "@/lib/money";

/** Modernized Button Component */
function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const GhostBtn = (p) => (
  <Btn className="glass border-white/40 text-slate-600 hover:bg-white/80 hover:text-indigo-600 shadow-sm" {...p} />
);

const DangerBtn = (p) => (
  <Btn className="bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:border-rose-200 shadow-sm" {...p} />
);

const SuccessBtn = (p) => (
  <Btn className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-100 border-none" {...p} />
);

const PrimaryBtn = (p) => (
  <Btn className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-100 border-none" {...p} />
);

const WarningBtn = (p) => (
  <Btn className="bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 hover:border-amber-200 shadow-sm" {...p} />
);

export default function Receipt() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [comps, setComps] = useState([]);
  const [err, setErr] = useState("");
  const [settling, setSettling] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [tabBusy, setTabBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`${API}/orders/${id}/`, { cache: "no-store" });
      if (!r.ok) {
        setErr(
          r.status === 401
            ? "Unauthorized"
            : r.status === 404
            ? "Order not found"
            : `Error ${r.status}`
        );
        return;
      }
      const data = await r.json();
      setOrder(data);

      try {
        const rc = await authFetch(`${API}/orders/${id}/comps/`, { cache: "no-store" });
        setComps(rc.ok ? (await rc.json()) || [] : []);
      } catch {
        setComps([]);
      }

    } catch {
      setErr("Network error while loading receipt.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function settle(payment_method = "cash") {
    if (!order || settling || order.status === "void") return;
    setSettling(true);
    try {
      const r = await authFetch(`${API}/orders/${order.id}/settle/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method, free_table: true }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = await r.json();
      setOrder(updated);
    } catch {
      alert("Failed to settle the order.");
    } finally {
      setSettling(false);
    }
  }

  function openCashModal() {
    if (!order || settling || order.status === "void") return;
    setCashReceived(String(Number(order.total || 0)));
    setCashModalOpen(true);
  }

  async function confirmCashSettle() {
    const total = Number(order?.total || 0);
    const received = Number(cashReceived || 0);
    if (received < total) {
      alert("Received amount is less than total.");
      return;
    }
    await settle("cash");
    setCashModalOpen(false);
  }

  async function voidOrder() {
    if (!order || voiding || order.paid_at || order.status === "void") return;
    const reason = prompt("Reason for void? (optional)") ?? "";
    setVoiding(true);
    try {
      const r = await authFetch(`${API}/orders/${order.id}/void/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, free_table: true }),
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        alert(`Void failed (${r.status}) ${msg}`);
        return;
      }
      const updated = await r.json();
      setOrder(updated);
    } catch {
      alert("Network error while voiding the order.");
    } finally {
      setVoiding(false);
    }
  }

  async function openTab() {
    if (!order || tabBusy || order.status === "tab" || order.status === "void" || order.paid_at) return;
    const customer_name = (prompt("Customer name (optional):") || "").trim();
    const remark = (prompt("Remark (optional):") || "").trim();
    const credit_given = confirm("Mark as 'given' now? (OK = yes, Cancel = no)");
    setTabBusy(true);
    try {
      const r = await authFetch(`${API}/orders/${order.id}/open_tab/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name, remark, credit_given }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = await r.json();
      setOrder(updated);
    } catch {
      alert("Failed to open a tab.");
    } finally {
      setTabBusy(false);
    }
  }

  async function changePaymentMethod(nextMethod) {
    if (!order || !order.paid_at || order.status === "void" || paymentBusy) return;

    const normalized = String(nextMethod || "").trim().toLowerCase();
    if (!normalized || normalized === order.payment_method) return;

    setPaymentBusy(true);
    try {
      const r = await authFetch(`${API}/orders/${order.id}/change-payment-method/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: normalized }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to change payment method.");
      }
      const updated = await r.json();
      setOrder(updated);
    } catch (e) {
      alert(e.message || "Unable to change payment method.");
    } finally {
      setPaymentBusy(false);
    }
  }

  function promptChangePaymentMethod() {
    if (!order?.paid_at || order?.status === "void") return;
    const current = String(order.payment_method || "").toLowerCase();
    const options = ["cash", "card", "qr", "transfer", "other"].filter((value) => value !== current);
    const picked = prompt(`Change payment method from "${current}" to:\n${options.join(" / ")}`, options[0] || "");
    if (!picked) return;
    changePaymentMethod(picked);
  }

  function backToTable() {
    const hasTable = !!(order?.table?.id || order?.table_name);
    if (hasTable) {
      router.push("/?showOrder=1");
      return;
    }
    router.push(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
  }

  if (err) return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
       <div className="glass p-12 rounded-[3rem] text-center max-w-sm w-full border-rose-100">
         <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
         </div>
         <h2 className="text-xl font-black text-slate-900 mb-2">Order Error</h2>
         <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{err}</p>
       </div>
    </main>
  );

  if (!order) return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="animate-pulse flex flex-col items-center gap-4">
         <div className="h-12 w-12 rounded-2xl bg-indigo-100" />
         <div className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading Receipt…</div>
       </div>
    </main>
  );

  const isVoided = order.status === "void";
  const isPaid = !!order.paid_at;
  const isTab = order.status === "tab";

  const money = (n) => formatMoney(n);
  const totalDue = Number(order?.total || 0);
  const receivedAmount = Number(cashReceived || 0);
  const changeAmount = Math.max(0, receivedAmount - totalDue);
  const byId = new Map((order.items || []).map((it) => [it.id, it]));
  function compLabel(c) {
    if (c.scope === "item") {
      const it = byId.get(c.item_id);
      const name = it ? it.product_name : `Item #${c.item_id}`;
      if (c.mode === "qty") return `${name} ×${c.qty}`;
      if (c.mode === "percent") return `${name} (${Number(c.percent || 0)}%)`;
      return name;
    }
    if (c.mode === "percent") return `Order Discount (${Number(c.percent || 0)}%)`;
    return `Special Discount`;
  }
  const activeFOC = (comps || [])
    .filter((c) => !c.voided_at)
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50/50 py-12 px-4 selection:bg-indigo-100 flex items-start justify-center">
      {cashModalOpen && !isPaid && !isVoided && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm no-print">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cash Settle</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Cash Calculator</h2>
              </div>
              <button
                type="button"
                onClick={() => setCashModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total Due</div>
                <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">฿{money(totalDue)}</div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Cash Received
                </label>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-emerald-600">฿</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full bg-transparent text-3xl font-black tracking-tight text-slate-900 outline-none"
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[totalDue, 100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCashReceived(String(amount))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    ฿{money(amount)}
                  </button>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Change</div>
                <div className="mt-2 text-3xl font-black tracking-tight text-emerald-700">฿{money(changeAmount)}</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCashModalOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={settling || receivedAmount < totalDue}
                onClick={confirmCashSettle}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {settling ? "Working..." : "Confirm Cash"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start gap-8 md:gap-10 lg:gap-16 max-w-6xl w-full justify-center">
        
        {/* Receipt Paper Container */}
        <div className="receipt-paper max-w-[340px] w-full shrink-0 animate-slide-down md:sticky md:top-8">
          {/* Physical Paper Visuals */}
          <div className="relative bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 p-8 pt-10 overflow-hidden">
            
            {/* Header Branding */}
            <header className="text-center mb-8">
              <div className="receipt-screen-brand">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-indigo-600 text-white font-black text-2xl shadow-xl shadow-indigo-100 mb-4 rotate-3">
                  J
                </div>
              </div>
              <div className="receipt-brand-copy">
                <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 leading-none">Jus Food & Drinks</h1>
                {/* <div className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Kitchen & Social House
                </div> */}
              </div>
            </header>

            {/* Metadata Section */}
            <section className="flex flex-col gap-1.5 mb-8 text-[10px] font-bold uppercase tracking-widest border-y border-slate-50 py-4">
              <div className="flex justify-between">
                {/* <span>Order Ref</span> */}
                <span className="text-sm font-black text-slate-900">#{order.id} / {order.number}</span>
              </div>
              <div className="flex justify-between">
                {/* <span>Station</span> */}
                <span className="text-sm font-black text-slate-9000">{order.table_name || order.table?.name || "TAKEAWAY"}</span>
              </div>
              <div className="flex justify-between">
                {/* <span>Date</span> */}
                <span className="text-sm font-black text-slate-900">
                  {new Date(order.created_at || Date.now()).toLocaleDateString('en-GB')} {new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </section>

            {/* Status Badges */}
            {(isVoided || isTab || isPaid) && (
              <div className="mb-8 no-print">
                {isVoided && (
                  <div className="bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Transaction Status</div>
                    <div className="text-xl font-black mt-1">VOIDED</div>
                  </div>
                )}
                {isTab && !isPaid && (
                  <div className="bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Transaction Status</div>
                    <div className="text-xl font-black mt-1">ON TAB</div>
                    {order.customer_name && <div className="text-[10px] font-bold mt-1 opacity-60">— {order.customer_name}</div>}
                  </div>
                )}
                {isPaid && (
                  <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl p-4 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">Transaction Status</div>
                    <div className="text-xl font-black mt-1">COMPLETED</div>
                  </div>
                )}
              </div>
            )}

            {/* Items Section */}
            <section className="space-y-4 mb-8">
              {(order.items || []).map((it) => (
                <div key={it.id} className="group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-sm font-black text-slate-900 leading-tight line-clamp-2">
                           {it.product_name}
                        </div>
                        <div className="text-sm font-bold text-slate-900 uppercase tracking-tighter">
                           {/* {it.qty} × {money(it.unit_price)}฿ */}
                            {it.qty}
                        </div>
                      </div>
                      {(it.variant_name || it.modifiers?.length > 0) && (
                        <div className="mt-3 space-y-1 text-sm font-bold text-slate-900 uppercase tracking-wider">
                          {it.variant_name && <div className="text-black text-sm">{it.variant_name}</div>}
                          {Object.values(groupModifiersForDisplay(it.modifiers || [])).map((group) => (
                            <div key={group.key} className="flex flex-wrap gap-1">
                              {group.title && (
                                <span className="text-slate-900 text-sm">{group.title}</span>
                              )}
                              {group.items.map(({ key, label }) => (
                                <span key={key} className="before:content-['·'] before:mr-1 truncate max-w-[120px] text-slate-900 text-sm font-bold">
                                  {label}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-slate-900">{money(it.line_total)}฿</div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Discounts / FOC */}
            {comps?.length > 0 && (
              <section className="mb-8 border-t border-slate-50 pt-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Applied Comps</h3>
                <div className="space-y-2">
                  {comps.map((c) => (
                    <div key={c.id} className={`flex justify-between text-[11px] font-bold ${c.voided_at ? 'text-slate-300 line-through' : 'text-emerald-600'}`}>
                      <span>{compLabel(c)}</span>
                      <span>-฿{money(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer Totals */}
            <section className="border-t-2 border-dashed border-slate-100 pt-8 mt-4">
               <div className="flex justify-between items-center mb-6">
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Total</div>
                  <div className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">{money(order.total)} ฿</div>
               </div>
               
               {/* Print Thank You (Only in Print) */}
               <div className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-900 mt-10 print-only">
                  {isPaid ? "Thank You!" : "Payment Pending"}
               </div>
            </section>
          </div>
        </div>

        {/* Action Buttons Side HUD (Screen HUD only) */}
        <div className="w-full md:w-[360px] lg:w-[420px] max-w-[420px] flex flex-col gap-4 md:gap-5 no-print md:sticky md:top-8">
          <button
            onClick={backToTable}
            className="w-full h-16 flex items-center justify-center gap-3 rounded-[2.2rem] glass border-white/40 text-slate-700 font-black uppercase tracking-[0.2em] text-sm hover:bg-white/80 transition-all hover:-translate-y-1 active:translate-y-0 shadow-xl shadow-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h11" /></svg>
            Back To Table
          </button>

          {isPaid && !isVoided && (
            <button
              onClick={promptChangePaymentMethod}
              disabled={paymentBusy}
              className="w-full h-16 flex items-center justify-center gap-3 rounded-[2.2rem] border border-amber-200 bg-amber-50 text-amber-700 font-black uppercase tracking-[0.2em] text-sm hover:bg-amber-100 transition-all hover:-translate-y-1 active:translate-y-0 shadow-xl shadow-amber-100/40 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v10m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {paymentBusy ? "Changing..." : `Change Payment (${String(order.payment_method || "unknown").toUpperCase()})`}
            </button>
          )}

          {!isPaid && !isVoided && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={openCashModal}
                  disabled={settling}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-emerald-600 py-8 px-4 text-white shadow-2xl shadow-emerald-200/50 transition-all hover:bg-emerald-500 hover:-translate-y-1.5 active:translate-y-0.5 disabled:opacity-50"
                >
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/20 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-80 mb-0.5">Payment</div>
                    <div className="text-sm font-black uppercase tracking-tight">{settling ? "Working..." : "Cash Settle"}</div>
                  </div>
                  <div className="absolute inset-0 rounded-[2.5rem] bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                </button>

                <button 
                  onClick={() => settle("card")}
                  disabled={settling}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-indigo-600 py-8 px-4 text-white shadow-2xl shadow-indigo-200/50 transition-all hover:bg-indigo-500 hover:-translate-y-1.5 active:translate-y-0.5 disabled:opacity-50"
                >
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/20 shadow-inner group-hover:-rotate-12 transition-transform duration-500">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-80 mb-0.5">Transaction</div>
                    <div className="text-sm font-black uppercase tracking-tight">{settling ? "Working..." : "Card Charge"}</div>
                  </div>
                  <div className="absolute inset-0 rounded-[2.5rem] bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {!isTab && (
                  <button 
                    onClick={openTab}
                    disabled={tabBusy}
                    className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] glass border-2 border-amber-100/50 bg-amber-50/30 py-7 px-4 text-amber-600 shadow-xl shadow-amber-100/20 transition-all hover:bg-amber-50/60 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
                  >
                    <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-amber-100/50 mb-1 group-hover:scale-110 transition-transform duration-500">
                      <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">{tabBusy ? "Opening..." : "Move to Tab"}</span>
                  </button>
                )}
                <button 
                  onClick={voidOrder}
                  disabled={voiding}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-[2.5rem] glass border-2 border-rose-100/50 bg-rose-50/30 py-7 px-4 text-rose-600 shadow-xl shadow-rose-100/20 transition-all hover:bg-rose-50/60 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50"
                >
                  <div className="h-11 w-11 flex items-center justify-center rounded-2xl bg-rose-100/50 mb-1 group-hover:scale-110 transition-transform duration-500">
                    <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">{voiding ? "Voiding..." : "Void Order"}</span>
                </button>
              </div>
            </>
          )}

          {(isPaid || isVoided) && (
            <div className="text-center no-print w-full">
              <button 
                onClick={() => window.print()} 
                className="w-full h-20 flex items-center justify-center gap-3 rounded-[2.5rem] glass border-white/40 text-slate-700 font-black uppercase tracking-[0.2em] text-sm hover:bg-white/80 transition-all hover:-translate-y-1 active:translate-y-0 shadow-xl shadow-slate-100"
              >
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                 Print Receipt Copy
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @font-face {
          font-family: 'ReceiptFont';
          src: local('Courier New'), local('Courier');
        }

        .print-only { display: none !important; }

        @media print {
          .print-hide, .no-print { display: none !important; }
          .print-only { display: block !important; }
          .receipt-paper header { display: block !important; }
          .receipt-screen-brand { display: none !important; }
          .receipt-brand-copy {
            margin-bottom: 4mm !important;
            padding-bottom: 3mm !important;
            border-bottom: 1px dashed #a1a1aa !important;
          }
          
          @page {
            size: 80mm auto;
            margin: 6mm 4mm 6mm 4mm;
          }
          
          html, body {
            background: #fff !important;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          main {
            min-height: auto !important;
            background: #fff !important;
            padding: 0 !important;
            display: block !important;
          }

          main > div,
          .receipt-paper > div {
            width: 100% !important;
            max-width: none !important;
          }

          .receipt-paper {
            width: auto !important;
            max-width: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            transform: none !important;
            animation: none !important;
          }

          .receipt-paper .relative {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            padding: 3mm 0 4mm !important;
            overflow: visible !important;
          }

          .receipt-paper header {
            margin-bottom: 5mm !important;
            padding-top: 2mm !important;
          }

          .receipt-paper section {
            margin-bottom: 4mm !important;
          }

          .receipt-paper .border-y,
          .receipt-paper .border-t,
          .receipt-paper .border-t-2 {
            border-color: #d4d4d8 !important;
          }

          .receipt-paper .border-dashed {
            border-style: dashed !important;
          }

          .receipt-paper .bg-indigo-600,
          .receipt-paper .bg-emerald-50,
          .receipt-paper .bg-rose-50,
          .receipt-paper .bg-amber-50,
          .receipt-paper .bg-white,
          .receipt-paper .bg-slate-50\/50,
          .receipt-paper .bg-slate-50,
          .receipt-paper .bg-slate-100,
          .receipt-paper .bg-indigo-50,
          .receipt-paper .bg-white\/20 {
            background: transparent !important;
          }

          .receipt-paper .shadow-xl,
          .receipt-paper .shadow-2xl,
          .receipt-paper .shadow-sm,
          .receipt-paper .shadow-indigo-100,
          .receipt-paper .shadow-emerald-100,
          .receipt-paper .shadow-slate-100 {
            box-shadow: none !important;
          }

          .receipt-paper .rounded-\[2rem\],
          .receipt-paper .rounded-\[1\.5rem\],
          .receipt-paper .rounded-2xl,
          .receipt-paper .rounded-xl {
            border-radius: 0 !important;
          }

          /* Force black text for contrast on thermal */
          .receipt-paper * {
            color: black !important;
            text-shadow: none !important;
          }
          
          .receipt-paper .text-slate-400,
          .receipt-paper .text-slate-500,
          .receipt-paper .text-indigo-500,
          .receipt-paper .text-indigo-600,
          .receipt-paper .text-emerald-600,
          .receipt-paper .text-rose-600,
          .receipt-paper .text-amber-700 {
             color: #666 !important;
             opacity: 0.8;
          }

          .receipt-paper .text-3xl {
            font-size: 24px !important;
            line-height: 1 !important;
          }

          .receipt-paper .text-xl {
            font-size: 18px !important;
          }

          .receipt-paper .text-sm {
            font-size: 12px !important;
          }
        }
      `}</style>
    </main>
  );
}
