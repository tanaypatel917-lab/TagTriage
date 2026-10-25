"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { simulatedMemory } from "@/domain/simMemory";
import { SimulatorReader } from "@/readers/simulator";
import type { ReaderKind, TagReader } from "@/readers/types";
import { WebNfcReader } from "@/readers/webNfc";
import { useAppState } from "./AppDataProvider";

interface ReaderContextValue {
  kind: ReaderKind;
  setKind: (kind: ReaderKind) => void;
  reader: TagReader;
  simulator: SimulatorReader;
  webNfcSupported: boolean;
}

const KIND_KEY = "tt.reader";
const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const { state } = useAppState();
  const [simulator] = useState(() => new SimulatorReader());
  const [webNfc] = useState(() => new WebNfcReader());
  const [kind, setKindState] = useState<ReaderKind>("simulator");
  const [webNfcSupported, setWebNfcSupported] = useState(false);

  useEffect(() => {
    simulator.setMemorySource((tagId) => simulatedMemory(state, tagId));
  }, [simulator, state]);

  useEffect(() => {
    const supported = webNfc.isSupported();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read browser-only NFC capability after hydration.
    setWebNfcSupported(supported);
    if (supported && localStorage.getItem(KIND_KEY) === "web-nfc") setKindState("web-nfc");
  }, [webNfc]);

  const value = useMemo<ReaderContextValue>(
    () => ({
      kind,
      setKind: (next) => {
        localStorage.setItem(KIND_KEY, next);
        setKindState(next);
      },
      reader: kind === "web-nfc" ? webNfc : simulator,
      simulator,
      webNfcSupported
    }),
    [kind, simulator, webNfc, webNfcSupported]
  );
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader(): ReaderContextValue {
  const value = useContext(ReaderContext);
  if (!value) throw new Error("useReader must be used inside ReaderProvider");
  return value;
}
