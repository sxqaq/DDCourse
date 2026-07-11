"use client";

import { useCallback, useRef, useState } from "react";
import { addWeeklySeconds, localMondayKey } from "../study-time.mjs";
import { readJson, STORAGE_KEYS, writeJson } from "../storage";

export function useStudyTime() {
  type WeeklyStudyTime = { week: string; seconds: number };
  const initial = readJson<WeeklyStudyTime>(STORAGE_KEYS.week, { week: localMondayKey(), seconds: 0 });
  const normalized = addWeeklySeconds(initial, 0);
  const [weekSeconds, setWeekSeconds] = useState(normalized.seconds);
  const storedRef = useRef(normalized);
  const lastVideoTimeRef = useRef(0);
  const lastSaveRef = useRef(0);

  const trackVideoTime = useCallback((currentTime: number) => {
    const delta = currentTime - lastVideoTimeRef.current;
    lastVideoTimeRef.current = currentTime;
    const next = addWeeklySeconds(storedRef.current, delta > 0 && delta < 2 ? delta : 0);
    if (next.week !== storedRef.current.week || next.seconds !== storedRef.current.seconds) {
      storedRef.current = next;
      setWeekSeconds(next.seconds);
      const now = Date.now();
      if (now - lastSaveRef.current >= 5000 || next.seconds === 0) { writeJson(STORAGE_KEYS.week, next); lastSaveRef.current = now; }
    }
  }, []);

  return { weekSeconds, trackVideoTime };
}
