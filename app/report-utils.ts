import { cleanName, idOf, timeLabel } from "./course-utils";
import type { Collection, ProgressMap, StudyBookmark, StudyNote } from "./types";

const escapeMarkdown = (value: string) => value.replace(/([\\`*_[\]{}()#+.!|>-])/g, "\\$1").replace(/\r?\n/g, "  \n");

export function createCollectionMarkdown(collection: Collection, progress: ProgressMap, notes: StudyNote[], bookmarks: StudyBookmark[]) {
  const fileIds = new Set(collection.files.map(idOf));
  const lines = [`# ${escapeMarkdown(collection.name)} 学习报告`, "", `导出时间：${new Date().toLocaleString("zh-CN")}`, ""];
  for (const file of collection.files) {
    const fileId = idOf(file), record = progress[fileId];
    const fileNotes = notes.filter(item => item.fileId === fileId).sort((a, b) => a.time - b.time);
    const fileBookmarks = bookmarks.filter(item => item.fileId === fileId).sort((a, b) => a.time - b.time);
    lines.push(`## ${escapeMarkdown(cleanName(file.name))}`, "", `- 状态：${record?.done ? "已完成" : "未完成"}`, `- 学习位置：${timeLabel(record?.time || 0)} / ${timeLabel(record?.duration || 0)}`, "");
    if (fileBookmarks.length) lines.push("### 收藏", "", ...fileBookmarks.map(item => `- **${timeLabel(item.time)}** ${escapeMarkdown(item.label || "重点")}`), "");
    if (fileNotes.length) lines.push("### 笔记", "", ...fileNotes.map(item => `- **${timeLabel(item.time)}** ${escapeMarkdown(item.text)}`), "");
  }
  const orphanCount = [...notes, ...bookmarks].filter(item => fileIds.has(item.fileId)).length;
  lines.splice(3, 0, `包含 ${collection.files.length} 节课程、${orphanCount} 条笔记与收藏。`, "");
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
