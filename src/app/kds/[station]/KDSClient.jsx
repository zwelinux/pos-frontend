// src/app/kds/[station]/KDSClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { API } from "@/lib/api";
import { authFetch, hasRole } from "@/lib/auth";

const cleanStation = (name) =>
  String(name || "MAIN").toUpperCase().replace(/[^0-9A-Z._-]/g, "_").slice(0, 80);

async function patchStatus(id, status) {
  const r = await authFetch(`${API}/kitchen-tickets/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

const prettyTable = (name) => {
  if (!name) return "";
  const m = /^table\s*(\d+)$/i.exec(String(name).trim());
  return m ? `Table ${m[1]}` : name;
};

function secondsBetween(a, b) {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : Date.now();
  if (!ta) return 0;
  return Math.max(0, Math.floor((tb - ta) / 1000));
}

function formatSeconds(secs) {
  const s = Math.max(0, Number(secs) || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatModifierLabel(modifier) {
  const qty = Number(modifier?.qty || 1);
  const prefix = modifier?.include ? "" : "No ";
  return `${prefix}${modifier?.option_name || ""}${qty > 1 ? ` x${qty}` : ""}`;
}

function groupModifiersForKds(modifiers = []) {
  return modifiers.reduce((groups, modifier, index) => {
    const showTitle = modifier?.show_title !== false;
    const key = showTitle ? (modifier?.group_name || "OPTIONS") : `__hidden__${index}`;
    const label = formatModifierLabel(modifier);

    if (!groups[key]) {
      groups[key] = {
        title: showTitle ? (modifier?.group_name || "OPTIONS") : null,
        items: [],
      };
    }

    groups[key].items.push(label);
    return groups;
  }, {});
}

function Timer({ started_at, done_at }) {
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (done_at || !started_at) return;
    const t = setInterval(() => setNowTick((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started_at, done_at]);
  const secs = secondsBetween(started_at, done_at);
  return (
    <span className="font-mono text-base font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
      {formatSeconds(secs)}
    </span>
  );
}

// --- choose a date field & normalize to YYYY-MM-DD (LOCAL) ---
function ticketISODate(ticket) {
  const src =
    ticket?.created_at ||
    ticket?.started_at ||
    ticket?.done_at ||
    ticket?.order_created_at ||
    null;
  if (!src) return null;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function KDSClient() {
  const { station: stationParam } = useParams();
  const station = cleanStation(stationParam);

  const [rawTickets, setRawTickets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const closingRef = useRef(false);
  const retryMsRef = useRef(500);

  // ✅ FIX: use LOCAL date (not UTC toISOString)
  const today = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // ---------- SOUND ----------
  const [unlocked, setUnlocked] = useState(true);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);

  const newOrderAudio = useRef(null);
  const readyAudio = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    newOrderAudio.current = new Audio("/sounds/neworder.mp3");
    readyAudio.current = new Audio("/sounds/order-ready.m4a");
    newOrderAudio.current.preload = "auto";
    readyAudio.current.preload = "auto";
  }, []);

  const primeAudio = async () => {
    const primeOne = async (el) => {
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

    await Promise.allSettled([
      primeOne(newOrderAudio.current),
      primeOne(readyAudio.current),
    ]);
  };

  useEffect(() => {
    // Try to prime sound automatically on mount
    const prime = async () => {
      try {
        await primeAudio();
        setUnlocked(true);
        console.log("🔊 Sound auto-primed successfully");
      } catch (err) {
        console.warn("⚠️ Autoplay blocked, needs user click:", err.message);
        setUnlocked(false);
      }
    };
    prime();
  }, []);


  // Load saved preferences
  useEffect(() => {
    const savedVol = localStorage.getItem("kds_vol");
    const savedMuted = localStorage.getItem("kds_muted");
    if (savedVol) setVol(parseFloat(savedVol));
    if (savedMuted !== null) setMuted(savedMuted === "1");
  }, []);



  useEffect(() => {
    localStorage.setItem("kds_vol", String(vol));
    localStorage.setItem("kds_muted", muted ? "1" : "0");
  }, [vol, muted]);


  useEffect(() => {
    const v = muted ? 0 : Math.max(0, Math.min(1, vol));
    if (newOrderAudio.current) newOrderAudio.current.volume = v;
    if (readyAudio.current) readyAudio.current.volume = v;
  }, [muted, vol]);


  const play = async (which) => {
    const el = which === "ready" ? readyAudio.current : newOrderAudio.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      await el.play();
      console.log(`🎵 Played ${which}`);
    } catch {
      console.warn("⚠️ Autoplay blocked; will unlock on user click");
      setUnlocked(false);
    }
  };

  useEffect(() => {
    // Prime the audio silently without actually playing sound
    const prime = async () => {
      try {
        await primeAudio();
        setUnlocked(true);
        console.log("🔊 Sound primed silently");
      } catch (err) {
        console.warn("⚠️ Autoplay blocked, needs user click:", err.message);
        setUnlocked(false);
      }
    };
    prime();
  }, []);



  // edge detection for sounds
  const lastById = useRef(new Map());
  const burst = useRef([]);
  const burstTimer = useRef(null);
  const flushBurst = () => {
    if (!burst.current.length) return;
    const hasReady = burst.current.includes("ready");
    const hasNew = burst.current.includes("new");
    burst.current = [];
    if (hasReady) play("ready");
    else if (hasNew) play("new");
  };
  const queueSound = (kind) => {
    burst.current.push(kind);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(flushBurst, 100);
  };

  const enableSound = async () => {
    setMuted(false);
    try {
      await primeAudio();
      setUnlocked(true);
      console.log("🔓 Sound enabled manually");
    } catch (err) {
      console.warn("⚠️ Still blocked:", err.message);
    }
  };

  useEffect(() => {
    const onUserGesture = () => {
      if (!unlocked) enableSound();
    };

    window.addEventListener("pointerdown", onUserGesture, { passive: true });
    window.addEventListener("keydown", onUserGesture);

    return () => {
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, [unlocked]);

  // ---------- DATE NAV ----------
  function shiftSelectedDate(days) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }
  function setToday() {
    setSelectedDate(today);
  }

  // ---------- LOAD ----------
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setLoading(true);
        setRawTickets([]);

        const r = await fetch(
          `${API}/kitchen-tickets/?station=${encodeURIComponent(
            station
          )}&date=${encodeURIComponent(selectedDate)}&_=${Date.now()}`,
          { cache: "no-store", signal: ctrl.signal }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled) {
          setRawTickets(Array.isArray(data) ? data : []);
          // seed lastById
          const map = new Map();
          (Array.isArray(data) ? data : []).forEach((t) =>
            map.set(t.id, { qty: Number(t.qty ?? 0), status: t.status || null })
          );
          lastById.current = map;
        }
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") {
          setError("Failed to load tickets. Check API/ASGI/DB.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [station, selectedDate]);

  // ---------- WS (only for TODAY) ----------
  useEffect(() => {
    if (selectedDate !== today) {
      try {
        closingRef.current = true;
        clearTimeout(reconnectTimer.current);
        wsRef.current && wsRef.current.close();
      } catch { }
      return;
    }

    closingRef.current = false;
    const baseWs = API.replace(/^http(s?):/, "ws$1:").replace(/\/api\/?$/, "");
    const url = `${baseWs}/ws/kitchen/${station}/`;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryMsRef.current = 500;
        setError("");
      };

      ws.onmessage = (evt) => {
        if (selectedDateRef.current !== today) return;
        const msg = JSON.parse(evt.data);

        if (msg.type === "ticket") {
          queueSound("new");
          setRawTickets((prev) => {
            const idx = prev.findIndex((x) => x.id === msg.data.id);
            const next =
              idx >= 0
                ? (() => {
                  const clone = prev.slice();
                  clone[idx] = { ...prev[idx], ...msg.data };
                  return clone;
                })()
                : [...prev, msg.data];
            lastById.current.set(msg.data?.id, {
              qty: Number(msg.data?.qty ?? 0),
              status: msg.data?.status ?? null,
            });
            return next;
          });
          return;
        }

        if (msg.type === "update") {
          const id = msg.data?.id;
          const qty = Number(msg.data?.qty ?? NaN);
          const status = msg.data?.status ?? null;

          if (id != null) {
            const prev = lastById.current.get(id) || {};
            const prevQty = Number.isFinite(prev.qty) ? Number(prev.qty) : qty;

            if (status === "done" && prev.status !== "done") queueSound("ready");
            else if (Number.isFinite(qty) && qty > prevQty) queueSound("new");

            lastById.current.set(id, { qty, status });
          }

          setRawTickets((prev) =>
            prev.map((x) => (x.id === id ? { ...x, ...msg.data } : x))
          );
          return;
        }

        if (msg.type === "cancel") {
          const id = msg.data?.id;
          setRawTickets((prev) => prev.filter((x) => x.id !== id));
          return;
        }
      };

      ws.onclose = () => {
        if (closingRef.current) return;
        clearTimeout(reconnectTimer.current);
        const delay = Math.min(retryMsRef.current, 5000);
        reconnectTimer.current = setTimeout(connect, delay);
        retryMsRef.current *= 2;
      };
      ws.onerror = () => setError("WebSocket error. Is Redis/ASGI running?");
    };

    connect();
    return () => {
      closingRef.current = true;
      clearTimeout(reconnectTimer.current);
      try {
        wsRef.current && wsRef.current.close();
      } catch { }
    };
  }, [station, selectedDate, today]);

  // ---------- FILTER ----------
  const ticketsFiltered = useMemo(
    () => (rawTickets || []).filter((t) => ticketISODate(t) === selectedDate),
    [rawTickets, selectedDate]
  );

  const inprog = useMemo(
    () => ticketsFiltered.filter((x) => x.status === "in_progress"),
    [ticketsFiltered]
  );
  const done = useMemo(
    () => ticketsFiltered.filter((x) => x.status === "done"),
    [ticketsFiltered]
  );

  function TicketCard({ ticket }) {
    const showLiveTimer = ticket.status !== "done" && !!ticket.started_at;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">
                  {ticket.product_name}
                  {ticket.variant_name ? ` — ${ticket.variant_name}` : ""}
                </div>
                {ticket.table_name ? (
                  <div className="mt-0.5 text-xs text-slate-600">
                    {prettyTable(ticket.table_name)}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {ticket.status === "done" ? (
                  <span className="font-mono text-base font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">

                    {formatSeconds(
                      ticket.duration_seconds ??
                      secondsBetween(ticket.started_at, ticket.done_at)
                    )}
                  </span>
                ) : showLiveTimer ? (
                  <Timer started_at={ticket.started_at} done_at={ticket.done_at} />
                ) : null}
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 font-mono text-xs">
                  x{ticket.qty}
                </span>
              </div>
            </div>

            {!!ticket.modifiers?.length && (
              <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4 text-sm text-slate-700/90">
                {Object.entries(groupModifiersForKds(ticket.modifiers)).map(([key, group]) => (
                  <div key={`${ticket.id}-${key}`} className="space-y-0.5">
                    {group.title && (
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500/80">
                        {group.title}
                      </div>
                    )}
                    <div className="font-medium">
                      {group.items.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {ticket.status !== "done" && hasRole("Kitchen") && (
            <button
              onClick={() => patchStatus(ticket.id, "done")}
              className="ml-auto inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 active:translate-y-px"
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-3 sm:p-4">
      {/* Top bar */}
      <header className="sticky top-0 z-20 -mx-3 mb-3 border bg-white/70 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/50 sm:rounded-b-xl sm:border sm:mx-0 sm:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
            KDS — <span className="font-mono text-slate-700">{station}</span>
          </h1>

          {/* Date filter */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftSelectedDate(-1)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:bg-slate-100"
              aria-label="Previous day"
              title="Previous day"
            >
              ◀
            </button>

            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value || today)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />

            <button
              type="button"
              onClick={() => shiftSelectedDate(1)}
              disabled={selectedDate >= today}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next day"
              title="Next day"
            >
              ▶
            </button>

            <button
              type="button"
              onClick={setToday}
              disabled={selectedDate === today}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Jump to today"
            >
              Today
            </button>
          </div>
        </div>

        {/* Sound controls */}
        <div className="mt-2 flex items-center gap-3">
          {/* {!unlocked && (
            <button
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              onClick={enableSound}
            >
              Enable Sound
            </button>
          )} */}

          {!unlocked ? (
            <button
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              onClick={enableSound}
            >
              Enable Sound
            </button>
          ) : (
            <span className="text-xs text-slate-500">
              {muted ? "🔇 Sound OFF" : "🔊 Sound ON"}
            </span>
          )}



          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => setMuted(e.target.checked)}
            />
            Mute
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={vol}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="w-36"
              title="Volume"
            />
          </div>
        </div>

        {error && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {error}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* In Progress */}
        <section className="flex min-h-[50vh] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-2 sm:p-3">
          <h2 className="sticky top-[4.25rem] z-10 mb-2 rounded-lg bg-slate-100/80 px-2 py-1 text-sm font-semibold tracking-wide text-amber-700 backdrop-blur md:static md:top-auto md:bg-transparent md:px-0 md:py-0">
            In Progress
          </h2>
          <div className="flex-1 space-y-2 overflow-auto rounded-lg p-0.5">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              inprog.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </div>
        </section>

        {/* Done */}
        <section className="flex min-h-[50vh] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-2 sm:p-3">
          <h2 className="sticky top-[4.25rem] z-10 mb-2 rounded-lg bg-slate-100/80 px-2 py-1 text-sm font-semibold tracking-wide text-emerald-700 backdrop-blur md:static md:top-auto md:bg-transparent md:px-0 md:py-0">
            DONE ({selectedDate})
          </h2>
          <div className="flex-1 space-y-2 overflow-auto rounded-lg p-0.5">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              done.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </div>
        </section>
      </div>

      <div className="h-6 md:h-2" />
    </main>
  );
}
