"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { idOf } from "../course-utils";
import { readJson, writeJson } from "../storage";
import type { Collection, ProgressMap } from "../types";

const STORAGE_KEY = "ddcourse_collapsed_collections_v1";
type CollapsedFolders = Record<string, string[]>;
type ContextMenu = { key: string; x: number; y: number } | null;

type Props = {
  collections: Collection[];
  current?: Collection;
  folderName: string;
  progress: ProgressMap;
  onCollectionChange: (key: string) => void;
};

export function CollectionPicker({ collections, current, folderName, progress, onCollectionChange }: Props) {
  const [collapsedFolders, setCollapsedFolders] = useState<CollapsedFolders>(() => readJson(STORAGE_KEY, {}));
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const folderKey = folderName || "__default__";
  const collapsedKeys = useMemo(() => new Set(collapsedFolders[folderKey] || []), [collapsedFolders, folderKey]);
  const stats = useMemo(() => new Map(collections.map(collection => {
    const done = collection.files.filter(file => progress[idOf(file)]?.done).length;
    return [collection.key, { done, complete: collection.files.length > 0 && done === collection.files.length }];
  })), [collections, progress]);
  const visibleCollections = collections.filter(collection => !collapsedKeys.has(collection.key));
  const collapsedCollections = collections.filter(collection => collapsedKeys.has(collection.key));
  const completedVisible = visibleCollections.filter(collection => stats.get(collection.key)?.complete);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

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
    setContextMenu({ key, x: Math.min(x, window.innerWidth - 154), y: Math.min(y, window.innerHeight - 54) });
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
          className={`collection-card ${collection.key === current?.key ? "active" : ""} ${collectionStats.complete ? "complete" : ""}`}
          onClick={() => onCollectionChange(collection.key)}
          onContextMenu={event => onContextMenu(event, collection.key)}
          onKeyDown={event => onCollectionKeyDown(event, collection.key)}
          title={`${collection.name}；右键可收起`}
        >
          <strong>{collection.name}</strong>
          <span><i style={{ width: `${collection.files.length ? collectionStats.done / collection.files.length * 100 : 0}%` }} /></span>
          <small>{collectionStats.complete ? "已完成" : `${collectionStats.done}/${collection.files.length}`}</small>
        </button>;
      })}
    </div>}
    {collapsedCollections.length > 0 && <details className="collapsed-collections">
      <summary>已收起 {collapsedCollections.length} 个合集</summary>
      <div>{collapsedCollections.map(collection => <button key={collection.key} onClick={() => restore(collection.key)}>{collection.name}<span>展开</span></button>)}</div>
    </details>}
    {contextMenu && <div className="collection-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={event => event.stopPropagation()}>
      <button role="menuitem" onClick={() => collapse([contextMenu.key])}>收起此合集</button>
    </div>}
  </section>;
}
