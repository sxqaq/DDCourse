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

const unsafeRecordKeys = new Set(["__proto__", "constructor", "prototype"]);

export function normalizeStringList(value: unknown, maxItems = 20_000): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().slice(0, 2_048);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function normalizeStringRecord(value: unknown, maxItems = 20_000): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string" || unsafeRecordKeys.has(rawKey)) continue;
    const key = rawKey.trim().slice(0, 2_048);
    const item = rawValue.trim().slice(0, 80);
    if (!key || !item || unsafeRecordKeys.has(key)) continue;
    result[key] = item;
    if (++count >= maxItems) break;
  }
  return result;
}

export function normalizeStringListRecord(value: unknown, maxFolders = 1_000): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (unsafeRecordKeys.has(rawKey)) continue;
    const key = rawKey.trim().slice(0, 2_048);
    if (!key || unsafeRecordKeys.has(key)) continue;
    result[key] = normalizeStringList(rawValue);
    if (++count >= maxFolders) break;
  }
  return result;
}

export function normalizeLastSelection(value: unknown): { collection: string; id: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.collection !== "string" || typeof candidate.id !== "string") return null;
  const collection = candidate.collection.trim().slice(0, 2_048);
  const id = candidate.id.trim().slice(0, 4_096);
  return collection && id ? { collection, id } : null;
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
