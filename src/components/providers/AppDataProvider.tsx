"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { emptyState } from "@/domain/state";
import { useLiveAppData, type AppData } from "@/store/hooks";
import { ensurePersistentStorage, type StoragePersistence } from "@/store/persistence";

const AppDataContext = createContext<AppData>({ ready: false, events: [], state: emptyState() });
const StoragePersistenceContext = createContext<StoragePersistence | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const appData = useLiveAppData();
  const [storagePersistence, setStoragePersistence] = useState<StoragePersistence | null>(null);

  useEffect(() => {
    let mounted = true;
    void ensurePersistentStorage().then((result) => {
      if (mounted) setStoragePersistence(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppDataContext.Provider value={appData}>
      <StoragePersistenceContext.Provider value={storagePersistence}>{children}</StoragePersistenceContext.Provider>
    </AppDataContext.Provider>
  );
}

export function useAppState(): AppData {
  return useContext(AppDataContext);
}

export function useStoragePersistence(): StoragePersistence | null {
  return useContext(StoragePersistenceContext);
}
