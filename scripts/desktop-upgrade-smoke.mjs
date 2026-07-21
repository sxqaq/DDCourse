import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const oldExecutable = process.env.DDCOURSE_OLD_EXECUTABLE;
const newExecutable = process.env.DDCOURSE_NEW_EXECUTABLE;
const oldAppDir = process.env.DDCOURSE_OLD_APP_DIR;
const newAppDir = process.env.DDCOURSE_NEW_APP_DIR;
if (Boolean(oldExecutable) !== Boolean(newExecutable) || Boolean(oldAppDir) !== Boolean(newAppDir) || (oldExecutable && oldAppDir)) {
  throw new Error("Set one complete old/new executable pair, one complete old/new app-directory pair, or neither.");
}

const profile = await mkdtemp(path.join(os.tmpdir(), "ddcourse-upgrade-"));
const persisted = {
  lumacourse_progress_v1: JSON.stringify({ "Course/lesson.mp4::1": { time: 123, duration: 600, done: false, updatedAt: "2026-01-01T00:00:00.000Z" } }),
  ddcourse_collection_names_v1: JSON.stringify({ Course: "My course" }),
  ddcourse_hidden_files_v1: JSON.stringify(["Course/hidden.mp4::3"]),
  lumacourse_last_v1: JSON.stringify({ collection: "Course", id: "Course/lesson.mp4::1" }),
};
const notesDocument = {
  app: "DDCourse",
  updatedAt: "2026-01-01T00:00:00.000Z",
  folder: "Course",
  notes: [{ id: "note-1", fileId: "Course/lesson.mp4::1", fileName: "lesson", time: 123, text: "keep me", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  bookmarks: [],
  deletions: [],
};

async function launch(executablePath, appDir) {
  const userDataArg = `--user-data-dir=${profile}`;
  if (executablePath) return electron.launch({ executablePath: path.resolve(executablePath), args: [userDataArg] });
  return electron.launch({ args: [path.resolve(appDir || "."), userDataArg] });
}

try {
  const before = await launch(oldExecutable, oldAppDir);
  try {
    const window = await before.firstWindow({ timeout: 30_000 });
    await window.waitForLoadState("domcontentloaded");
    await window.evaluate(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    }, persisted);
    await window.waitForTimeout(500);
    await window.evaluate(document => window.ddcourseDesktop.saveNotes(document), notesDocument);
  } finally {
    await before.close();
  }

  const after = await launch(newExecutable, newAppDir);
  try {
    const window = await after.firstWindow({ timeout: 30_000 });
    await window.waitForLoadState("domcontentloaded");
    const restored = await window.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(persisted));
    assert.deepEqual(restored, persisted, "an application upgrade must retain the existing Electron profile data");
    const restoredNotes = await window.evaluate(() => window.ddcourseDesktop.loadNotes());
    assert.deepEqual(restoredNotes, notesDocument, "an application upgrade must retain the desktop notes document");
  } finally {
    await after.close();
  }

  console.log(oldExecutable || oldAppDir
    ? "Desktop upgrade smoke passed with separate old and new application revisions."
    : "Desktop upgrade persistence contract passed across two application launches.");
} finally {
  await rm(profile, { recursive: true, force: true });
}
