"use client";

import { useCallback } from "react";
import { normalizeProgressId } from "../progress-backup.mjs";
import { normalizeStudyItems } from "../notes-schema.mjs";
import { STORAGE_KEYS } from "../storage";
import type { StudyBookmark, StudyNote } from "../types";
import { useLocalStorageList } from "./useLocalStorageList";

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeNotes = (value: unknown): StudyNote[] => (normalizeStudyItems(value, "note", id) as StudyNote[])
  .map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) }));
const normalizeBookmarks = (value: unknown): StudyBookmark[] => (normalizeStudyItems(value, "bookmark", id) as StudyBookmark[])
  .map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) }));

export function useNotesAndBookmarks() {
  const notesStore = useLocalStorageList<StudyNote>(STORAGE_KEYS.notes, normalizeNotes);
  const bookmarksStore = useLocalStorageList<StudyBookmark>(STORAGE_KEYS.bookmarks, normalizeBookmarks);
  const addNote = useCallback((note: Omit<StudyNote, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    notesStore.add({ ...note, id: id(), createdAt: now, updatedAt: now });
  }, [notesStore]);
  const addBookmark = useCallback((bookmark: Omit<StudyBookmark, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    bookmarksStore.add({ ...bookmark, id: id(), createdAt: now, updatedAt: now });
  }, [bookmarksStore]);
  const mergeDesktopData = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") return;
    const payload = value as { notes?: unknown; bookmarks?: unknown };
    const merge = <T extends { id: string; createdAt: string; updatedAt: string }>(local: T[], incoming: T[]) => {
      const byId = new Map(local.map(item => [item.id, item]));
      incoming.forEach(item => { const existing = byId.get(item.id); if (!existing || item.updatedAt >= existing.updatedAt) byId.set(item.id, item); });
      return [...byId.values()];
    };
    notesStore.replaceAll(merge(notesStore.items, normalizeNotes(payload.notes)));
    bookmarksStore.replaceAll(merge(bookmarksStore.items, normalizeBookmarks(payload.bookmarks)));
  }, [notesStore, bookmarksStore]);
  const editNote = useCallback((itemId: string, patch: Partial<StudyNote>) => notesStore.update(itemId, { ...patch, updatedAt: new Date().toISOString() }), [notesStore]);
  const editBookmark = useCallback((itemId: string, patch: Partial<StudyBookmark>) => bookmarksStore.update(itemId, { ...patch, updatedAt: new Date().toISOString() }), [bookmarksStore]);
  return { notes: notesStore.items, bookmarks: bookmarksStore.items, mergeDesktopData, addNote, editNote, deleteNote: notesStore.remove, addBookmark, editBookmark, deleteBookmark: bookmarksStore.remove };
}
