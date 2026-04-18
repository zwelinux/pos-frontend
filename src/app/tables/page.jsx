// src/app/tables/page.jsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useOrder } from "@/store/order";
import Link from "next/link";
// import Navbar from "@/components/Navbar";

const LIVE_SYNC_MS = 3000;

export default function TablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ default to opening the menu WITH the order panel visible
  const next = searchParams.get("next") || "/?showOrder=1";

  // also capture last table id for refresh flows
  const { setOrder, setLastTableId } = useOrder();

  const [tables, setTables] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const inFlightRef = useRef(false);

  async function loadTables({ silent = false } = {}) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await authFetch(`${API}/tables/`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setTables(Array.isArray(data) ? data : []);
      setLastUpdatedAt(new Date());
    } catch {
      if (!silent) {
        setTables([]);
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadTables({ silent: true });
    }, LIVE_SYNC_MS);

    const refreshNow = () => {
      if (document.visibilityState === "visible") {
        loadTables({ silent: true });
      }
    };

    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, []);

  async function pickTable(table) {
    if (loadingId) return;
    setLoadingId(table.id);
    try {
      const r = await authFetch(`${API}/tables/${table.id}/active_order/`, { method: "POST" });
      if (!r.ok) {
        alert("Failed to access table context.");
        return;
      }
      const orderObj = await r.json();
      setOrder(orderObj);
      if (orderObj?.table?.id) setLastTableId(orderObj.table.id);
      router.push(next || "/?showOrder=1");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 min-h-[calc(100vh-80px)] mt-[2%]">
      <header className="mb-12 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-4 py-1.5 mb-6 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Operations Hub</span>
        </div>
        <h1 className="text-5xl font-black tracking-tight text-slate-900 leading-none">
          Select <span className="text-indigo-600">Table.</span>
        </h1>
        {/* <div className="mt-5 flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:flex-row md:items-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-emerald-700 md:justify-start">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live sync every {Math.floor(LIVE_SYNC_MS / 1000)}s
          </div>
          <div>
            Last update: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : "Syncing..."}
          </div>
        </div> */}
      </header>
       
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
        {tables.map((t) => {
          const isFree = t.status === "free";
          const isLoading = loadingId === t.id;
          
          return (
            <button
              key={t.id}
              disabled={!!loadingId}
              onClick={() => pickTable(t)}
              className={`group relative flex flex-col items-center justify-center aspect-[1/1.1] p-4 rounded-3xl border transition-all duration-300 ${
                isLoading 
                  ? "bg-slate-50 border-slate-100 opacity-60 cursor-wait animate-pulse" 
                  : "glass border-white/40 shadow-sm hover:shadow-xl hover:shadow-indigo-100 hover:-translate-y-1 active:scale-95"
              }`}
            >
              {/* Status Indicator */}
              <div className="absolute top-3 right-3">
                <div className={`h-2.5 w-2.5 rounded-full ring-4 ring-white/50 ${isFree ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"}`} />
              </div>

              {/* Table Icon/Shape */}
              <div className={`mb-2 h-10 w-10 flex items-center justify-center rounded-xl transition-all ${
                isFree 
                  ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100" 
                  : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
              }`}>
                <svg className="h-5 w-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v4m-5 4h10a2 2 0 002-2V8a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 6V4m8 2V4M7 20v2m10-2v2" />
                </svg>
              </div>

              <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${
                 isFree ? "text-amber-600" : "text-emerald-600"
              }`}>
                {isFree ? "Free" : "Busy"}
              </div>

              <span className="text-xl font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                {t.name}
              </span>
              
              <div className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] leading-relaxed text-center ${
                isFree ? "text-slate-400" : "text-emerald-400"
              }`}>
                {isFree ? "Ready" : "In Service"}
              </div>

              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-indigo-50/20 backdrop-blur-[2px]">
                   <svg className="h-8 w-8 animate-spin text-indigo-600" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                   </svg>
                </div>
              )}
            </button>
          );
        })}

        {/* Empty State / Add Table Placeholder if no tables */}
        {tables.length === 0 && (
          <div className="col-span-full py-20 text-center glass rounded-[2rem] border-dashed border-2 border-slate-200">
            <div className="text-slate-400 font-bold mb-2">No active tables found</div>
            <Link href="/manage/tables" className="text-indigo-600 font-extrabold underline-offset-4 hover:underline">
               Go to table management
            </Link>
          </div>
        )}
      </div>

      <footer className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Logged shift: <span className="text-slate-600">JusPOS Operations System</span>
        </div>
        <Link
          href="/manage/tables"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Configure Table Layout
        </Link>
      </footer>
    </main>
  );
}
