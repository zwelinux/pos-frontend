// src/app/cart/page.jsx
"use client";
import { useCart } from "@/store/cart";
import { API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { authFetch } from "@/lib/auth";
import AttachTableModal from "@/components/AttachTableModal";
import Link from "next/link";
import { useOrder } from "@/store/order";

// --- helpers: validate modifiers against product's allowed option IDs ---
async function fetchAllowedOptionIds(apiBase, items) {
  const uniqueIds = [...new Set(items.map((i) => i.productId))];
  const map = new Map();
  await Promise.all(
    uniqueIds.map(async (pid) => {
      const r = await fetch(`${apiBase}/products/${pid}/`, { cache: "no-store" });
      if (!r.ok) {
        map.set(pid, new Set());
        return;
      }
      const p = await r.json();
      const ids = new Set(
        (p.modifier_groups || [])
          .flatMap((g) => g.options || [])
          .map((o) => o.id)
      );
      map.set(pid, ids);
    })
  );
  return map;
}

function filterModsByAllowed(item, allowedMap) {
  const allowed = allowedMap.get(item.productId) || new Set();
  return (item.mods || [])
    .filter((m) => !!m.include && allowed.has(m.id))
    .map((m) => ({ option_id: m.id, include: true }));
}

// --- helper: fetch a fresh order (ensures items are present) ---
async function fetchFullOrder(orderId) {
  try {
    // const r = await authFetch(`${API}/orders/${orderId}/`);
    const r = await authFetch(`${API}/orders/${orderId}/`, {
      cache: "no-store", 
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default function CartPage() {
  const { items, total, clear, removeAt, incAt, decAt, setQtyAt } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ⬇️ pull setLastTableId from the store
  const { order, setOrder, setLastTableId } = useOrder();

  // If the current order already has a table, make sure we remember it
  useEffect(() => {
    if (order?.table?.id) setLastTableId(order.table.id);
  }, [order?.table?.id, setLastTableId]);

  // post-checkout: attach table modal
  const [needsAttach, setNeedsAttach] = useState(false);

  // default: Pay at end (dine-in)
  const [payNow, setPayNow] = useState(false);

  const hasItems = items.length > 0;

  const checkout = async () => {
    if (!hasItems || loading) return;
    setLoading(true);
    try {
      const allowedMap = await fetchAllowedOptionIds(API, items);
      const safeItems = items.map((i) => ({
        product_id: i.productId,
        variant_id: i.variantId,
        qty: i.qty,
        modifiers: filterModsByAllowed(i, allowedMap),
      }));

      if (order?.id && !payNow) {
        // Append to existing open order (pay later)
        const payload = { tax_rate: "0.00", items: safeItems };
        const r = await authFetch(`${API}/orders/${order.id}/add_items/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const msg = await r.text().catch(() => "");
          alert(`Add items failed (${r.status}) ${msg}`);
          return;
        }

        // Re-fetch the full order so the right panel has lines immediately
        const full = await fetchFullOrder(order.id);
        if (full) {
          setOrder(full);
          if (full.table?.id) setLastTableId(full.table.id);         // 👈 remember table
        } else if (order.table?.id) {
          setLastTableId(order.table.id);                             // fallback
        }

        clear();
        router.push("/?showOrder=1"); // show order immediately
        return;
      }

      // Create a fresh order
      const payload = {
        payment_method: payNow ? "cash" : "pending",
        tax_rate: "0.00",
        pay_now: !!payNow,
        table_id: order?.table?.id ?? null,
        items: safeItems,
      };

      const r = await authFetch(`${API}/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        alert(`Checkout failed (${r.status}) ${msg}`);
        return;
      }

      const data = await r.json();

      // Always fetch the fresh order by id so items are present
      const full = await fetchFullOrder(data.id);
      if (full) {
        setOrder(full);
        if (full.table?.id) setLastTableId(full.table.id);
      } else {
        // fallback: refetch directly (never use raw "data" snapshot)
        const retry = await authFetch(`${API}/orders/${data.id}/`, { cache: "no-store" });
        const fetched = await retry.json();
        setOrder(fetched);
        if (fetched.table?.id) setLastTableId(fetched.table.id);
      }

      clear();

      if (payNow) {
        router.push(`/receipt/${data.id}`);
      } else {
        if (!data.table) {
          setNeedsAttach(true); // ask to attach table
        } else {
          router.push("/?showOrder=1");
        }
      }
    } catch {
      alert("Network error during checkout.");
    } finally {
      setLoading(false);
    }
  };

  // after successful attach inside modal
  function onAttached() {
    // The modal should update the order; the effect above will capture table.id and store it.
    setNeedsAttach(false);
    router.push("/?showOrder=1");
  }

  const showAttachModal = useMemo(
    () => !!order && !order.table && !payNow && needsAttach,
    [order, payNow, needsAttach]
  );

  return (
    <main className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-xl font-semibold">Cart</h1>
        {!!items.length && (
          <button
            onClick={clear}
            className="ml-auto text-sm px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
          >
            Clear cart
          </button>
        )}
      </div>

      {!hasItems && <div className="text-slate-500">No items.</div>}

      {/* Table banner (if order already has table) */}
      {order?.table ? (
        <div className="mb-3 inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-100 border">
          <span className="text-sm">Table:</span>
          <span className="font-medium">{order.table.name}</span>
          <Link
            href={`/tables?next=${encodeURIComponent("/cart")}`}
            className="text-xs underline ml-2"
          >
            change
          </Link>
        </div>
      ) : (
        <Link
          href={`/tables?next=${encodeURIComponent("/cart")}`}
          className="mb-3 inline-block text-sm underline"
        >
          Pick a table (optional)
        </Link>
      )}

      <div className="mb-3 flex items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="paytime"
            checked={payNow}
            onChange={() => setPayNow(true)}
            disabled={loading}
          />
          <span>Pay now at counter</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="paytime"
            checked={!payNow}
            onChange={() => setPayNow(false)}
            disabled={loading}
          />
          <span>Pay at the end</span>
        </label>
      </div>

      <div className="space-y-3">
        {items.map((i, idx) => (
          <div key={idx} className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {i.productName} {i.variantName ? `— ${i.variantName}` : ""}
                </div>
                <div className="text-sm text-slate-600">
                  {i.mods.filter((m) => m.include).map((m) => m.name).join(", ") || "No toppings"}
                </div>
              </div>

              <button
                onClick={() => removeAt(idx)}
                className="text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50"
                aria-label="Remove item"
                disabled={loading}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
              <div className="inline-flex items-center gap-2">
                <span className="text-slate-600">Qty:</span>
                <button
                  onClick={() => decAt(idx)}
                  className="px-2 py-1 rounded border hover:bg-slate-50"
                  aria-label="Decrease quantity"
                  disabled={loading}
                >
                  −
                </button>
                <input
                  className="w-14 px-2 py-1 rounded border text-center"
                  type="number"
                  min={1}
                  value={i.qty}
                  onChange={(e) => {
                    const n = Math.max(1, Number(e.target.value ?? 1) || 1);
                    setQtyAt(idx, n);
                  }}
                  disabled={loading}
                />
                <button
                  onClick={() => incAt(idx)}
                  className="px-2 py-1 rounded border hover:bg-slate-50"
                  aria-label="Increase quantity"
                  disabled={loading}
                >
                  +
                </button>
              </div>

              <div className="ml-auto flex items-center gap-4">
                <span className="text-slate-600">Unit: {Number(i.unit).toFixed(2)}</span>
                <span className="font-semibold">Line: {Number(i.line).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <div className="text-lg font-semibold">Total: {total().toFixed(2)}</div>
        <button
          disabled={loading || !hasItems}
          onClick={checkout}
          className="ml-auto px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
        >
          {loading ? "Processing…" : "Order"}
        </button>
      </div>

      {showAttachModal && (
        <AttachTableModal
          order={order}
          defaultTableId={order?.table?.id || null}
          onDone={onAttached}
          onCancel={() => {
            setNeedsAttach(false);
            router.push("/?showOrder=1");
          }}
        />
      )}
    </main>
  );
}
