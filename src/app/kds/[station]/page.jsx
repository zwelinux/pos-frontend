import { Suspense } from "react";
import KDSClient from "./KDSClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function KDSStationPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <KDSClient />
    </Suspense>
  );
}
