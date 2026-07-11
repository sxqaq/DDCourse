"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "../storage";

export function useLocalStorageList<T extends { id: string }>(key: string, normalize: (value: unknown) => T[]) {
  const [items, setItems] = useState<T[]>(() => normalize(readJson<unknown>(key, [])));
  useEffect(() => { writeJson(key, items); }, [items, key]);
  const commit = useCallback((recipe: (previous: T[]) => T[]) => setItems(recipe), []);
  const add = useCallback((item: T) => commit(previous => [...previous, item]), [commit]);
  const update = useCallback((id: string, patch: Partial<T>) => commit(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item)), [commit]);
  const remove = useCallback((id: string) => commit(previous => previous.filter(item => item.id !== id)), [commit]);
  const replaceAll = useCallback((next: T[]) => setItems(next), []);
  return { items, add, update, remove, replaceAll };
}
