"use client";
/* eslint-disable @next/next/no-img-element -- shared renderer also runs in Electron without Next Image. */

import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type RefObject, type UIEvent } from "react";
import { cleanName, idOf, timeLabel } from "../course-utils";
import type { Collection, CourseFile, ProgressMap } from "../types";
import { CollectionPicker } from "./CollectionPicker";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

type CourseStats = { done: number; duration: number; pct: number };

type Props = {
  allFilesCount: number;
  collections: Collection[];
  current?: Collection;
  files: CourseFile[];
  folderName: string;
  folderMode: boolean;
  progress: ProgressMap;
  query: string;
  unfinished: boolean;
  activeId: string;
  stats: CourseStats;
  weekSeconds: number;
  folderRef: RefObject<HTMLInputElement | null>;
  filesRef: RefObject<HTMLInputElement | null>;
  importRef: RefObject<HTMLInputElement | null>;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onFolderInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onFilesInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onCollectionChange: (key: string) => void;
  onQueryChange: (query: string) => void;
  onUnfinishedChange: (value: boolean) => void;
  onPlayFile: (file: CourseFile, collectionKey: string) => void;
  onShowNotes: () => void;
  onImportProgress: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportProgress: () => void;
  onReset: () => void;
  noteMatchIds: Set<string>;
  hiddenCount: number;
  onRestoreHidden: () => void;
  onRenameCollection: (collection: Collection) => void;
  onResetCollection: (collection: Collection) => void;
  onRevealCollection?: (collection: Collection) => void;
  onExportCollection: (collection: Collection) => void;
  onTogglePinnedCollection: (collection: Collection) => void;
  onToggleSkippedCollection: (collection: Collection) => void;
  onToggleFileDone: (file: CourseFile) => void;
  onResetFile: (file: CourseFile) => void;
  onViewFileNotes: (file: CourseFile) => void;
  onQueueFile: (file: CourseFile) => void;
  onHideFile: (file: CourseFile) => void;
  onCopyFilePath: (file: CourseFile) => void;
  onRevealFile?: (file: CourseFile) => void;
};

export type CourseSearchEntry = { file: CourseFile; collectionKey: string; collectionName: string; ordinal: number };

export function buildCourseSearchEntries(collections: Collection[], current: Collection | undefined, query: string, unfinished: boolean, progress: ProgressMap, noteMatchIds: Set<string>): CourseSearchEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  const source = needle ? collections : current ? [current] : [];
  const result: CourseSearchEntry[] = [];
  for (const collection of source) {
    for (let index = 0; index < collection.files.length; index += 1) {
      const file = collection.files[index], fileId = idOf(file);
      if (unfinished && progress[fileId]?.done) continue;
      if (needle && !cleanName(file.name).toLocaleLowerCase().includes(needle) && !noteMatchIds.has(fileId)) continue;
      result.push({ file, collectionKey: collection.key, collectionName: collection.name, ordinal: index + 1 });
    }
  }
  return result;
}

export function virtualCourseRange(total: number, scrollTop: number, viewportHeight: number, rowHeight = 58, overscan = 8) {
  if (total <= 150) return { start: 0, end: total, top: 0, bottom: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end, top: start * rowHeight, bottom: Math.max(0, (total - end) * rowHeight) };
}

export function CourseSidebar(props: Props) {
  const { collections, current, noteMatchIds, progress, query, unfinished } = props;
  const [menu, setMenu] = useState<{ file: CourseFile; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 600 });
  const openMenu = (file: CourseFile, x: number, y: number) => setMenu({ file, x, y });
  const onFileContextMenu = (event: MouseEvent<HTMLButtonElement>, file: CourseFile) => { event.preventDefault(); openMenu(file, event.clientX, event.clientY); };
  const onFileKeyDown = (event: KeyboardEvent<HTMLButtonElement>, file: CourseFile, entryIndex: number) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const targetIndex = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : Math.max(0, Math.min(entries.length - 1, entryIndex + (event.key === "ArrowDown" ? 1 : -1)));
      const element = listRef.current;
      if (element) {
        element.scrollTop = targetIndex * 58;
        setViewport({ scrollTop: element.scrollTop, height: element.clientHeight || viewport.height });
        requestAnimationFrame(() => element.querySelector<HTMLButtonElement>(`[data-course-index="${targetIndex}"]`)?.focus());
      }
      return;
    }
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(file, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
  const overallFiles = props.collections.filter(collection => !collection.skipped).flatMap(collection => collection.allFiles);
  const overallDone = overallFiles.filter(file => props.progress[idOf(file)]?.done).length;
  const overallPct = overallFiles.length ? Math.round(overallDone / overallFiles.length * 100) : 0;
  // Keep 10k-course filtering stable while scroll state changes the virtual window.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const entries = useMemo(() => buildCourseSearchEntries(collections, current, query, unfinished, progress, noteMatchIds), [collections, current, noteMatchIds, progress, query, unfinished]);
  const range = virtualCourseRange(entries.length, viewport.scrollTop, viewport.height);
  const visibleEntries = entries.slice(range.start, range.end);
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;
    element.scrollTop = 0;
    setViewport({ scrollTop: 0, height: element.clientHeight || 600 });
  }, [props.current?.key, props.query, props.unfinished]);
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(previous => ({ ...previous, height: element.clientHeight || previous.height })));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const onListScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    setViewport({ scrollTop: element.scrollTop, height: element.clientHeight || viewport.height });
  };
  return (
    <aside className="library">
      <header className="brand"><img className="brand-mark" src="./icons/icon-192.png" alt="DDCourse"/><div><strong>DDCourse</strong><span>Learning Player</span></div></header>
      <section className="pick-area">
        <button className="primary" onClick={props.onPrimaryAction}><span>{props.folderMode ? "↻" : "＋"}</span>{props.folderMode ? "刷新" : "选择课程文件夹"}</button>
        <button className="ghost compact" onClick={props.onSecondaryAction}>{props.folderMode ? "更换文件夹" : "选择视频"}</button>
        <input ref={props.folderRef} hidden type="file" multiple {...({ webkitdirectory: "" } as object)} onChange={props.onFolderInput} />
        <input ref={props.filesRef} hidden type="file" multiple accept="video/*,.mkv,.avi" onChange={props.onFilesInput} />
        {props.folderName && <div className="folder-name"><span>▱</span><b>{props.folderName}</b><small>{props.allFilesCount} 个视频</small></div>}
      </section>

      {props.collections.length > 1 && <CollectionPicker collections={props.collections} current={props.current} folderName={props.folderName} progress={props.progress} onCollectionChange={props.onCollectionChange} onRename={props.onRenameCollection} onReset={props.onResetCollection} onReveal={props.onRevealCollection} onExportReport={props.onExportCollection} onTogglePinned={props.onTogglePinnedCollection} onToggleSkipped={props.onToggleSkippedCollection} />}

      <section className="course-summary">
        <div className="summary-head"><div><span>课程进度</span><strong>{props.stats.done} / {props.current?.allFiles.length || 0} 节</strong></div><b>{props.stats.pct}%</b></div>
        <div className="progress-track"><i style={{ width: `${props.stats.pct}%` }} /></div>
        <div className="study-stat"><span>本周专注</span><strong>{props.weekSeconds >= 3600 ? `${(props.weekSeconds / 3600).toFixed(1)} 小时` : `${Math.round(props.weekSeconds / 60)} 分钟`}</strong><small>全库进度 {overallDone}/{overallFiles.length} 节 · {overallPct}%（暂不学习的合集不计）</small></div>
      </section>

      <section className="list-area">
        <div className="list-head"><div className="search"><span>⌕</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="搜索课程、笔记或收藏…" /></div><button className={props.unfinished ? "filter active" : "filter"} onClick={() => props.onUnfinishedChange(!props.unfinished)}>未完成</button></div>
        <div className="lesson-list" ref={listRef} onScroll={onListScroll}>
          {!entries.length && <div className="empty-list"><span>◫</span><strong>{props.query ? "没有匹配的课程或笔记" : "课程库还是空的"}</strong><p>{props.query ? "可尝试更短的关键词，搜索范围包含全部合集。" : "选择一个课程文件夹，视频会自动按子文件夹整理。"}</p></div>}
          {range.top > 0 && <div aria-hidden="true" style={{ height: range.top }} />}
          {visibleEntries.map(({ file, collectionKey, collectionName, ordinal }, visibleIndex) => {
            const record = props.progress[idOf(file)];
            const isActive = idOf(file) === props.activeId;
            const pct = record?.duration ? Math.min(100, record.time / record.duration * 100) : 0;
            const crossCollection = Boolean(props.query.trim()) && collectionKey !== props.current?.key;
            const entryIndex = range.start + visibleIndex;
            return <button key={idOf(file)} data-course-index={entryIndex} aria-label={`${cleanName(file.name)}，第 ${entryIndex + 1} 个结果，共 ${entries.length} 个`} className={`lesson ${isActive ? "active" : ""} ${record?.done ? "done" : ""}`} onClick={() => props.onPlayFile(file, collectionKey)} onContextMenu={event => onFileContextMenu(event, file)} onKeyDown={event => onFileKeyDown(event, file, entryIndex)} title={`${crossCollection ? `${collectionName}；` : ""}右键打开课程操作`}><span className="lesson-state">{record?.done ? "✓" : String(ordinal).padStart(2, "0")}</span><span className="lesson-copy"><strong>{cleanName(file.name)}</strong><small>{crossCollection ? `${collectionName} · ` : ""}{record?.done ? "已完成" : record?.time ? `已学习 ${timeLabel(record.time)}` : "未开始"}</small><i><b style={{ width: `${record?.done ? 100 : pct}%` }} /></i></span><span className="lesson-time">{record?.duration ? timeLabel(record.duration) : ""}</span></button>;
          })}
          {range.bottom > 0 && <div aria-hidden="true" style={{ height: range.bottom }} />}
        </div>
      </section>
      <footer className="library-footer"><button onClick={props.onShowNotes}>笔记位置</button><button onClick={() => props.importRef.current?.click()}>导入进度</button><button onClick={props.onExportProgress}>导出进度</button>{props.hiddenCount > 0 && <button onClick={props.onRestoreHidden}>恢复隐藏({props.hiddenCount})</button>}<button className="danger-text" onClick={props.onReset}>重置</button><input hidden ref={props.importRef} type="file" accept="application/json" onChange={props.onImportProgress} /></footer>
      {menu && (() => {
        const record = props.progress[idOf(menu.file)];
        const items: ContextMenuItem[] = [
          { label: record?.done ? "标记为未完成" : "标记为已看完", onClick: () => props.onToggleFileDone(menu.file) },
          { label: "重置这一节进度", onClick: () => props.onResetFile(menu.file), danger: true },
          { label: "查看该视频的笔记与收藏", onClick: () => props.onViewFileNotes(menu.file) },
          { label: "插队为下一个播放", onClick: () => props.onQueueFile(menu.file) },
          { label: "从课程列表隐藏", onClick: () => props.onHideFile(menu.file) },
          { label: "复制文件路径", onClick: () => props.onCopyFilePath(menu.file) },
          ...(props.onRevealFile ? [{ label: "在文件管理器中定位", onClick: () => props.onRevealFile?.(menu.file) }] : []),
        ];
        return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)}/>;
      })()}
    </aside>
  );
}
