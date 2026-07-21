"use client";

import { useCallback, useMemo, useState } from "react";
import { idOf, pathOf, VIDEO_RE } from "../course-utils";
import { readJson, STORAGE_KEYS, writeJson } from "../storage";
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
  const [collectionNames, setCollectionNames] = useState<Record<string, string>>(() => readJson(STORAGE_KEYS.collectionNames, {}));
  const [pinnedCollections, setPinnedCollections] = useState<string[]>(() => readJson(STORAGE_KEYS.collectionOrder, []));
  const [skippedCollections, setSkippedCollections] = useState<string[]>(() => readJson(STORAGE_KEYS.skippedCollections, []));
  const [hiddenFiles, setHiddenFiles] = useState<string[]>(() => readJson(STORAGE_KEYS.hiddenFiles, []));

  const collections = useMemo<Collection[]>(() => {
    const map = new Map<string, CourseFile[]>();
    const hidden = new Set(hiddenFiles);
    allFiles.forEach(file => {
      const parts = pathOf(file).split(/[\\/]/).filter(Boolean);
      const key = parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程";
      if (!hidden.has(idOf(file))) map.set(key, [...(map.get(key) || []), file]);
      else if (!map.has(key)) map.set(key, []);
    });
    const pinned = new Map(pinnedCollections.map((key, index) => [key, index]));
    return [...map.entries()].map(([key, files]) => ({
      key,
      name: collectionNames[key] || key.split("/").pop() || key,
      files,
      pinned: pinned.has(key),
      skipped: skippedCollections.includes(key),
    })).sort((a, b) => {
      const aPin = pinned.get(a.key), bPin = pinned.get(b.key);
      if (aPin !== undefined || bPin !== undefined) return aPin === undefined ? 1 : bPin === undefined ? -1 : aPin - bPin;
      return a.key.localeCompare(b.key, "zh-CN", { numeric: true });
    });
  }, [allFiles, collectionNames, hiddenFiles, pinnedCollections, skippedCollections]);

  const current = collections.find(collection => collection.key === collectionKey) || collections[0];
  const files = useMemo(() => current?.files || [], [current]);

  const loadFiles = useCallback((list: FileList | File[], fromFolder = false) => {
    const raw = Array.from(list);
    const subtitles = new Map(raw.filter(file => /\.(srt|vtt)$/i.test(file.name)).map(file => [pathOf(file as CourseFile).replace(/\.[^.]+$/, "").toLowerCase(), file]));
    const next = raw.filter(file => file.type.startsWith("video/") || VIDEO_RE.test(file.name)) as CourseFile[];
    next.forEach(file => {
      const subtitle = subtitles.get(pathOf(file).replace(/\.[^.]+$/, "").toLowerCase());
      if (subtitle) file.subtitleFile = subtitle;
    });
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

  const renameCollection = useCallback((key: string, name: string) => {
    const trimmed = name.trim().slice(0, 80);
    const next = { ...collectionNames };
    if (trimmed) next[key] = trimmed; else delete next[key];
    setCollectionNames(next); writeJson(STORAGE_KEYS.collectionNames, next);
  }, [collectionNames]);
  const togglePinned = useCallback((key: string) => {
    const next = pinnedCollections.includes(key) ? pinnedCollections.filter(item => item !== key) : [key, ...pinnedCollections];
    setPinnedCollections(next); writeJson(STORAGE_KEYS.collectionOrder, next);
  }, [pinnedCollections]);
  const toggleSkipped = useCallback((key: string) => {
    const next = skippedCollections.includes(key) ? skippedCollections.filter(item => item !== key) : [...skippedCollections, key];
    setSkippedCollections(next); writeJson(STORAGE_KEYS.skippedCollections, next);
  }, [skippedCollections]);
  const hideFile = useCallback((file: CourseFile) => {
    const fileId = idOf(file); if (hiddenFiles.includes(fileId)) return;
    const next = [...hiddenFiles, fileId]; setHiddenFiles(next); writeJson(STORAGE_KEYS.hiddenFiles, next);
  }, [hiddenFiles]);
  const restoreHiddenFiles = useCallback(() => { setHiddenFiles([]); writeJson(STORAGE_KEYS.hiddenFiles, []); }, []);

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
    renameCollection,
    togglePinned,
    toggleSkipped,
    hideFile,
    restoreHiddenFiles,
    hiddenCount: hiddenFiles.length,
  };
}
