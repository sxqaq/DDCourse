"use client";

import { useCallback } from "react";
import { normalizeProgressId } from "../progress-backup.mjs";
import { STORAGE_KEYS } from "../storage";
import type { StudyBookmark, StudyNote } from "../types";
import { useLocalStorageList } from "./useLocalStorageList";

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = <T extends { createdAt?: unknown; id?: unknown; fileId?: unknown }>(value: unknown) =>
  (Array.isArray(value) ? value : []).filter(item => item && typeof item === "object").map(item => {
    const record = item as T;
    return { ...record, id: typeof record.id === "string" ? record.id : id(), fileId: normalizeProgressId(typeof record.fileId === "string" ? record.fileId : "") };
  });

export function useNotesAndBookmarks() {
  const notesStore = useLocalStorageList<StudyNote>(STORAGE_KEYS.notes, value => normalize<StudyNote>(value) as StudyNote[]);
  const bookmarksStore = useLocalStorageList<StudyBookmark>(STORAGE_KEYS.bookmarks, value => normalize<StudyBookmark>(value) as StudyBookmark[]);
  const addNote = useCallback((note: Omit<StudyNote, "id" | "createdAt">) => notesStore.add({ ...note, id: id(), createdAt: new Date().toISOString() }), [notesStore]);
  const addBookmark = useCallback((bookmark: Omit<StudyBookmark, "id" | "createdAt">) => bookmarksStore.add({ ...bookmark, id: id(), createdAt: new Date().toISOString() }), [bookmarksStore]);
  const mergeDesktopData = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") return;
    const payload = value as { notes?: unknown; bookmarks?: unknown };
    const merge = <T extends { id: string; createdAt: string }>(local: T[], incoming: T[]) => {
      const byId = new Map(local.map(item => [item.id, item]));
      incoming.forEach(item => { const existing = byId.get(item.id); if (!existing || item.createdAt >= existing.createdAt) byId.set(item.id, item); });
      return [...byId.values()];
    };
    notesStore.replaceAll(merge(notesStore.items, normalize<StudyNote>(payload.notes) as StudyNote[]));
    bookmarksStore.replaceAll(merge(bookmarksStore.items, normalize<StudyBookmark>(payload.bookmarks) as StudyBookmark[]));
  }, [notesStore, bookmarksStore]);
  return { notes: notesStore.items, bookmarks: bookmarksStore.items, mergeDesktopData, addNote, editNote: notesStore.update, deleteNote: notesStore.remove, addBookmark, editBookmark: bookmarksStore.update, deleteBookmark: bookmarksStore.remove };
}
