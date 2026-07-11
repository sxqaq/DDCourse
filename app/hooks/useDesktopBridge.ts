"use client";

import { useCallback } from "react";
import type { DesktopApi } from "../types";

export function useDesktopBridge() {
  const api = typeof window === "undefined" ? undefined : window.ddcourseDesktop;
  const chooseFolder = useCallback(() => api?.chooseFolder() ?? Promise.resolve(null), [api]);
  const restoreFolder = useCallback(() => api?.restoreFolder() ?? Promise.resolve(null), [api]);
  const loadNotes = useCallback(() => api?.loadNotes() ?? Promise.resolve(null), [api]);
  const saveNotes = useCallback((payload: unknown) => api?.saveNotes(payload) ?? Promise.resolve(""), [api]);
  const saveAndShowNotes = useCallback((payload: unknown) => api?.saveAndShowNotes(payload) ?? Promise.resolve(""), [api]);
  return { isDesktop: Boolean(api), chooseFolder, restoreFolder, loadNotes, saveNotes, saveAndShowNotes };
}

declare global { interface Window { ddcourseDesktop?: DesktopApi } }
