"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";

export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  tone = "sky",
  disabled
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  tone?: "sky" | "red";
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const items = draft
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const next = [...values];
    for (const item of items) if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    onChange(next);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} className="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} disabled={disabled} />
        <button type="button" className="btn btn-ghost btn-sm min-h-[48px] shrink-0" onClick={add} disabled={disabled || !draft.trim()} aria-label={`Add to ${label}`}>
          <Icon name="plus" />
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={label}>
          {values.map((value) => (
            <li key={value} className={`chip chip-${tone} min-h-[36px] pr-1 text-sm`}>
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"
                aria-label={`Remove ${value}`}
                disabled={disabled}
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
