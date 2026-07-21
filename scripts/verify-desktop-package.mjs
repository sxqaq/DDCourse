import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extractFile, listPackage } = require("@electron/asar");
const archive = path.resolve(process.argv[2] || "release/win-unpacked/resources/app.asar");
const resources = path.dirname(archive);

await access(archive);
await access(path.join(resources, "app-update.yml"));
const entries = listPackage(archive).map(entry => entry.replaceAll("\\", "/").replace(/^\//, ""));
for (const required of ["electron/main.cjs", "electron/preload.cjs", "app/notes-schema.mjs", "desktop-dist/index.html"]) {
  assert(entries.includes(required), `Packaged desktop application is missing ${required}`);
}

const main = extractFile(archive, "electron/main.cjs").toString("utf8");
const schema = extractFile(archive, "app/notes-schema.mjs").toString("utf8");
assert.match(main, /import\("\.\.\/app\/notes-schema\.mjs"\)/);
assert.match(main, /autoUpdater\.autoDownload = false/);
assert.match(main, /autoUpdater\.autoInstallOnAppQuit = false/);
assert.match(main, /autoUpdater\.quitAndInstall\(false, true\)/);
assert.match(main, /pathInsideLastFolder/);
assert.match(schema, /export function parseNotesDocument/);
console.log("Packaged desktop contents verified, including update metadata, runtime notes schema, and guarded local-file IPC.");
