"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useOrder } from "@/store/order";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { groupModifiersForDisplay } from "@/lib/modifierDisplay";
import { formatMoney } from "@/lib/money";

function money(n) {
  return formatMoney(n);
}

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

const PrimaryBtn = (p) => (
  <Btn className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-100 border-none" {...p} />
);

const SuccessBtn = (p) => (
  <Btn className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 shadow-sm" {...p} />
);

/** Modernized Menu Popup */
function MenuPopup({ label, actions = [], disabled = false, buttonClassName = "", wrapperClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const modalContent = open && mounted && createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-[340px] rounded-[2rem] glass border-white/20 bg-white/90 p-8 shadow-2xl animate-slide-down">
        <h3 className="mb-6 text-xl font-black text-slate-900 tracking-tight">{label}</h3>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <button
              key={i}
              className="block w-full rounded-2xl border border-slate-100 bg-white/50 px-4 py-3 text-left text-sm font-bold text-slate-700 transition-all hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100"
              onClick={() => {
                setOpen(false);
                a.onClick?.();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <button 
            onClick={() => setOpen(false)}
            className="w-full py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className={`relative ${wrapperClassName}`}>
      <GhostBtn
        className={buttonClassName}
        disabled={disabled}
        onClick={() => !disabled && setOpen(true)}
      >
        {label}
      </GhostBtn>
      {modalContent}
    </div>
  );
}

export default function OrderPanel({ onClose }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsPanel = searchParams.get("showOrder") === "1";
  const { order, hasHydrated, ensureFresh, recoverOrder, clearOrder, setLastTableId } = useOrder();

  const [busyOrder, setBusyOrder] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [comps, setComps] = useState([]);
  const [panelError, setPanelError] = useState("");

  async function fetchComps() {
    if (!order?.id) return;
    try {
      const res = await authFetch(`${API}/orders/${order.id}/comps/`);
      const data = await res.json();
      setComps(Array.isArray(data) ? data : []);
    } catch {
      setComps([]);
    }
  }

  useEffect(() => {
    if (!hasHydrated) return;
    if (wantsPanel && !order?.id) recoverOrder();
  }, [hasHydrated, wantsPanel, order?.id, recoverOrder]);

  useEffect(() => {
    if (hasHydrated && order?.id) {
      (async () => {
        await ensureFresh();
        await fetchComps();
      })();
    }
  }, [hasHydrated, order?.id]);

  useEffect(() => {
    if (!order?.items) return;
    if (selectedItemId && !order.items.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [order?.items, selectedItemId]);

  useEffect(() => {
    setPanelError("");
  }, [order?.id]);

  if (!hasHydrated) {
    return <aside className="glass h-full p-8 rounded-[2.5rem] animate-pulse border-white/20" />;
  }
  if (!order?.id) {
    return (
      <aside className="glass h-full flex flex-col items-center justify-center p-8 rounded-[2.5rem] border-white/20 text-center">
        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
           <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
        </div>
        <div className="text-lg font-black text-slate-900 tracking-tight">Cart Empty</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Start adding products</div>
      </aside>
    );
  }

  // ---------- actions ----------
  async function setQty(itemId, qty) {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      if (qty <= 0) {
        await removeItem(itemId);
      } else {
        await authFetch(`${API}/orders/${order.id}/items/${itemId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qty }),
        });
        await ensureFresh();
        await fetchComps();
      }
    } finally {
      setBusyOrder(false);
    }
  }

  async function removeItem(itemId) {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      // Small delay to simulate sync for better UX feedback
      await new Promise(r => setTimeout(r, 400));
      await authFetch(`${API}/orders/${order.id}/items/${itemId}/`, { method: "DELETE" });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function compItemQty(itemId, qty = 1, reason = "FOC") {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "qty", item_id: itemId, qty, reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function compItemPercent(itemId, percent, reason = "FOC %") {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "percent", item_id: itemId, percent: Number(percent), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function compItemAmount(itemId, amount, reason = "FOC $") {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "amount", item_id: itemId, amount: Number(amount), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function compOrderPercent(percent, reason = "FOC order %") {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "order", mode: "percent", percent: Number(percent), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function compOrderAmount(amount, reason = "FOC order $") {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "order", mode: "amount", amount: Number(amount), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function voidComp(compId) {
    if (busyOrder) return;
    setBusyOrder(true);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/${compId}/void/`, { method: "POST" });
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function freeEmptyTable() {
    const tableId = order?.table?.id ?? order?.table_id;
    if (!tableId || busyOrder) return;

    setBusyOrder(true);
    setPanelError("");
    try {
      const r = await authFetch(`${API}/tables/${tableId}/free/`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Unable to free table.");
      }

      clearOrder();
      setLastTableId(null);
      router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
    } catch (e) {
      setPanelError(e.message || "Unable to free table.");
    } finally {
      setBusyOrder(false);
    }
  }

  // ---------- computed ----------
  const subtotal = Number(order?.subtotal ?? 0);
  const tax = Number(order?.tax ?? 0);
  const total = Number(order?.total ?? subtotal + tax);
  const tableName = order.table_name || order.table?.name || (order.table_id ? `Table ${order.table_id}` : "Takeaway");
  const compTotal = (comps || []).filter((c) => !c.voided_at).reduce((s, c) => s + Number(c.amount || 0), 0);
  const hasActiveComps = (comps || []).some((c) => !c.voided_at);
  const selectedItem = order.items?.find((i) => i.id === selectedItemId);
  const canFreeEmptyTable = !!(order?.table?.id || order?.table_id) && !order?.items?.length && total <= 0 && !hasActiveComps;

  return (
    <aside className="flex h-full flex-col glass rounded-[2.5rem] border-white/20 shadow-2xl overflow-hidden relative">
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between">
           <div>
             <div className="text-2xl font-black text-slate-900 tracking-tight">Active Order</div>
             <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
               <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-slate-600 font-black">{tableName}</span>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <span className="hidden sm:inline-block rounded-xl glass border-white/40 px-3 py-1 text-[10px] font-black text-slate-500 shadow-sm ring-1 ring-slate-900/5">
               ID: #{order.id}
             </span>
             {onClose && (
               <button 
                 onClick={onClose}
                 className="md:hidden h-10 w-10 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
               >
                 <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             )}
           </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-2">
        {!order.items?.length ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
             <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Empty Selection</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {order.items.map((it) => {
              const comped = Number(it?.comped_amount ?? 0);
              const net = Number(it?.net_line_total ?? it.line_total ?? 0);
              const isSelected = selectedItemId === it.id;
              
              return (
                <li
                  key={it.id}
                  onClick={() => setSelectedItemId(isSelected ? null : it.id)}
                  className={`relative rounded-2xl border p-4 cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-white border-indigo-100 shadow-xl shadow-indigo-50/50 -translate-y-1"
                      : "glass border-white/20 hover:border-indigo-100"
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-slate-800">
                        {/* {it.product_name} {Number(it.qty)} × {money(it.unit_price)} */}
                        {it.product_name} x {Number(it.qty)}
                      </div>
                      {it.variant_name && (
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                          {it.variant_name}
                        </div>
                      )}
                      
                      {!!it.modifiers?.length && (
                        <div className="mt-2 space-y-1.5">
                          {Object.values(groupModifiersForDisplay(it.modifiers)).map((group) => (
                            <div key={group.key} className="flex flex-col gap-0.5">
                              {group.title && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 opacity-80 leading-none">
                                  {group.title}
                                </span>
                              )}
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {group.items.map(({ key, label }) => (
                                  <span key={key} className="text-[9.5px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 italic">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900">
                        {comped > 0 ? (
                          <span className="text-emerald-600">฿{money(net)}</span>
                        ) : (
                          `฿${money(it.line_total)}`
                        )}
                      </div>
                      {/* <div className="text-[10px] font-bold text-slate-400">
                        {Number(it.qty)} × {money(it.unit_price)}
                      </div> */}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Selected Item Controls Overlay */}
      <div className={`transition-all duration-500 absolute inset-x-0 bottom-0 z-[60] transform ${
        selectedItem ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}>
        <div className="glass border-t border-white/60 shadow-[0_-20px_60px_rgba(0,0,0,0.15)] p-10 relative overflow-hidden backdrop-blur-3xl rounded-t-[3rem]">
           {/* Background Accent */}
           <div className="absolute -top-10 -right-10 h-32 w-32 bg-indigo-500/5 rounded-full blur-3xl" />
           
           <div className="flex items-start justify-between mb-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50 px-2 py-0.5 mb-2 shadow-sm">
                   <div className="h-1 w-1 rounded-full bg-indigo-500 animate-pulse" />
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">Adjusting Item</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none truncate max-w-[240px]">
                  {selectedItem?.product_name}
                </h3>
                {selectedItem?.variant_name && (
                   <div className="mt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedItem?.variant_name}</div>
                )}
              </div>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(null); }}
                className="relative z-10 h-10 w-10 cursor-pointer rounded-2xl glass border-white/40 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all duration-300 shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
           
           <div className="space-y-8">
             {/* Quantity Selector Section */}
             <div className="flex items-center justify-between p-2 glass rounded-[2rem] border-white/40 shadow-inner bg-white/40">
               <button
                 disabled={busyOrder}
                 onClick={(e) => { e.stopPropagation(); setQty(selectedItem?.id, Number(selectedItem?.qty) - 1); }}
                 className="h-16 w-16 flex items-center justify-center rounded-[1.4rem] bg-white shadow-lg font-black text-2xl text-slate-400 hover:text-indigo-600 active:scale-90 active:shadow-inner transition-all hover:translate-y-[-2px]"
               > − </button>
               
               <div className="flex flex-col items-center">
                 <div className="text-4xl font-black tabular-nums text-indigo-600 tracking-tighter">{selectedItem?.qty}</div>
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Units Selected</div>
               </div>
               
               <button
                 disabled={busyOrder}
                 onClick={(e) => { e.stopPropagation(); setQty(selectedItem?.id, Number(selectedItem?.qty) + 1); }}
                 className="h-16 w-16 flex items-center justify-center rounded-[1.4rem] bg-white shadow-lg font-black text-2xl text-slate-400 hover:text-indigo-600 active:scale-90 active:shadow-inner transition-all hover:translate-y-[-2px]"
               > + </button>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-2 gap-4">
               <MenuPopup
                 label="Apply Disct. / FOC"
                 disabled={busyOrder}
                 actions={[
                   { label: "1 Unit Full FOC", onClick: () => compItemQty(selectedItem.id, 1) },
                   {
                     label: "Discount Percent…",
                     onClick: () => {
                       const v = prompt("Enter percentage (0-100):", "100");
                       if (v) compItemPercent(selectedItem.id, Number(v));
                     },
                   },
                 ]}
               />
               <DangerBtn onClick={() => removeItem(selectedItem.id)}>
                 Remove Selection
               </DangerBtn>
             </div>
           </div>
        </div>
      </div>

      {/* Totals & Footer */}
      <div className="mt-auto p-8 pt-4 space-y-4">
        {panelError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {panelError}
          </div>
        ) : null}

        <div className="space-y-2 border-t border-white/20 pt-6">
          {compTotal > 0 && (
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-emerald-600">
              <span>Applied Discounts</span>
              <span>-฿{money(compTotal)}</span>
            </div>
          )}
          <div className="flex justify-between items-end">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Amount</span>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">
              {money(total)} ฿
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* <PrimaryBtn
            className="w-full rounded-2xl py-4 text-sm tracking-[0.18em] shadow-xl bg-indigo-600 text-white shadow-indigo-200"
            onClick={() => (window.location.href = `/receipt/${order.id}`)}
          > */}
          <PrimaryBtn
            className="w-full rounded-2xl py-4 text-sm bg-indigo-600 text-white"
            onClick={() => (window.location.href = `/receipt/${order.id}`)}
          >
            Print Receipt
          </PrimaryBtn>

          <div className={`grid gap-3 ${canFreeEmptyTable ? "grid-cols-2" : "grid-cols-1"}`}>
          <MenuPopup
            label="Order FOC"
            wrapperClassName="w-full"
            buttonClassName="w-full rounded-2xl py-4 text-sm justify-center bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-800 shadow-sm"
            actions={[
              { label: "100% Order FOC", onClick: () => compOrderPercent(100) },
              {
                label: "Custom Percent…",
                onClick: () => {
                  const v = prompt("Enter Custom Percent (0–100):", "10");
                  if (v) compOrderPercent(Number(v));
                },
              }
            ]}
          />

          {canFreeEmptyTable ? (
              <SuccessBtn
                className="w-full rounded-2xl py-4 text-sm justify-center"
                disabled={busyOrder}
                onClick={freeEmptyTable}
              >
                Free
              </SuccessBtn>
            ) : null}
          </div>
        </div>
      </div>
      
      {busyOrder && (
        <div className="absolute inset-0 z-[100] bg-white/40 backdrop-blur-[1px] flex items-center justify-center cursor-wait">
           <div className="h-2 w-12 glass rounded-full animate-pulse bg-indigo-500/20" />
        </div>
      )}
    </aside>
  );
}
