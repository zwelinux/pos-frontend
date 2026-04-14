"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import Link from "next/link";

function wsUrlFromApi(apiBase) {
  try {
    const u = new URL(apiBase);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    return (path) => `${wsProto}//${u.host}${path}`;
  } catch {
    return (path) =>
      (window.location.protocol === "https:" ? "wss:" : "ws:") +
      "//" +
      window.location.host +
      path;
  }
}

export default function KDSStationsClient() {
  const [stations, setStations] = useState([]); // [{slug, label, count}]
  const [err, setErr] = useState("");
  const socketsRef = useRef({});
  const makeWsUrl = useMemo(() => wsUrlFromApi(API), []);

  const load = async () => {
    try {
      const r = await authFetch(`${API}/kitchen-stations/`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // normalize + group duplicates
      const map = new Map();
      (j.stations || []).forEach((s) => {
        let slug, label, count;
        if (typeof s === "string") {
          slug = s.trim().toUpperCase();
          label = s;
          count = 0;
        } else {
          slug = (s.slug || s.name || "").trim().toUpperCase();
          label = s.name || slug;
          count = Number(s.count ?? 0);
        }
        if (!slug) return;

        if (!map.has(slug)) {
          map.set(slug, { slug, label, count });
        } else {
          map.get(slug).count += count; // merge dup slugs
        }
      });

      setStations([...map.values()]);
      setErr("");
    } catch (e) {
      console.error(e);
      setErr("Failed to load stations.");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let debTimer = null;
    const debouncedLoad = () => {
      clearTimeout(debTimer);
      debTimer = setTimeout(() => load(), 150);
    };

    const openFor = (slug) => {
      const sock = socketsRef.current[slug];
      if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) return;
      const ws = new WebSocket(makeWsUrl(`/ws/kitchen/${encodeURIComponent(slug)}/`));
      socketsRef.current[slug] = ws;
      ws.onmessage = debouncedLoad;
      ws.onclose = () => setTimeout(() => openFor(slug), 1500);
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    stations.forEach((s) => s.slug && openFor(s.slug));

    // cleanup sockets that are no longer needed
    const wanted = new Set(stations.map((s) => s.slug));
    Object.entries(socketsRef.current).forEach(([slug, sock]) => {
      if (!wanted.has(slug)) {
        try { sock.close(1000, "cleanup"); } catch {}
        delete socketsRef.current[slug];
      }
    });
  }, [stations.map((s) => s.slug).join(",")]);

  return (
    <main className="max-w-4xl mx-auto p-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-center sm:text-left">Kitchen Stations</h1>
        <Link
          href="/kds/by-table"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50"
        >
          KDS By Table
        </Link>
      </div>

      {err && <div className="text-red-600 mb-4 text-center">{err}</div>}

      {stations.length === 0 && !err && (
        <p className="text-sm text-slate-500 text-center">No stations found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {stations.map((s) => (
          <Link
            key={s.slug}
            href={`/kds/${encodeURIComponent(s.slug)}`}
            className="flex justify-between items-center px-4 py-3 border rounded-lg shadow-sm hover:shadow-md hover:bg-slate-50 transition"
          >
            <span className="font-medium">{s.label}</span>
            <span
              className={`text-xs px-2 py-1 rounded-full min-w-6 text-center ${
                s.count > 0
                  ? "bg-red-600 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {s.count}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
