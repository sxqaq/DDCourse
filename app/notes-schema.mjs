const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function parseStudyItem(value, kind, allowLegacy) {
  if (!isObject(value)) throw new Error(`Invalid ${kind}`);
  const textKey = kind === "note" ? "text" : "label";
  const content = typeof value[textKey] === "string"
    ? value[textKey]
    : allowLegacy && kind === "bookmark"
      ? "重点"
      : null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id : allowLegacy ? "" : null;
  const createdAt = isIsoDate(value.createdAt) ? value.createdAt : null;
  const updatedAt = isIsoDate(value.updatedAt) ? value.updatedAt : allowLegacy ? createdAt : null;
  if (id === null
    || typeof value.fileId !== "string"
    || typeof value.fileName !== "string"
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

export function parseNotesDocument(value, options = {}) {
  const allowLegacy = options.allowLegacy === true;
  if (!isObject(value)
    || value.app !== "DDCourse"
    || !Array.isArray(value.notes)
    || !Array.isArray(value.bookmarks)
    || (value.folder !== undefined && typeof value.folder !== "string")) {
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
