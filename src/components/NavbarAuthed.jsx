// src/components/NavbarAuthed.jsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "./Navbar";
import { API } from "@/lib/api";
import { authFetch, isAuthed } from "@/lib/auth";

export default function NavbarAuthed({
  brand = "Jus Food & Drinks",
  nextAfterTables = "/?showOrder=1",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicMenu = pathname === "/menu" || pathname?.startsWith("/menu/");
  const [me, setMe] = useState(null);
  const [session, setSession] = useState(null);

  // --- Load user ---
  const loadMe = useCallback(async () => {
    if (isPublicMenu) {
      setMe(null);
      return;
    }

    if (!isAuthed()) {
      setMe(null);
      return;
    }

    try {
      const r = await authFetch(`${API}/me/`);
      if (!r.ok) {
        setMe(null);
        return;
      }
      setMe(await r.json());
    } catch {
      setMe(null);
    }
  }, [isPublicMenu]);

  // --- Load current cash session ---
  const loadSession = useCallback(async () => {
    if (isPublicMenu) {
      setSession(null);
      return;
    }

    if (!isAuthed()) {
      setSession(null);
      return;
    }

    try {
      const r = await authFetch(`${API}/cash-sessions/current/`);
      if (!r.ok) return setSession(null);
      const j = await r.json();
      setSession(j.active ? j.session : null);
    } catch {
      setSession(null);
    }
  }, [isPublicMenu]);

  // --- Re-fetch on mount and route change ---
  useEffect(() => {
    loadMe();
    loadSession();
  }, [loadMe, loadSession, pathname]);

  // --- Refresh when tab focus or auth change ---
  useEffect(() => {
    const onFocus = () => {
      loadMe();
      loadSession();
    };
    const onStorage = (e) => {
      if (e.key === "auth") {
        loadMe();
        loadSession();
      }
    };
    const onAuthChanged = () => {
      loadMe();
      loadSession();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", onAuthChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, [loadMe, loadSession]);

  // --- Logout handler ---
  const onLogout = () => {
    try {
      localStorage.removeItem("auth");
      window.dispatchEvent(new Event("auth-changed"));
    } catch {}
    router.replace("/login");
  };

  return (
    <>
      <Navbar
        me={me}
        onLogout={onLogout}
        brand={brand}
        nextAfterTables={nextAfterTables}
        session={session}
      />

      {/* 💰 Open Session Modal */}
      {me && !session && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-300">
          <div className="glass border border-white/20 p-8 rounded-[2rem] shadow-[0_32px_80px_rgba(0,0,0,0.2)] w-full max-w-md animate-slide-down">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 mb-6 shadow-lg shadow-indigo-200">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Open Cash Session
            </h2>
            <p className="text-sm text-slate-500 mt-2 mb-8 font-medium">
              Enter the initial drawer balance to begin your shift and enable point-of-sale operations.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 mb-2 block">Starting Balance</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</div>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-slate-200 bg-white/50 pl-8 pr-4 py-4 text-lg font-bold text-slate-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_20px_rgba(79,70,229,0.1)]"
                    id="starting-balance"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  const btn = document.getElementById("open-session-btn");
                  btn.disabled = true;
                  btn.innerText = "Processing...";
                  
                  const val = document.getElementById("starting-balance").value || "0";
                  const r = await authFetch(`${API}/cash-sessions/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ starting_balance: val }),
                  });
                  
                  if (r.ok) {
                    window.location.reload();
                  } else {
                    const j = await r.json().catch(() => ({}));
                    alert(j.detail || "Unable to open session. Please check your credentials.");
                    btn.disabled = false;
                    btn.innerText = "Open Session";
                  }
                }}
                id="open-session-btn"
                className="w-full rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-xl shadow-slate-200 transition-all hover:bg-indigo-600 hover:shadow-indigo-100 hover:-translate-y-1 active:translate-y-0"
              >
                Open Session
              </button>
            </div>
            
            <div className="mt-8 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                Authorized Personnel Only <br /> Sessions are logged for security
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
