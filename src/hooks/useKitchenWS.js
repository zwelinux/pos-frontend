// src/hooks/useKitchenWS.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function safeParse(j) {
  try { return JSON.parse(j); } catch { return null; }
}

function useAudio(url) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const el = new Audio(url);
    el.preload = "auto";
    audioRef.current = el;
    return () => {
      // best-effort cleanup to allow GC
      try { el.pause(); } catch {}
    };
  }, [url]);

  const fallbackBeep = useCallback(async () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.value = 0.06;
      osc.type = "sine"; osc.frequency.value = 880;
      osc.start();
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 140);
    } catch {}
  }, []);

  const play = useCallback(async () => {
    try {
      const el = audioRef.current;
      if (el) {
        el.currentTime = 0;
        await el.play();
      } else {
        await fallbackBeep();
      }
    } catch {
      await fallbackBeep();
    }
  }, [fallbackBeep]);

  const setVolume = useCallback((v) => {
    const el = audioRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, v));
  }, []);

  return { play, setVolume };
}

/**
 * Subscribes to ws://<host>/ws/kitchen/<STATION>/
 * Sounds:
 *   - ticket                         -> new-order.m4a
 *   - update status=done (edge)      -> order-ready.m4a
 *   - update qty increased           -> new-order.m4a
 */
export function useKitchenWS({ station = "MAIN", onEvent }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  // sound players (their play/setVolume are stable via useCallback)
  const sNewOrder = useAudio("/sounds/new-order.m4a");
  const sReady    = useAudio("/sounds/order-ready.m4a");

  // remember last known (qty, status) by ticket id to detect transitions
  const last = useRef(new Map());

  // small burst coalescer so many events in a frame don't spam
  const queue = useRef([]);
  const flushTimer = useRef(null);

  const flush = useCallback(() => {
    const hasReady = queue.current.includes("ready");
    const hasNew   = queue.current.includes("new");
    queue.current = [];
    if (hasReady) sReady.play();
    else if (hasNew) sNewOrder.play();
  }, [sNewOrder.play, sReady.play]);

  const requestPlay = useCallback((kind) => {
    queue.current.push(kind);
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 120);
  }, [flush]);

  const handleMessage = useCallback((ev) => {
    const msg = typeof ev?.data === "string" ? safeParse(ev.data) : ev?.data;
    if (!msg || !msg.type) return;

    // bubble the raw event up
    onEvent?.(msg);

    // Your consumer sends: "ticket", "update", "cancel"
    if (msg.type === "ticket") {
      // new ticket -> new-order sound
      const id = msg.data?.id;
      const qty = Number(msg.data?.qty || 0);
      const status = msg.data?.status || null;
      if (id) last.current.set(id, { qty, status });
      requestPlay("new");
      return;
    }

    if (msg.type === "update") {
      const id = msg.data?.id;
      const qty = Number(msg.data?.qty ?? NaN);
      const status = msg.data?.status || null;
      if (!id) return;

      const prev = last.current.get(id) || {};
      // edge-trigger for READY: play only when status flips to 'done'
      if (status === "done" && prev.status !== "done") {
        requestPlay("ready");
      } else if (Number.isFinite(qty)) {
        // qty increased → treat as new order sound
        const prevQty = Number.isFinite(prev.qty) ? Number(prev.qty) : qty;
        if (qty > prevQty) requestPlay("new");
      }
      last.current.set(id, { qty, status });
      return;
    }

    // cancel: no sound (change here if you want a soft tone)
    // if (msg.type === "cancel") { /* optional sound */ }
  }, [onEvent, requestPlay]);

  // Open/close the websocket; depend on STATION and the message handler.
  useEffect(() => {
    const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws/kitchen/${encodeURIComponent(String(station || "MAIN").toUpperCase())}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const onOpen  = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onError = () => setConnected(false);

    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);
    ws.addEventListener("error", onError);
    ws.addEventListener("message", handleMessage);

    return () => {
      try { ws.removeEventListener("open", onOpen); } catch {}
      try { ws.removeEventListener("close", onClose); } catch {}
      try { ws.removeEventListener("error", onError); } catch {}
      try { ws.removeEventListener("message", handleMessage); } catch {}
      try { ws.close(); } catch {}
      if (flushTimer.current) clearTimeout(flushTimer.current);
      wsRef.current = null;
    };
  }, [station, handleMessage]);

  const setVolume = useCallback((v) => {
    sNewOrder.setVolume(v);
    sReady.setVolume(v);
  }, [sNewOrder.setVolume, sReady.setVolume]);

  return { connected, setVolume };
}
