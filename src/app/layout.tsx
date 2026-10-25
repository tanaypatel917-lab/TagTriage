import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { AppHeader } from "@/components/shell/AppHeader";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TagTriage", template: "%s · TagTriage" },
  description: "Offline-first EMS app for NFC medical stickers. Demonstrator: no real patient data.",
  applicationName: "TagTriage",
  appleWebApp: { capable: true, title: "TagTriage", statusBarStyle: "black-translucent" },
  other: { "mobile-web-app-capable": "yes" }
};

export const viewport: Viewport = {
  themeColor: "#060b16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-[100dvh] font-sans antialiased">
        <div className="aurora-bg" aria-hidden="true" />
        <ServiceWorkerRegistrar />
        <Providers>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:pt-10">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-xs text-white/45">
            Demonstrator · no real patient data · not for clinical use
          </footer>
        </Providers>
      </body>
    </html>
  );
}
