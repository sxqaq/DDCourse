"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { idOf } from "../course-utils";
import { normalizeStringListRecord, readJson, writeJson } from "../storage";
import type { Collection, ProgressMap } from "../types";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

const STORAGE_KEY = "ddcourse_collapsed_collections_v1";
type CollapsedFolders = Record<string, string[]>;
type ContextMenu = { key: string; x: number; y: number } | null;

type Props = {
  collections: Collection[];
  current?: Collection;
  folderName: string;
  progress: ProgressMap;
  onCollectionChange: (key: string) => void;
  onRename: (collection: Collection) => void;
  onReset: (collection: Collection) => void;
  onReveal?: (collection: Collection) => void;
  onExportReport: (collection: Collection) => void;
  onTogglePinned: (collection: Collection) => void;
  onToggleSkipped: (collection: Collection) => void;
};

export function CollectionPicker({ collections, current, folderName, progress, onCollectionChange, onRename, onReset, onReveal, onExportReport, onTogglePinned, onToggleSkipped }: Props) {
  const [collapsedFolders, setCollapsedFolders] = useState<CollapsedFolders>(() => normalizeStringListRecord(readJson<unknown>(STORAGE_KEY, {})));
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const folderKey = folderName || "__default__";
  const collapsedKeys = useMemo(() => new Set(collapsedFolders[folderKey] || []), [collapsedFolders, folderKey]);
  const stats = useMemo(() => new Map(collections.map(collection => {
    const done = collection.allFiles.filter(file => progress[idOf(file)]?.done).length;
    return [collection.key, { done, complete: collection.allFiles.length > 0 && done === collection.allFiles.length }];
  })), [collections, progress]);
  const visibleCollections = collections.filter(collection => !collapsedKeys.has(collection.key));
  const collapsedCollections = collections.filter(collection => collapsedKeys.has(collection.key));
  const completedVisible = visibleCollections.filter(collection => stats.get(collection.key)?.complete);

  const saveCollapsed = (next: Set<string>) => {
    const nextFolders = { ...collapsedFolders, [folderKey]: [...next] };
    setCollapsedFolders(nextFolders);
    writeJson(STORAGE_KEY, nextFolders);
  };
  const collapse = (keys: string[]) => {
    const next = new Set(collapsedKeys);
    keys.forEach(key => next.add(key));
    saveCollapsed(next);
    setContextMenu(null);
  };
  const restore = (key: string) => {
    const next = new Set(collapsedKeys);
    next.delete(key);
    saveCollapsed(next);
    onCollectionChange(key);
  };
  const openContextMenu = (key: string, x: number, y: number) => {
    setContextMenu({ key, x, y });
  };
  const onContextMenu = (event: MouseEvent<HTMLButtonElement>, key: string) => {
    event.preventDefault();
    openContextMenu(key, event.clientX, event.clientY);
  };
  const onCollectionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenu(key, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return <section className="collections">
    <div className="section-label">
      <span>课程合集</span><em>{collections.length}</em>
      {completedVisible.length > 0 && <button className="collapse-completed" onClick={() => collapse(completedVisible.map(collection => collection.key))}>收起已完成</button>}
    </div>
    {visibleCollections.length > 0 && <div className="collection-grid">
      {visibleCollections.map(collection => {
        const collectionStats = stats.get(collection.key) || { done: 0, complete: false };
        return <button
          key={collection.key}
          className={`collection-card ${collection.key === current?.key ? "active" : ""} ${collectionStats.complete ? "complete" : ""} ${collection.skipped ? "skipped" : ""}`}
          onClick={() => onCollectionChange(collection.key)}
          onContextMenu={event => onContextMenu(event, collection.key)}
          onKeyDown={event => onCollectionKeyDown(event, collection.key)}
          title={`${collection.name}；右键打开合集操作`}
        >
          <strong>{collection.pinned ? "★ " : ""}{collection.name}</strong>
          <span><i style={{ width: `${collection.allFiles.length ? collectionStats.done / collection.allFiles.length * 100 : 0}%` }} /></span>
          <small>{collection.skipped ? "暂不学习" : collectionStats.complete ? "已完成" : `${collectionStats.done}/${collection.allFiles.length}`}</small>
        </button>;
      })}
    </div>}
    {collapsedCollections.length > 0 && <details className="collapsed-collections">
      <summary>已收起 {collapsedCollections.length} 个合集</summary>
      <div>{collapsedCollections.map(collection => <button key={collection.key} onClick={() => restore(collection.key)}>{collection.name}<span>展开</span></button>)}</div>
    </details>}
    {contextMenu && (() => {
      const collection = collections.find(item => item.key === contextMenu.key);
      if (!collection) return null;
      const items: ContextMenuItem[] = [
        { label: "重命名合集", onClick: () => onRename(collection) },
        { label: "重置该合集进度", onClick: () => onReset(collection), danger: true },
        ...(onReveal ? [{ label: "在文件管理器中定位", onClick: () => onReveal(collection) }] : []),
        { label: "导出学习报告（Markdown）", onClick: () => onExportReport(collection) },
        { label: collection.pinned ? "取消置顶" : "置顶合集", onClick: () => onTogglePinned(collection) },
        { label: collection.skipped ? "恢复学习并计入进度" : "暂不学习（不计总体进度）", onClick: () => onToggleSkipped(collection) },
        { label: "收起此合集", onClick: () => collapse([collection.key]) },
      ];
      return <ContextMenu x={contextMenu.x} y={contextMenu.y} items={items} onClose={() => setContextMenu(null)}/>;
    })()}
  </section>;
}
