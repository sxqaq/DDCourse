"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CourseSidebar } from "./components/CourseSidebar";
import { PlayerStage } from "./components/PlayerStage";
import { cleanName, idOf, timeLabel } from "./course-utils";
import { useAppearance } from "./hooks/useAppearance";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import { useDesktopBridge } from "./hooks/useDesktopBridge";
import { useDesktopNotesSync } from "./hooks/useDesktopNotesSync";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNotesAndBookmarks } from "./hooks/useNotesAndBookmarks";
import { usePlayer } from "./hooks/usePlayer";
import { useProgress } from "./hooks/useProgress";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useStudyTime } from "./hooks/useStudyTime";
import { useVoiceEnhancer } from "./hooks/useVoiceEnhancer";
import { normalizeProgressId } from "./progress-backup.mjs";
import { readJson, STORAGE_KEYS } from "./storage";
import type { DesktopFolder, StudyBookmark, StudyNote } from "./types";

export default function Home() {
  const folderRef = useRef<HTMLInputElement>(null), filesRef = useRef<HTMLInputElement>(null), importRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && localStorage.getItem("lumacourse_sidebar") === "1");
  const [speed, setSpeed] = useState(() => typeof window === "undefined" ? 1 : Number(localStorage.getItem(STORAGE_KEYS.speed)) || 1);
  const [dragging, setDragging] = useState(false), [notice, setNotice] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false), [appearanceOpen, setAppearanceOpen] = useState(false);

  const library = useCourseLibrary(setNotice);
  const { loadDesktopFolder, setCollectionKey, collections, folderName } = library;
  const { progress, saveProgress, resetFiles, importProgress: importProgressFile, exportProgress: createProgressExport } = useProgress();
  const { weekSeconds, trackVideoTime } = useStudyTime();
  const { notes, bookmarks, deletions, mergeDesktopData, addNote: storeNote, editNote: updateNote, deleteNote: removeNote, addBookmark: storeBookmark, editBookmark: updateBookmark, deleteBookmark: removeBookmark } = useNotesAndBookmarks();
  const { font, setFont, scale, setScale, fontName, importFont } = useAppearance();
  const { isDesktop, restoreFolder, loadNotes, saveNotes, saveAndShowNotes, chooseFolder } = useDesktopBridge();
  const current = library.current, files = library.files;
  const activeIndex = files.findIndex(file => idOf(file) === activeId), activeFile = activeIndex >= 0 ? files[activeIndex] : null;
  const { videoRef, recordCurrent, savePeriodically, stopCurrentPlayer, playFile, step, adjacent, togglePlayback, onLoaded } = usePlayer({ files, activeFile, activeIndex, collectionKey: current?.key, speed, setSpeed, progress, idOf, setActiveId, saveProgress });
  const { installed, installApp } = usePwaInstall(setNotice);
  const { enabled: compressor, toggle: toggleCompressor } = useVoiceEnhancer(videoRef, setNotice);
  useKeyboardShortcuts({ enabled: Boolean(activeFile), togglePlayback, step, adjacent, setSpeed });
  useDesktopNotesSync({ isDesktop, folderName, notes, bookmarks, deletions, loadNotes, saveNotes, mergeDesktopData, onNotice: setNotice });

  const stopAndClearActive = useCallback(() => { stopCurrentPlayer(); setActiveId(""); }, [stopCurrentPlayer]);
  const loadDesktopResult = useCallback((result: DesktopFolder, message?: string) => {
    stopAndClearActive();
    if (loadDesktopFolder(result)) { setNotice(message || `已恢复课程文件夹：${result.folderName}`); window.setTimeout(() => setNotice(""), 2400); }
  }, [loadDesktopFolder, stopAndClearActive]);
  useEffect(() => { if (isDesktop) restoreFolder().then(result => { if (result?.files.length) loadDesktopResult(result); }).catch(() => undefined); }, [isDesktop, restoreFolder, loadDesktopResult]);
  useEffect(() => { let reported = false; const report = () => { if (!reported) { reported = true; setNotice("本地存储空间不足或不可用，本次更改可能没有保存"); } }; window.addEventListener("ddcourse:storage-error", report); return () => window.removeEventListener("ddcourse:storage-error", report); }, []);
  useEffect(() => { const sync = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", sync); return () => document.removeEventListener("fullscreenchange", sync); }, []);
  useEffect(() => {
    if (!collections.length || activeId) return;
    const last = readJson<{ collection: string; id: string } | null>(STORAGE_KEYS.last, null); if (!last) return;
    const normalizedId = normalizeProgressId(last.id || "");
    const previousCollection = collections.find(collection => collection.key === last.collection && collection.files.some(file => idOf(file) === normalizedId));
    if (previousCollection && current?.key !== previousCollection.key) {
      setCollectionKey(previousCollection.key);
      return;
    }
    const target = (previousCollection || current)?.files.find(file => idOf(file) === normalizedId && !progress[idOf(file)]?.done) || current?.files.find(file => (progress[idOf(file)]?.time || 0) > 0 && !progress[idOf(file)]?.done);
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(`可继续播放：${cleanName(target.name)}`);
    }
  }, [collections, setCollectionKey, current, activeId, progress]);

  const stats = useMemo(() => {
    const duration = files.reduce((sum, file) => sum + (progress[idOf(file)]?.duration || 0), 0);
    const watched = files.reduce((sum, file) => { const record = progress[idOf(file)]; return sum + (record?.done ? record.duration : Math.min(record?.time || 0, record?.duration || Infinity)); }, 0);
    const done = files.filter(file => progress[idOf(file)]?.done).length;
    return { done, duration, pct: duration ? Math.min(100, Math.round(watched / duration * 100)) : files.length ? Math.round(done / files.length * 100) : 0 };
  }, [files, progress]);

  const pickFolder = async () => { if (isDesktop) { const result = await chooseFolder(); if (result?.files.length) loadDesktopResult(result, `已载入 ${result.files.length} 个视频`); else if (result) setNotice("这个文件夹里没有可播放的视频"); return; } folderRef.current?.click(); };
  const refreshFolder = async () => {
    if (!library.folderMode) return pickFolder();
    if (isDesktop) { const previousCount = library.allFiles.length; stopAndClearActive(); const result = await restoreFolder(); if (result?.files.length) { library.loadDesktopFolder(result); setNotice(result.files.length > previousCount ? `刷新完成，发现 ${result.files.length - previousCount} 个新视频` : `刷新完成，共 ${result.files.length} 个视频`); } else setNotice("当前文件夹里没有可播放的视频"); return; }
    stopAndClearActive(); folderRef.current?.click();
  };
  const loadBrowserFiles = (list: FileList, fromFolder: boolean) => { stopAndClearActive(); if (library.loadFiles(list, fromFolder)) window.setTimeout(() => setNotice(""), 2400); };
  const exportProgress = () => { const { blob, filename } = createProgressExport(), url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("学习进度备份已导出"); };
  const importProgress = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const result = await importProgressFile(file), imported = activeFile ? result.progress[idOf(activeFile)] : undefined; if (imported && videoRef.current) { const video = videoRef.current; if (imported.time >= 0 && (!Number.isFinite(video.duration) || imported.time <= video.duration)) video.currentTime = imported.time; if (imported.speed) { video.playbackRate = imported.speed; setSpeed(imported.speed); } } setNotice(`学习进度已成功导入（${result.importedCount} 条）`); }
    catch { setNotice("这不是有效的 DDCourse 进度文件"); } finally { event.target.value = ""; }
  };
  const resetCurrent = () => { if (!current || !confirm(`清空“${current.name}”的全部播放进度？`)) return; stopAndClearActive(); resetFiles(current.files.map(idOf)); };
  const addBookmark = () => { const time = videoRef.current?.currentTime || 0; if (!activeFile) return; storeBookmark({ fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, label: "重点" }); setNotice(`已收藏 ${timeLabel(time)} 的知识点`); };
  const editBookmark = (item: StudyBookmark) => { const label = prompt("修改重点名称：", item.label || "重点"); if (label?.trim()) updateBookmark(item.id, { label: label.trim() }); };
  const deleteBookmark = (item: StudyBookmark) => { if (confirm(`删除 ${timeLabel(item.time)} 的重点“${item.label || "重点"}”？`)) removeBookmark(item.id); };
  const editNote = (item: StudyNote) => { const text = prompt("修改笔记：", item.text); if (text?.trim()) updateNote(item.id, { text: text.trim() }); };
  const deleteNote = (item: StudyNote) => { if (confirm(`删除 ${timeLabel(item.time)} 的这条笔记？`)) removeNote(item.id); };
  const addNote = () => { const text = prompt("记录这一刻的想法："); if (!text?.trim() || !activeFile) return; const time = videoRef.current?.currentTime || 0; storeNote({ fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, text: text.trim() }); setNotice("笔记已添加到学习地图"); };
  const showNotesLocation = async () => {
    const payload = { app: "DDCourse", updatedAt: new Date().toISOString(), folder: library.folderName, notes, bookmarks, deletions };
    if (isDesktop) { try { setNotice(`笔记已保存：${await saveAndShowNotes(payload)}`); } catch { setNotice("笔记保存失败，请检查磁盘空间和目录权限"); } return; }
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); anchor.download = "DDCourse-学习笔记.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  };
  const toggleFullscreen = async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) loadBrowserFiles(event.dataTransfer.files, false); };
  const changeCollapsed = (value: boolean) => { setCollapsed(value); try { localStorage.setItem("lumacourse_sidebar", value ? "1" : "0"); } catch { /* Preference remains in memory. */ } };

  return <main className={`shell ${collapsed ? "is-collapsed" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    {dragging && <div className="dropzone"><div><span>＋</span><strong>松开以载入课程视频</strong><small>实际播放能力取决于视频编码和系统支持</small></div></div>}
    <CourseSidebar allFilesCount={library.allFiles.length} collections={library.collections} current={current} files={files} folderName={library.folderName} folderMode={library.folderMode} progress={progress} query={query} unfinished={unfinished} activeId={activeId} stats={stats} weekSeconds={weekSeconds} folderRef={folderRef} filesRef={filesRef} importRef={importRef} onPrimaryAction={library.folderMode ? refreshFolder : pickFolder} onSecondaryAction={library.folderMode ? pickFolder : () => filesRef.current?.click()} onFolderInput={event => { if (event.target.files) loadBrowserFiles(event.target.files, true); event.target.value = ""; }} onFilesInput={event => { if (event.target.files) loadBrowserFiles(event.target.files, false); event.target.value = ""; }} onCollectionChange={key => { stopAndClearActive(); library.setCollectionKey(key); }} onQueryChange={setQuery} onUnfinishedChange={setUnfinished} onPlayFile={playFile} onShowNotes={showNotesLocation} onImportProgress={importProgress} onExportProgress={exportProgress} onReset={resetCurrent}/>
    <PlayerStage collapsed={collapsed} onCollapsedChange={changeCollapsed} currentName={current?.name} activeFile={activeFile} installed={installed} onInstall={installApp} appearanceOpen={appearanceOpen} setAppearanceOpen={setAppearanceOpen} font={font} setFont={setFont} scale={scale} setScale={setScale} fontName={fontName} importFont={importFont} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onPickFolder={pickFolder} videoRef={videoRef} videoDuration={videoRef.current?.duration || 0} onJumpToTime={time => { if (videoRef.current) videoRef.current.currentTime = time; }} onLoaded={onLoaded} onTimeUpdate={currentTime => { trackVideoTime(currentTime); savePeriodically(); }} onPause={() => recordCurrent()} onEnded={() => { recordCurrent(true); adjacent(1); }} progress={progress} notes={notes} bookmarks={bookmarks} onShowNotes={showNotesLocation} onAddBookmark={addBookmark} onAddNote={addNote} onEditBookmark={editBookmark} onDeleteBookmark={deleteBookmark} onEditNote={editNote} onDeleteNote={deleteNote} activeIndex={activeIndex} filesLength={files.length} onAdjacent={adjacent} onStep={step} onTogglePlayback={togglePlayback} compressor={compressor} onToggleCompressor={toggleCompressor} speed={speed} setSpeed={setSpeed}/>
    {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
  </main>;
}
