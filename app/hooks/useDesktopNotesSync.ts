"use client";

import { useEffect, useRef } from "react";
import type { StudyBookmark, StudyDeletion, StudyNote } from "../types";

type Options = {
  isDesktop: boolean;
  folderName: string;
  notes: StudyNote[];
  bookmarks: StudyBookmark[];
  deletions: StudyDeletion[];
  loadNotes: () => Promise<unknown | null>;
  saveNotes: (payload: unknown) => Promise<string>;
  mergeDesktopData: (value: unknown) => void;
  onNotice: (message: string) => void;
};

export function useDesktopNotesSync(options: Options) {
  const { isDesktop, folderName, notes, bookmarks, deletions, loadNotes, saveNotes, mergeDesktopData, onNotice } = options;
  const readyRef = useRef(false);
  const mergeRef = useRef(mergeDesktopData);
  mergeRef.current = mergeDesktopData;

  useEffect(() => {
    if (!isDesktop) {
      readyRef.current = true;
      return;
    }
    readyRef.current = false;
    loadNotes()
      .then(value => {
        if (value) mergeRef.current(value);
        readyRef.current = true;
      })
      .catch(error => {
        console.error("Unable to load desktop notes", error);
        onNotice("桌面笔记读取失败，本地缓存仍可使用");
        readyRef.current = true;
      });
  }, [isDesktop, loadNotes, onNotice]);

  useEffect(() => {
    if (!readyRef.current || !isDesktop) return;
    const timer = window.setTimeout(() => {
      const payload = {
        app: "DDCourse",
        updatedAt: new Date().toISOString(),
        folder: folderName,
        notes,
        bookmarks,
        deletions,
      };
      saveNotes(payload).catch(error => {
        console.error("Unable to save desktop notes", error);
        onNotice("桌面笔记保存失败，请检查磁盘空间和目录权限");
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isDesktop, folderName, notes, bookmarks, deletions, saveNotes, onNotice]);
}
