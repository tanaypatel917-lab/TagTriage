"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  warning?: string;
  className?: string;
}

function FieldShell({ id, label, hint, error, warning, className, children }: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : warning ? (
        <p id={`${id}-msg`} className="mt-1.5 text-sm font-medium text-amber-300">
          {warning}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="mt-1.5 text-sm text-white/55">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ label, hint, error, warning, className, ...input }: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} warning={warning} className={className}>
      <input id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={error || warning || hint ? `${id}-msg` : undefined} {...input} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, className, children, ...select }: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...select}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, className, ...textarea }: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} className={cx("field resize-y")} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} {...textarea} />
    </FieldShell>
  );
}
