"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { useOperator } from "../providers/OperatorProvider";
import { OperatorDialog } from "./OperatorDialog";
import { Logo, NAV } from "./brand";


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

export function AppHeader() {
  const pathname = usePathname();
  const online = useOnline();
  const offlineReady = useOfflineReady();
  const { operator } = useOperator();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="battenburg battenburg--thin" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:flex-nowrap md:px-6 md:py-3">
        <Link href="/" className="order-1 flex min-h-[44px] items-center gap-3 rounded-control" aria-label="TagTriage home">
          <Logo />
          <span className="flex flex-col">
            <span className="wordmark text-[26px]">
              TagTriage<span className="text-signal">.</span>
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-fg/55 sm:block">EMS sticker reader</span>
          </span>
        </Link>
        <nav aria-label="Primary" className="no-scrollbar order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto border-t border-fg/15 px-4 pt-2 md:order-2 md:mx-auto md:w-auto md:border-0 md:px-0 md:pt-0">
          <ul className="inline-flex gap-1">
            {NAV.map((item, index) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className="nav-link" aria-current={active ? "page" : undefined}>
                    <span className="nav-link__index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
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
            className="inline-flex min-h-[44px] min-w-[44px] max-w-[16rem] items-center justify-center gap-2 rounded-control border-[1.5px] border-ink bg-paper-card px-3 text-sm font-bold text-fg shadow-[3px_3px_0_#0f1a2a] transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-none md:max-w-[16rem]"
            aria-label={`Operator: ${operator.name}, ${operator.role}, ${operator.unit}. Change operator`}
          >
            <Icon name="user" className="h-4 w-4 shrink-0" />
            <span className="hidden truncate sm:inline">
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
      className={cx("chip min-h-[32px] font-mono uppercase tracking-wider", online ? "chip-emerald" : "chip-amber")}
      title={offlineReady ? "App shell cached for offline use" : "Offline cache not active yet"}
      role="status"
    >
      <span className={cx("h-2 w-2 rounded-full", online ? "bg-rescue" : "bg-amber-600")} aria-hidden="true" />
      <span className={online ? "sr-only sm:not-sr-only" : undefined}>{online ? "Online" : "Offline"}</span>
      {offlineReady && <span className="hidden opacity-75 lg:inline">· cached</span>}
    </span>
  );
}
