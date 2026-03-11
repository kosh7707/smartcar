import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import type { Adapter } from "@smartcar/shared";
import { fetchAdapters } from "../api/client";

const POLL_INTERVAL = 5_000;

// Shared store per projectId — all consumers of the same projectId share state
interface AdapterStore {
  adapters: Adapter[];
  loading: boolean;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  refCount: number;
}

const stores = new Map<string, AdapterStore>();

function getStore(projectId: string): AdapterStore {
  let store = stores.get(projectId);
  if (!store) {
    store = { adapters: [], loading: true, listeners: new Set(), timer: null, refCount: 0 };
    stores.set(projectId, store);
  }
  return store;
}

function notify(store: AdapterStore) {
  store.listeners.forEach((l) => l());
}

async function refresh(projectId: string) {
  const store = getStore(projectId);
  try {
    const data = await fetchAdapters(projectId);
    store.adapters = data;
  } catch {
    store.adapters = [];
  } finally {
    store.loading = false;
    notify(store);
  }
}

function subscribe(projectId: string, store: AdapterStore) {
  store.refCount++;
  if (store.refCount === 1) {
    refresh(projectId);
    store.timer = setInterval(() => refresh(projectId), POLL_INTERVAL);
  }
  return () => {
    store.refCount--;
    if (store.refCount === 0) {
      if (store.timer) clearInterval(store.timer);
      store.timer = null;
      stores.delete(projectId);
    }
  };
}

export function useAdapters(projectId?: string) {
  // Force re-render trigger for subscribe/getSnapshot
  const [, setTick] = useState(0);
  const pidRef = useRef(projectId);
  pidRef.current = projectId;

  const storeRef = useRef<AdapterStore | null>(null);

  useEffect(() => {
    if (!projectId) {
      storeRef.current = null;
      setTick((t) => t + 1);
      return;
    }
    const store = getStore(projectId);
    storeRef.current = store;

    const listener = () => setTick((t) => t + 1);
    store.listeners.add(listener);
    const unsub = subscribe(projectId, store);

    return () => {
      store.listeners.delete(listener);
      unsub();
    };
  }, [projectId]);

  const store = storeRef.current;
  const adapters = store?.adapters ?? [];
  const loading = store?.loading ?? !projectId;

  const forceRefresh = useCallback(async () => {
    if (pidRef.current) await refresh(pidRef.current);
  }, []);

  const connected = adapters.filter((a) => a.connected);
  const hasConnected = connected.length > 0;

  return { adapters, connected, hasConnected, loading, refresh: forceRefresh };
}
