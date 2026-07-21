"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, writeJson, writeString } from "../storage";
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
  const nextUpRef = useRef<CourseFile | null>(null);
  const playbackFileRef = useRef<CourseFile | null>(null);
  const pendingStartTimeRef = useRef<number | null>(null);
  const suppressedPauseEventsRef = useRef(0);
  const [sourceUrl, setSourceUrl] = useState("");
  const latest = useRef(options); latest.current = options;

  const recordCurrent = useCallback((forceDone = false) => {
    const video = videoRef.current, current = latest.current;
    const file = playbackFileRef.current;
    if (!video || !file) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0, time = video.currentTime || 0;
    const fileId = current.idOf(file), existing = current.progress[fileId];
    const automaticDone = duration > 0 && time / duration >= .9;
    const done = forceDone ? true : existing?.doneOverride ?? automaticDone;
    current.saveProgress(fileId, { time, duration, done, ...(existing?.doneOverride === undefined ? {} : { doneOverride: existing.doneOverride }), updatedAt: new Date().toISOString(), speed: current.speed });
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
      if (!video.paused) suppressedPauseEventsRef.current += 1;
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    playbackFileRef.current = null;
    pendingStartTimeRef.current = null;
    revokeObjectUrl();
    setSourceUrl("");
    lastSavedTimeRef.current = 0;
  }, [recordCurrent, revokeObjectUrl]);

  const playFile = useCallback((file: CourseFile, startTime?: number, collectionKey?: string) => {
    stopCurrentPlayer();
    nextUpRef.current = null;
    pendingStartTimeRef.current = Number.isFinite(startTime) ? Math.max(0, startTime!) : null;
    const sourceUrl = file.nativeUrl || URL.createObjectURL(file as unknown as Blob);
    if (!file.nativeUrl) objectUrlRef.current = sourceUrl;
    setSourceUrl(sourceUrl);
    const current = latest.current, fileId = current.idOf(file);
    current.setActiveId(fileId);
    writeJson(STORAGE_KEYS.last, { collection: collectionKey ?? current.collectionKey, id: fileId });
    requestAnimationFrame(() => { const video = videoRef.current; if (!video) return; playbackFileRef.current = file; video.src = sourceUrl; video.load(); video.play().catch(() => undefined); });
  }, [stopCurrentPlayer]);

  const step = useCallback((direction: number) => { const video = videoRef.current; if (video && Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + direction * 10)); }, []);
  const adjacent = useCallback((direction: number) => {
    const current = latest.current;
    const target = direction > 0 && nextUpRef.current ? nextUpRef.current : current.files[current.activeIndex + direction];
    if (target) playFile(target);
  }, [playFile]);
  const queueNext = useCallback((file: CourseFile) => { nextUpRef.current = file; }, []);
  const togglePlayback = useCallback(() => { const video = videoRef.current; if (!video) return; if (video.paused) video.play().catch(() => undefined); else video.pause(); }, []);
  const onLoaded = useCallback(() => {
    const video = videoRef.current, current = latest.current;
    const file = playbackFileRef.current;
    if (!video || !file) return;
    const fileId = current.idOf(file), record = current.progress[fileId];
    const requestedTime = pendingStartTimeRef.current;
    pendingStartTimeRef.current = null;
    if (requestedTime !== null) video.currentTime = Math.min(requestedTime, Math.max(0, video.duration));
    else if (record?.time > 3 && record.time < video.duration - 5) video.currentTime = record.time;
    video.playbackRate = record?.speed || current.speed;
    current.saveProgress(fileId, { ...(record || { time: 0, done: false, updatedAt: new Date().toISOString() }), duration: video.duration });
    lastSavedTimeRef.current = video.currentTime;
  }, []);

  const onPause = useCallback(() => {
    if (suppressedPauseEventsRef.current > 0) {
      suppressedPauseEventsRef.current -= 1;
      return;
    }
    recordCurrent();
  }, [recordCurrent]);

  const savePeriodically = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || Math.abs(video.currentTime - lastSavedTimeRef.current) < 5) return;
    recordCurrent();
    lastSavedTimeRef.current = video.currentTime;
  }, [recordCurrent]);

  useEffect(() => { const video = videoRef.current; if (video) video.playbackRate = options.speed; writeString(STORAGE_KEYS.speed, String(options.speed)); }, [options.speed]);
  useEffect(() => {
    const save = () => recordCurrent();
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [recordCurrent]);
  useEffect(() => () => stopCurrentPlayer(), [stopCurrentPlayer]);
  return { videoRef, sourceUrl, recordCurrent, savePeriodically, stopCurrentPlayer, playFile, queueNext, step, adjacent, togglePlayback, onLoaded, onPause };
}
