import type { StudyBookmark, StudyNote } from "./types";

export type NotesDocument = {
  app: "DDCourse";
  updatedAt: string;
  folder: string;
  notes: StudyNote[];
  bookmarks: StudyBookmark[];
};

export function parseNotesDocument(value: unknown, options?: { allowLegacy?: boolean }): NotesDocument;
export function normalizeStudyItems(value: unknown, kind: "note", createId: () => string): StudyNote[];
export function normalizeStudyItems(value: unknown, kind: "bookmark", createId: () => string): StudyBookmark[];
