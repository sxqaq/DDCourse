"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createProgressBackup, normalizeProgressId, normalizeProgressMap, parseProgressBackup, progressBackupFilename, progressId, type ProgressMap } from "./progress-backup.mjs";

type CourseFile = {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
  webkitRelativePath?: string;
  nativeUrl?: string;
};
type DesktopFolder = { folderName: string; folderPath: string; files: CourseFile[] };
type StudyNote = { fileId: string; fileName: string; time: number; text: string; createdAt: string };
type StudyBookmark = { fileId: string; fileName: string; time: number; label?: string; createdAt: string };
type Collection = { key: string; name: string; files: CourseFile[] };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    ddcourseDesktop?: {
      chooseFolder: () => Promise<DesktopFolder | null>;
      restoreFolder: () => Promise<DesktopFolder | null>;
      saveAndShowNotes: (payload: unknown) => Promise<string>;
      saveNotes: (payload: unknown) => Promise<string>;
    };
  }
}

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;
const PROGRESS_KEY = "lumacourse_progress_v1";
const LAST_KEY = "lumacourse_last_v1";
const WEEK_KEY = "lumacourse_week_v1";
const SPEED_KEY = "lumacourse_speed_v1";
const SPEEDS: Record<string, number> = { KeyQ: 1, KeyW: 1.25, KeyE: 1.5, KeyR: 2 };

function pathOf(file: CourseFile) { return file.webkitRelativePath || file.name; }
function idOf(file: CourseFile) { return progressId(pathOf(file), file.size); }
function cleanName(name: string) { return name.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]*/, "").replace(/[_-]+/g, " "); }
function timeLabel(seconds = 0) {
  if (!Number.isFinite(seconds)) return "--:--";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function mondayKey() {
  const d = new Date(); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef("");
  const lastTickRef = useRef(0);
  const lastWeekSaveRef = useRef(0);
  const [allFiles, setAllFiles] = useState<CourseFile[]>([]);
  const [collectionKey, setCollectionKey] = useState("");
  const [activeId, setActiveId] = useState("");
  const [progress, setProgress] = useState<ProgressMap>(() => normalizeProgressMap(readJson(PROGRESS_KEY, {})));
  const progressRef = useRef(progress);
  const [query, setQuery] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && localStorage.getItem("lumacourse_sidebar") === "1");
  const [folderName, setFolderName] = useState("");
  const [speed, setSpeed] = useState(() => typeof window === "undefined" ? 1 : Number(localStorage.getItem(SPEED_KEY)) || 1);
  const [compressor, setCompressor] = useState(false);
  const [weekSeconds, setWeekSeconds] = useState(() => {
    const week = readJson<{ week: string; seconds: number }>(WEEK_KEY, { week: mondayKey(), seconds: 0 });
    return week.week === mondayKey() ? week.seconds : 0;
  });
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || navigator.userAgent.includes("Electron")));
  const [bookmarks, setBookmarks] = useState<StudyBookmark[]>(() => readJson<StudyBookmark[]>("ddcourse_bookmarks_v1", []).map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) })));
  const [notes, setNotes] = useState<StudyNote[]>(() => readJson<StudyNote[]>("ddcourse_notes_v1", []).map(item => ({ ...item, fileId: normalizeProgressId(item.fileId) })));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const notesReadyRef = useRef(false);
  const audioRef = useRef<{ ctx: AudioContext; node: DynamicsCompressorNode } | null>(null);

  useEffect(() => { notesReadyRef.current = true; }, []);

  useEffect(() => {
    if (!notesReadyRef.current || !window.ddcourseDesktop) return;
    window.ddcourseDesktop.saveNotes({ app: "DDCourse", updatedAt: new Date().toISOString(), folder: folderName, notes, bookmarks }).catch(() => undefined);
  }, [notes, bookmarks, folderName]);

  useEffect(() => {
    const desktop = window.ddcourseDesktop;
    if (!desktop) return;
    // The restore callback runs asynchronously after all component callbacks are initialized.
    // eslint-disable-next-line react-hooks/immutability
    desktop.restoreFolder().then(result => { if (result?.files.length) loadDesktopFolder(result); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const complete = () => { setInstalled(true); setInstallPrompt(null); setNotice("DDCourse 已安装完成"); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      setNotice("请使用 Chrome 或 Edge 的“安装此应用”功能");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  const collections = useMemo<Collection[]>(() => {
    const map = new Map<string, CourseFile[]>();
    allFiles.forEach(file => {
      const parts = pathOf(file).split(/[\\/]/).filter(Boolean);
      const key = parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程";
      map.set(key, [...(map.get(key) || []), file]);
    });
    return [...map.entries()].map(([key, files]) => ({ key, name: key.split("/").pop() || key, files }));
  }, [allFiles]);
  const current = collections.find(c => c.key === collectionKey) || collections[0];
  const files = current?.files || [];
  const activeIndex = files.findIndex(f => idOf(f) === activeId);
  const activeFile = activeIndex >= 0 ? files[activeIndex] : null;
  const visibleFiles = files.filter(file => {
    const record = progress[idOf(file)];
    return cleanName(file.name).toLowerCase().includes(query.toLowerCase()) && (!unfinished || !record?.done);
  });
  const stats = useMemo(() => {
    const duration = files.reduce((sum, f) => sum + (progress[idOf(f)]?.duration || 0), 0);
    const watched = files.reduce((sum, f) => { const r = progress[idOf(f)]; return sum + (r?.done ? r.duration : Math.min(r?.time || 0, r?.duration || Infinity)); }, 0);
    const done = files.filter(f => progress[idOf(f)]?.done).length;
    return { done, duration, pct: duration ? Math.min(100, Math.round(watched / duration * 100)) : files.length ? Math.round(done / files.length * 100) : 0 };
  }, [files, progress]);

  const persist = useCallback((next: ProgressMap) => { progressRef.current = next; setProgress(next); localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); }, []);
  const recordCurrent = useCallback((forceDone = false) => {
    const video = videoRef.current; if (!video || !activeFile) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const time = video.currentTime || 0;
    const next = { ...progressRef.current, [idOf(activeFile)]: { time, duration, done: forceDone || (duration > 0 && time / duration >= .9), updatedAt: new Date().toISOString(), speed } };
    persist(next);
  }, [activeFile, speed, persist]);

  const playFile = useCallback((file: CourseFile) => {
    recordCurrent();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = file.nativeUrl || URL.createObjectURL(file as unknown as Blob);
    setActiveId(idOf(file));
    localStorage.setItem(LAST_KEY, JSON.stringify({ collection: current?.key, id: idOf(file) }));
    requestAnimationFrame(() => {
      const video = videoRef.current; if (!video) return;
      video.src = objectUrlRef.current;
      video.load();
      video.play().catch(() => undefined);
    });
  }, [current?.key, recordCurrent]);

  const loadFiles = useCallback((list: FileList | File[]) => {
    const next = Array.from(list).filter(f => f.type.startsWith("video/") || VIDEO_RE.test(f.name)) as CourseFile[];
    next.sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    if (!next.length) { setNotice("没有找到可播放的视频文件"); return; }
    setAllFiles(next); setActiveId("");
    const firstPath = pathOf(next[0]).split(/[\\/]/); setFolderName(firstPath.length > 1 ? firstPath[0] : `${next.length} 个视频`);
    const firstParts = pathOf(next[0]).split(/[\\/]/).filter(Boolean);
    setCollectionKey(firstParts.length > 1 ? firstParts.slice(0, -1).join("/") : "全部课程");
    setNotice(`已载入 ${next.length} 个视频`); setTimeout(() => setNotice(""), 2400);
  }, []);

  const loadDesktopFolder = (result: DesktopFolder) => {
    const next = [...result.files].sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    setAllFiles(next); setActiveId(""); setFolderName(result.folderName);
    const parts = pathOf(next[0]).split(/[\\/]/).filter(Boolean);
    setCollectionKey(parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程");
    setNotice(`已恢复课程文件夹：${result.folderName}`); setTimeout(() => setNotice(""), 2400);
  };

  const pickFolder = async () => {
    if (window.ddcourseDesktop) {
      const result = await window.ddcourseDesktop.chooseFolder();
      if (result?.files.length) loadDesktopFolder(result);
      else if (result) setNotice("这个文件夹里没有可播放的视频");
      return;
    }
    folderRef.current?.click();
  };

  useEffect(() => {
    if (!current || activeId) return;
    const last = readJson<{ collection: string; id: string } | null>(LAST_KEY, null);
    const resume = current.files.find(f => idOf(f) === normalizeProgressId(last?.id || "") && !progress[idOf(f)]?.done) || current.files.find(f => (progress[idOf(f)]?.time || 0) > 0 && !progress[idOf(f)]?.done);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resume) setNotice(`可继续播放：${cleanName(resume.name)}`);
  }, [current, activeId, progress]);

  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = speed; localStorage.setItem(SPEED_KEY, String(speed)); }, [speed]);
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const onLoaded = () => {
    const video = videoRef.current; if (!video || !activeFile) return;
    const r = progress[idOf(activeFile)]; if (r?.time > 3 && r.time < video.duration - 5) video.currentTime = r.time;
    video.playbackRate = r?.speed || speed;
    const next = { ...progress, [idOf(activeFile)]: { ...(r || { time: 0, done: false, updatedAt: new Date().toISOString() }), duration: video.duration } }; persist(next);
  };
  const addWeekTime = () => {
    const video = videoRef.current; if (!video) return;
    const now = video.currentTime, delta = now - lastTickRef.current; lastTickRef.current = now;
    if (delta > 0 && delta < 2) setWeekSeconds(prev => {
      const next = prev + delta;
      const timestamp = Date.now();
      if (timestamp - lastWeekSaveRef.current >= 5000) {
        localStorage.setItem(WEEK_KEY, JSON.stringify({ week: mondayKey(), seconds: next }));
        lastWeekSaveRef.current = timestamp;
      }
      return next;
    });
  };
  const step = (dir: number) => { const v = videoRef.current; if (v && Number.isFinite(v.duration)) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + dir * 10)); };
  const adjacent = (dir: number) => { const target = files[activeIndex + dir]; if (target) playFile(target); };
  const toggleCompressor = () => {
    const video = videoRef.current; if (!video) return;
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx(), source = ctx.createMediaElementSource(video), node = ctx.createDynamicsCompressor();
        node.threshold.value = -26; node.knee.value = 18; node.ratio.value = 5; node.attack.value = .01; node.release.value = .22;
        source.connect(node); node.connect(ctx.destination); audioRef.current = { ctx, node };
      }
      audioRef.current.ctx.resume(); setCompressor(v => !v);
      audioRef.current.node.threshold.value = compressor ? 0 : -26;
    } catch { setNotice("当前浏览器无法启用人声增强"); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input,textarea,[contenteditable=true]")) return;
      if (SPEEDS[e.code]) { e.preventDefault(); setSpeed(SPEEDS[e.code]); return; }
      if (!activeFile) return;
      if (e.code === "Space") { e.preventDefault(); const v = videoRef.current!; if (v.paused) v.play(); else v.pause(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.code === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.code === "BracketLeft" || e.code === "KeyP") adjacent(-1);
      if (e.code === "BracketRight" || e.code === "KeyN") adjacent(1);
    };
    document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler);
  });

  const exportProgress = () => {
    const now = new Date();
    const data = JSON.stringify(createProgressBackup(progress, now), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = progressBackupFilename(now);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice("学习进度备份已导出");
  };
  const importProgress = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const backup = parseProgressBackup(JSON.parse(await file.text()));
      const next = { ...progressRef.current, ...backup.progress };
      persist(next);
      if (activeFile && videoRef.current) {
        const imported = next[idOf(activeFile)];
        if (imported) {
          const video = videoRef.current;
          if (imported.time >= 0 && (!Number.isFinite(video.duration) || imported.time <= video.duration)) video.currentTime = imported.time;
          if (imported.speed) { video.playbackRate = imported.speed; setSpeed(imported.speed); }
        }
      }
      setNotice(`学习进度已成功导入（${Object.keys(backup.progress).length} 条）`);
    } catch {
      setNotice("这不是有效的 DDCourse 进度文件");
    } finally {
      e.target.value = "";
    }
  };
  const resetCurrent = () => { if (!current || !confirm(`清空“${current.name}”的全部播放进度？`)) return; const next = { ...progress }; current.files.forEach(f => delete next[idOf(f)]); persist(next); };
  const addBookmark = () => {
    const time = videoRef.current?.currentTime || 0;
    if (!activeFile) return;
    setBookmarks(items => { const next = [...items, { fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, label: "重点", createdAt: new Date().toISOString() }]; localStorage.setItem("ddcourse_bookmarks_v1", JSON.stringify(next)); return next; });
    setNotice(`已收藏 ${timeLabel(time)} 的知识点`);
  };
  const editBookmark = (item: StudyBookmark) => {
    const label = prompt("修改重点名称：", item.label || "重点"); if (!label?.trim()) return;
    setBookmarks(items => { const next = items.map(current => current.createdAt === item.createdAt ? { ...current, label: label.trim() } : current); localStorage.setItem("ddcourse_bookmarks_v1", JSON.stringify(next)); return next; });
  };
  const deleteBookmark = (item: StudyBookmark) => {
    if (!confirm(`删除 ${timeLabel(item.time)} 的重点“${item.label || "重点"}”？`)) return;
    setBookmarks(items => { const next = items.filter(current => current.createdAt !== item.createdAt); localStorage.setItem("ddcourse_bookmarks_v1", JSON.stringify(next)); return next; });
  };
  const editNote = (item: StudyNote) => {
    const text = prompt("修改笔记：", item.text); if (!text?.trim()) return;
    setNotes(items => { const next = items.map(current => current.createdAt === item.createdAt ? { ...current, text: text.trim() } : current); localStorage.setItem("ddcourse_notes_v1", JSON.stringify(next)); return next; });
  };
  const deleteNote = (item: StudyNote) => {
    if (!confirm(`删除 ${timeLabel(item.time)} 的这条笔记？`)) return;
    setNotes(items => { const next = items.filter(current => current.createdAt !== item.createdAt); localStorage.setItem("ddcourse_notes_v1", JSON.stringify(next)); return next; });
  };
  const addNote = () => {
    const text = prompt("记录这一刻的想法：");
    if (!text?.trim()) return;
    if (!activeFile) return;
    const time = videoRef.current?.currentTime || 0;
    setNotes(items => { const next = [...items, { fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, text: text.trim(), createdAt: new Date().toISOString() }]; localStorage.setItem("ddcourse_notes_v1", JSON.stringify(next)); return next; });
    setNotice("笔记已添加到学习地图");
  };
  const showNotesLocation = async () => {
    const payload = { app: "DDCourse", exportedAt: new Date().toISOString(), folder: folderName, notes, bookmarks };
    if (window.ddcourseDesktop) {
      const location = await window.ddcourseDesktop.saveAndShowNotes(payload);
      setNotice(`笔记已保存：${location}`);
      return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); a.download = "DDCourse-学习笔记.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); };

  return (
    <main className={`shell ${collapsed ? "is-collapsed" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      {dragging && <div className="dropzone"><div><span>＋</span><strong>松开以载入课程视频</strong><small>支持 MP4、WebM、MOV、MKV 等格式</small></div></div>}
      <aside className="library">
        <header className="brand"><img className="brand-mark" src="./icons/icon-192.png" alt="DDCourse"/><div><strong>DDCourse</strong><span>Learning Player</span></div></header>
        <section className="pick-area">
          <button className="primary" onClick={pickFolder}><span>＋</span>{folderName ? "更换文件夹" : "选择课程文件夹"}</button>
          <button className="ghost compact" onClick={() => filesRef.current?.click()}>选择视频</button>
          <input ref={folderRef} hidden type="file" multiple {...({ webkitdirectory: "" } as object)} onChange={e => e.target.files && loadFiles(e.target.files)} />
          <input ref={filesRef} hidden type="file" multiple accept="video/*,.mkv,.avi" onChange={e => e.target.files && loadFiles(e.target.files)} />
          {folderName && <div className="folder-name"><span>▱</span><b>{folderName}</b><small>{allFiles.length} 个视频</small></div>}
        </section>

        {collections.length > 1 && <section className="collections"><div className="section-label"><span>课程合集</span><em>{collections.length}</em></div><div className="collection-row">{collections.map(c => { const done = c.files.filter(f => progress[idOf(f)]?.done).length; return <button key={c.key} className={c.key === current?.key ? "active" : ""} onClick={() => { setCollectionKey(c.key); setActiveId(""); }}><strong>{c.name}</strong><span><i style={{ width: `${c.files.length ? done / c.files.length * 100 : 0}%` }} /> </span><small>{done}/{c.files.length}</small></button>; })}</div></section>}

        <section className="course-summary">
          <div className="summary-head"><div><span>课程进度</span><strong>{stats.done} / {files.length} 节</strong></div><b>{stats.pct}%</b></div>
          <div className="progress-track"><i style={{ width: `${stats.pct}%` }} /></div>
          <div className="study-stat"><span>本周专注</span><strong>{weekSeconds >= 3600 ? `${(weekSeconds / 3600).toFixed(1)} 小时` : `${Math.round(weekSeconds / 60)} 分钟`}</strong><small>Lv. 1 · 今天也在认真升级</small></div>
        </section>

        <section className="list-area">
          <div className="list-head"><div className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索课程…" /></div><button className={unfinished ? "filter active" : "filter"} onClick={() => setUnfinished(v => !v)}>未完成</button></div>
          <div className="lesson-list">
            {!files.length && <div className="empty-list"><span>◫</span><strong>课程库还是空的</strong><p>选择一个课程文件夹，视频会自动按子文件夹整理。</p></div>}
            {visibleFiles.map((file, index) => { const r = progress[idOf(file)]; const isActive = idOf(file) === activeId; const pct = r?.duration ? Math.min(100, r.time / r.duration * 100) : 0; return <button key={idOf(file)} className={`lesson ${isActive ? "active" : ""} ${r?.done ? "done" : ""}`} onClick={() => playFile(file)}><span className="lesson-state">{r?.done ? "✓" : String(files.indexOf(file) + 1).padStart(2, "0")}</span><span className="lesson-copy"><strong>{cleanName(file.name)}</strong><small>{r?.done ? "已完成" : r?.time ? `已学习 ${timeLabel(r.time)}` : "未开始"}</small><i><b style={{ width: `${r?.done ? 100 : pct}%` }} /></i></span><span className="lesson-time">{r?.duration ? timeLabel(r.duration) : ""}</span></button>; })}
          </div>
        </section>
        <footer className="library-footer"><button onClick={showNotesLocation}>笔记位置</button><button onClick={() => importRef.current?.click()}>导入进度</button><button onClick={exportProgress}>导出进度</button><button className="danger-text" onClick={resetCurrent}>重置</button><input hidden ref={importRef} type="file" accept="application/json" onChange={importProgress} /></footer>
      </aside>

      <section className="stage">
        <header className="stage-top"><button className="collapse" onClick={() => { setCollapsed(v => { localStorage.setItem("lumacourse_sidebar", !v ? "1" : "0"); return !v; }); }} aria-label="折叠课程库">{collapsed ? "›" : "‹"}</button><div><span>{current?.name || "学习工作台"}</span><strong>{activeFile ? cleanName(activeFile.name) : "准备开始今天的课程"}</strong></div><div className="top-actions"><span className="local-badge">◆ LOCAL FIRST</span><span className="shortcut-hint"><kbd>空格</kbd> 播放 · <kbd>←</kbd><kbd>→</kbd> 快进退</span>{!installed && <button className="install-button" onClick={installApp}>↓ 安装应用</button>}<button className="fullscreen-button" onClick={toggleFullscreen} title={isFullscreen ? "退出全屏" : "全屏"}>{isFullscreen ? "退出全屏" : "⛶ 全屏"}</button></div></header>
        <div className="player-wrap">
          {!activeFile && <div className="welcome"><div className="pixel-scene"><img src="./icons/icon-192.png" alt=""/><i className="pixel-star one"/><i className="pixel-star two"/></div><p className="eyebrow">READY TO LEARN?</p><h1>把本地课程，<br/><em>变成学习进度。</em></h1><p className="lead">DDCourse 会整理章节、记录重点、保存笔记，并在下次回来时从上次的位置继续。</p><button className="primary hero-button" onClick={pickFolder}>打开课程文件夹 <span>→</span></button><p className="privacy">▣ Local First · 视频不会离开你的设备</p></div>}
          <video ref={videoRef} className={activeFile ? "visible" : ""} controls playsInline onLoadedMetadata={onLoaded} onTimeUpdate={addWeekTime} onPause={() => recordCurrent()} onEnded={() => { recordCurrent(true); adjacent(1); }} />
          {activeFile && <div className="learning-map"><div className="map-head"><div><span>LEARNING MAP</span><strong>学习地图</strong></div><div className="map-actions"><button onClick={showNotesLocation}>⌖ 笔记位置</button><button onClick={addBookmark}>★ 收藏重点</button><button onClick={addNote}>▤ 添加笔记</button></div></div><div className="map-track"><i className="learned" style={{width:`${progress[idOf(activeFile)]?.duration ? Math.min(100,(progress[idOf(activeFile)]?.time || 0)/(progress[idOf(activeFile)]?.duration || 1)*100) : 0}%`}}/>{bookmarks.filter(item=>item.fileId===idOf(activeFile)).map((item,index)=><button key={`b-${index}`} className="marker bookmark" style={{left:`${videoRef.current?.duration ? item.time/videoRef.current.duration*100 : 0}%`}} onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}} title={`${item.label || "重点"} ${timeLabel(item.time)}`}/>)}{notes.filter(note=>note.fileId===idOf(activeFile)).map((note,index)=><button key={`n-${index}`} className="marker note" style={{left:`${videoRef.current?.duration ? note.time/videoRef.current.duration*100 : 0}%`}} onClick={()=>{if(videoRef.current)videoRef.current.currentTime=note.time}} title={note.text}/>)}</div><div className="map-legend"><span><i className="blue"/>当前学习</span><span><i className="green"/>已学习</span><span><i className="yellow"/>收藏重点</span><span><i className="note-dot"/>课程笔记</span></div><div className="marker-list">{bookmarks.filter(item=>item.fileId===idOf(activeFile)).map(item=><div className="marker-row" key={item.createdAt}><button className="jump" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}}><b>★ {timeLabel(item.time)}</b><span>{item.label || "重点"}</span></button><button onClick={()=>editBookmark(item)}>编辑</button><button className="delete" onClick={()=>deleteBookmark(item)}>删除</button></div>)}{notes.filter(item=>item.fileId===idOf(activeFile)).map(item=><div className="marker-row" key={item.createdAt}><button className="jump" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}}><b>▤ {timeLabel(item.time)}</b><span>{item.text}</span></button><button onClick={()=>editNote(item)}>编辑</button><button className="delete" onClick={()=>deleteNote(item)}>删除</button></div>)}</div></div>}
        </div>
        <div className="control-deck">
          <div className="transport"><button onClick={() => adjacent(-1)} disabled={activeIndex <= 0} aria-label="上一节">|‹</button><button onClick={() => step(-1)}>−10</button><button className="play" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) v.play(); else v.pause(); }}>▶</button><button onClick={() => step(1)}>+10</button><button onClick={() => adjacent(1)} disabled={activeIndex < 0 || activeIndex >= files.length - 1} aria-label="下一节">›|</button></div>
          <div className="tools"><button className={`voice ${compressor ? "on" : ""}`} onClick={toggleCompressor}><i /> 人声增强</button><label className="speed"><span>播放速度</span><input type="range" min="0.5" max="3" step="0.05" value={speed} onChange={e => setSpeed(Number(e.target.value))}/><b>{speed.toFixed(2)}×</b></label></div>
        </div>
      </section>
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
