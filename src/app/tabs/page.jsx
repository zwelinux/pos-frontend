import { Suspense } from "react";
import TabsClient from "./TabsClient";

// Make sure Next doesn't try to statically export this page
export const dynamic = "force-dynamic";   // or: export const revalidate = 0;

export default function TabsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <TabsClient />
    </Suspense>
  );
}
