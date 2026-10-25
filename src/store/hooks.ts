"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import type { AppEvent } from "@/domain/events";
import { project } from "@/domain/project";
import type { AppState } from "@/domain/state";
import { getDb } from "./db";
import { getDeviceId } from "./identity";
import type { ProfileRecord } from "./types";

export interface AppData {
  ready: boolean;
  events: AppEvent[];
  state: AppState;
}

const NO_EVENTS: AppEvent[] = [];

export function useAppState(): AppData {
  const events = useLiveQuery(() => getDb().events.toArray(), []);
  const state = useMemo(() => project(events ?? NO_EVENTS), [events]);
  return { ready: events !== undefined, events: events ?? NO_EVENTS, state };
}

export function useProfile(tagId: string | undefined): ProfileRecord | undefined {
  return useLiveQuery(() => (tagId ? getDb().profiles.get(tagId) : undefined), [tagId]);
}

export function useProfiles(): Record<string, ProfileRecord> {
  const profiles = useLiveQuery(() => getDb().profiles.toArray(), []);
  return useMemo(() => Object.fromEntries((profiles ?? []).map((p) => [p.tagId, p])), [profiles]);
}

export function useDeviceId(): string | undefined {
  const [deviceId, setDeviceId] = useState<string>();
  useEffect(() => {
    getDb()
      .transaction("rw", getDb().meta, () => getDeviceId(getDb()))
      .then(setDeviceId)
      .catch(() => setDeviceId(undefined));
  }, []);
  return deviceId;
}
