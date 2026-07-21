export type CourseFile = {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
  webkitRelativePath?: string;
  nativeUrl?: string;
  subtitleFile?: File;
  subtitleNativePath?: string;
};

export type DesktopFolder = { folderName: string; folderPath: string; files: CourseFile[] };
export type StudyNote = { id: string; fileId: string; fileName: string; time: number; text: string; createdAt: string; updatedAt: string };
export type StudyBookmark = { id: string; fileId: string; fileName: string; time: number; label: string; createdAt: string; updatedAt: string };
export type StudyDeletion = { id: string; kind: "note" | "bookmark"; deletedAt: string };
export type Collection = { key: string; name: string; files: CourseFile[]; pinned?: boolean; skipped?: boolean };
export type ProgressRecord = { time: number; duration: number; done: boolean; doneOverride?: boolean; updatedAt: string; speed?: number };
export type ProgressMap = Record<string, ProgressRecord>;
export type UpdateState = "idle" | "checking" | "available" | "up-to-date" | "downloading" | "ready" | "error" | "unsupported";
export type UpdateStatus = { state: UpdateState; version?: string; percent?: number; message?: string };

export type DesktopApi = {
  chooseFolder: () => Promise<DesktopFolder | null>;
  restoreFolder: () => Promise<DesktopFolder | null>;
  loadNotes: () => Promise<unknown | null>;
  saveAndShowNotes: (payload: unknown) => Promise<string>;
  saveNotes: (payload: unknown) => Promise<string>;
  revealPath: (nativeUrlOrPath: string) => Promise<void>;
  readSubtitle: (nativePath: string) => Promise<Uint8Array>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => () => void;
};
