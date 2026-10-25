import type { ReactNode } from "react";

/** Editorial page header: mono kicker rule, oversized display headline, lede and an optional action. */
export function PageIntro({ index, kicker, title, lede, action }: { index: string; kicker: string; title: ReactNode; lede: ReactNode; action?: ReactNode }) {
  return (
    <header className="space-y-6 md:space-y-8">
      <div className="kicker border-b-[1.5px] border-ink pb-2.5">
        <span className="rounded-[4px] bg-ink px-1.5 py-0.5 text-hivis">§{index}</span>
        <span className="text-fg">{kicker}</span>
        <span className="ml-auto hidden sm:inline">TagTriage field manual</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <h1 className="page-title">{title}</h1>
        <div className="space-y-5 lg:pb-2">
          <p className="max-w-xl text-[17px] leading-relaxed text-fg/75">{lede}</p>
          {action}
        </div>
      </div>
    </header>
  );
}
