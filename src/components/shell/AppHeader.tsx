"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { useOperator } from "../providers/OperatorProvider";
import { OperatorDialog } from "./OperatorDialog";

const NAV = [
  { href: "/", label: "Capture" },
  { href: "/register", label: "Register" },
  { href: "/board", label: "Board" },
  { href: "/inventory", label: "Inventory" },
  { href: "/audit", label: "Audit·Sync" }
];

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function useOfflineReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const update = () => setReady(Boolean(navigator.serviceWorker.controller));
    update();
    navigator.serviceWorker.addEventListener("controllerchange", update);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", update);
  }, []);
  return ready;
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a6b" />
          <stop offset="1" stopColor="#e04e2e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-g)" />
      <path d="M8 16h4l2-5 4 10 2-5h4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const online = useOnline();
  const offlineReady = useOfflineReady();
  const { operator } = useOperator();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header__aurora" aria-hidden="true" />
      <div className="app-header__dots" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:flex-nowrap md:py-3">
        <Link href="/" className="order-1 flex min-h-[44px] items-center gap-2.5 rounded-xl" aria-label="TagTriage home">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-[-0.02em]">TagTriage</span>
        </Link>
        <nav aria-label="Primary" className="no-scrollbar order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 md:order-2 md:mx-auto md:w-auto md:px-0">
          <ul className="inline-flex gap-1 rounded-full bg-white/10 p-1 ring-1 ring-inset ring-white/10 backdrop-blur">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className="nav-pill" aria-current={active ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="order-2 ml-auto flex min-w-0 items-center gap-2 md:order-3 md:ml-0">
          <StatusPill online={online} offlineReady={offlineReady} />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex min-h-[44px] min-w-0 max-w-[10rem] items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-semibold text-white/85 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 md:max-w-[16rem]"
            aria-label={`Operator: ${operator.name}, ${operator.role}, ${operator.unit}. Change operator`}
          >
            <Icon name="user" className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {operator.name} · {operator.unit || operator.role}
            </span>
          </button>
        </div>
      </div>
      <OperatorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </header>
  );
}

function StatusPill({ online, offlineReady }: { online: boolean; offlineReady: boolean }) {
  return (
    <span
      className={cx("chip min-h-[32px]", online ? "chip-emerald" : "chip-amber")}
      title={offlineReady ? "App shell cached for offline use" : "Offline cache not active yet"}
      role="status"
    >
      <Icon name={online ? "wifi" : "wifiOff"} className="h-3.5 w-3.5" />
      <span className={online ? "sr-only sm:not-sr-only" : undefined}>{online ? "Online" : "Offline"}</span>
      {offlineReady && <span className="hidden text-white/70 lg:inline">· offline-ready</span>}
    </span>
  );
}
