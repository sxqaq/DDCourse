import type { StudyBookmark, StudyDeletion, StudyNote } from "./types";

export type NotesDocument = {
  app: "DDCourse";
  updatedAt: string;
  folder: string;
  notes: StudyNote[];
  bookmarks: StudyBookmark[];
  deletions: StudyDeletion[];
};

export function parseNotesDocument(value: unknown, options?: { allowLegacy?: boolean }): NotesDocument;
export function normalizeStudyItems(value: unknown, kind: "note", createId: () => string): StudyNote[];
export function normalizeStudyItems(value: unknown, kind: "bookmark", createId: () => string): StudyBookmark[];
export function normalizeStudyDeletions(value: unknown): StudyDeletion[];
