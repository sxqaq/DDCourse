"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeProgressId, progressId } from "./progress-backup.mjs";
import { useDesktopBridge } from "./hooks/useDesktopBridge";
import { useAppearance } from "./hooks/useAppearance";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNotesAndBookmarks } from "./hooks/useNotesAndBookmarks";
import { usePlayer } from "./hooks/usePlayer";
import { useProgress } from "./hooks/useProgress";
import { useStudyTime } from "./hooks/useStudyTime";
import { readJson, STORAGE_KEYS } from "./storage";
import type { Collection, CourseFile, DesktopFolder, StudyBookmark, StudyNote } from "./types";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;

function pathOf(file: CourseFile) { return file.webkitRelativePath || file.name; }
function idOf(file: CourseFile) { return progressId(pathOf(file), file.size); }
function cleanName(name: string) { return name.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]*/, "").replace(/[_-]+/g, " "); }
function timeLabel(seconds = 0) {
  if (!Number.isFinite(seconds)) return "--:--";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
export default function Home() {
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [allFiles, setAllFiles] = useState<CourseFile[]>([]);
  const [collectionKey, setCollectionKey] = useState("");
  const [activeId, setActiveId] = useState("");
  const { progress, saveProgress, resetFiles, importProgress: importProgressFile, exportProgress: createProgressExport } = useProgress();
  const [query, setQuery] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && localStorage.getItem("lumacourse_sidebar") === "1");
  const [folderName, setFolderName] = useState("");
  const [folderMode, setFolderMode] = useState(false);
  const [speed, setSpeed] = useState(() => typeof window === "undefined" ? 1 : Number(localStorage.getItem(STORAGE_KEYS.speed)) || 1);
  const [compressor, setCompressor] = useState(false);
  const { weekSeconds, trackVideoTime } = useStudyTime();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || navigator.userAgent.includes("Electron")));
  const { notes, bookmarks, mergeDesktopData, addNote: storeNote, editNote: updateNote, deleteNote: removeNote, addBookmark: storeBookmark, editBookmark: updateBookmark, deleteBookmark: removeBookmark } = useNotesAndBookmarks();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { font, setFont, scale, setScale, fontName, importFont } = useAppearance();
  const notesReadyRef = useRef(false);
  const audioRef = useRef<{ ctx: AudioContext; node: DynamicsCompressorNode } | null>(null);
  const desktop = useDesktopBridge();
  const { isDesktop, restoreFolder, loadNotes, saveNotes, saveAndShowNotes, chooseFolder } = desktop;
  const mergeDesktopDataRef = useRef(mergeDesktopData);
  mergeDesktopDataRef.current = mergeDesktopData;

  useEffect(() => {
    if (!isDesktop) { notesReadyRef.current = true; return; }
    loadNotes().then(value => { if (value) mergeDesktopDataRef.current(value); notesReadyRef.current = true; }).catch(error => { console.error(error); setNotice("桌面笔记读取失败，本地缓存仍可使用"); notesReadyRef.current = true; });
  }, [isDesktop, loadNotes]);

  useEffect(() => {
    let reported = false;
    const report = () => { if (!reported) { reported = true; setNotice("本地存储空间不足或不可用，本次更改可能没有保存"); } };
    window.addEventListener("ddcourse:storage-error", report);
    return () => window.removeEventListener("ddcourse:storage-error", report);
  }, []);

  useEffect(() => {
    if (!notesReadyRef.current || !isDesktop) return;
    saveNotes({ app: "DDCourse", updatedAt: new Date().toISOString(), folder: folderName, notes, bookmarks }).catch(error => { console.error(error); setNotice("桌面笔记保存失败，请检查磁盘空间和目录权限"); });
  }, [notes, bookmarks, folderName, isDesktop, saveNotes]);

  useEffect(() => {
    if (!isDesktop) return;
    // The restore callback runs asynchronously after all component callbacks are initialized.
    // eslint-disable-next-line react-hooks/immutability
    restoreFolder().then(result => { if (result?.files.length) loadDesktopFolder(result); }).catch(() => undefined);
  }, [isDesktop, restoreFolder]);

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
  const files = useMemo(() => current?.files || [], [current]);
  const activeIndex = files.findIndex(f => idOf(f) === activeId);
  const activeFile = activeIndex >= 0 ? files[activeIndex] : null;
  const { videoRef, recordCurrent, savePeriodically, playFile, step, adjacent, togglePlayback, onLoaded } = usePlayer({ files, activeFile, activeIndex, collectionKey: current?.key, speed, setSpeed, progress, idOf, setActiveId, saveProgress });
  useKeyboardShortcuts({ enabled: Boolean(activeFile), togglePlayback, step, adjacent, setSpeed });
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

  const loadFiles = useCallback((list: FileList | File[], fromFolder = false) => {
    const next = Array.from(list).filter(f => f.type.startsWith("video/") || VIDEO_RE.test(f.name)) as CourseFile[];
    next.sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    if (!next.length) { setNotice("没有找到可播放的视频文件"); return; }
    setAllFiles(next); setActiveId(""); setFolderMode(fromFolder);
    const firstPath = pathOf(next[0]).split(/[\\/]/); setFolderName(firstPath.length > 1 ? firstPath[0] : `${next.length} 个视频`);
    const firstParts = pathOf(next[0]).split(/[\\/]/).filter(Boolean);
    setCollectionKey(firstParts.length > 1 ? firstParts.slice(0, -1).join("/") : "全部课程");
    setNotice(`已载入 ${next.length} 个视频`); setTimeout(() => setNotice(""), 2400);
  }, []);

  const loadDesktopFolder = (result: DesktopFolder) => {
    const next = [...result.files].sort((a, b) => pathOf(a).localeCompare(pathOf(b), "zh-CN", { numeric: true }));
    setAllFiles(next); setActiveId(""); setFolderName(result.folderName); setFolderMode(true);
    const parts = pathOf(next[0]).split(/[\\/]/).filter(Boolean);
    setCollectionKey(parts.length > 1 ? parts.slice(0, -1).join("/") : "全部课程");
    setNotice(`已恢复课程文件夹：${result.folderName}`); setTimeout(() => setNotice(""), 2400);
  };

  const pickFolder = async () => {
    if (isDesktop) {
      const result = await chooseFolder();
      if (result?.files.length) loadDesktopFolder(result);
      else if (result) setNotice("这个文件夹里没有可播放的视频");
      return;
    }
    folderRef.current?.click();
  };

  const refreshFolder = async () => {
    if (!folderMode) return pickFolder();
    if (isDesktop) {
      const result = await restoreFolder();
      if (result?.files.length) {
        const previousCount = allFiles.length;
        loadDesktopFolder(result);
        setNotice(result.files.length > previousCount ? `刷新完成，发现 ${result.files.length - previousCount} 个新视频` : `刷新完成，共 ${result.files.length} 个视频`);
      } else setNotice("当前文件夹里没有可播放的视频");
      return;
    }
    // Browsers do not retain reusable folder handles, so refreshing asks the user
    // to grant access to the same folder again.
    folderRef.current?.click();
  };

  useEffect(() => {
    if (!current || activeId) return;
    const last = readJson<{ collection: string; id: string } | null>(STORAGE_KEYS.last, null);
    const resume = current.files.find(f => idOf(f) === normalizeProgressId(last?.id || "") && !progress[idOf(f)]?.done) || current.files.find(f => (progress[idOf(f)]?.time || 0) > 0 && !progress[idOf(f)]?.done);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resume) setNotice(`可继续播放：${cleanName(resume.name)}`);
  }, [current, activeId, progress]);

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

  const exportProgress = () => {
    const { blob, filename } = createProgressExport();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("学习进度备份已导出");
  };
  const importProgress = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const result = await importProgressFile(file), next = result.progress;
      if (activeFile && videoRef.current) {
        const imported = next[idOf(activeFile)];
        if (imported) {
          const video = videoRef.current;
          if (imported.time >= 0 && (!Number.isFinite(video.duration) || imported.time <= video.duration)) video.currentTime = imported.time;
          if (imported.speed) { video.playbackRate = imported.speed; setSpeed(imported.speed); }
        }
      }
      setNotice(`学习进度已成功导入（${result.importedCount} 条）`);
    } catch {
      setNotice("这不是有效的 DDCourse 进度文件");
    } finally {
      e.target.value = "";
    }
  };
  const resetCurrent = () => { if (!current || !confirm(`清空“${current.name}”的全部播放进度？`)) return; resetFiles(current.files.map(idOf)); };
  const addBookmark = () => {
    const time = videoRef.current?.currentTime || 0;
    if (!activeFile) return;
    storeBookmark({ fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, label: "重点" });
    setNotice(`已收藏 ${timeLabel(time)} 的知识点`);
  };
  const editBookmark = (item: StudyBookmark) => {
    const label = prompt("修改重点名称：", item.label || "重点"); if (!label?.trim()) return;
    updateBookmark(item.id, { label: label.trim() });
  };
  const deleteBookmark = (item: StudyBookmark) => {
    if (!confirm(`删除 ${timeLabel(item.time)} 的重点“${item.label || "重点"}”？`)) return;
    removeBookmark(item.id);
  };
  const editNote = (item: StudyNote) => {
    const text = prompt("修改笔记：", item.text); if (!text?.trim()) return;
    updateNote(item.id, { text: text.trim() });
  };
  const deleteNote = (item: StudyNote) => {
    if (!confirm(`删除 ${timeLabel(item.time)} 的这条笔记？`)) return;
    removeNote(item.id);
  };
  const addNote = () => {
    const text = prompt("记录这一刻的想法：");
    if (!text?.trim()) return;
    if (!activeFile) return;
    const time = videoRef.current?.currentTime || 0;
    storeNote({ fileId: idOf(activeFile), fileName: cleanName(activeFile.name), time, text: text.trim() });
    setNotice("笔记已添加到学习地图");
  };
  const showNotesLocation = async () => {
    const payload = { app: "DDCourse", exportedAt: new Date().toISOString(), folder: folderName, notes, bookmarks };
    if (isDesktop) {
      const location = await saveAndShowNotes(payload);
      setNotice(`笔记已保存：${location}`);
      return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); a.download = "DDCourse-学习笔记.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
          <button className="primary" onClick={folderMode ? refreshFolder : pickFolder}><span>{folderMode ? "↻" : "＋"}</span>{folderMode ? "刷新" : "选择课程文件夹"}</button>
          <button className="ghost compact" onClick={folderMode ? pickFolder : () => filesRef.current?.click()}>{folderMode ? "更换文件夹" : "选择视频"}</button>
          <input ref={folderRef} hidden type="file" multiple {...({ webkitdirectory: "" } as object)} onChange={e => { if (e.target.files) loadFiles(e.target.files, true); e.target.value = ""; }} />
          <input ref={filesRef} hidden type="file" multiple accept="video/*,.mkv,.avi" onChange={e => { if (e.target.files) loadFiles(e.target.files, false); e.target.value = ""; }} />
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
            {visibleFiles.map(file => { const r = progress[idOf(file)]; const isActive = idOf(file) === activeId; const pct = r?.duration ? Math.min(100, r.time / r.duration * 100) : 0; return <button key={idOf(file)} className={`lesson ${isActive ? "active" : ""} ${r?.done ? "done" : ""}`} onClick={() => playFile(file)}><span className="lesson-state">{r?.done ? "✓" : String(files.indexOf(file) + 1).padStart(2, "0")}</span><span className="lesson-copy"><strong>{cleanName(file.name)}</strong><small>{r?.done ? "已完成" : r?.time ? `已学习 ${timeLabel(r.time)}` : "未开始"}</small><i><b style={{ width: `${r?.done ? 100 : pct}%` }} /></i></span><span className="lesson-time">{r?.duration ? timeLabel(r.duration) : ""}</span></button>; })}
          </div>
        </section>
        <footer className="library-footer"><button onClick={showNotesLocation}>笔记位置</button><button onClick={() => importRef.current?.click()}>导入进度</button><button onClick={exportProgress}>导出进度</button><button className="danger-text" onClick={resetCurrent}>重置</button><input hidden ref={importRef} type="file" accept="application/json" onChange={importProgress} /></footer>
      </aside>

      <section className="stage">
        <header className="stage-top"><button className="collapse" onClick={() => { setCollapsed(v => { localStorage.setItem("lumacourse_sidebar", !v ? "1" : "0"); return !v; }); }} aria-label="折叠课程库">{collapsed ? "›" : "‹"}</button><div><span>{current?.name || "学习工作台"}</span><strong>{activeFile ? cleanName(activeFile.name) : "准备开始今天的课程"}</strong></div><div className="top-actions"><span className="local-badge">◆ LOCAL FIRST</span><span className="shortcut-hint"><kbd>空格</kbd> 播放 · <kbd>←</kbd><kbd>→</kbd> 快进退</span>{!installed && <button className="install-button" onClick={installApp}>↓ 安装应用</button>}<div className="appearance"><button className="fullscreen-button" onClick={() => setAppearanceOpen(value => !value)}>Aa 显示</button>{appearanceOpen && <div className="appearance-panel"><label>界面字体<select value={font} onChange={event => setFont(event.target.value)}><option value="misans">MiSans（默认）</option><option value="system">系统无衬线</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option><option value="custom">{fontName}</option></select></label><label>导入本地字体<input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={importFont}/></label><label>界面字号<div className="scale-options">{[[.9,"小"],[1,"标准"],[1.1,"大"]].map(([value,label])=><button key={String(value)} className={scale===value?"active":""} onClick={()=>setScale(Number(value))}>{label}</button>)}</div></label><p className="font-license">默认优先使用 MiSans。自定义字体仅保存在本机，不会上传；字体版权、商用、嵌入和再分发许可由用户自行确认，DDCourse 不授予第三方字体许可。</p></div>}</div><button className="fullscreen-button" onClick={toggleFullscreen} title={isFullscreen ? "退出全屏" : "全屏"}>{isFullscreen ? "退出全屏" : "⛶ 全屏"}</button></div></header>
        <div className="player-wrap">
          {!activeFile && <div className="welcome"><div className="pixel-scene"><img src="./icons/icon-192.png" alt=""/><i className="pixel-star one"/><i className="pixel-star two"/></div><p className="eyebrow">READY TO LEARN?</p><h1>把本地课程，<br/><em>变成学习进度。</em></h1><p className="lead">DDCourse 会整理章节、记录重点、保存笔记，并在下次回来时从上次的位置继续。</p><button className="primary hero-button" onClick={pickFolder}>打开课程文件夹 <span>→</span></button><p className="privacy">▣ Local First · 视频不会离开你的设备</p></div>}
          <video ref={videoRef} className={activeFile ? "visible" : ""} controls playsInline onLoadedMetadata={onLoaded} onTimeUpdate={event => { trackVideoTime(event.currentTarget.currentTime); savePeriodically(); }} onPause={() => recordCurrent()} onEnded={() => { recordCurrent(true); adjacent(1); }} />
          {activeFile && <div className="learning-map"><div className="map-head"><div><span>LEARNING MAP</span><strong>学习地图</strong></div><div className="map-actions"><button onClick={showNotesLocation}>⌖ 笔记位置</button><button onClick={addBookmark}>★ 收藏重点</button><button onClick={addNote}>▤ 添加笔记</button></div></div><div className="map-track"><i className="learned" style={{width:`${progress[idOf(activeFile)]?.duration ? Math.min(100,(progress[idOf(activeFile)]?.time || 0)/(progress[idOf(activeFile)]?.duration || 1)*100) : 0}%`}}/>{bookmarks.filter(item=>item.fileId===idOf(activeFile)).map(item=><button key={item.id} className="marker bookmark" style={{left:`${videoRef.current?.duration ? item.time/videoRef.current.duration*100 : 0}%`}} onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}} title={`${item.label || "重点"} ${timeLabel(item.time)}`}/>)}{notes.filter(note=>note.fileId===idOf(activeFile)).map(note=><button key={note.id} className="marker note" style={{left:`${videoRef.current?.duration ? note.time/videoRef.current.duration*100 : 0}%`}} onClick={()=>{if(videoRef.current)videoRef.current.currentTime=note.time}} title={note.text}/>)}</div><div className="map-legend"><span><i className="blue"/>当前学习</span><span><i className="green"/>已学习</span><span><i className="yellow"/>收藏重点</span><span><i className="note-dot"/>课程笔记</span></div><div className="marker-list">{bookmarks.filter(item=>item.fileId===idOf(activeFile)).map(item=><div className="marker-row" key={item.id}><button className="jump" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}}><b>★ {timeLabel(item.time)}</b><span>{item.label || "重点"}</span></button><button onClick={()=>editBookmark(item)}>编辑</button><button className="delete" onClick={()=>deleteBookmark(item)}>删除</button></div>)}{notes.filter(item=>item.fileId===idOf(activeFile)).map(item=><div className="marker-row" key={item.id}><button className="jump" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=item.time}}><b>▤ {timeLabel(item.time)}</b><span>{item.text}</span></button><button onClick={()=>editNote(item)}>编辑</button><button className="delete" onClick={()=>deleteNote(item)}>删除</button></div>)}</div></div>}
        </div>
        <div className="control-deck">
          <div className="transport"><button onClick={() => adjacent(-1)} disabled={activeIndex <= 0} aria-label="上一节">|‹</button><button onClick={() => step(-1)}>−10</button><button className="play" onClick={togglePlayback}>▶</button><button onClick={() => step(1)}>+10</button><button onClick={() => adjacent(1)} disabled={activeIndex < 0 || activeIndex >= files.length - 1} aria-label="下一节">›|</button></div>
          <div className="tools"><button className={`voice ${compressor ? "on" : ""}`} onClick={toggleCompressor}><i /> 人声增强</button><label className="speed"><span>播放速度</span><input type="range" min="0.5" max="3" step="0.05" value={speed} onChange={e => setSpeed(Number(e.target.value))}/><b>{speed.toFixed(2)}×</b></label></div>
        </div>
      </section>
      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}
