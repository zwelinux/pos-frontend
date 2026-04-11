"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useOrder } from "@/store/order";
import { getCategories, getProducts, getApiBase } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import OrderPanel from "@/components/OrderPanel";
import ProductConfigModal from "@/components/ProductConfigModal";

export default function Page() {
  return (
    <Suspense fallback={<MainSkeleton />}>
      <PageInner />
    </Suspense>
  );
}

// ------------------------------
// Skeleton Loader
// ------------------------------
function MainSkeleton() {
  return (
    <div className="mesh-bg min-h-screen p-6">
      <div className="mx-auto max-w-[1600px] grid grid-cols-1 md:grid-cols-[380px_1fr] gap-6 h-[calc(100vh-120px)]">
        <aside className="glass rounded-[2.5rem] border-white/20 animate-pulse" />
        <section className="space-y-6">
          <div className="h-12 w-1/2 glass rounded-2xl animate-pulse" />
          <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-[2rem] glass border-white/10 animate-pulse"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ------------------------------
// Main POS Page Content
// ------------------------------
function PageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { order, setOrder, clearOrder, lastTableId, hasHydrated, recoverOrder } = useOrder();
  const showPanel = searchParams.get("showOrder") === "1" || !!order?.id;

  const [activeProduct, setActiveProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [showMobileOrder, setShowMobileOrder] = useState(false);
  const catScrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  // Load categories
  useEffect(() => {
    (async () => {
      try {
        const cs = await getCategories();
        setCategories(Array.isArray(cs) ? cs : []);
        setActiveCat(Array.isArray(cs) && cs[0] ? cs[0].id : null);
      } catch (e) {
        console.error("Failed to load categories", e);
        setCategories([]);
      }
    })();
  }, []);

  // Load products by category
  useEffect(() => {
    (async () => {
      if (!activeCat) return;
      setLoading(true);
      try {
        const ps = await getProducts(activeCat);
        setProducts(Array.isArray(ps) ? ps : []);
      } catch (e) {
        console.error("Failed to load products", e);
        setProducts([]);
      }
      setLoading(false);
    })();
  }, [activeCat]);

  // Force table selection before ordering. If a table was already selected,
  // restore its active order after refresh instead of opening a loose order.
  useEffect(() => {
    (async () => {
      if (!hasHydrated) return;

      const hasSelectedTable = !!order?.table?.id || !!lastTableId;

      if (!hasSelectedTable) {
        if (order?.id) clearOrder();
        router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
        return;
      }

      if (order?.id) return;

      try {
        const recovered = await recoverOrder();
        if (!recovered?.table?.id) {
          clearOrder();
          router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
        }
      } catch (e) {
        console.error("Failed to recover active order", e);
        clearOrder();
        router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
      }
    })();
  }, [clearOrder, hasHydrated, lastTableId, order?.id, order?.table?.id, recoverOrder, router]);

  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return;

    const updateButtons = () => {
      setCanScroll({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };

    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [categories.length]);

  useEffect(() => {
    if (showMobileOrder) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [showMobileOrder]);

  const scrollCategories = (dir) => {
    const el = catScrollRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.6));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="mesh-bg h-[calc(100vh-80px)] overflow-hidden relative">
      <div className="mx-auto max-w-7xl w-full flex h-full px-4 py-4 md:py-6 gap-6">
        {/* LEFT: Order Panel */}
        {showPanel && (
          <aside className="hidden md:block w-[380px] shrink-0 sticky top-0 h-full overflow-hidden">
            <OrderPanel />
          </aside>
        )}

        {/* RIGHT: Main Workspace */}
        <section className="flex-1 flex flex-col min-w-0 h-full">
          {/* Category Navigation */}
          <div className="shrink-0 pb-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Categories
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCategories("left")}
                  disabled={!canScroll.left}
                  className="h-9 w-9 rounded-xl border border-white/50 bg-white/70 text-slate-500 transition hover:text-indigo-600 disabled:opacity-40"
                  aria-label="Scroll categories left"
                >
                  <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scrollCategories("right")}
                  disabled={!canScroll.right}
                  className="h-9 w-9 rounded-xl border border-white/50 bg-white/70 text-slate-500 transition hover:text-indigo-600 disabled:opacity-40"
                  aria-label="Scroll categories right"
                >
                  <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div ref={catScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar">
              {Array.isArray(categories) &&
                categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={[
                      "shrink-0 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300",
                      activeCat === c.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        : "glass border-white/40 text-slate-600 hover:bg-white/60 hover:text-indigo-600",
                    ].join(" ")}
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Workspace Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
            {loading ? (
              <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-[2.5rem] glass border-white/10 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-32 md:pb-20">
                {Array.isArray(products) &&
                  products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!order?.table?.id) {
                          router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
                          return;
                        }
                        setActiveProduct(p.id);
                      }}
                      disabled={loadingAdd}
                      className="group relative aspect-square flex flex-col rounded-[2.5rem] glass border-white/40 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-2 overflow-hidden"
                    >
                      {/* Visual Background / Image */}
                      <div className="absolute inset-x-4 top-4 bottom-22 rounded-[1.8rem] bg-indigo-50/50 group-hover:bg-indigo-100/50 transition-colors flex items-center justify-center overflow-hidden text-center">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <span className="text-4xl font-black text-indigo-200 group-hover:scale-110 transition-transform duration-500">
                            {p.name?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Floating Add Action */}
                      <div className="absolute top-8 right-8 h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>

                      {/* Product Details */}
                      <div className="mt-auto p-6 text-center">
                        <div className="line-clamp-1 text-lg font-black tracking-tight text-slate-800">
                          {p.name}
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          {/* <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Unit Basis</span> */}
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-sm font-black text-indigo-600">
                            {Number(p.base_price ?? 0).toFixed(2)} ฿
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* MOBILE: Sticky Bottom Bar */}
          <div className="md:hidden fixed bottom-6 left-6 right-6 z-[80] animate-in slide-in-from-bottom-8 duration-500">
            <button
              onClick={() => setShowMobileOrder(true)}
              className="w-full glass bg-slate-900/90 border-white/20 backdrop-blur-xl rounded-[2.5rem] p-5 shadow-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Items in Cart</div>
                  <div className="text-[12px] font-black text-black leading-none">
                    {(order?.items || []).reduce((sum, i) => sum + Number(i.qty), 0)} Selected
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 leading-none mb-1 text-right">Order Total</div>
                  <div className="text-[12px] font-black text-black leading-none">
                    ฿{Number(order?.total ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </button>
          </div>

          {/* MOBILE: Order Drawer Overlay */}
          {showMobileOrder && (
            <div className="md:hidden fixed inset-0 z-[1100] bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="absolute inset-x-0 bottom-0 h-[92vh] glass bg-white/95 rounded-t-[3rem] shadow-2xl animate-in slide-in-from-bottom-full duration-500 overflow-hidden flex flex-col">
                <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <OrderPanel onClose={() => setShowMobileOrder(false)} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Configuration Modal */}
        {activeProduct && (
          <ProductConfigModal
            productId={activeProduct}
            onClose={() => setActiveProduct(null)}
            onAdd={async (itemData) => {
              if (!order?.id || !order?.table?.id) {
                setActiveProduct(null);
                router.replace(`/tables?next=${encodeURIComponent("/?showOrder=1")}`);
                return;
              }
              const r = await authFetch(`${getApiBase()}/orders/${order.id}/add_items/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [itemData], tax_rate: "0.00" }),
              });
              if (r.ok) {
                const refreshed = await authFetch(`${getApiBase()}/orders/${order.id}/`);
                if (refreshed.ok) setOrder(await refreshed.json());
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
