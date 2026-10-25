import Link from "next/link";
import { Logo, NAV } from "./brand";

export function AppFooter() {
  return (
    <footer className="mt-8 border-t-[1.5px] border-ink bg-ink text-paper">
      <div className="battenburg" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 md:grid-cols-[1.4fr_1fr] md:px-6">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <p className="wordmark text-4xl text-paper md:text-5xl">
              TagTriage<span className="text-signal">.</span>
            </p>
          </div>
          <p className="mt-4 max-w-md text-paper/70">
            Tap a sticker, see what matters first. Allergies, code status and blood thinners in under a second, even with no signal.
          </p>
        </div>
        <div className="flex flex-col justify-between gap-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline-offset-4 hover:text-hivis hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/55">Demonstrator · no real patient data · not for clinical use</p>
        </div>
      </div>
    </footer>
  );
}
