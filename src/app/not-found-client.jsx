"use client";

import { useSearchParams } from "next/navigation";

export default function NotFoundClient() {
  // If you don't actually need this, delete it to keep 404 fully static.
  const sp = useSearchParams();
  const q = sp.get("q") || "";

  return (
    <main className="mx-auto max-w-xl p-6 text-center space-y-3">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      {q ? <p className="text-slate-600">You searched for: <b>{q}</b></p> : null}
      <a href="/" className="inline-block mt-2 underline">Go home</a>
    </main>
  );
}
