export type ProgressRecord = {
  time: number;
  duration: number;
  done: boolean;
  updatedAt: string;
  speed?: number;
};
export type ProgressMap = Record<string, ProgressRecord>;
export type ProgressBackup = {
  app: "DDCourse";
  formatVersion: 1;
  exportedAt: string;
  progress: ProgressMap;
};
export function createProgressBackup(progress: ProgressMap, now?: Date): ProgressBackup;
export function parseProgressBackup(value: unknown): ProgressBackup;
export function progressBackupFilename(now?: Date): string;
export function progressId(path: string, size: number): string;
export function normalizeProgressId(id: string): string;
export function normalizeProgressMap(progress: ProgressMap): ProgressMap;
