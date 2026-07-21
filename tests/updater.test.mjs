import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preload = await readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const release = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("desktop updates remain manual and install only after download", () => {
  assert.match(main, /autoUpdater\.autoDownload = false/);
  assert.match(main, /updateStatus\.state !== "available"/);
  assert.match(main, /updateStatus\.state !== "ready"/);
  assert.match(main, /quitAndInstall\(false, true\)/);
  assert.doesNotMatch(main, /clearStorageData|clearCache/);
  assert.equal(pkg.build.appId, "com.ddcourse.player", "updates must retain the existing Electron userData identity");
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});

test("updater and local file IPC enforce the trusted renderer boundary", () => {
  for (const channel of ["updates:check", "updates:download", "updates:install", "course-file:reveal", "subtitle:read"]) {
    const handler = main.slice(main.indexOf(`ipcMain.handle("${channel}"`));
    assert.match(handler.slice(0, 220), /assertTrustedSender\(event\)/, `${channel} must verify its sender`);
  }
  assert.match(main, /fs\.promises\.realpath/);
  assert.match(main, /path\.relative\(root, target\)/);
  assert.match(main, /MAX_SUBTITLE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(main, /return new Uint8Array\(contents\)/);
  assert.match(preload, /removeListener\("updates:status", handler\)/);
});

test("release publishes updater metadata beside the NSIS installer", () => {
  assert.match(release, /release\/latest\.yml/);
  assert.match(release, /release\/DDCourse-Setup-\*\.exe\.blockmap/);
});
