const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_ITEMS = 10_000;
const MAX_ID_LENGTH = 512;
const MAX_PATH_LENGTH = 4096;
const MAX_CONTENT_LENGTH = 100_000;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function isBoundedString(value, maximum, allowEmpty = true) {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

function parseStudyItem(value, kind, allowLegacy) {
  if (!isObject(value)) throw new Error(`Invalid ${kind}`);
  const textKey = kind === "note" ? "text" : "label";
  const content = isBoundedString(value[textKey], MAX_CONTENT_LENGTH)
    ? value[textKey]
    : allowLegacy && kind === "bookmark"
      ? "重点"
      : null;
  const id = isBoundedString(value.id, MAX_ID_LENGTH, false) ? value.id : allowLegacy ? "" : null;
  const createdAt = isIsoDate(value.createdAt) ? value.createdAt : null;
  const updatedAt = isIsoDate(value.updatedAt) ? value.updatedAt : allowLegacy ? createdAt : null;
  if (id === null
    || !isBoundedString(value.fileId, MAX_PATH_LENGTH, false)
    || !isBoundedString(value.fileName, MAX_PATH_LENGTH)
    || typeof value.time !== "number"
    || !Number.isFinite(value.time)
    || value.time < 0
    || content === null
    || !createdAt
    || !updatedAt) {
    throw new Error(`Invalid ${kind}`);
  }
  return {
    id,
    fileId: value.fileId,
    fileName: value.fileName,
    time: value.time,
    [textKey]: content,
    createdAt,
    updatedAt,
  };
}

function parseDeletion(value) {
  if (!isObject(value)
    || !isBoundedString(value.id, MAX_ID_LENGTH, false)
    || (value.kind !== "note" && value.kind !== "bookmark")
    || !isIsoDate(value.deletedAt)) {
    throw new Error("Invalid study deletion");
  }
  return { id: value.id, kind: value.kind, deletedAt: value.deletedAt };
}

export function parseNotesDocument(value, options = {}) {
  const allowLegacy = options.allowLegacy === true;
  if (!isObject(value)
    || value.app !== "DDCourse"
    || !Array.isArray(value.notes)
    || !Array.isArray(value.bookmarks)
    || (!allowLegacy && !Array.isArray(value.deletions))
    || (value.deletions !== undefined && !Array.isArray(value.deletions))
    || value.notes.length > MAX_ITEMS
    || value.bookmarks.length > MAX_ITEMS
    || (Array.isArray(value.deletions) && value.deletions.length > MAX_ITEMS * 2)
    || (value.folder !== undefined && !isBoundedString(value.folder, MAX_PATH_LENGTH))) {
    throw new Error("Invalid notes document");
  }
  const updatedAt = isIsoDate(value.updatedAt)
    ? value.updatedAt
    : isIsoDate(value.exportedAt)
      ? value.exportedAt
      : allowLegacy
        ? new Date(0).toISOString()
        : null;
  if (!updatedAt) throw new Error("Invalid notes document timestamp");
  return {
    app: "DDCourse",
    updatedAt,
    folder: value.folder || "",
    notes: value.notes.map(item => parseStudyItem(item, "note", allowLegacy)),
    bookmarks: value.bookmarks.map(item => parseStudyItem(item, "bookmark", allowLegacy)),
    deletions: (value.deletions || []).map(parseDeletion),
  };
}

export function normalizeStudyItems(value, kind, createId) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const item of value) {
    try {
      const parsed = parseStudyItem(item, kind, true);
      normalized.push({ ...parsed, id: parsed.id || createId() });
    } catch {
      // Corrupt individual entries are ignored so one bad record cannot hide all notes.
    }
  }
  return normalized;
}

export function normalizeStudyDeletions(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  for (const item of value) {
    try { normalized.push(parseDeletion(item)); }
    catch { /* Ignore corrupt tombstones without hiding valid deletions. */ }
  }
  return normalized;
}
