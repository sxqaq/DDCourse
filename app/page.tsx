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
import { requestFullscreenExclusive, usePictureInPicture } from "./hooks/useMediaFeatures";
import { useNotesAndBookmarks } from "./hooks/useNotesAndBookmarks";
import { usePlayer } from "./hooks/usePlayer";
import { useProgress } from "./hooks/useProgress";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useDesktopUpdater } from "./hooks/useDesktopUpdater";
import { useStudyTime } from "./hooks/useStudyTime";
import { useVoiceEnhancer } from "./hooks/useVoiceEnhancer";
import { normalizeProgressId } from "./progress-backup.mjs";
import { createSubtitleObjectUrl, subtitleKindFromName } from "./media-utils";
import { createCollectionMarkdown, downloadText } from "./report-utils";
import { normalizeLastSelection, readJson, readString, STORAGE_KEYS, writeString } from "./storage";
import type { Collection, CourseFile, DesktopFolder, StudyBookmark, StudyNote } from "./types";

export default function Home() {
  const folderRef = useRef<HTMLInputElement>(null), filesRef = useRef<HTMLInputElement>(null), importRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readString("lumacourse_sidebar") === "1");
  const [speed, setSpeed] = useState(() => { const value = Number(readString(STORAGE_KEYS.speed, "1")); return value >= 0.5 && value <= 3 ? value : 1; });
  const [dragging, setDragging] = useState(false), [notice, setNotice] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false), [appearanceOpen, setAppearanceOpen] = useState(false);
  const [viewingNotesFile, setViewingNotesFile] = useState<CourseFile | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const restoredRef = useRef(false);

  const library = useCourseLibrary(setNotice);
  const { loadDesktopFolder, setCollectionKey, collections, folderName } = library;
  const { progress, saveProgress, resetFiles, importProgress: importProgressFile, exportProgress: createProgressExport } = useProgress();
  const { weekSeconds, trackVideoTime } = useStudyTime();
  const { notes, bookmarks, deletions, mergeDesktopData, addNote: storeNote, editNote: updateNote, deleteNote: removeNote, addBookmark: storeBookmark, editBookmark: updateBookmark, deleteBookmark: removeBookmark } = useNotesAndBookmarks();
  const { font, setFont, scale, setScale, theme, setTheme, fontName, importFont } = useAppearance();
  const { isDesktop, restoreFolder, loadNotes, saveNotes, saveAndShowNotes, chooseFolder, revealPath, getNativePath, readSubtitle } = useDesktopBridge();
  const current = library.current, files = library.files;
  const activeIndex = files.findIndex(file => idOf(file) === activeId), activeFile = activeIndex >= 0 ? files[activeIndex] : null;
  const { videoRef, sourceUrl, recordCurrent, savePeriodically, stopCurrentPlayer, playFile, queueNext, step, adjacent, togglePlayback, onLoaded, onPause } = usePlayer({ files, activeFile, activeIndex, collectionKey: current?.key, speed, setSpeed, progress, idOf, setActiveId, saveProgress });
  const updater = useDesktopUpdater();
  const pictureInPicture = usePictureInPicture(videoRef);
  const { installed: pwaInstalled, installApp } = usePwaInstall(setNotice);
  const installed = pwaInstalled || isDesktop;
  const { enabled: compressor, toggle: toggleCompressor } = useVoiceEnhancer(videoRef, setNotice);
  useKeyboardShortcuts({ enabled: Boolean(activeFile), togglePlayback, step, adjacent, setSpeed });
  useDesktopNotesSync({ isDesktop, folderName, notes, bookmarks, deletions, loadNotes, saveNotes, mergeDesktopData, onNotice: setNotice });

  useEffect(() => {
    let cancelled = false;
    let cleanup: () => void = () => undefined;
    queueMicrotask(() => { if (!cancelled) setSubtitleUrl(""); });
    if (!activeFile || (!activeFile.subtitleFile && !activeFile.subtitleNativePath)) return;
    const subtitleName = activeFile.subtitleFile?.name || activeFile.subtitleNativePath || "";
    const kind = subtitleKindFromName(subtitleName);
    if (!kind) return;
    const load = activeFile.subtitleFile
      ? activeFile.subtitleFile.arrayBuffer().then(buffer => new Uint8Array(buffer))
      : readSubtitle(activeFile.subtitleNativePath!);
    load.then(bytes => {
      if (cancelled) return;
      const resource = createSubtitleObjectUrl(bytes, kind);
      cleanup = resource.revoke;
      setSubtitleUrl(resource.url);
    }).catch(() => { if (!cancelled) setNotice("字幕读取失败，视频仍可正常播放"); });
    return () => { cancelled = true; cleanup(); };
  }, [activeFile, readSubtitle]);

  const updateNotice = updater.status.state === "up-to-date" ? "当前已是最新版本"
    : updater.status.state === "available" ? `发现新版本 ${updater.status.version || ""}，点击按钮下载`
    : updater.status.state === "ready" ? `版本 ${updater.status.version || ""} 已下载，可重启安装`
    : (updater.status.state === "error" || updater.status.state === "unsupported") ? updater.status.message || "更新操作失败"
    : "";

  const stopAndClearActive = useCallback(() => { stopCurrentPlayer(); setActiveId(""); }, [stopCurrentPlayer]);
  const loadDesktopResult = useCallback((result: DesktopFolder, message?: string) => {
    stopAndClearActive();
    if (loadDesktopFolder(result)) { setNotice(message || `已恢复课程文件夹：${result.folderName}`); window.setTimeout(() => setNotice(""), 2400); }
  }, [loadDesktopFolder, stopAndClearActive]);
  useEffect(() => { if (isDesktop) restoreFolder().then(result => { if (result?.files.length) loadDesktopResult(result); }).catch(() => undefined); }, [isDesktop, restoreFolder, loadDesktopResult]);
  useEffect(() => { let reported = false; const report = () => { if (!reported) { reported = true; setNotice("本地存储空间不足或不可用，本次更改可能没有保存"); } }; window.addEventListener("ddcourse:storage-error", report); return () => window.removeEventListener("ddcourse:storage-error", report); }, []);
  useEffect(() => { const sync = () => setIsFullscreen(document.fullscreenElement === document.documentElement); document.addEventListener("fullscreenchange", sync); return () => document.removeEventListener("fullscreenchange", sync); }, []);
  useEffect(() => {
    if (!collections.length || activeId || restoredRef.current) return;
    restoredRef.current = true;
    const last = normalizeLastSelection(readJson<unknown>(STORAGE_KEYS.last, null)); if (!last) return;
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

  const noteMatchIds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return new Set<string>();
    return new Set([...notes.filter(item => item.text.toLowerCase().includes(needle)), ...bookmarks.filter(item => item.label.toLowerCase().includes(needle))].map(item => item.fileId));
  }, [bookmarks, notes, query]);

  const stats = useMemo(() => {
    const sourceFiles = current?.allFiles || [];
    const duration = sourceFiles.reduce((sum, file) => sum + (progress[idOf(file)]?.duration || 0), 0);
    const watched = sourceFiles.reduce((sum, file) => { const record = progress[idOf(file)]; return sum + (record?.done ? record.duration : Math.min(record?.time || 0, record?.duration || Infinity)); }, 0);
    const done = sourceFiles.filter(file => progress[idOf(file)]?.done).length;
    return { done, duration, pct: duration ? Math.min(100, Math.round(watched / duration * 100)) : sourceFiles.length ? Math.round(done / sourceFiles.length * 100) : 0 };
  }, [current, progress]);

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
  const resetCurrent = () => { if (!current || !confirm(`清空“${current.name}”的全部播放进度？`)) return; stopAndClearActive(); resetFiles(current.allFiles.map(idOf)); };
  const renameCollection = (collection: Collection) => { const name = prompt("合集显示名称：", collection.name); if (name !== null) library.renameCollection(collection.key, name); };
  const resetCollection = (collection: Collection) => {
    if (!confirm(`清空“${collection.name}”的全部播放进度？`)) return;
    if (activeFile && collection.allFiles.some(file => idOf(file) === idOf(activeFile))) stopAndClearActive();
    resetFiles(collection.allFiles.map(idOf)); setNotice(`已重置“${collection.name}”`);
  };
  const exportCollection = (collection: Collection) => {
    downloadText(`DDCourse-${collection.name}-学习报告.md`, createCollectionMarkdown({ ...collection, files: collection.allFiles }, progress, notes, bookmarks));
    setNotice(`已导出“${collection.name}”学习报告`);
  };
  const nativePathLabel = (file: CourseFile) => {
    if (!file.nativeUrl) return file.webkitRelativePath || file.name;
    try { return decodeURIComponent(new URL(file.nativeUrl).pathname).replace(/^\/([A-Za-z]:)/, "$1"); } catch { return file.nativeUrl; }
  };
  const toggleFileDone = (file: CourseFile) => {
    const fileId = idOf(file), record = progress[fileId], done = !record?.done;
    saveProgress(fileId, { time: record?.time || 0, duration: record?.duration || 0, done, doneOverride: done, updatedAt: new Date().toISOString(), speed: record?.speed || speed });
    setNotice(done ? "已标记为看完" : "已标记为未完成");
  };
  const resetFile = (file: CourseFile) => { if (activeId === idOf(file)) stopAndClearActive(); resetFiles([idOf(file)]); setNotice("这一节的进度已重置"); };
  const hideFile = (file: CourseFile) => { if (activeId === idOf(file)) stopAndClearActive(); library.hideFile(file); setNotice("已从课程列表隐藏，可在底部恢复"); };
  const copyFilePath = async (file: CourseFile) => { try { const source = file.nativeUrl || file.webkitRelativePath || file.name; const label = isDesktop ? await getNativePath(source) : nativePathLabel(file); await navigator.clipboard.writeText(label); setNotice("文件路径已复制"); } catch { setNotice("无法复制文件路径"); } };
  const revealFile = async (file: CourseFile) => { try { await revealPath(file.nativeUrl || file.webkitRelativePath || ""); } catch { setNotice("无法在文件管理器中定位"); } };
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
  const toggleFullscreen = async () => { try { if (document.fullscreenElement === document.documentElement) await document.exitFullscreen(); else { if (document.fullscreenElement) await document.exitFullscreen(); await document.documentElement.requestFullscreen(); } } catch { setNotice("应用全屏失败，请检查系统权限"); } };
  const toggleVideoFullscreen = async () => { const video = videoRef.current; if (!video) return; try { if (document.fullscreenElement === video) await document.exitFullscreen(); else await requestFullscreenExclusive(video); } catch { setNotice("视频全屏失败，请检查系统权限"); } };
  const togglePip = async () => { try { await pictureInPicture.toggle(); } catch { setNotice("当前系统或视频不支持画中画"); } };
  const updaterLabel = updater.status.state === "checking" ? "检查中…" : updater.status.state === "available" ? `下载 ${updater.status.version || "新版本"}` : updater.status.state === "downloading" ? `下载 ${Math.round(updater.status.percent || 0)}%` : updater.status.state === "ready" ? "重启安装" : "检查更新";
  const runUpdateAction = async () => {
    if (updater.status.state === "available") return updater.downloadUpdate();
    if (updater.status.state === "ready") {
      stopAndClearActive();
      await saveNotes({ app: "DDCourse", updatedAt: new Date().toISOString(), folder: library.folderName, notes, bookmarks, deletions }).catch(() => undefined);
      return updater.installUpdate();
    }
    return updater.checkForUpdates();
  };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) loadBrowserFiles(event.dataTransfer.files, false); };
  const changeCollapsed = (value: boolean) => { setCollapsed(value); writeString("lumacourse_sidebar", value ? "1" : "0"); };
  const playFromSidebar = (file: CourseFile, targetCollectionKey: string) => {
    setViewingNotesFile(null);
    if (targetCollectionKey !== current?.key) setCollectionKey(targetCollectionKey);
    playFile(file, undefined, targetCollectionKey);
  };
  const jumpToTime = (time: number) => {
    const target = viewingNotesFile;
    if (target && idOf(target) !== (activeFile ? idOf(activeFile) : "")) {
      const targetCollection = collections.find(collection => collection.files.some(file => idOf(file) === idOf(target)));
      if (targetCollection && targetCollection.key !== current?.key) setCollectionKey(targetCollection.key);
      setViewingNotesFile(null);
      playFile(target, time, targetCollection?.key);
      return;
    }
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  return <main className={`shell ${collapsed ? "is-collapsed" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    {dragging && <div className="dropzone"><div><span>＋</span><strong>松开以载入课程视频</strong><small>实际播放能力取决于视频编码和系统支持</small></div></div>}
    <CourseSidebar allFilesCount={library.allFiles.length} collections={library.collections} current={current} files={files} folderName={library.folderName} folderMode={library.folderMode} progress={progress} query={query} unfinished={unfinished} activeId={activeId} stats={stats} weekSeconds={weekSeconds} folderRef={folderRef} filesRef={filesRef} importRef={importRef} onPrimaryAction={library.folderMode ? refreshFolder : pickFolder} onSecondaryAction={library.folderMode ? pickFolder : () => filesRef.current?.click()} onFolderInput={event => { if (event.target.files) loadBrowserFiles(event.target.files, true); event.target.value = ""; }} onFilesInput={event => { if (event.target.files) loadBrowserFiles(event.target.files, false); event.target.value = ""; }} onCollectionChange={key => { stopAndClearActive(); setViewingNotesFile(null); library.setCollectionKey(key); }} onQueryChange={setQuery} onUnfinishedChange={setUnfinished} onPlayFile={playFromSidebar} onShowNotes={showNotesLocation} onImportProgress={importProgress} onExportProgress={exportProgress} onReset={resetCurrent} noteMatchIds={noteMatchIds} hiddenCount={library.hiddenCount} onRestoreHidden={library.restoreHiddenFiles} onRenameCollection={renameCollection} onResetCollection={resetCollection} onRevealCollection={isDesktop ? collection => { const file = collection.allFiles[0]; if (file) revealFile(file); } : undefined} onExportCollection={exportCollection} onTogglePinnedCollection={collection => library.togglePinned(collection.key)} onToggleSkippedCollection={collection => library.toggleSkipped(collection.key)} onToggleFileDone={toggleFileDone} onResetFile={resetFile} onViewFileNotes={setViewingNotesFile} onQueueFile={file => { queueNext(file); setNotice(`下一节将播放：${cleanName(file.name)}`); }} onHideFile={hideFile} onCopyFilePath={copyFilePath} onRevealFile={isDesktop ? revealFile : undefined}/>
    <PlayerStage collapsed={collapsed} onCollapsedChange={changeCollapsed} currentName={current?.name} activeFile={activeFile} installed={installed} onInstall={installApp} appearanceOpen={appearanceOpen} setAppearanceOpen={setAppearanceOpen} font={font} setFont={setFont} scale={scale} setScale={setScale} theme={theme} setTheme={setTheme} fontName={fontName} importFont={importFont} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onPickFolder={pickFolder} videoRef={videoRef} videoDuration={videoRef.current?.duration || 0} videoCurrentTime={videoCurrentTime} videoSource={sourceUrl} subtitleUrl={subtitleUrl} onJumpToTime={jumpToTime} onVideoFullscreen={toggleVideoFullscreen} pipSupported={pictureInPicture.supported} pipActive={pictureInPicture.active} onTogglePip={togglePip} updaterVisible={updater.isDesktop} updaterLabel={updaterLabel} updaterDisabled={updater.status.state === "checking" || updater.status.state === "downloading"} onUpdateAction={runUpdateAction} onLoaded={onLoaded} onTimeUpdate={currentTime => { setVideoCurrentTime(currentTime); trackVideoTime(currentTime); savePeriodically(); }} onPause={onPause} onEnded={() => { recordCurrent(true); adjacent(1); }} progress={progress} notes={notes} bookmarks={bookmarks} onShowNotes={showNotesLocation} onAddBookmark={addBookmark} onAddNote={addNote} onEditBookmark={editBookmark} onDeleteBookmark={deleteBookmark} onEditNote={editNote} onDeleteNote={deleteNote} viewingNotesFile={viewingNotesFile} onCloseNotesView={() => setViewingNotesFile(null)} activeIndex={activeIndex} filesLength={files.length} onAdjacent={adjacent} onStep={step} onTogglePlayback={togglePlayback} compressor={compressor} onToggleCompressor={toggleCompressor} speed={speed} setSpeed={setSpeed}/>
    {(notice || updateNotice) && <div className="toast" role="status" aria-live="polite">{notice || updateNotice}</div>}
  </main>;
}
