"use client";

import { useState, useEffect } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/components/ToastContext";
import { formatMoney } from "@/lib/money";

export default function ProductConfigModal({ productId, onClose, onAdd }) {
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [modSelections, setModSelections] = useState({});
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(`${API}/products/${productId}/`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setProduct(j);
        setVariant(null);
        setModSelections({});
        setQty(1);
      } catch (e) {
        console.error("Failed to load product", e);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    setModSelections((prev) => {
      if (!variant) return {};
      const visibleGroupIds = new Set(
        (product?.modifier_groups || [])
          .filter(g => !g.required_variant_id || Number(g.required_variant_id) === Number(variant))
          .flatMap(g => g.options.map(o => o.id))
      );
      return Object.fromEntries(Object.entries(prev).filter(([id]) => visibleGroupIds.has(Number(id))));
    });
  }, [variant, product]);

  if (!product) return null;
  const selectedVariantId = variant ? Number(variant) : null;

  const addOption = (group, opt) => {
    setModSelections(prev => {
      const currentQty = prev[opt.id]?.qty || 0;
      const totalPicks = Object.entries(prev)
        .filter(([id, v]) => v.qty > 0 && group.options.some(o => o.id === Number(id)))
        .reduce((sum, [_, v]) => sum + v.qty, 0);

      // 1. Multi-Click behavior: increment up to group max
      if (opt.multi_click) {
        if (totalPicks >= group.max_allowed) {
          showToast(`⚠️ Maximum ${group.max_allowed} items allowed`);
          return prev;
        }
        return { ...prev, [opt.id]: { qty: currentQty + 1 } };
      }

      // 2. Single selection group behavior (exclusive toggle within this group)
      if (group.selection_type === "single") {
        const next = { ...prev };
        // Remove any existing selection from THIS group
        group.options.forEach(o => {
          delete next[o.id];
        });

        if (currentQty === 0) {
          next[opt.id] = { qty: 1 };
        }
        return next;
      }

      // 3. Multi selection group behavior (toggle 0/1)
      if (currentQty > 0) {
        const next = { ...prev };
        delete next[opt.id];
        return next;
      } else {
        if (totalPicks >= group.max_allowed) {
          showToast(`⚠️ Maximum ${group.max_allowed} items allowed`);
          return prev;
        }
        return { ...prev, [opt.id]: { qty: 1 } };
      }
    });
  };

  const removeOption = (optId) => {
    setModSelections(prev => {
      if (!prev[optId]) return prev;
      const next = { ...prev };
      delete next[optId];
      return next;
    });
    showToast("♻️ Selection cleared");
  };

  const decreaseOption = (group, opt) => {
    setModSelections(prev => {
      const currentQty = prev[opt.id]?.qty || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[opt.id];
        return next;
      }
      return { ...prev, [opt.id]: { qty: currentQty - 1 } };
    });
  };

  const isGroupVisible = (g) => {
    if (!g.show_group) return false;
    const reqV = g.required_variant_id ? Number(g.required_variant_id) : null;
    if (reqV !== null && reqV !== selectedVariantId) return false;
    
    const reqO = g.required_option_ids || [];
    if (reqO.length > 0 && !reqO.some(id => modSelections[id]?.qty > 0)) return false;

    return true;
  };

  const getGroupQty = (group) =>
    Object.entries(modSelections)
      .filter(([id, v]) => v.qty > 0 && group.options.some(o => o.id === Number(id)))
      .reduce((sum, [_, v]) => sum + v.qty, 0);

  const hasVariantRequired = product.modifier_groups?.some(g => g.required_variant_id) ?? false;
  
  const visibleGroups = (product.modifier_groups || []).filter(isGroupVisible);

  const modifiersValid = visibleGroups.every(g => getGroupQty(g) >= g.min_required);

  const canAdd = (!hasVariantRequired || selectedVariantId !== null) && modifiersValid;

  const handleAdd = async () => {
    if (!canAdd) {
      showToast("❗ Please complete required selections");
      return;
    }
    setLoading(true);
    
    const visibleOptionIds = new Set(visibleGroups.flatMap(g => g.options.map(o => o.id)));

    const modifiers = Object.entries(modSelections)
      .filter(([id, v]) => v.qty > 0 && visibleOptionIds.has(Number(id)))
      .map(([id, v]) => ({ option_id: Number(id), include: true, qty: v.qty }));
      
    try {
      await onAdd({ product_id: Number(product.id), variant_id: selectedVariantId, qty, modifiers });
      showToast("✔ Added to Order");
      onClose();
    } catch (e) {
      console.error(e);
      showToast("❌ Failed to add");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 mt-12 md:p-8 overflow-hidden">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass border-white/20 rounded-[2.5rem] shadow-2xl flex flex-col max-h-full overflow-hidden animate-slide-down">
        {/* Modal Header */}
        <div className="p-8 pb-4 shrink-0 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-3 py-1 shadow-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Product Customizer</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{product.name}</h2>
            </div>
            {product.image && (
              <div className="h-24 w-24 shrink-0 rounded-[2rem] overflow-hidden glass border-white/60 shadow-xl shadow-indigo-100/50">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          <p className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest">
             <span className="text-indigo-600">฿{money(product.base_price)}</span>
          </p>
        </div>

        {/* Scrollable Configuration */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-6 space-y-8">
          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="space-y-4">
              {/* <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Select Variation</h3> */}
              <div className="grid grid-cols-2 gap-3">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariant(Number(v.id))}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-4 transition-all duration-300 ${
                      selectedVariantId === Number(v.id)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                        : "glass border-white/40 text-slate-600 hover:border-indigo-100 hover:text-indigo-600"
                    }`}
                  >
                    <span className="text-sm font-black">{v.name}</span>
                    <span className={`text-[10px] font-bold mt-1 ${selectedVariantId === Number(v.id) ? "text-indigo-200" : "text-slate-400"}`}>
                      {Number(v.price_delta) > 0 ? `+${money(v.price_delta)} ฿` : ""}
                      {/* {Number(v.price_delta) > 0 ? `+${money(v.price_delta)} ฿` : "Included"} */}

                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modifier Groups */}
          {visibleGroups.map((group) => {
            const isGroupValid = getGroupQty(group) >= group.min_required;

            return (
              <div key={group.id} className="space-y-4">
                {group.show_title && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {group.name}
                      {group.min_required > 0 && <span className="text-indigo-500 ml-1 font-black">*</span>}
                    </h3>
                    {group.min_required > 0 && !isGroupValid && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">Required</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(group.options || []).map((opt) => {
                    const currentQty = modSelections[opt.id]?.qty || 0;

                    if (opt.multi_click) {
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center rounded-2xl border transition-all duration-300 overflow-hidden ${
                            currentQty > 0
                              ? "bg-indigo-50 border-indigo-200 shadow-sm"
                              : "glass border-white/40 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`px-4 py-3 flex items-center justify-center text-sm font-bold ${currentQty > 0 ? "text-indigo-700" : "text-slate-600"}`}>
                            {opt.name}
                            {Number(opt.price_delta) > 0 && (
                              <span className="ml-2 py-0.5 px-1.5 rounded-md bg-white border border-indigo-100 text-[10px] font-black text-indigo-600">
                                +{money(opt.price_delta)} ฿
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 px-3 py-2 border-l border-white/40 ml-auto">
                            <button
                              onClick={() => decreaseOption(group, opt)}
                              className={`w-8 h-8 flex items-center justify-center rounded-xl font-bold transition-colors ${
                                currentQty > 0 ? "bg-white text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white" : "opacity-30 cursor-not-allowed text-slate-400"
                              }`}
                              disabled={currentQty === 0}
                            >
                              –
                            </button>
                            <span className={`w-8 text-center text-lg font-black ${currentQty > 0 ? "text-indigo-700" : "text-slate-400"}`}>
                              {currentQty}
                            </span>
                            <button
                              onClick={() => addOption(group, opt)}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white shadow-sm text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={opt.id}
                        onClick={() => addOption(group, opt)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (currentQty > 0) removeOption(opt.id);
                        }}
                        className={`px-5 py-3 rounded-2xl border text-sm font-bold transition-all duration-300 relative overflow-hidden group/btn ${
                          currentQty > 0
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                            : "glass border-white/40 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                        title={currentQty > 0 ? "Long press or right-click to clear" : ""}
                      >
                        {opt.name}
                        {Number(opt.price_delta) > 0 && (
                          <span className="ml-2 py-0.5 px-1.5 rounded-md bg-white border border-indigo-100 text-[10px] font-black text-indigo-600">
                            +{money(opt.price_delta)} ฿
                          </span>
                        )}
                        
                        {/* Hint for clearing */}
                        {currentQty > 0 && (
                          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                            <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-8 shrink-0 bg-slate-50/50 border-t border-white/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl glass border-white/40 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-white hover:text-slate-900 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || !canAdd}
            className="flex-[2] relative overflow-hidden rounded-2xl bg-indigo-600 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-500 active:translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed group"
          >
            <span className="relative z-10">{loading ? "Synchronizing..." : "Add to Selection"}</span>
            {!loading && canAdd && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function money(n) {
  return formatMoney(n);
}
