"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

// ---------------------------------------------
// UTILITIES
// ---------------------------------------------
function prettyStatus(status) {
  if (status === "queued" || status === "in_progress") return "In Progress";
  if (status === "done") return "Cooked";
  if (status === "cancelled") return "Voided";
  return status ?? "Unknown";
}

function toDateOnly(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate()
  ).padStart(2, "0")}`;
}

function formatModifierLabel(modifier) {
  const qty = Number(modifier?.qty || 1);
  const prefix = modifier?.include ? "" : "No ";
  return `${prefix}${modifier?.option_name || ""}${qty > 1 ? ` ×${qty}` : ""}`;
}

function groupModifiersForKds(modifiers = []) {
  return modifiers.reduce((groups, modifier, index) => {
    const showTitle = modifier?.show_title !== false;
    const key = showTitle ? (modifier?.group_name || "OPTIONS") : `__hidden__${index}`;

    if (!groups[key]) {
      groups[key] = {
        title: showTitle ? (modifier?.group_name || "OPTIONS") : null,
        items: [],
      };
    }

    groups[key].items.push(formatModifierLabel(modifier));
    return groups;
  }, {});
}

// ---------------------------------------------
// TIMER COMPONENT
// ---------------------------------------------
function Timer({ ticket }) {
  const [, forceTick] = useState(0);

  const start = ticket.started_at
    ? new Date(ticket.started_at)
    : new Date(ticket.created_at);

  useEffect(() => {
    if (ticket.status === "done" || ticket.status === "cancelled" || ticket.isVoided) return;
    const intv = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(intv);
  }, [ticket.status, ticket.isVoided]);

  const now = (ticket.status === "done" || ticket.isVoided) ? new Date(ticket.done_at || ticket.updated_at || new Date()) : new Date();
  const secs = Math.floor((now - start) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const isOld = secs > 600; // Red if > 10m

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black tracking-widest ${ticket.isVoided
      ? "bg-rose-600 border-rose-700 text-white shadow-lg shadow-rose-200"
      : isOld
        ? "bg-rose-50 border-rose-100 text-rose-600 animate-pulse"
        : "glass border-white/40 text-slate-500"
      }`}>
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {mm}:{ss}
    </div>
  );
}

// ---------------------------------------------
// MAIN KDS DASHBOARD
// ---------------------------------------------
export default function KDSDashboard() {
  const PAGE_SIZE = 9;
  const [tickets, setTickets] = useState([]);
  const [stations, setStations] = useState([{ slug: "ALL", name: "ALL" }]);
  const [selectedStation, setSelectedStation] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const audioCtxRef = useRef(null);
  const newOrderAudioRef = useRef(null);
  const readyAudioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const alertTimerRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const newOrderAudio = new Audio("/sounds/neworder.mp3");
    const readyAudio = new Audio("/sounds/order-ready.m4a");

    newOrderAudio.preload = "auto";
    readyAudio.preload = "auto";

    newOrderAudioRef.current = newOrderAudio;
    readyAudioRef.current = readyAudio;

    return () => {
      try { newOrderAudio.pause(); } catch {}
      try { readyAudio.pause(); } catch {}
    };
  }, []);

  async function unlockAudio() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      const prime = async (audioRef) => {
        const el = audioRef.current;
        if (!el) return;
        const prevMuted = el.muted;
        const prevVolume = el.volume;
        el.muted = true;
        el.volume = 0;
        el.currentTime = 0;
        await el.play();
        el.pause();
        el.currentTime = 0;
        el.muted = prevMuted;
        el.volume = prevVolume || 1;
      };

      await Promise.allSettled([prime(newOrderAudioRef), prime(readyAudioRef)]);
      setAudioEnabled(true);
      return true;
    } catch {
      setAudioEnabled(false);
      return false;
    }
  }

  useEffect(() => {
    const onUserGesture = () => {
      unlockAudio();
    };

    window.addEventListener("pointerdown", onUserGesture, { passive: true });
    window.addEventListener("keydown", onUserGesture);

    return () => {
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, []);

  function playBeep(freq = 880, duration = 0.15) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  async function playAudio(which = "new") {
    const audio = which === "ready" ? readyAudioRef.current : newOrderAudioRef.current;
    if (!audio) {
      playBeep(which === "ready" ? 440 : 880, which === "ready" ? 0.12 : 0.18);
      return;
    }

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      playBeep(which === "ready" ? 440 : 880, which === "ready" ? 0.12 : 0.18);
    }
  }

  function showBrowserNotification(title, body) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body });
    } catch {}
  }

  async function playAlertSequence(which = "new") {
    clearTimeout(alertTimerRef.current);

    if (which === "ready") {
      await playAudio("ready");
      return;
    }

    await playAudio("new");
    alertTimerRef.current = setTimeout(() => playAudio("new"), 900);
    setTimeout(() => playAudio("new"), 1800);
  }

  // LOAD STATIONS
  useEffect(() => {
    (async () => {
      const res = await authFetch(`${API}/kitchen-stations/`);
      const json = await res.json();
      const unique = new Map();
      [{ slug: "ALL", name: "ALL" }, ...(json.stations || [])].forEach((s) => unique.set(s.slug, s));
      setStations([...unique.values()]);
    })();
  }, []);

  // FETCH TICKETS (POLLING)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        const r = await authFetch(`${API}/kitchen-tickets/?date=${selectedDate}`);
        const arr = await r.json();
        if (alive) setTickets(arr);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [selectedDate]);

  // WEBSOCKETS (TODAY ONLY)
  useEffect(() => {
    if (selectedDate !== today) return;
    const wsBase = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
    const sockets = stations
      .filter((s) => s.slug !== "ALL")
      .map((s) => {
        const ws = new WebSocket(`${wsBase}/ws/kitchen/${s.slug}/`);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);

          if (msg.type === "ticket") {
            playAlertSequence("new");
            showBrowserNotification("New Kitchen Ticket", `Order #${msg.data?.order_number || msg.data?.order_id || ""}`);
            setTickets((prev) => prev.some((t) => t.id === msg.data.id) ? prev : [msg.data, ...prev]);
          }

          if (msg.type === "update") {
            if (msg.data.status === "done") playAlertSequence("ready");
            setTickets((prev) => prev.map((t) => t.id === msg.data.id ? { ...t, ...msg.data } : t));
          }

          if (msg.type === "cancel") {
            playBeep(220, 0.4); // Deep warning beep for cancellation
            setTickets((prev) =>
              prev.map((t) => {
                if (t.id === msg.data.id) {
                  return { ...t, isVoided: true, status: "cancelled", updated_at: new Date().toISOString() };
                }
                return t;
              })
            );
          }
        };
        return ws;
      });
    return () => sockets.forEach((ws) => ws.close());
  }, [stations, selectedDate, today]);

  // FILTER & SORT
  const visibleTickets = useMemo(() => {
    return tickets
      .filter((t) => selectedStation === "ALL" ? true : t.station === selectedStation)
      .filter((t) => toDateOnly(t.created_at || t.started_at) === selectedDate)
      .sort((a, b) => {
        // CRITICAL: Always jump VOIDED tickets to the absolute front
        if (a.isVoided && !b.isVoided) return -1;
        if (!a.isVoided && b.isVoided) return 1;

        // Then sort by status (pending first, then done)
        if (a.status !== "done" && b.status === "done") return -1;
        if (a.status === "done" && b.status !== "done") return 1;

        // Finally sort by ID (newer first)
        return b.id - a.id;
      });
  }, [tickets, selectedStation, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / PAGE_SIZE));
  const pagedTickets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleTickets.slice(start, start + PAGE_SIZE);
  }, [visibleTickets, currentPage, PAGE_SIZE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStation, selectedDate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  // MARK DONE
  async function markDone(id) {
    playAlertSequence("ready");
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: "done", done_at: new Date().toISOString() } : t));
    await authFetch(`${API}/kitchen-tickets/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
  }

  // DISMISS VOIDED
  function dismissTicket(id) {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 h-full flex p-6 gap-8">
        {/* Sidebar: Stations & Filter */}
        <aside className="w-[320px] glass rounded-[2.5rem] border-white/20 p-8 flex flex-col shrink-0">
          <header className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-3 py-1 mb-4 shadow-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Kitchen Operations</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">KDS Orders</h2>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 ml-1">Stations Selection</div>
            {stations.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSelectedStation(s.slug)}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-black transition-all duration-300 ${selectedStation === s.slug ? "bg-white text-indigo-600 shadow-xl shadow-indigo-50 border-none" : "text-slate-500 hover:bg-white/40 hover:text-slate-900"
                  }`}
              >
                <span>{s.name}</span>
                {selectedStation === s.slug && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-white/20">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block ml-1">Archive Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full glass border-white/40 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
            />
          </div>
        </aside>

        {/* Main Grid: Ticket Cards */}
        <section className="flex-1 overflow-y-auto no-scrollbar pb-20">
          {visibleTickets.length > PAGE_SIZE && (
            <div className="mb-6 flex items-center justify-between rounded-[2rem] glass border-white/30 px-5 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Page {currentPage} Of {totalPages}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-2xl border border-white/50 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="rounded-2xl bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="h-2 w-24 glass rounded-full animate-pulse bg-indigo-500/20" />
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pagedTickets.map((t) => {
                const isDone = t.status === "done";
                const isVoided = t.isVoided || t.status === "cancelled";

                return (
                  <div
                    key={t.id}
                    className={`group relative flex flex-col rounded-[2.3rem] glass border-white/40 p-1 transition-all duration-500 ${isVoided ? "ring-4 ring-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.3)] animate-pulse-slow z-20" :
                      isDone ? "opacity-60 grayscale-[0.3]" : "hover:shadow-2xl hover:shadow-indigo-100"
                      }`}
                  >
                    <div className={`relative p-5 flex flex-col h-full rounded-[2rem] transition-all duration-700 ${isVoided ? "bg-rose-50/90" : "bg-white/40"}`}>

                      {/* PERSISTENT CANCELLED BANNER */}
                      {isVoided && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden rounded-[2.5rem]">
                          <div className="bg-rose-600/90 py-3 px-10 -rotate-12 scale-110 shadow-2xl border-y-4 border-rose-400 shadow-rose-900/40">
                            <span className="text-2xl font-black uppercase tracking-[0.26em] text-white whitespace-nowrap">Order Cancelled</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        {/* <span className={`rounded-xl glass border-white/40 px-3 py-1.5 text-[10px] font-black ${isVoided ? "bg-rose-600 text-white border-rose-700" : "text-slate-400"}`}>
                          #{t.id}
                        </span> */}
                        <Timer ticket={t} />
                      </div>

                      <h3 className={`text-[15px] font-black tracking-tight leading-snug flex-1 ${isVoided ? "text-rose-900" : "text-slate-900"}`}>
                        <span className={`${isVoided ? "text-rose-600" : "text-indigo-600"} mr-2.5 underline decoration-indigo-200 underline-offset-4`}>{Number(t.qty || 1)}×</span>
                        {t.product_name}
                        {t.variant_name && (
                          <span className={`block mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${isVoided ? "text-rose-600" : "text-indigo-500"}`}>{t.variant_name}</span>
                        )}
                        {!!t.modifiers?.length && (
                          <div className="mt-3 space-y-2 border-l-2 border-indigo-100 pl-3 py-0.5">
                            {Object.entries(groupModifiersForKds(t.modifiers)).map(([key, group]) => (
                              <div key={key} className="space-y-0.5 text-[11px] font-black">
                                {group.title && (
                                  <div className={`uppercase text-[8px] tracking-[0.1em] opacity-60 ${isVoided ? "text-rose-600" : "text-indigo-500"}`}>
                                    {group.title}
                                  </div>
                                )}
                                <div className={isVoided ? "text-rose-900" : "text-slate-800"}>
                                  {group.items.join(", ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </h3>

                      <div className={`mt-5 pt-4 border-t flex items-center justify-between ${isVoided ? "border-rose-200" : "border-slate-100"}`}>
                        <div>
                          {/* <div className={`text-[10px] font-bold uppercase tracking-widest ${isVoided ? "text-rose-400" : "text-slate-400"}`}>Destination</div> */}
                          <div className={`text-sm font-black ${isVoided ? "text-rose-900" : "text-slate-800"}`}>{t.table_name || "Takeaway"}</div>
                        </div>
                        <div className={`h-3 w-3 rounded-full ring-4 ring-white shadow-xl ${isVoided ? "bg-rose-600 shadow-rose-100" :
                          isDone ? "bg-emerald-500 shadow-emerald-100" : "bg-amber-500 shadow-amber-100 animate-pulse"
                          }`} />
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="p-2.5">
                      {isVoided ? (
                        <button
                          onClick={() => dismissTicket(t.id)}
                          className="w-full relative overflow-hidden rounded-[1.7rem] bg-rose-600 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-2xl shadow-rose-200 transition-all hover:bg-rose-700 hover:scale-[1.02] active:scale-95 group/btn"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            Acknowledge & Clear
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        </button>
                      ) : !isDone ? (
                        <button
                          onClick={() => markDone(t.id)}
                          className="w-full relative overflow-hidden rounded-[1.7rem] bg-indigo-600 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-2xl shadow-indigo-100 transition-all hover:bg-emerald-600 hover:shadow-emerald-100 hover:scale-[1.02] active:scale-95 group/btn"
                        >
                          <span className="relative z-20 flex items-center justify-center gap-2">
                            Complete
                          </span>
                        </button>
                      ) : (
                        <div className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.32em] text-emerald-600 bg-emerald-50/50 rounded-[1.7rem] border border-emerald-100/50">
                          Cooked
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {visibleTickets.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="h-20 w-20 rounded-[2rem] glass flex items-center justify-center mb-6">
                <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="text-xl font-black text-slate-900">Queue Open</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">No pending kitchen orders</div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
