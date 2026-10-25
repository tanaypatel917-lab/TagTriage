"use client";

import { createContext, useContext, type ReactNode } from "react";
import { emptyState } from "@/domain/state";
import { useLiveAppData, type AppData } from "@/store/hooks";

const AppDataContext = createContext<AppData>({ ready: false, events: [], state: emptyState() });

export function AppDataProvider({ children }: { children: ReactNode }) {
  return <AppDataContext.Provider value={useLiveAppData()}>{children}</AppDataContext.Provider>;
}

export function useAppState(): AppData {
  return useContext(AppDataContext);
}
