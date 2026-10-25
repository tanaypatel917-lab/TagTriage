"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EventDraft } from "@/domain/events";
import { getDb } from "@/store/db";
import { writeEvents, type WriteOptions, type WriteResult } from "@/store/eventStore";
import { DEFAULT_OPERATOR, actorLabel, loadOperator, saveOperator, type Operator } from "@/store/identity";

interface OperatorContextValue {
  operator: Operator;
  actor: string;
  setOperator: (operator: Operator) => void;
}

const OperatorContext = createContext<OperatorContextValue>({ operator: DEFAULT_OPERATOR, actor: actorLabel(DEFAULT_OPERATOR), setOperator: () => {} });

export function OperatorProvider({ children }: { children: ReactNode }) {
  const [operator, setOperatorState] = useState<Operator>(DEFAULT_OPERATOR);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load browser-only operator preferences after hydration.
    setOperatorState(loadOperator());
  }, []);
  const setOperator = useCallback((next: Operator) => {
    saveOperator(next);
    setOperatorState(next);
  }, []);
  const value = useMemo(() => ({ operator, actor: actorLabel(operator), setOperator }), [operator, setOperator]);
  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>;
}

export function useOperator(): OperatorContextValue {
  return useContext(OperatorContext);
}

/** Every write is stamped with the current operator; callers must check `ok` before showing success. */
export function useWriter(): (drafts: EventDraft[], options?: Omit<WriteOptions, "actor">) => Promise<WriteResult> {
  const { actor } = useOperator();
  return useCallback((drafts, options) => writeEvents(getDb(), drafts, { ...options, actor }), [actor]);
}
