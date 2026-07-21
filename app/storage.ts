export const STORAGE_KEYS = {
  progress: "lumacourse_progress_v1",
  last: "lumacourse_last_v1",
  week: "lumacourse_week_v1",
  speed: "lumacourse_speed_v1",
  bookmarks: "ddcourse_bookmarks_v1",
  notes: "ddcourse_notes_v1",
  noteDeletions: "ddcourse_note_deletions_v1",
  collectionNames: "ddcourse_collection_names_v1",
  collectionOrder: "ddcourse_collection_order_v1",
  skippedCollections: "ddcourse_skipped_collections_v1",
  hiddenFiles: "ddcourse_hidden_files_v1",
  theme: "ddcourse_theme_v1",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

export function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (error) {
    console.error(`Unable to persist local data: ${key}`, error);
    window.dispatchEvent(new CustomEvent("ddcourse:storage-error", { detail: { key } }));
    return false;
  }
}

export function readString(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeString(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try { localStorage.setItem(key, value); return true; }
  catch { return false; }
}
