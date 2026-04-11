// src/app/order/[id]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { groupModifiersForDisplay } from "@/lib/modifierDisplay";
import { useOrder } from "@/store/order";

export default function OrderPage() {
  const params = useParams();
  const id = params?.id;
  const { order, setOrder } = useOrder();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API}/orders/${id}/`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setOrder(j);
      } catch (e) {
        setErr("Failed to load order.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, setOrder]);

  if (loading) return <main className="p-4">Loading…</main>;
  if (err) return <main className="p-4 text-red-600">{err}</main>;
  if (!order) return <main className="p-4">Order not found.</main>;

  const itemCount = (order.items || []).reduce((a, it) => a + Number(it.qty || 0), 0);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Order #{order.id}</h1>
        {order.table && (
          <span className="text-sm px-2 py-1 rounded bg-slate-100 border">
            Table: <b>{order.table.name}</b>
          </span>
        )}
        {order.paid_at ? (
          <span className="text-sm px-2 py-1 rounded bg-emerald-50 border text-emerald-700">
            Paid
          </span>
        ) : (
          <span className="text-sm px-2 py-1 rounded bg-yellow-50 border text-yellow-700">
            Open
          </span>
        )}
        <span className="ml-auto text-sm text-slate-600">{itemCount} items</span>
        <Link href="/" className="text-sm underline">Add more</Link>
      </div>

      <div className="border rounded-lg divide-y">
        {(order.items || []).map((it) => (
          <div key={it.id} className="p-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {it.product_name}{it.variant_name ? ` — ${it.variant_name}` : ""}
              </div>
              {!!it.modifiers?.length && (
                <div className="mt-1 space-y-1 text-sm text-slate-600">
                  {Object.values(groupModifiersForDisplay(it.modifiers)).map((group) => (
                    <div key={group.key}>
                      {group.title && (
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {group.title}
                        </div>
                      )}
                      <div>{group.items.map(({ label }) => label).join(", ")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600">Qty: {it.qty}</div>
              <div className="font-semibold">{Number(it.line_total).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">
          Total: {Number(order.total).toFixed(2)}
        </div>
        <div className="ml-auto flex gap-2">
          {!order.table && (
            <Link
              href={`/tables?next=${encodeURIComponent(`/order/${order.id}`)}`}
              className="px-3 py-2 rounded bg-slate-100 border"
            >
              Attach table
            </Link>
          )}
          {!order.paid_at && (
            <Link
              href={`/receipt/${order.id}`}
              className="px-3 py-2 rounded bg-emerald-600 text-white"
            >
              Settle / Print
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
