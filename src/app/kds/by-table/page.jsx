"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

function todayInBangkok() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function cleanStationSlug(value) {
  return String(value || "MAIN").trim().toUpperCase().replace(/[^0-9A-Z._-]/g, "_").slice(0, 80);
}

function buildWsCandidates(apiBase, path) {
  const candidates = [];

  if (typeof window !== "undefined") {
    const currentProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    candidates.push(`${currentProto}//${window.location.host}${path}`);
  }

  try {
    const u = new URL(apiBase);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    candidates.push(`${wsProto}//${u.host}${path}`);
  } catch {}

  return [...new Set(candidates)];
}

function toDateOnly(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupModifierLines(modifiers = []) {
  const groups = modifiers.reduce((acc, modifier, index) => {
    const showTitle = modifier?.show_title !== false;
    const title = showTitle ? modifier?.group_name || "OPTIONS" : null;
    const key = title || `__hidden__${index}`;
    if (!acc[key]) acc[key] = { title, items: [] };

    const qty = Number(modifier?.qty || 1);
    const prefix = modifier?.include ? "" : "No ";
    acc[key].items.push(`${prefix}${modifier?.option_name || ""}${qty > 1 ? ` ×${qty}` : ""}`);
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => {
      const line = group.items.join(", ");
      return group.title ? `${group.title}: ${line}` : line;
    })
    .filter(Boolean);
}

function buildItemKey(ticket) {
  const modifierKey = (ticket.modifiers || [])
    .map((modifier) => [
      modifier?.group_name || "",
      modifier?.option_name || "",
      modifier?.include !== false ? "1" : "0",
      Number(modifier?.qty || 1),
      modifier?.show_title !== false ? "1" : "0",
    ].join("::"))
    .sort()
    .join("||");

  return [
    ticket.product_name || "",
    ticket.variant_name || "",
    modifierKey,
    ticket.status || "",
  ].join("__");
}

function groupTicketsIntoOrders(tickets) {
  const groups = new Map();

  for (const ticket of tickets) {
    const tableName = ticket.table_name || "Takeaway";
    const orderNumber = ticket.order_number || "Unknown";
    const key = `${tableName}__${orderNumber}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        orderId: ticket.order_id,
        tableName,
        orderNumber,
        createdAt: ticket.created_at,
        tickets: [],
      });
    }

    const group = groups.get(key);
    if (!group.orderId && ticket.order_id) {
      group.orderId = ticket.order_id;
    }
    group.tickets.push(ticket);
    if (ticket.created_at && new Date(ticket.created_at) < new Date(group.createdAt)) {
      group.createdAt = ticket.created_at;
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const itemMap = new Map();

      for (const ticket of group.tickets) {
        if (ticket.status === "cancelled" || ticket.isVoided) continue;

        const itemKey = buildItemKey(ticket);
        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            key: itemKey,
            productName: ticket.product_name,
            variantName: ticket.variant_name,
            modifiers: ticket.modifiers || [],
            qty: 0,
            ticketIds: [],
            doneCount: 0,
            activeCount: 0,
          });
        }

        const item = itemMap.get(itemKey);
        item.qty += Number(ticket.qty || 1);
        item.ticketIds.push(ticket.id);
        if (ticket.status === "done") item.doneCount += 1;
        else item.activeCount += 1;
      }

      const items = Array.from(itemMap.values()).sort((a, b) => {
        if (a.activeCount > 0 && b.activeCount === 0) return -1;
        if (a.activeCount === 0 && b.activeCount > 0) return 1;
        return String(a.productName || "").localeCompare(String(b.productName || ""));
      });

      const activeTicketIds = group.tickets
        .filter((ticket) => ticket.status !== "done" && ticket.status !== "cancelled" && !ticket.isVoided)
        .map((ticket) => ticket.id);

      return {
        ...group,
        items,
        activeTicketIds,
        activeCount: activeTicketIds.length,
      };
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => {
      if (a.activeCount > 0 && b.activeCount === 0) return -1;
      if (a.activeCount === 0 && b.activeCount > 0) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function prettyAge(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function KDSByTablePage() {
  const [tickets, setTickets] = useState([]);
  const [stations, setStations] = useState([{ slug: "ALL", name: "ALL" }]);
  const [selectedStation, setSelectedStation] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(todayInBangkok());
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [wsConnectedCount, setWsConnectedCount] = useState(0);
  const [lastEventLabel, setLastEventLabel] = useState("No events yet");
  const [lastEventAt, setLastEventAt] = useState(null);

  const socketsRef = useRef({});
  const reconnectTimersRef = useRef({});
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const alertTimerRef = useRef(null);
  const liveWsEnabledRef = useRef(false);
  const today = todayInBangkok();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio("/sounds/neworder.mp3");
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
      } catch {}
      audioRef.current = null;
    };
  }, []);

  async function unlockAudio() {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") return false;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }

      audio.currentTime = 0;
      const prevMuted = audio.muted;
      const prevVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = prevMuted;
      audio.volume = prevVolume || 1;
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

  function playBeep(freq = 880, duration = 0.18) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  async function playNewOrderAlert() {
    clearTimeout(alertTimerRef.current);

    const audio = audioRef.current;
    if (!audio) {
      playBeep();
      return;
    }

    try {
      audio.currentTime = 0;
      await audio.play();
      setAudioEnabled(true);
    } catch {
      playBeep();
      setAudioEnabled(false);
    }

    alertTimerRef.current = window.setTimeout(() => {
      const replay = async () => {
        try {
          audio.currentTime = 0;
          await audio.play();
        } catch {
          playBeep(880, 0.15);
        }
      };
      replay();
    }, 900);
  }

  async function testSound() {
    const unlocked = await unlockAudio();
    if (!unlocked && !audioCtxRef.current) return;
    await playNewOrderAlert();
  }

  function showBrowserNotification(title, body) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(title, { body });
    } catch {}
  }

  useEffect(() => {
    (async () => {
      const res = await authFetch(`${API}/kitchen-stations/`);
      const json = await res.json();
      const unique = new Map();
      [{ slug: "ALL", name: "ALL" }, ...(json.stations || [])].forEach((station) => {
        const slug = station?.slug ? cleanStationSlug(station.slug) : "ALL";
        unique.set(slug, { ...station, slug });
      });
      setStations([...unique.values()]);
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const load = async () => {
      try {
        const res = await authFetch(`${API}/kitchen-tickets/?date=${selectedDate}`);
        const data = await res.json();
        if (alive) setTickets(Array.isArray(data) ? data : []);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [selectedDate]);

  useEffect(() => {
    liveWsEnabledRef.current = typeof window !== "undefined" && selectedDate === today;
    if (!liveWsEnabledRef.current) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const wantedStations = stations.filter((station) => station.slug !== "ALL");

    const connectStation = (slug, candidateIndex = 0) => {
      const normalizedSlug = cleanStationSlug(slug);
      const existing = socketsRef.current[normalizedSlug];
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const candidates = buildWsCandidates(API, `/ws/kitchen/${encodeURIComponent(normalizedSlug)}/`);
      const targetUrl = candidates[candidateIndex];
      if (!targetUrl) {
        setLastEventLabel(`No socket target: ${normalizedSlug}`);
        setLastEventAt(new Date());
        return;
      }

      const ws = new WebSocket(targetUrl);
      socketsRef.current[normalizedSlug] = ws;
      setWsConnectedCount(Object.values(socketsRef.current).filter((socket) => socket.readyState === WebSocket.OPEN).length);

      ws.onopen = () => {
        setWsConnectedCount(Object.values(socketsRef.current).filter((socket) => socket.readyState === WebSocket.OPEN).length);
        setLastEventLabel(`Socket connected: ${normalizedSlug}`);
        setLastEventAt(new Date());
      };

      ws.onmessage = async (event) => {
        let msg = null;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!msg?.type || !msg?.data) return;
        setLastEventLabel(`${String(msg.type).toUpperCase()} • ${msg.data?.table_name || "Takeaway"} • ${msg.data?.product_name || `Order ${msg.data?.order_number || msg.data?.order_id || ""}`}`);
        setLastEventAt(new Date());

        if (msg.type === "ticket") {
          setTickets((prev) => (prev.some((ticket) => ticket.id === msg.data.id) ? prev : [msg.data, ...prev]));
          await playNewOrderAlert();
          showBrowserNotification(
            "New Kitchen Order",
            `${msg.data?.table_name || "Takeaway"} • Order ${msg.data?.order_number || msg.data?.order_id || ""}`
          );
          return;
        }

        if (msg.type === "update") {
          setTickets((prev) =>
            prev.map((ticket) => (ticket.id === msg.data.id ? { ...ticket, ...msg.data } : ticket))
          );
          return;
        }

        if (msg.type === "cancel") {
          setTickets((prev) =>
            prev.map((ticket) =>
              ticket.id === msg.data.id
                ? { ...ticket, isVoided: true, status: "cancelled", updated_at: new Date().toISOString() }
                : ticket
            )
          );
        }
      };

      ws.onclose = () => {
        delete socketsRef.current[normalizedSlug];
        setWsConnectedCount(Object.values(socketsRef.current).filter((socket) => socket.readyState === WebSocket.OPEN).length);
        if (!ws.wasOpened && candidateIndex + 1 < candidates.length) {
          setLastEventLabel(`Retrying socket: ${normalizedSlug}`);
          setLastEventAt(new Date());
          connectStation(normalizedSlug, candidateIndex + 1);
          return;
        }
        setLastEventLabel(`Socket closed: ${normalizedSlug}`);
        setLastEventAt(new Date());
        if (!liveWsEnabledRef.current) return;
        reconnectTimersRef.current[normalizedSlug] = window.setTimeout(() => connectStation(normalizedSlug), 1500);
      };

      ws.onerror = () => {
        setLastEventLabel(`Socket error: ${normalizedSlug}`);
        setLastEventAt(new Date());
        try {
          ws.close();
        } catch {}
      };

      ws.addEventListener("open", () => {
        ws.wasOpened = true;
      });
    };

    wantedStations.forEach((station) => connectStation(station.slug));

    const wanted = new Set(wantedStations.map((station) => station.slug));
    Object.entries(socketsRef.current).forEach(([slug, socket]) => {
      if (wanted.has(slug)) return;
      try {
        socket.close(1000, "cleanup");
      } catch {}
      delete socketsRef.current[slug];
    });
    setWsConnectedCount(Object.values(socketsRef.current).filter((socket) => socket.readyState === WebSocket.OPEN).length);

    return () => {
      clearTimeout(alertTimerRef.current);
      liveWsEnabledRef.current = false;
      Object.values(reconnectTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      reconnectTimersRef.current = {};

      Object.values(socketsRef.current).forEach((socket) => {
        try {
          socket.close(1000, "cleanup");
        } catch {}
      });
      socketsRef.current = {};
      setWsConnectedCount(0);
    };
  }, [stations, selectedDate, today]);

  const filteredTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => (selectedStation === "ALL" ? true : ticket.station === selectedStation))
        .filter((ticket) => toDateOnly(ticket.created_at || ticket.started_at) === selectedDate),
    [tickets, selectedStation, selectedDate]
  );

  const groupedOrders = useMemo(() => groupTicketsIntoOrders(filteredTickets), [filteredTickets]);

  async function markDone(ticketIds) {
    const ids = Array.isArray(ticketIds) ? ticketIds : [ticketIds];
    if (!ids.length) return;

    setBusyIds((current) => [...current, ...ids]);
    setTickets((prev) =>
      prev.map((ticket) =>
        ids.includes(ticket.id) ? { ...ticket, status: "done", done_at: new Date().toISOString() } : ticket
      )
    );

    try {
      await Promise.all(
        ids.map((ticketId) =>
          authFetch(`${API}/kitchen-tickets/${ticketId}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          })
        )
      );
    } finally {
      setBusyIds((current) => current.filter((id) => !ids.includes(id)));
    }
  }

  return (
    <main className="mesh-bg min-h-[calc(100vh-80px)] overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 rounded-[2.5rem] glass border-white/20 p-6 lg:flex-row lg:items-end lg:justify-between">
        
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/kds/all"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/50 bg-white/70 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:text-indigo-600"
            >
              Original KDS
            </Link>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="h-11 rounded-2xl glass border-white/40 px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
            >
              {stations.map((station) => (
                <option key={station.slug} value={station.slug}>
                  {station.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-11 rounded-2xl glass border-white/40 px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-2 w-24 rounded-full bg-indigo-500/20 animate-pulse" />
          </div>
        ) : null}

        {!loading && groupedOrders.length === 0 ? (
          <div className="glass rounded-[2.5rem] border-white/20 p-12 text-center">
            <div className="text-xl font-black text-slate-900">Queue Open</div>
            <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">No grouped table orders</div>
          </div>
        ) : null}

        {!loading && groupedOrders.length > 0 ? (
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {groupedOrders.map((group) => {
              const isBusy = group.activeTicketIds.some((id) => busyIds.includes(id));
              const isDone = group.activeCount === 0;

              return (
                <article
                  key={group.key}
                  className="overflow-hidden rounded-[2.3rem] glass border-white/30 shadow-xl shadow-slate-200/60"
                >
                  <div className={`flex items-center justify-between px-5 py-4 ${isDone ? "bg-indigo-50" : "bg-indigo-300"}`}>
                    <div>
                      <div className="text-2xl font-black tracking-tight text-white">{group.tableName}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                        Order {group.orderNumber}
                      </div>
                    </div>
                    <div className="text-sm font-black text-slate-600">{prettyAge(group.createdAt)}</div>
                  </div>

                  <div className="bg-white/95 px-5 py-5">
                    <div className="mb-4 flex items-center justify-between">
                      <span
                        className={`rounded-full px-4 py-2 text-sm font-black ${
                          isDone ? "bg-emerald-100 text-emerald-700" : "bg-lime-100 text-lime-700"
                        }`}
                      >
                        {isDone ? "Done" : "Ready"}
                      </span>
                      <span className="text-sm font-black text-slate-400">
                        {group.activeCount} active
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.items.map((item) => {
                        const modifierLines = groupModifierLines(item.modifiers);
                        return (
                          <div key={item.key} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[15px] font-black leading-tight text-slate-900">
                                  {item.productName} {item.qty}
                                </div>
                                {item.variantName ? (
                                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                                    {item.variantName}
                                  </div>
                                ) : null}
                                {modifierLines.map((line, index) => (
                                  <div key={`${item.key}-${index}`} className="mt-1 text-[11px] font-bold text-slate-500">
                                    {line}
                                  </div>
                                ))}
                              </div>
                              <div
                                className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                                  item.activeCount > 0 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={isDone || isBusy}
                      onClick={() => markDone(group.activeTicketIds)}
                      className={`mt-5 w-full rounded-[1.6rem] border px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                        isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {isDone ? "Completed" : "Mark As Done"}
                    </button>

                    {group.orderId ? (
                      <Link
                        href={`/receipt/${group.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex w-full items-center justify-center rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-100 hover:text-indigo-600"
                      >
                        Print Receipt
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
