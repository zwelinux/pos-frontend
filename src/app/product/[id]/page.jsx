"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProduct } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/store/cart";

export default function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [modsState, setModsState] = useState({}); // {optionId: true}
  const [qty, setQty] = useState(1);

  useEffect(() => {
    (async () => {
      const p = await getProduct(id);
      setProduct(p);
      if (p?.variants?.length) setVariantId(p.variants[0].id);
      const defaults = {};
      (p.modifier_groups || []).forEach((g) =>
        g.options.forEach((o) => {
          if (o.is_default) defaults[o.id] = true;
        })
      );
      setModsState(defaults);
    })();
  }, [id]);

  const price = useMemo(() => {
    if (!product) return 0;
    const base = Number(product.base_price);
    const vDelta =
      product.variants?.find((v) => v.id === variantId)?.price_delta || 0;
    const mDelta = (product.modifier_groups || [])
      .flatMap((g) => g.options)
      .filter((o) => !!modsState[o.id])
      .reduce((s, o) => s + Number(o.price_delta || 0), 0);
    return +(base + Number(vDelta) + mDelta).toFixed(2);
  }, [product, variantId, modsState]);

  if (!product) {
    return <main className="p-4">Loading…</main>;
  }

  const toggleOpt = (group, opt) => {
    const isSingle = group.selection_type === "single";
    setModsState((prev) => {
      if (!isSingle) {
        return { ...prev, [opt.id]: !prev[opt.id] };
      }
      // single: clear all in group then set this one
      const next = { ...prev };
      group.options.forEach((o) => delete next[o.id]);
      next[opt.id] = true;
      return next;
    });
  };

  const onAdd = () => {
    const variant =
      product.variants?.find((v) => v.id === variantId) || null;

    // include only selected (or default where user didn't toggle off)
    const mods = (product.modifier_groups || [])
      .flatMap((g) => g.options)
      .filter(
        (o) => modsState[o.id] === true || (o.is_default && !modsState[o.id])
      )
      .map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: o.price_delta,
        include: !!modsState[o.id],
      }));

    addItem({ product, variant, mods, qty });
    router.push("/cart");
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* Breadcrumb / Back */}
        <button
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Back
        </button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Image / Visual */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="aspect-square rounded-2xl bg-neutral-100" />
          </div>

          {/* Config */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold">{product.name}</h1>
              <p className="mt-1 text-neutral-600">
                Base ฿{formatMoney(product.base_price)}
              </p>
            </div>

            {/* Variants */}
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="mb-2 font-medium">Variant</h3>
              <div className="flex flex-col gap-2">
                {(product.variants || []).length === 0 && (
                  <div className="text-sm text-neutral-500">No variants</div>
                )}
                {(product.variants || []).map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variant"
                        checked={variantId === v.id}
                        onChange={() => setVariantId(v.id)}
                      />
                      <span>{v.name}</span>
                    </div>
                    <span className="text-sm text-neutral-600">
                      {v.price_delta >= 0 ? "+" : ""}
                      {formatMoney(v.price_delta)}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Modifier Groups */}
            {(product.modifier_groups || []).length > 0 && (
              <section className="space-y-4">
                {(product.modifier_groups || []).map((g) => (
                  <div
                    key={g.id}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-medium">{g.name}</h4>
                      <span className="text-xs text-neutral-500">
                        {g.selection_type === "single"
                          ? "Choose 1"
                          : "Multiple allowed"}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {g.options.map((o) => {
                        const isSingle = g.selection_type === "single";
                        const checked = !!modsState[o.id];
                        return (
                          <label
                            key={o.id}
                            className="flex items-center justify-between rounded-xl border px-3 py-2 hover:bg-neutral-50"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type={isSingle ? "radio" : "checkbox"}
                                name={isSingle ? `group-${g.id}` : undefined}
                                checked={checked}
                                onChange={() => toggleOpt(g, o)}
                              />
                              <span>{o.name}</span>
                            </div>
                            <span className="text-sm text-neutral-600">
                              {o.price_delta >= 0 ? "+" : ""}
                              {formatMoney(o.price_delta)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Quantity (desktop view; on mobile we also show in sticky bar) */}
            <div className="hidden md:flex items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-sm">Qty</span>
                <input
                  className="w-20 rounded-xl border px-3 py-2"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(+e.target.value || 1)}
                />
              </label>
              <div className="font-semibold">
                Line: ฿{formatMoney(price * qty)}
              </div>
              <button
                onClick={onAdd}
                className="ml-auto rounded-xl bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/90 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <input
            className="w-20 rounded-xl border px-3 py-2"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(+e.target.value || 1)}
          />
          <div className="font-semibold">฿{formatMoney(price * qty)}</div>
          <button
            onClick={onAdd}
            className="ml-auto inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-700"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </main>
  );
}
