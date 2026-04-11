// src/store/cart.js
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// keep only selected mods, sort ids for stable signature
const normalizeMods = (mods = []) =>
  mods.filter((m) => !!m.include).map((m) => String(m.id)).sort();

const signatureOf = (item) =>
  [
    item.productId,
    item.variantId ?? "",
    normalizeMods(item.mods || []).join(","),
  ].join("|");

export const useCart = create(
  persist(
    (set, get) => ({
      // 🆕 Track server-side order
      orderId: null,

      // Each item: {productId, productName, variantId, variantName, qty, mods[], unit, line}
      items: [],

      // 🆕 hydrate from backend OrderOutSer
      hydrateFromOrder: (order) => {
        if (!order) return;
        const items = (order.items || []).map((it) => ({
          productId: it.product_id ?? null,
          productName: it.product_name,
          variantId: it.variant_id ?? null,
          variantName: it.variant_name ?? "",
          qty: it.qty,
          mods: it.modifiers || [],
          unit: Number(it.unit_price),
          line: Number(it.line_total),
        }));
        set({ orderId: order.id, items });
      },

      // Add item (still useful for optimistic UI, but usually replaced by backend add_items API)
      addItem: ({ product, variant, mods, qty }) => {
        const base = Number(product.base_price);
        const vDelta = variant ? Number(variant.price_delta) : 0;
        const mDelta = (mods || [])
          .filter((m) => !!m.include)
          .reduce((s, m) => s + Number(m.price_delta || 0), 0);

        const unit = round2(base + vDelta + mDelta);
        const addQty = Math.max(1, Number(qty) || 1);

        const incoming = {
          productId: product.id,
          productName: product.name,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? "",
          qty: addQty,
          mods: mods || [],
          unit,
          line: round2(unit * addQty),
        };

        const sig = signatureOf(incoming);
        const items = [...get().items];
        const idx = items.findIndex((x) => signatureOf(x) === sig);

        if (idx >= 0) {
          const current = items[idx];
          const newQty = Number(current.qty) + addQty;
          items[idx] = {
            ...current,
            qty: newQty,
            unit, // refresh in case pricing changed
            line: round2(unit * newQty),
          };
          set({ items });
        } else {
          set({ items: [...items, incoming] });
        }
      },

      clear: () => set({ items: [], orderId: null }),

      total: () => {
        const sum = get().items.reduce(
          (s, i) => s + Number(i.unit) * Number(i.qty),
          0
        );
        return round2(sum);
      },

      // --- helpers for cart UI ---
      removeAt: (idx) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== idx),
        })),

      setQtyAt: (idx, qty) =>
        set((state) => {
          const items = state.items.slice();
          const it = items[idx];
          if (!it) return state;
          const q = Math.max(1, Number(qty) || 1);
          it.qty = q;
          it.line = round2(it.unit * q);
          items[idx] = it;
          return { items };
        }),

      incAt: (idx) =>
        set((state) => {
          const items = state.items.slice();
          const it = items[idx];
          if (!it) return state;
          const q = Number(it.qty) + 1;
          it.qty = q;
          it.line = round2(it.unit * q);
          items[idx] = it;
          return { items };
        }),

      decAt: (idx) =>
        set((state) => {
          const items = state.items.slice();
          const it = items[idx];
          if (!it) return state;
          const q = Math.max(1, Number(it.qty) - 1);
          it.qty = q;
          it.line = round2(it.unit * q);
          items[idx] = it;
          return { items };
        }),
    }),
    {
      name: "pos-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, orderId: state.orderId }),
      version: 2,
      migrate: (persisted) => {
        const coerce = (i) => ({
          ...i,
          unit: Number(i.unit),
          qty: Number(i.qty || 1),
          line: round2(Number(i.unit) * Number(i.qty || 1)),
        });
        return {
          ...persisted,
          orderId: persisted?.orderId ?? null,
          items: Array.isArray(persisted?.items)
            ? persisted.items.map(coerce)
            : [],
        };
      },
    }
  )
);
