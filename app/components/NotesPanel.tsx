"use client";

import { idOf, timeLabel } from "../course-utils";
import type { CourseFile, ProgressMap, StudyBookmark, StudyNote } from "../types";

type Props = {
  activeFile: CourseFile;
  duration: number;
  onJump: (time: number) => void;
  progress: ProgressMap;
  bookmarks: StudyBookmark[];
  notes: StudyNote[];
  onShowNotes: () => void;
  onAddBookmark: () => void;
  onAddNote: () => void;
  onEditBookmark: (item: StudyBookmark) => void;
  onDeleteBookmark: (item: StudyBookmark) => void;
  onEditNote: (item: StudyNote) => void;
  onDeleteNote: (item: StudyNote) => void;
  readOnly?: boolean;
  onClose?: () => void;
};

export function NotesPanel(props: Props) {
  const fileId = idOf(props.activeFile);
  const bookmarks = props.bookmarks.filter(item => item.fileId === fileId);
  const notes = props.notes.filter(item => item.fileId === fileId);
  const progressRecord = props.progress[fileId];
  return (
    <div className="learning-map">
      <div className="map-head"><div><span>LEARNING MAP</span><strong>{props.readOnly ? `${props.activeFile.name} · 笔记浏览` : "学习地图"}</strong></div><div className="map-actions"><button onClick={props.onShowNotes}>⌖ 笔记位置</button>{!props.readOnly && <><button onClick={props.onAddBookmark}>★ 收藏重点</button><button onClick={props.onAddNote}>▤ 添加笔记</button></>}{props.onClose && <button onClick={props.onClose}>关闭浏览</button>}</div></div>
      <div className="map-track">
        <i className="learned" style={{ width: `${progressRecord?.duration ? Math.min(100, (progressRecord.time || 0) / progressRecord.duration * 100) : 0}%` }}/>
        {bookmarks.map(item => <button key={item.id} className="marker bookmark" style={{ left: `${props.duration ? item.time / props.duration * 100 : 0}%` }} onClick={() => props.onJump(item.time)} disabled={props.readOnly} title={`${item.label || "重点"} ${timeLabel(item.time)}`} aria-label={`跳到重点 ${item.label || "重点"} ${timeLabel(item.time)}`}/>)}
        {notes.map(note => <button key={note.id} className="marker note" style={{ left: `${props.duration ? note.time / props.duration * 100 : 0}%` }} onClick={() => props.onJump(note.time)} disabled={props.readOnly} title={note.text} aria-label={`跳到笔记 ${timeLabel(note.time)}`}/>)}
      </div>
      <div className="map-legend"><span><i className="blue"/>当前学习</span><span><i className="green"/>已学习</span><span><i className="yellow"/>收藏重点</span><span><i className="note-dot"/>课程笔记</span></div>
      <div className="marker-list">
        {bookmarks.map(item => <div className="marker-row" key={item.id}><button className="jump" onClick={() => props.onJump(item.time)} disabled={props.readOnly}><b>★ {timeLabel(item.time)}</b><span>{item.label || "重点"}</span></button><button onClick={() => props.onEditBookmark(item)}>编辑</button><button className="delete" onClick={() => props.onDeleteBookmark(item)}>删除</button></div>)}
        {notes.map(item => <div className="marker-row" key={item.id}><button className="jump" onClick={() => props.onJump(item.time)} disabled={props.readOnly}><b>▤ {timeLabel(item.time)}</b><span>{item.text}</span></button><button onClick={() => props.onEditNote(item)}>编辑</button><button className="delete" onClick={() => props.onDeleteNote(item)}>删除</button></div>)}
      </div>
    </div>
  );
}
