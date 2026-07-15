"use client";
/* eslint-disable @next/next/no-img-element -- shared renderer also runs in Electron without Next Image. */

import type { ChangeEvent, RefObject } from "react";
import { cleanName, idOf, timeLabel } from "../course-utils";
import type { Collection, CourseFile, ProgressMap } from "../types";

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
  onPlayFile: (file: CourseFile) => void;
  onShowNotes: () => void;
  onImportProgress: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportProgress: () => void;
  onReset: () => void;
};

export function CourseSidebar(props: Props) {
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

      {props.collections.length > 1 && <section className="collections"><div className="section-label"><span>课程合集</span><em>{props.collections.length}</em></div><div className="collection-row">{props.collections.map(collection => { const done = collection.files.filter(file => props.progress[idOf(file)]?.done).length; return <button key={collection.key} className={collection.key === props.current?.key ? "active" : ""} onClick={() => props.onCollectionChange(collection.key)}><strong>{collection.name}</strong><span><i style={{ width: `${collection.files.length ? done / collection.files.length * 100 : 0}%` }} /> </span><small>{done}/{collection.files.length}</small></button>; })}</div></section>}

      <section className="course-summary">
        <div className="summary-head"><div><span>课程进度</span><strong>{props.stats.done} / {props.files.length} 节</strong></div><b>{props.stats.pct}%</b></div>
        <div className="progress-track"><i style={{ width: `${props.stats.pct}%` }} /></div>
        <div className="study-stat"><span>本周专注</span><strong>{props.weekSeconds >= 3600 ? `${(props.weekSeconds / 3600).toFixed(1)} 小时` : `${Math.round(props.weekSeconds / 60)} 分钟`}</strong><small>Lv. 1 · 今天也在认真升级</small></div>
      </section>

      <section className="list-area">
        <div className="list-head"><div className="search"><span>⌕</span><input value={props.query} onChange={event => props.onQueryChange(event.target.value)} placeholder="搜索课程…" /></div><button className={props.unfinished ? "filter active" : "filter"} onClick={() => props.onUnfinishedChange(!props.unfinished)}>未完成</button></div>
        <div className="lesson-list">
          {!props.files.length && <div className="empty-list"><span>◫</span><strong>课程库还是空的</strong><p>选择一个课程文件夹，视频会自动按子文件夹整理。</p></div>}
          {props.files.filter(file => {
            const record = props.progress[idOf(file)];
            return cleanName(file.name).toLowerCase().includes(props.query.toLowerCase()) && (!props.unfinished || !record?.done);
          }).map(file => {
            const record = props.progress[idOf(file)];
            const isActive = idOf(file) === props.activeId;
            const pct = record?.duration ? Math.min(100, record.time / record.duration * 100) : 0;
            return <button key={idOf(file)} className={`lesson ${isActive ? "active" : ""} ${record?.done ? "done" : ""}`} onClick={() => props.onPlayFile(file)}><span className="lesson-state">{record?.done ? "✓" : String(props.files.indexOf(file) + 1).padStart(2, "0")}</span><span className="lesson-copy"><strong>{cleanName(file.name)}</strong><small>{record?.done ? "已完成" : record?.time ? `已学习 ${timeLabel(record.time)}` : "未开始"}</small><i><b style={{ width: `${record?.done ? 100 : pct}%` }} /></i></span><span className="lesson-time">{record?.duration ? timeLabel(record.duration) : ""}</span></button>;
          })}
        </div>
      </section>
      <footer className="library-footer"><button onClick={props.onShowNotes}>笔记位置</button><button onClick={() => props.importRef.current?.click()}>导入进度</button><button onClick={props.onExportProgress}>导出进度</button><button className="danger-text" onClick={props.onReset}>重置</button><input hidden ref={props.importRef} type="file" accept="application/json" onChange={props.onImportProgress} /></footer>
    </aside>
  );
}
