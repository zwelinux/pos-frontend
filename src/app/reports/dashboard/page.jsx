import { Suspense } from "react";
import ReportsDashboardClient from "./ReportsDashboardClient";

export const dynamic = "force-dynamic";   // prevent static export
export const revalidate = 0;              // no ISR

export default function ReportsDashboardPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <ReportsDashboardClient />
    </Suspense>
  );
}
