"use client";

import type { ReactNode } from "react";
import { AppDataProvider } from "./AppDataProvider";
import { OperatorProvider } from "./OperatorProvider";
import { ReaderProvider } from "./ReaderProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <OperatorProvider>
        <ReaderProvider>{children}</ReaderProvider>
      </OperatorProvider>
    </AppDataProvider>
  );
}
