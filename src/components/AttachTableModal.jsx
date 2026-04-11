"use client";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function AttachTableModal({ order, defaultTableId = null, onDone, onCancel }) {
  const [tables, setTables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/tables/`, { cache: "no-store" });
      const data = await r.json();
      setTables(Array.isArray(data) ? data : []);
    })();
  }, []);

  const takeaway = useMemo(
    () => tables.find(t => t.name?.toLowerCase() === "takeaway") || null,
    [tables]
  );
  const realTables = useMemo(
    () => tables.filter(t => t.name?.toLowerCase() !== "takeaway"),
    [tables]
  );

  async function attach(tableId) {
    if (saving) return;
    setSaving(true);
    try {
      const r = await authFetch(`${API}/orders/${order.id}/attach_table/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: tableId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onDone?.();
    } catch {
      alert("Failed to attach table.");
    } finally {
      setSaving(false);
    }
  }

  // Auto-attach to the pre-selected table if provided
  useEffect(() => {
    if (!autoTried && defaultTableId) {
      setAutoTried(true);
      attach(defaultTableId);
    }
  }, [autoTried, defaultTableId]);

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg">
        <div className="flex items-center mb-3">
          <div className="text-lg font-semibold">Attach Table</div>
          <button onClick={onCancel} className="ml-auto text-sm underline">cancel</button>
        </div>

        <div className="grid grid-cols-3 gap-2 max-h-[40vh] overflow-auto">
          {realTables.map(t => (
            <button key={t.id}
              disabled={saving || t.status === "closed"}
              onClick={() => attach(t.id)}
              className={`rounded-xl p-3 shadow border ${t.status==="occupied"?"bg-gray-100":"bg-white hover:bg-gray-50"}`}>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs opacity-70 capitalize">{t.status}</div>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {takeaway && (
            <button disabled={saving}
              onClick={() => attach(takeaway.id)}
              className="w-full rounded-xl p-3 bg-black text-white">
              Attach to Takeaway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
