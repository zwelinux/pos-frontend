// /src/components/OrderPanel.jsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrder } from "@/store/order";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

function money(n) {
  return formatMoney(n);
}

function Btn({ children, className = "", ...props }) {
  return (
    <button
      className={
        "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition " +
        "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
const GhostBtn = (p) => <Btn className="border-slate-300 hover:bg-slate-50" {...p} />;
const DangerBtn = (p) => <Btn className="border-rose-300 text-rose-600 hover:bg-rose-50" {...p} />;
const PrimaryBtn = (p) => (
  <Btn className="border-slate-900 bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-300" {...p} />
);

/** Modal-style popup used for both Line-FOC and Order-FOC */
function MenuPopup({ label, actions = [], disabled = false }) {
  const [open, setOpen] = useState(false);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <GhostBtn disabled={disabled} onClick={() => !disabled && setOpen(true)}>
        {label}
      </GhostBtn>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[320px] rounded-xl bg-white p-4 shadow-lg">
            <h3 className="mb-3 text-base font-semibold">{label}</h3>

            <div className="space-y-2">
              {actions.map((a, i) => (
                <button
                  key={i}
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    a.onClick?.();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="mt-4 text-right">
              <GhostBtn onClick={() => setOpen(false)}>Cancel</GhostBtn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function OrderPanel() {
  const searchParams = useSearchParams();
  const wantsPanel = searchParams.get("showOrder") === "1";

  const { order, hasHydrated, ensureFresh, recoverOrder } = useOrder();

  const [busyIds, setBusyIds] = useState(new Set());
  const [busyOrder, setBusyOrder] = useState(false);
  const isBusy = (id) => busyIds.has(id);
  const markBusy = (id) => setBusyIds((s) => new Set(s).add(id));
  const clearBusy = (id) =>
    setBusyIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });

  const [comps, setComps] = useState([]);

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
  }, [hasHydrated, order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasHydrated) {
    return <aside className="p-4 border rounded-lg text-sm text-slate-500">Loading…</aside>;
  }
  if (!order?.id) {
    return <aside className="p-4 border rounded-lg text-sm text-slate-600">No active order yet.</aside>;
  }

  // ---------- qty / delete ----------
  async function setQty(itemId, qty) {
    if (qty <= 0) return removeItem(itemId);
    if (isBusy(itemId)) return;
    markBusy(itemId);
    try {
      await authFetch(`${API}/orders/${order.id}/items/${itemId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: Number(qty) }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      clearBusy(itemId);
    }
  }

  async function removeItem(itemId) {
    if (isBusy(itemId)) return;
    if (!confirm("Remove this item?")) return;
    markBusy(itemId);
    try {
      await authFetch(`${API}/orders/${order.id}/items/${itemId}/`, { method: "DELETE" });
      await ensureFresh();
      await fetchComps();
    } finally {
      clearBusy(itemId);
    }
  }

  // ---------- comps (FOC) ----------
  async function compItemQty(itemId, qty = 1, reason = "FOC") {
    if (isBusy(itemId)) return;
    markBusy(itemId);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "qty", item_id: itemId, qty, reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      clearBusy(itemId);
    }
  }
  async function compItemPercent(itemId, percent, reason = "FOC %") {
    if (isBusy(itemId)) return;
    markBusy(itemId);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "percent", item_id: itemId, percent: Number(percent), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      clearBusy(itemId);
    }
  }
  async function compItemAmount(itemId, amount, reason = "FOC $") {
    if (isBusy(itemId)) return;
    markBusy(itemId);
    try {
      await authFetch(`${API}/orders/${order.id}/comps/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "item", mode: "amount", item_id: itemId, amount: Number(amount), reason }),
      });
      await ensureFresh();
      await fetchComps();
    } finally {
      clearBusy(itemId);
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

  // Quick rewind helpers
  async function voidAllComps() {
    if (busyOrder) return;
    const active = (comps || []).filter((c) => !c.voided_at);
    if (!active.length) return;
    setBusyOrder(true);
    try {
      for (const c of active) {
        await authFetch(`${API}/orders/${order.id}/comps/${c.id}/void/`, { method: "POST" });
      }
      await ensureFresh();
      await fetchComps();
    } finally {
      setBusyOrder(false);
    }
  }

  async function undoLastComp() {
    const active = (comps || []).filter((c) => !c.voided_at);
    if (!active.length) return;
    // prefer created_at if provided; otherwise fall back to id
    const last = active
      .slice()
      .sort((a, b) => {
        if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
        return (b.id ?? 0) - (a.id ?? 0);
      })[0];
    await voidComp(last.id);
  }

  // ---------- computed ----------
  const subtotal = Number(order?.subtotal ?? 0);
  const tax = Number(order?.tax ?? 0);
  const total = Number(order?.total ?? subtotal + tax);
  const tableName =
    order.table_name || order.table?.name || (order.table_id ? `Table ${order.table_id}` : "Takeaway");
  const status = (order.status || "open").replace(/_/g, " ");
  const compTotal = (comps || []).filter((c) => !c.voided_at).reduce((s, c) => s + Number(c.amount || 0), 0);

  const hasActiveComps = (comps || []).some((c) => !c.voided_at);

  return (
    <aside className="flex h-full flex-col rounded-xl border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div>
          <div className="text-lg font-semibold">Table Order</div>
          <div className="text-xs text-slate-600">
            {/* {tableName} • <span className="capitalize">{status}</span> */}
            {tableName} 
          </div>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs">#{order.id}</span>
      </div>

      {/* Editable lines */}
      <div className="max-h-[52vh] overflow-auto px-4">
        {!order.items?.length ? (
          <div className="my-6 text-sm text-slate-500">No items yet.</div>
        ) : (
          <ul className="space-y-3">
            {order.items.map((it) => {
              const comped = Number(it?.comped_amount ?? 0);
              const net = Number(it?.net_line_total ?? it.line_total ?? 0);

              return (
                <li key={it.id} className="rounded-lg border p-3">
                  {/* top: name + controls UNDER the name */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {it.product_name}
                        {it.variant_name ? ` — ${it.variant_name}` : ""}
                      </div>

                      {!!it.modifiers?.length && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {it.modifiers.map((m) => (m.include ? "" : "No ") + m.option_name).join(", ")}
                        </div>
                      )}

                      <div className="mt-1 text-[11px] text-slate-500">
                        {Number(it.qty)} × {money(it.unit_price)}
                      </div>

                      {/* quantity controls */}
                      <div className="mt-2 flex items-center gap-2">
                        <GhostBtn
                          aria-label="Decrease quantity"
                          disabled={isBusy(it.id)}
                          onClick={() => setQty(it.id, Number(it.qty) - 1)}
                          title="Decrease"
                        >
                          −
                        </GhostBtn>
                        <div className="w-8 text-center tabular-nums">{it.qty}</div>
                        <GhostBtn
                          aria-label="Increase quantity"
                          disabled={isBusy(it.id)}
                          onClick={() => setQty(it.id, Number(it.qty) + 1)}
                          title="Increase"
                        >
                          +
                        </GhostBtn>
                        <DangerBtn title="Remove line" disabled={isBusy(it.id)} onClick={() => removeItem(it.id)}>
                          Remove
                        </DangerBtn>
                      </div>
                    </div>
                  </div>

                  {/* bottom: FOC actions + amounts */}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="flex flex-wrap gap-2">
                      <MenuPopup
                        label="FOC (Line)"
                        disabled={isBusy(it.id)}
                        actions={[
                          { label: "×1 — one unit", onClick: () => compItemQty(it.id, 1) },
                          {
                            label: "% — by percent…",
                            onClick: () => {
                              const v = prompt("Line FOC percent (0–100):", "100");
                              if (v !== null) compItemPercent(it.id, Number(v));
                            },
                          },
                          {
                            label: "$ — by amount…",
                            onClick: () => {
                              const v = prompt("Line FOC amount:", money(it.unit_price));
                              if (v !== null) compItemAmount(it.id, Number(v));
                            },
                          },
                        ]}
                      />
                    </div>

                    <div className="text-right">
                      {comped > 0 ? (
                        <>
                          <div className="text-xs text-slate-500 line-through">{money(it.line_total)}</div>
                          <div className="font-semibold">{money(net)}</div>
                        </>
                      ) : (
                        <div className="font-semibold">{money(it.line_total)}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Comps list */}
      {comps?.length > 0 && (
        <div className="mx-4 my-3 rounded-lg bg-slate-50 p-3">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>FOC / Comps</span>
            <div className="flex gap-2">
              <GhostBtn disabled={busyOrder || !hasActiveComps} onClick={undoLastComp} title="Void the latest comp">
                Undo last
              </GhostBtn>
              <GhostBtn disabled={busyOrder || !hasActiveComps} onClick={voidAllComps} title="Void all active comps">
                Void all
              </GhostBtn>
            </div>
          </div>

          {comps.map((c) => {
            const voided = !!c.voided_at;
            return (
              <div
                key={c.id}
                className={
                  "flex items-center justify-between rounded-md px-2 py-1 text-xs " +
                  (voided ? "text-slate-400" : "")
                }
              >
                <div className="truncate">
                  {c.scope === "item" ? "Item" : "Order"} • {c.mode}
                  {c.reason ? ` • ${c.reason}` : ""}
                  {voided && " (voided)"}
                </div>
                <div className="flex items-center gap-2">
                  {!voided && (
                    <GhostBtn disabled={busyOrder} onClick={() => voidComp(c.id)} title="Void this comp">
                      Void
                    </GhostBtn>
                  )}
                  <span className="tabular-nums">-{money(c.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Totals */}
      <div className="mt-auto space-y-1 p-4 text-sm">
        {compTotal > 0 && (
          <div className="flex justify-between text-sm text-rose-600">
            <span>FOC / Comps</span>
            <span>-{money(compTotal)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 flex flex-wrap gap-2 p-4 pt-2">
        <PrimaryBtn onClick={() => (window.location.href = `/receipt/${order.id}`)}>Receipt</PrimaryBtn>

        <MenuPopup
          label="FOC (Order)"
          disabled={busyOrder}
          actions={[
            {
              label: "% — by percent…",
              onClick: () => {
                const v = prompt("Order FOC percent (0–100):", "100");
                if (v !== null) compOrderPercent(Number(v));
              },
            },
            {
              label: "$ — by amount…",
              onClick: () => {
                const v = prompt("Order FOC amount:", money(total));
                if (v !== null) compOrderAmount(Number(v));
              },
            },
          ]}
        />
      </div>
    </aside>
  );
}
