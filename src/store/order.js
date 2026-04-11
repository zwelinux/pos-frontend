// src/store/order.js
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export const useOrder = create(
  persist(
    (set, get) => ({
      order: null,          // full OrderOutSer
      lastTableId: null,    // remember which table we’re on
      hasHydrated: false,

      setOrder: (order) => set({ order, lastTableId: order?.table?.id ?? get().lastTableId }),
      setLastTableId: (id) => set({ lastTableId: id ?? null }),
      clearOrder: () => set({ order: null }),

      // Fetch the current server copy of the active order (by id)
      ensureFresh: async () => {
        const id = get().order?.id;
        if (!id) return null;
        try {
          const r = await authFetch(`${API}/orders/${id}/`);
          if (!r.ok) return null;
          const full = await r.json();
          set({ order: full });
          return full;
        } catch {
          return null;
        }
      },

      // If we don’t have an order (e.g., after refresh), ask the table for its active order
      recoverOrder: async () => {
        const tid = get().lastTableId;
        if (!tid) return null;
        try {
          // POST always returns/opens the current active order for that table
          const r = await authFetch(`${API}/tables/${tid}/active_order/`, { method: "POST" });
          if (!r.ok) return null;
          const o = await r.json();
          set({ order: o });
          return o;
        } catch {
          return null;
        }
      },

      // conveniences
      get orderId() {
        return get().order?.id ?? null;
      },
      get isPaid() {
        return !!get().order?.paid_at;
      },
      get isVoided() {
        return get().order?.status === "void";
      },
    }),
    {
      name: "pos-active-order",
      storage: createJSONStorage(() => sessionStorage),

      // persist full order + lastTableId so refresh works
      partialize: (state) => ({
        order: state.order,
        lastTableId: state.lastTableId,
      }),

      onRehydrateStorage: () => {
        return () => {
          // mark ready for UI to stop showing loading placeholders
          useOrder.setState({ hasHydrated: true });
        };
      },

      version: 4,
      migrate: (p) => p,
    }
  )
);

// tiny safety net in case the rehydrate callback doesn’t run
if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const s = useOrder.getState();
    if (!s.hasHydrated) useOrder.setState({ hasHydrated: true });
  });
}
