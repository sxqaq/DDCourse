"use client";

import { useCallback, useMemo, useState } from "react";
import { pathOf, VIDEO_RE } from "../course-utils";
import type { Collection, CourseFile, DesktopFolder } from "../types";

function initialCollectionKey(files: CourseFile[]) {
  const parts = pathOf(files[0]).split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程";
}

export function useCourseLibrary(onNotice: (message: string) => void) {
  const [allFiles, setAllFiles] = useState<CourseFile[]>([]);
  const [collectionKey, setCollectionKey] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderMode, setFolderMode] = useState(false);

  const collections = useMemo<Collection[]>(() => {
    const map = new Map<string, CourseFile[]>();
    allFiles.forEach(file => {
      const parts = pathOf(file).split(/[\\/]/).filter(Boolean);
      const key = parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程";
      map.set(key, [...(map.get(key) || []), file]);
    });
    return [...map.entries()].map(([key, files]) => ({ key, name: key.split("/").pop() || key, files }));
  }, [allFiles]);

  const current = collections.find(collection => collection.key === collectionKey) || collections[0];
  const files = useMemo(() => current?.files || [], [current]);

  const loadFiles = useCallback((list: FileList | File[], fromFolder = false) => {
    const next = Array.from(list).filter(file => file.type.startsWith("video/") || VIDEO_RE.test(file.name)) as CourseFile[];
    next.sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    if (!next.length) {
      onNotice("没有找到可播放的视频文件");
      return false;
    }
    setAllFiles(next);
    setFolderMode(fromFolder);
    const firstPath = pathOf(next[0]).split(/[\\/]/);
    setFolderName(firstPath.length > 1 ? firstPath[0] : `${next.length} 个视频`);
    setCollectionKey(initialCollectionKey(next));
    onNotice(`已载入 ${next.length} 个视频`);
    return true;
  }, [onNotice]);

  const loadDesktopFolder = useCallback((result: DesktopFolder) => {
    if (!result.files.length) return false;
    const next = [...result.files].sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    setAllFiles(next);
    setFolderName(result.folderName);
    setFolderMode(true);
    setCollectionKey(initialCollectionKey(next));
    return true;
  }, []);

  return {
    allFiles,
    collections,
    current,
    files,
    folderName,
    folderMode,
    collectionKey,
    setCollectionKey,
    loadFiles,
    loadDesktopFolder,
  };
}
