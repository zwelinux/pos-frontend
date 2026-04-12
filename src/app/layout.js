// import { Geist, Geist_Mono } from "next/font/google";
// import { Noto_Sans_Myanmar } from "next/font/google";
// import "./globals.css";
// import NavbarAuthed from "@/components/NavbarAuthed";
// import { Suspense } from "react";

// const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// const notoMyanmar = Noto_Sans_Myanmar({
//   variable: "--font-noto-myanmar",
//   weight: ["400", "500", "700"],
//   subsets: ["my", "latin"],
//   display: "swap",
// });

// export const metadata = {
//   title: "JusPOS",
//   description: "POS system for Jus Food & Drinks",
// };

// // ✅ add viewport for correct mobile scaling/notch handling
// export const viewport = {
//   width: "device-width",
//   initialScale: 1,
//   viewportFit: "cover",
// };

// export default function RootLayout({ children }) {
//   return (
//     <html lang="my">
//       <body
//         className={`
//           ${geistSans.variable}
//           ${geistMono.variable}
//           ${notoMyanmar.variable}
//           font-sans antialiased text-neutral-800
//           bg-white min-h-screen overflow-x-hidden
//         `}
//         style={{
//           fontFamily:
//             "var(--font-noto-myanmar), var(--font-geist-sans), Arial, sans-serif",
//         }}
//       >
//         <Suspense fallback={null}>
//           <NavbarAuthed />
//         </Suspense>

//         {/* FIX: Added a <main> element with `z-10` and `relative` to establish a 
//           new stacking context below the header (z-40/z-50). The content is 
//           already flowing under the header due to `sticky` positioning, 
//           so the issue is the high z-index of the mobile menu panel 
//           (z-50) is still not enough to cover the main content (which 
//           defaults to z-index auto, but might be elevated by its own layout).
//         */}
//         <main className="relative z-10">
//           <Suspense fallback={<div className="p-6">Loading…</div>}>
//             {children}
//           </Suspense>
//         </main>

//       </body>
//     </html>
//   );
// }

import "./globals.css";
import NavbarAuthed from "@/components/NavbarAuthed";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ToastContext";

export const metadata = {
  title: "JusPOS | Modern Point of Sale",
  description: "Advanced POS system for Jus Food & Drinks",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="my" className="scroll-smooth">
      <body
        className={`
          antialiased text-slate-900
          mesh-bg min-h-screen overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900
        `}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <ToastProvider>
          <ServiceWorkerCleanup />
          <Suspense fallback={null}>
            <NavbarAuthed />
          </Suspense>

          <main className="relative z-10">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-indigo-100" />
                  <div className="text-slate-400 font-medium">Loading JusPOS...</div>
                </div>
              </div>
            }>
              {children}
            </Suspense>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
