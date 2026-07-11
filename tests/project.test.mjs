import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { createProgressBackup, parseProgressBackup, progressBackupFilename } from "../app/progress-backup.mjs";

test("desktop build is configured as DDCourse", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "ddcourse");
  assert.equal(pkg.build.productName, "DDCourse");
  assert.match(pkg.build.artifactName, /^DDCourse-Setup-/);
});

test("desktop persistence and note management are wired", async () => {
  const [main, preload, page] = await Promise.all([
    readFile(new URL("../electron/main.cjs", import.meta.url), "utf8"),
    readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(main, /course-folder:restore/);
  assert.match(main, /notes:save/);
  assert.match(preload, /chooseFolder/);
  assert.match(page, /editNote/);
  assert.match(page, /deleteNote/);
  assert.match(page, /editBookmark/);
  assert.match(page, /deleteBookmark/);
});

test("required application icons exist", async () => {
  await Promise.all([
    access(new URL("../public/icons/icon-192.png", import.meta.url)),
    access(new URL("../public/icons/icon-512.png", import.meta.url)),
  ]);
});

test("progress backup round-trips using the documented versioned format", () => {
  const now = new Date("2026-07-11T08:30:00.000Z");
  const progress = {
    "lesson.mp4::100::200": {
      time: 42,
      duration: 120,
      done: false,
      updatedAt: now.toISOString(),
      speed: 1.25,
    },
  };
  const backup = createProgressBackup(progress, now);
  assert.deepEqual(parseProgressBackup(JSON.parse(JSON.stringify(backup))), backup);
  assert.equal(progressBackupFilename(now), "DDCourse-progress-2026-07-11.json");
});

test("progress import rejects wrong apps, versions, and malformed records", () => {
  assert.throws(() => parseProgressBackup({ app: "Other", progress: {} }));
  assert.throws(() => parseProgressBackup({ app: "DDCourse", formatVersion: 2, progress: {} }));
  assert.throws(() => parseProgressBackup({ app: "DDCourse", progress: { lesson: { time: -1 } } }));
});
