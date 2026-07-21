const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { autoUpdater } = require("electron-updater");
const { createSerialQueue } = require("./serial-queue.cjs");
const notesSchema = import("../app/notes-schema.mjs");

app.setName("DDCourse");

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;
const SUBTITLE_RE = /\.(srt|vtt)$/i;
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const notesPath = () => path.join(app.getPath("documents"), "DDCourse", "学习笔记.json");
const MAX_NOTES_BYTES = 5 * 1024 * 1024;
const rendererPath = path.join(__dirname, "../desktop-dist/index.html");
const rendererUrl = pathToFileURL(rendererPath).href;

function assertTrustedSender(event) {
  if (event.senderFrame?.url !== rendererUrl) throw new Error("Untrusted IPC sender");
}

function nativePath(input) {
  if (typeof input !== "string" || !input.trim()) throw new Error("Invalid path");
  try { return new URL(input).protocol === "file:" ? fileURLToPath(input) : input; }
  catch (error) { if (/^[a-zA-Z]:[\\/]/.test(input)) return input; throw error; }
}

async function pathInsideLastFolder(input) {
  const rootSetting = readSettings().lastFolder;
  if (typeof rootSetting !== "string" || !rootSetting) throw new Error("No course folder is open");
  const root = await fs.promises.realpath(path.resolve(rootSetting));
  const target = await fs.promises.realpath(path.resolve(nativePath(input)));
  const relative = path.relative(root, target);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) return target;
  throw new Error("Path is outside the selected course folder");
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), "utf8")); } catch { return {}; }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

async function writeJsonAtomic(filePath, payload) {
  const data = JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(data, "utf8") > MAX_NOTES_BYTES) throw new Error("Notes payload is too large");
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.promises.writeFile(temporaryPath, data, "utf8");
  await fs.promises.rename(temporaryPath, filePath);
}

const queueNotesWrite = createSerialQueue(async payload => {
  const { parseNotesDocument } = await notesSchema;
  const validated = parseNotesDocument(payload);
  await writeJsonAtomic(notesPath(), validated);
  return notesPath();
});

async function scanFolder(root) {
  const files = [];
  const subtitlePaths = new Map();
  async function walk(folder) {
    let entries;
    try { entries = await fs.promises.readdir(folder, { withFileTypes: true }); }
    catch (error) { console.warn(`Skipping unreadable course folder: ${folder}`, error); return; }
    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(fullPath);
      else if (VIDEO_RE.test(entry.name)) {
        try {
          const stat = await fs.promises.stat(fullPath);
          files.push({
            name: entry.name,
            size: stat.size,
            lastModified: stat.mtimeMs,
            webkitRelativePath: path.relative(path.dirname(root), fullPath).split(path.sep).join("/"),
            nativeUrl: pathToFileURL(fullPath).href,
          });
        } catch (error) { console.warn(`Skipping unreadable course file: ${fullPath}`, error); }
      } else if (SUBTITLE_RE.test(entry.name)) {
        const key = path.join(path.dirname(fullPath), path.basename(fullPath, path.extname(fullPath))).toLocaleLowerCase("en-US");
        const existing = subtitlePaths.get(key);
        if (!existing || path.extname(fullPath).toLowerCase() === ".vtt") subtitlePaths.set(key, fullPath);
      }
    }
  }
  await walk(root);
  for (const file of files) {
    const videoPath = fileURLToPath(file.nativeUrl);
    const key = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath))).toLocaleLowerCase("en-US");
    const subtitlePath = subtitlePaths.get(key);
    if (subtitlePath) file.subtitleNativePath = subtitlePath;
  }
  files.sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath, "zh-CN", { numeric: true }));
  return { folderName: path.basename(root), folderPath: root, files };
}

ipcMain.handle("course-folder:choose", async event => {
  assertTrustedSender(event);
  const parent = BrowserWindow.fromWebContents(event.sender);
  const options = { properties: ["openDirectory"] };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  const folderPath = result.filePaths[0];
  saveSettings({ ...readSettings(), lastFolder: folderPath });
  return await scanFolder(folderPath);
});

ipcMain.handle("course-folder:restore", async event => {
  assertTrustedSender(event);
  const folderPath = readSettings().lastFolder;
  if (!folderPath || !fs.existsSync(folderPath)) return null;
  return await scanFolder(folderPath);
});

ipcMain.handle("notes:load", async event => {
  assertTrustedSender(event);
  try {
    const raw = JSON.parse(await fs.promises.readFile(notesPath(), "utf8"));
    const { parseNotesDocument } = await notesSchema;
    return parseNotesDocument(raw, { allowLegacy: true });
  }
  catch (error) { if (error?.code !== "ENOENT") console.warn("Unable to load notes", error); return null; }
});

ipcMain.handle("notes:save-and-show", async (event, payload) => {
  assertTrustedSender(event);
  const filePath = await queueNotesWrite(payload);
  shell.showItemInFolder(filePath);
  return filePath;
});

ipcMain.handle("notes:save", async (event, payload) => {
  assertTrustedSender(event);
  return await queueNotesWrite(payload);
});

ipcMain.handle("course-file:reveal", async (event, nativeUrlOrPath) => {
  assertTrustedSender(event);
  const target = await pathInsideLastFolder(nativeUrlOrPath);
  await fs.promises.access(target, fs.constants.F_OK);
  shell.showItemInFolder(target);
});

ipcMain.handle("course-file:native-path", async (event, nativeUrlOrPath) => {
  assertTrustedSender(event);
  // Convert in the main process so Node's fileURLToPath preserves UNC hosts
  // (file://server/share becomes \\server\share) on Windows.
  return await pathInsideLastFolder(nativeUrlOrPath);
});

ipcMain.handle("subtitle:read", async (event, nativeUrlOrPath) => {
  assertTrustedSender(event);
  const target = await pathInsideLastFolder(nativeUrlOrPath);
  if (!SUBTITLE_RE.test(target)) throw new Error("Unsupported subtitle file");
  const stat = await fs.promises.stat(target);
  if (!stat.isFile() || stat.size > MAX_SUBTITLE_BYTES) throw new Error("Subtitle file is too large");
  const contents = await fs.promises.readFile(target);
  if (contents.byteLength > MAX_SUBTITLE_BYTES) throw new Error("Subtitle file is too large");
  return new Uint8Array(contents);
});

let updateStatus = { state: "idle" };
let updateOperation;

function publishUpdateStatus(status) {
  updateStatus = status;
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:status", status);
}

function updaterErrorMessage(error) {
  console.warn("Desktop update failed", error);
  return "更新操作失败，请检查网络后重试。";
}

autoUpdater.autoDownload = false;
// Install only after the user explicitly requests it and the renderer saves data.
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on("checking-for-update", () => publishUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", info => publishUpdateStatus({ state: "available", version: info.version }));
autoUpdater.on("update-not-available", info => publishUpdateStatus({ state: "up-to-date", version: info.version }));
autoUpdater.on("download-progress", progress => publishUpdateStatus({
  state: "downloading",
  percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
}));
autoUpdater.on("update-downloaded", info => publishUpdateStatus({ state: "ready", version: info.version }));
autoUpdater.on("error", error => publishUpdateStatus({ state: "error", message: updaterErrorMessage(error) }));

ipcMain.handle("updates:check", async event => {
  assertTrustedSender(event);
  if (!app.isPackaged) {
    publishUpdateStatus({ state: "unsupported", message: "开发模式不会检查更新，请在正式安装版中使用。" });
    return;
  }
  if (updateOperation) return updateOperation;
  updateOperation = autoUpdater.checkForUpdates()
    .then(() => undefined)
    .catch(error => publishUpdateStatus({ state: "error", message: updaterErrorMessage(error) }))
    .finally(() => { updateOperation = undefined; });
  return updateOperation;
});

ipcMain.handle("updates:download", async event => {
  assertTrustedSender(event);
  if (!app.isPackaged) {
    publishUpdateStatus({ state: "unsupported", message: "开发模式不能下载应用更新。" });
    return;
  }
  if (updateStatus.state !== "available") throw new Error("No update is available");
  if (updateOperation) return updateOperation;
  updateOperation = autoUpdater.downloadUpdate()
    .then(() => undefined)
    .catch(error => publishUpdateStatus({ state: "error", message: updaterErrorMessage(error) }))
    .finally(() => { updateOperation = undefined; });
  return updateOperation;
});

ipcMain.handle("updates:install", event => {
  assertTrustedSender(event);
  if (!app.isPackaged) {
    publishUpdateStatus({ state: "unsupported", message: "开发模式不能安装应用更新。" });
    return;
  }
  if (updateStatus.state !== "ready") throw new Error("Update has not finished downloading");
  // NSIS replaces application binaries only. Electron userData and Documents/DDCourse remain untouched.
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: "#f8fafc",
    title: "DDCourse",
    icon: path.join(__dirname, "../public/icons/icon-512.png"),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(rendererPath);
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch { /* Deny malformed URLs. */ }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
}

app.whenReady().then(() => {
  const session = require("electron").session.defaultSession;
  session.setPermissionCheckHandler((_webContents, permission) => permission === "fullscreen");
  session.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "fullscreen"));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
