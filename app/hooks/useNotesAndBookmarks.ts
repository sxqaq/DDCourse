"use client";

import { useCallback } from "react";
import { normalizeProgressId } from "../progress-backup.mjs";
import { normalizeStudyDeletions, normalizeStudyItems } from "../notes-schema.mjs";
import { STORAGE_KEYS } from "../storage";
import type { StudyBookmark, StudyDeletion, StudyNote } from "../types";
import { useLocalStorageList } from "./useLocalStorageList";

const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeNotes = (value: unknown): StudyNote[] => (normalizeStudyItems(value, "note", id) as StudyNote[])
  .map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) }));
const normalizeBookmarks = (value: unknown): StudyBookmark[] => (normalizeStudyItems(value, "bookmark", id) as StudyBookmark[])
  .map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) }));

export function useNotesAndBookmarks() {
  const notesStore = useLocalStorageList<StudyNote>(STORAGE_KEYS.notes, normalizeNotes);
  const bookmarksStore = useLocalStorageList<StudyBookmark>(STORAGE_KEYS.bookmarks, normalizeBookmarks);
  const deletionsStore = useLocalStorageList<StudyDeletion>(STORAGE_KEYS.noteDeletions, normalizeStudyDeletions);
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
    const payload = value as { notes?: unknown; bookmarks?: unknown; deletions?: unknown };
    const merge = <T extends { id: string; createdAt: string; updatedAt: string }>(local: T[], incoming: T[]) => {
      const byId = new Map(local.map(item => [item.id, item]));
      incoming.forEach(item => { const existing = byId.get(item.id); if (!existing || item.updatedAt >= existing.updatedAt) byId.set(item.id, item); });
      return [...byId.values()];
    };
    const deletionMap = new Map<string, StudyDeletion>();
    [...deletionsStore.items, ...normalizeStudyDeletions(payload.deletions)].forEach(deletion => {
      const key = `${deletion.kind}:${deletion.id}`;
      const existing = deletionMap.get(key);
      if (!existing || deletion.deletedAt >= existing.deletedAt) deletionMap.set(key, deletion);
    });
    const keep = (kind: StudyDeletion["kind"]) => <T extends { id: string; updatedAt: string }>(item: T) => {
      const deletion = deletionMap.get(`${kind}:${item.id}`);
      return !deletion || deletion.deletedAt < item.updatedAt;
    };
    notesStore.replaceAll(merge(notesStore.items, normalizeNotes(payload.notes)).filter(keep("note")));
    bookmarksStore.replaceAll(merge(bookmarksStore.items, normalizeBookmarks(payload.bookmarks)).filter(keep("bookmark")));
    deletionsStore.replaceAll([...deletionMap.values()]);
  }, [notesStore, bookmarksStore, deletionsStore]);
  const editNote = useCallback((itemId: string, patch: Partial<StudyNote>) => notesStore.update(itemId, { ...patch, updatedAt: new Date().toISOString() }), [notesStore]);
  const editBookmark = useCallback((itemId: string, patch: Partial<StudyBookmark>) => bookmarksStore.update(itemId, { ...patch, updatedAt: new Date().toISOString() }), [bookmarksStore]);
  const deleteNote = useCallback((itemId: string) => {
    deletionsStore.add({ id: itemId, kind: "note", deletedAt: new Date().toISOString() });
    notesStore.remove(itemId);
  }, [deletionsStore, notesStore]);
  const deleteBookmark = useCallback((itemId: string) => {
    deletionsStore.add({ id: itemId, kind: "bookmark", deletedAt: new Date().toISOString() });
    bookmarksStore.remove(itemId);
  }, [deletionsStore, bookmarksStore]);
  return { notes: notesStore.items, bookmarks: bookmarksStore.items, deletions: deletionsStore.items, mergeDesktopData, addNote, editNote, deleteNote, addBookmark, editBookmark, deleteBookmark };
}
