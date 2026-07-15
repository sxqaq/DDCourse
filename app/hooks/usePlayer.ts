"use client";

import { useCallback, useEffect, useRef } from "react";
import { STORAGE_KEYS, writeJson } from "../storage";
import type { CourseFile, ProgressMap, ProgressRecord } from "../types";

type Options = {
  files: CourseFile[]; activeFile: CourseFile | null; activeIndex: number; collectionKey?: string;
  speed: number; setSpeed: (speed: number) => void; progress: ProgressMap;
  idOf: (file: CourseFile) => string; setActiveId: (id: string) => void;
  saveProgress: (fileId: string, record: ProgressRecord) => void;
};

export function usePlayer(options: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef("");
  const lastSavedTimeRef = useRef(0);
  const latest = useRef(options); latest.current = options;

  const recordCurrent = useCallback((forceDone = false) => {
    const video = videoRef.current, current = latest.current;
    if (!video || !current.activeFile) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0, time = video.currentTime || 0;
    current.saveProgress(current.idOf(current.activeFile), { time, duration, done: forceDone || (duration > 0 && time / duration >= .9), updatedAt: new Date().toISOString(), speed: current.speed });
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
  }, []);

  const stopCurrentPlayer = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      recordCurrent();
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    revokeObjectUrl();
    lastSavedTimeRef.current = 0;
  }, [recordCurrent, revokeObjectUrl]);

  const playFile = useCallback((file: CourseFile) => {
    stopCurrentPlayer();
    const sourceUrl = file.nativeUrl || URL.createObjectURL(file as unknown as Blob);
    if (!file.nativeUrl) objectUrlRef.current = sourceUrl;
    const current = latest.current, fileId = current.idOf(file);
    current.setActiveId(fileId);
    writeJson(STORAGE_KEYS.last, { collection: current.collectionKey, id: fileId });
    requestAnimationFrame(() => { const video = videoRef.current; if (!video) return; video.src = sourceUrl; video.load(); video.play().catch(() => undefined); });
  }, [stopCurrentPlayer]);

  const step = useCallback((direction: number) => { const video = videoRef.current; if (video && Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + direction * 10)); }, []);
  const adjacent = useCallback((direction: number) => { const current = latest.current, target = current.files[current.activeIndex + direction]; if (target) playFile(target); }, [playFile]);
  const togglePlayback = useCallback(() => { const video = videoRef.current; if (!video) return; if (video.paused) video.play().catch(() => undefined); else video.pause(); }, []);
  const onLoaded = useCallback(() => {
    const video = videoRef.current, current = latest.current;
    if (!video || !current.activeFile) return;
    const fileId = current.idOf(current.activeFile), record = current.progress[fileId];
    if (record?.time > 3 && record.time < video.duration - 5) video.currentTime = record.time;
    video.playbackRate = record?.speed || current.speed;
    current.saveProgress(fileId, { ...(record || { time: 0, done: false, updatedAt: new Date().toISOString() }), duration: video.duration });
    lastSavedTimeRef.current = video.currentTime;
  }, []);

  const savePeriodically = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || Math.abs(video.currentTime - lastSavedTimeRef.current) < 5) return;
    recordCurrent();
    lastSavedTimeRef.current = video.currentTime;
  }, [recordCurrent]);

  useEffect(() => { const video = videoRef.current; if (video) video.playbackRate = options.speed; localStorage.setItem(STORAGE_KEYS.speed, String(options.speed)); }, [options.speed]);
  useEffect(() => {
    const save = () => recordCurrent();
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [recordCurrent]);
  useEffect(() => () => stopCurrentPlayer(), [stopCurrentPlayer]);
  return { videoRef, recordCurrent, savePeriodically, stopCurrentPlayer, playFile, step, adjacent, togglePlayback, onLoaded };
}
