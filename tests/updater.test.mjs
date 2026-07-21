import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
const preload = await readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const release = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const ci = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const upgradeSmoke = await readFile(new URL("../scripts/desktop-upgrade-smoke.mjs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("desktop updates remain manual and install only after download", () => {
  assert.match(main, /autoUpdater\.autoDownload = false/);
  assert.match(main, /autoUpdater\.autoInstallOnAppQuit = false/);
  assert.match(main, /updateStatus\.state !== "available"/);
  assert.match(main, /updateStatus\.state !== "ready"/);
  assert.match(main, /quitAndInstall\(false, true\)/);
  assert.doesNotMatch(main, /clearStorageData|clearCache/);
  assert.equal(pkg.build.appId, "com.ddcourse.player", "updates must retain the existing Electron userData identity");
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});

test("updater and local file IPC enforce the trusted renderer boundary", () => {
  for (const channel of ["updates:check", "updates:download", "updates:install", "course-file:reveal", "course-file:native-path", "subtitle:read"]) {
    const handler = main.slice(main.indexOf(`ipcMain.handle("${channel}"`));
    assert.match(handler.slice(0, 220), /assertTrustedSender\(event\)/, `${channel} must verify its sender`);
  }
  assert.match(main, /fs\.promises\.realpath/);
  assert.match(main, /path\.relative\(root, target\)/);
  assert.match(main, /MAX_SUBTITLE_BYTES = 2 \* 1024 \* 1024/);
  assert.match(main, /return new Uint8Array\(contents\)/);
  assert.match(preload, /removeListener\("updates:status", handler\)/);
  assert.match(preload, /getNativePath: nativeUrlOrPath => ipcRenderer\.invoke\("course-file:native-path", nativeUrlOrPath\)/);
  assert.match(page, /isDesktop \? await getNativePath\(source\) : nativePathLabel\(file\)/);
});

test("release publishes updater metadata beside the NSIS installer", () => {
  assert.match(release, /release\/latest\.yml/);
  assert.match(release, /release\/DDCourse-Setup-\*\.exe\.blockmap/);
  assert.match(release, /fetch-depth: 0/);
  assert.match(release, /merge-base --is-ancestor \$env:GITHUB_SHA origin\/main/);
  assert.match(release, /GITHUB_REF_NAME.*v\$packageVersion/);
  assert.match(release, /CHANGELOG\.md is missing release notes/);
  assert.match(release, /body_path: release\/release-notes\.md/);
});

test("pull requests exercise Electron on Windows and upgrades retain profile data", () => {
  assert.match(ci, /desktop-windows:[\s\S]*runs-on: windows-latest/);
  assert.match(ci, /npm run desktop:check/);
  assert.match(ci, /npm run desktop:bundle/);
  assert.match(ci, /npm run desktop:smoke:upgrade/);
  assert.match(upgradeSmoke, /DDCOURSE_OLD_EXECUTABLE/);
  assert.match(upgradeSmoke, /DDCOURSE_OLD_APP_DIR/);
  assert.match(upgradeSmoke, /localStorage\.setItem/);
  assert.match(upgradeSmoke, /assert\.deepEqual\(restored, persisted/);
  assert.match(upgradeSmoke, /saveNotes\(document\)/);
  assert.match(upgradeSmoke, /assert\.deepEqual\(restoredNotes, notesDocument/);
  assert.match(ci, /github\.event\.pull_request\.base\.sha \|\| github\.event\.before/);
  assert.match(ci, /DDCOURSE_OLD_APP_DIR/);
});
