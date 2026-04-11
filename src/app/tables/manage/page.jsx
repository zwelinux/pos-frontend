// src/app/tables/manage/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function ManageTablesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await authFetch(`${API}/tables/`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } catch {
      setErr("Failed to load tables.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addTable() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setErr("");
    try {
      const r = await authFetch(`${API}/tables/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Create failed");
      }
      setNewName("");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function renameTable(tid, name) {
    name = (name || "").trim();
    if (!name) return;
    setSaving(true);
    try {
      const r = await authFetch(`${API}/tables/${tid}/rename/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Rename failed");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(tid, action) {
    setSaving(true);
    setErr("");
    try {
      const r = await authFetch(`${API}/tables/${tid}/${action}/`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Update failed");
      }
      load();
    } catch (e) {
      setErr(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateSort(tid, newSort) {
    // client-side patch
    const r2 = await authFetch(`${API}/tables/${tid}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort: Number(newSort) }),
    });
    if (!r2.ok) throw new Error("Sort update failed");
    load();
  }

  async function del(tid) {
    if (!confirm("Delete this table?")) return;
    setSaving(true);
    setErr("");
    try {
      const r = await authFetch(`${API}/tables/${tid}/`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Delete failed");
      }
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const totalTables = rows.length;
  const freeTables = rows.filter((t) => t.status === "free").length;
  const occupiedTables = rows.filter((t) => t.status === "occupied").length;
  const closedTables = rows.filter((t) => t.status === "closed").length;

  function statusClass(status) {
    if (status === "closed") return "bg-slate-200 text-slate-700";
    if (status === "occupied") return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Floor Control
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Manage Tables</h1>
            <p className="mt-1 text-sm text-slate-600">
              Create, rename, sort, and update table availability.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading || saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              onClick={() => router.push("/tables")}
            >
              Back to Pick
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTables}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Free</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">{freeTables}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Occupied</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{occupiedTables}</p>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">Closed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-800">{closedTables}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add New Table</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none ring-offset-2 transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="New table name (e.g., A1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTable()}
          />
          <button
            onClick={addTable}
            disabled={saving || !newName.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Table"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
          Loading tables...
        </div>
      ) : null}

      <div className="grid gap-3">
        {rows.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                  <input
                    defaultValue={t.name}
                    className="w-full max-w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== t.name) renameTable(t.id, v);
                    }}
                  />
                </div>

                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(t.status)}`}>
                  {t.status}
                </span>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</label>
                  <input
                    type="number"
                    defaultValue={t.sort ?? 0}
                    className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none ring-offset-2 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (String(v) !== String(t.sort ?? 0)) updateSort(t.id, v);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {t.status !== "closed" ? (
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => changeStatus(t.id, "close")}
                  >
                    Close
                  </button>
                ) : (
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => changeStatus(t.id, "open")}
                  >
                    Reopen
                  </button>
                )}

                <button
                  className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 transition hover:bg-emerald-50"
                  onClick={() => changeStatus(t.id, "free")}
                  title="Mark Free"
                >
                  Free
                </button>

                <button
                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-700 transition hover:bg-amber-50"
                  onClick={() => changeStatus(t.id, "occupy")}
                  title="Mark Occupied"
                >
                  Occupy
                </button>

                <button
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50"
                  onClick={() => del(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <p className="text-sm text-slate-600">No tables found. Add your first table above.</p>
        </div>
      ) : null}
    </main>
  );
}
