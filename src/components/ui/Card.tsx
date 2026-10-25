import type { ReactNode } from "react";
import { cx } from "@/lib/format";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  instant?: boolean;
  stagger?: number;
  id?: string;
  labelledBy?: string;
}

export function Card({ title, description, action, children, className, instant, stagger = 0, id, labelledBy }: CardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={labelledBy ?? (title ? headingId : undefined)}
      className={cx("glass-card p-5 sm:p-6", instant && "glass-card--instant", className)}
      style={{ ["--stagger" as string]: `${stagger * 60}ms` }}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="font-display text-2xl font-bold tracking-[-0.03em] text-fg">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 max-w-prose text-sm text-fg/65">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
