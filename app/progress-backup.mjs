function isFiniteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isProgressRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return isFiniteNonNegative(value.time)
    && isFiniteNonNegative(value.duration)
    && typeof value.done === "boolean"
    && typeof value.updatedAt === "string"
    && !Number.isNaN(Date.parse(value.updatedAt))
    && (value.speed === undefined || (typeof value.speed === "number" && Number.isFinite(value.speed) && value.speed > 0));
}

export function createProgressBackup(progress, now = new Date()) {
  return { app: "DDCourse", formatVersion: 1, exportedAt: now.toISOString(), progress };
}

export function parseProgressBackup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid backup");
  if (value.app !== "DDCourse" || (value.formatVersion !== undefined && value.formatVersion !== 1)) throw new Error("Unsupported backup");
  if (!value.progress || typeof value.progress !== "object" || Array.isArray(value.progress)) throw new Error("Invalid progress map");
  if (!Object.values(value.progress).every(isProgressRecord)) throw new Error("Invalid progress record");
  return {
    app: "DDCourse",
    formatVersion: 1,
    exportedAt: typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt))
      ? value.exportedAt
      : new Date(0).toISOString(),
    progress: value.progress,
  };
}

export function progressBackupFilename(now = new Date()) {
  return `DDCourse-progress-${now.toISOString().slice(0, 10)}.json`;
}
