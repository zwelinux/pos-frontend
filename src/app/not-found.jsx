import { Suspense } from "react";
import NotFoundClient from "./not-found-client"; // only if you truly need client hooks

export const dynamic = "force-dynamic"; // prevents static export edge cases

export default function NotFound() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <NotFoundClient />
    </Suspense>
  );
}
