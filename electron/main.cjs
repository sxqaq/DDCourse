const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createSerialQueue } = require("./serial-queue.cjs");
const notesSchema = import("../app/notes-schema.mjs");

app.setName("DDCourse");

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const notesPath = () => path.join(app.getPath("documents"), "DDCourse", "学习笔记.json");
const MAX_NOTES_BYTES = 5 * 1024 * 1024;
const rendererPath = path.join(__dirname, "../desktop-dist/index.html");
const rendererUrl = pathToFileURL(rendererPath).href;

function assertTrustedSender(event) {
  if (event.senderFrame?.url !== rendererUrl) throw new Error("Untrusted IPC sender");
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
      }
    }
  }
  await walk(root);
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
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
