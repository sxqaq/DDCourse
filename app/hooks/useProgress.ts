"use client";

import { useCallback, useRef, useState } from "react";
import { createProgressBackup, normalizeProgressMap, parseProgressBackup, progressBackupFilename } from "../progress-backup.mjs";
import { readJson, STORAGE_KEYS, writeJson } from "../storage";
import type { ProgressMap, ProgressRecord } from "../types";

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>(() => normalizeProgressMap(readJson<ProgressMap>(STORAGE_KEYS.progress, {} as ProgressMap)) as ProgressMap);
  const progressRef = useRef(progress);
  const persist = useCallback((next: ProgressMap) => { progressRef.current = next; setProgress(next); writeJson(STORAGE_KEYS.progress, next); }, []);
  const saveProgress = useCallback((fileId: string, record: ProgressRecord) => persist({ ...progressRef.current, [fileId]: record }), [persist]);
  const resetFiles = useCallback((fileIds: string[]) => {
    const next = { ...progressRef.current };
    fileIds.forEach(fileId => delete next[fileId]);
    persist(next);
  }, [persist]);
  const importProgress = useCallback(async (file: File) => {
    const backup = parseProgressBackup(JSON.parse(await file.text()));
    const next: ProgressMap = { ...progressRef.current, ...backup.progress };
    persist(next);
    return { progress: next, importedCount: Object.keys(backup.progress).length };
  }, [persist]);
  const exportProgress = useCallback(() => {
    const now = new Date();
    return { blob: new Blob([JSON.stringify(createProgressBackup(progressRef.current, now), null, 2)], { type: "application/json" }), filename: progressBackupFilename(now) };
  }, []);
  return { progress, progressRef, persist, saveProgress, resetFiles, importProgress, exportProgress };
}
