import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { AppFooter } from "@/components/shell/AppFooter";
import { AppHeader } from "@/components/shell/AppHeader";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TagTriage", template: "%s · TagTriage" },
  description: "Offline-first EMS app for NFC medical stickers. Demonstrator: no real patient data.",
  applicationName: "TagTriage",
  appleWebApp: { capable: true, title: "TagTriage", statusBarStyle: "default" },
  other: { "mobile-web-app-capable": "yes" }
};

export const viewport: Viewport = {
  themeColor: "#f3eee4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-[100dvh] font-sans antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="paper-bg" aria-hidden="true" />
        <ServiceWorkerRegistrar />
        <Providers>
          <AppHeader />
          <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-20 pt-8 outline-none md:px-6 md:pt-12">
            {children}
          </main>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
