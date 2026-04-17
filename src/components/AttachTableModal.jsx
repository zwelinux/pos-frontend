"use client";

import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

function normalizeTableName(name) {
  return String(name || "").trim().toLowerCase();
}

export default function AttachTableModal({
  order,
  defaultTableId = null,
  title = "Switch Table",
  confirmLabel = "Move here",
  contained = false,
  onDone,
  onCancel,
}) {
  const [tables, setTables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const r = await authFetch(`${API}/tables/`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (alive) setTables(Array.isArray(data) ? data : []);
      } catch {
        if (alive) {
          setTables([]);
          setError("Failed to load tables.");
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const currentTableId = order?.table?.id ?? defaultTableId ?? null;
  const currentTableName = order?.table_display || order?.table?.name || "Takeaway";

  const takeaway = useMemo(
    () => tables.find((t) => normalizeTableName(t.name) === "takeaway") || null,
    [tables]
  );

  const tableChoices = useMemo(
    () => tables.filter((t) => normalizeTableName(t.name) !== "takeaway"),
    [tables]
  );

  async function attach(tableId) {
    if (!order?.id || saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await authFetch(`${API}/orders/${order.id}/attach_table/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_id: tableId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Failed to switch table.");
      onDone?.(data);
    } catch (e) {
      setError(e.message || "Failed to switch table.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`grid place-items-center p-4 backdrop-blur-sm ${
        contained
          ? "absolute inset-0 z-[140] bg-white/55"
          : "fixed inset-0 z-[100] bg-slate-900/50"
      }`}
    >
      <div
        className={`w-full rounded-[2rem] border border-white/20 bg-white/95 p-6 shadow-2xl ${
          contained ? "max-w-none" : "max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Floor Control</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              Order #{order?.number || order?.id} is currently on <span className="font-bold text-slate-900">{currentTableName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className={`mt-6 grid gap-3 overflow-auto pr-1 ${contained ? "max-h-[50vh] grid-cols-2" : "max-h-[55vh] grid-cols-2 sm:grid-cols-3"}`}>
          {tableChoices.map((t) => {
            const isCurrent = t.id === currentTableId;
            const isOccupied = t.status === "occupied" && !isCurrent;
            const isClosed = t.status === "closed";
            const disabled = saving || isOccupied || isClosed || isCurrent;

            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => attach(t.id)}
                className={`rounded-[1.5rem] border p-4 text-left transition ${
                  isCurrent
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : isClosed
                    ? "border-slate-200 bg-slate-100 text-slate-400"
                    : isOccupied
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-black tracking-tight">{t.name}</div>
                  {isCurrent ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                      Current
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em]">
                  {isClosed ? "Closed" : isOccupied ? "Occupied" : confirmLabel}
                </div>
              </button>
            );
          })}
        </div>

        {takeaway ? (
          <button
            type="button"
            disabled={saving || takeaway.id === currentTableId}
            onClick={() => attach(takeaway.id)}
            className="mt-5 inline-flex w-full items-center justify-center rounded-[1.4rem] border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Move to Takeaway
          </button>
        ) : null}
      </div>
    </div>
  );
}
