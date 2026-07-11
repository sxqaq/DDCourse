export type CourseFile = {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
  webkitRelativePath?: string;
  nativeUrl?: string;
};

export type DesktopFolder = { folderName: string; folderPath: string; files: CourseFile[] };
export type StudyNote = { id: string; fileId: string; fileName: string; time: number; text: string; createdAt: string };
export type StudyBookmark = { id: string; fileId: string; fileName: string; time: number; label?: string; createdAt: string };
export type Collection = { key: string; name: string; files: CourseFile[] };
export type ProgressRecord = { time: number; duration: number; done: boolean; updatedAt: string; speed?: number };
export type ProgressMap = Record<string, ProgressRecord>;

export type DesktopApi = {
  chooseFolder: () => Promise<DesktopFolder | null>;
  restoreFolder: () => Promise<DesktopFolder | null>;
  loadNotes: () => Promise<unknown | null>;
  saveAndShowNotes: (payload: unknown) => Promise<string>;
  saveNotes: (payload: unknown) => Promise<string>;
};
