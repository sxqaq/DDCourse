import { progressId } from "./progress-backup.mjs";
import type { CourseFile } from "./types";

export const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;

export function pathOf(file: CourseFile) {
  return file.webkitRelativePath || file.name;
}

export function idOf(file: CourseFile) {
  return progressId(pathOf(file), file.size);
}

export function cleanName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]*/, "").replace(/[_-]+/g, " ");
}

export function timeLabel(seconds = 0) {
  if (!Number.isFinite(seconds)) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
