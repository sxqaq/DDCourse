"use client";
/* eslint-disable @next/next/no-img-element -- shared renderer also runs in Electron without Next Image. */

import type { ChangeEventHandler, Dispatch, RefObject, SetStateAction } from "react";
import { cleanName } from "../course-utils";
import type { AppearanceTheme } from "../hooks/useAppearance";
import type { CourseFile, ProgressMap, StudyBookmark, StudyNote } from "../types";
import { NotesPanel } from "./NotesPanel";
import { VideoPreviewBar } from "./VideoPreviewBar";

type Props = {
  collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void; currentName?: string; activeFile: CourseFile | null;
  installed: boolean; onInstall: () => void; appearanceOpen: boolean; setAppearanceOpen: Dispatch<SetStateAction<boolean>>;
  font: string; setFont: (font: string) => void; scale: number; setScale: (scale: number) => void; fontName: string; importFont: ChangeEventHandler<HTMLInputElement>;
  theme: AppearanceTheme; setTheme: (theme: AppearanceTheme) => void;
  isFullscreen: boolean; onToggleFullscreen: () => void; onPickFolder: () => void; videoRef: RefObject<HTMLVideoElement | null>;
  videoDuration: number; videoCurrentTime: number; videoSource: string; subtitleUrl: string; onJumpToTime: (time: number) => void; onVideoFullscreen: () => void;
  pipSupported: boolean; pipActive: boolean; onTogglePip: () => void;
  updaterVisible: boolean; updaterLabel: string; updaterDisabled: boolean; onUpdateAction: () => void;
  onLoaded: () => void; onTimeUpdate: (currentTime: number) => void; onPause: () => void; onEnded: () => void;
  progress: ProgressMap; notes: StudyNote[]; bookmarks: StudyBookmark[]; onShowNotes: () => void; onAddBookmark: () => void; onAddNote: () => void;
  onEditBookmark: (item: StudyBookmark) => void; onDeleteBookmark: (item: StudyBookmark) => void; onEditNote: (item: StudyNote) => void; onDeleteNote: (item: StudyNote) => void;
  activeIndex: number; filesLength: number; onAdjacent: (direction: number) => void; onStep: (direction: number) => void; onTogglePlayback: () => void;
  compressor: boolean; onToggleCompressor: () => void; speed: number; setSpeed: (speed: number) => void;
  viewingNotesFile: CourseFile | null; onCloseNotesView: () => void;
};

export function PlayerStage(props: Props) {
  return (
    <section className="stage">
      <header className="stage-top"><button className="collapse" onClick={() => props.onCollapsedChange(!props.collapsed)} aria-label="折叠课程库">{props.collapsed ? "›" : "‹"}</button><div><span>{props.currentName || "学习工作台"}</span><strong>{props.activeFile ? cleanName(props.activeFile.name) : "准备开始今天的课程"}</strong></div><div className="top-actions"><span className="local-badge">◆ LOCAL FIRST</span><span className="shortcut-hint"><kbd>空格</kbd> 播放 · <kbd>←</kbd><kbd>→</kbd> 快进退</span>{props.updaterVisible && <button className="install-button" disabled={props.updaterDisabled} onClick={props.onUpdateAction}>{props.updaterLabel}</button>}{!props.installed && <button className="install-button" onClick={props.onInstall}>↓ 安装应用</button>}<div className="appearance"><button className="fullscreen-button" onClick={() => props.setAppearanceOpen(value => !value)}>Aa 显示</button>{props.appearanceOpen && <div className="appearance-panel"><label>界面主题<select value={props.theme} onChange={event => props.setTheme(event.target.value as AppearanceTheme)}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label>界面字体<select value={props.font} onChange={event => props.setFont(event.target.value)}><option value="misans">MiSans（默认）</option><option value="system">系统无衬线</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option><option value="custom">{props.fontName}</option></select></label><label>导入本地字体<input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={props.importFont}/></label><label>界面字号<div className="scale-options">{[[.9,"小"],[1,"标准"],[1.1,"大"]].map(([value,label]) => <button key={String(value)} className={props.scale === value ? "active" : ""} onClick={() => props.setScale(Number(value))}>{label}</button>)}</div></label><p className="font-license">默认优先使用 MiSans。自定义字体仅保存在本机，不会上传；字体版权、商用、嵌入和再分发许可由用户自行确认，DDCourse 不授予第三方字体许可。</p></div>}</div><button className="fullscreen-button" onClick={props.onToggleFullscreen} title={props.isFullscreen ? "退出应用全屏" : "应用全屏"}>{props.isFullscreen ? "退出应用全屏" : "⛶ 应用全屏"}</button></div></header>
      <div className="player-wrap">
        {!props.activeFile && <div className="welcome"><div className="pixel-scene"><img src="./icons/icon-192.png" alt=""/><i className="pixel-star one"/><i className="pixel-star two"/></div><p className="eyebrow">READY TO LEARN?</p><h1>把本地课程，<br/><em>变成学习进度。</em></h1><p className="lead">DDCourse 会整理章节、记录重点、保存笔记，并在下次回来时从上次的位置继续。</p><button className="primary hero-button" onClick={props.onPickFolder}>打开课程文件夹 <span>→</span></button><p className="privacy">▣ Local First · 视频不会离开你的设备</p></div>}
        <video ref={props.videoRef} className={props.activeFile ? "visible" : ""} controls playsInline onLoadedMetadata={props.onLoaded} onTimeUpdate={event => props.onTimeUpdate(event.currentTarget.currentTime)} onPause={props.onPause} onEnded={props.onEnded}>{props.subtitleUrl && <track key={props.subtitleUrl} src={props.subtitleUrl} kind="subtitles" srcLang="zh" label="本地字幕" default/>}</video>
        {props.activeFile && props.videoSource && (
          <VideoPreviewBar className="video-preview-bar" src={props.videoSource} duration={props.videoDuration} currentTime={props.videoCurrentTime} onSeek={props.onJumpToTime}/>
        )}
        {(props.viewingNotesFile || props.activeFile) && (
          <NotesPanel activeFile={props.viewingNotesFile || props.activeFile!} duration={props.viewingNotesFile ? (props.progress[`${props.viewingNotesFile.webkitRelativePath || props.viewingNotesFile.name}::${props.viewingNotesFile.size}`]?.duration || 0) : props.videoDuration} onJump={props.onJumpToTime} progress={props.progress} notes={props.notes} bookmarks={props.bookmarks} onShowNotes={props.onShowNotes} onAddBookmark={props.onAddBookmark} onAddNote={props.onAddNote} onEditBookmark={props.onEditBookmark} onDeleteBookmark={props.onDeleteBookmark} onEditNote={props.onEditNote} onDeleteNote={props.onDeleteNote} readOnly={Boolean(props.viewingNotesFile && props.viewingNotesFile !== props.activeFile)} onClose={props.viewingNotesFile ? props.onCloseNotesView : undefined}/>
        )}
      </div>
      <div className="control-deck">
        <div className="transport"><button onClick={() => props.onAdjacent(-1)} disabled={props.activeIndex <= 0} aria-label="上一节">|‹</button><button onClick={() => props.onStep(-1)}>−10</button><button className="play" onClick={props.onTogglePlayback}>▶</button><button onClick={() => props.onStep(1)}>+10</button><button onClick={() => props.onAdjacent(1)} disabled={props.activeIndex < 0 || props.activeIndex >= props.filesLength - 1} aria-label="下一节">›|</button></div>
        <div className="tools"><button className="voice" onClick={props.onVideoFullscreen}>视频全屏</button>{props.pipSupported && <button className={`voice ${props.pipActive ? "on" : ""}`} onClick={props.onTogglePip}>画中画</button>}<button className={`voice ${props.compressor ? "on" : ""}`} onClick={props.onToggleCompressor}><i /> 人声增强</button><label className="speed"><span>播放速度</span><input type="range" min="0.5" max="3" step="0.05" value={props.speed} onChange={event => props.setSpeed(Number(event.target.value))}/><b>{props.speed.toFixed(2)}×</b></label></div>
      </div>
    </section>
  );
}
