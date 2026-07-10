const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

app.setName("DDCourse");

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i;
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const notesPath = () => path.join(app.getPath("documents"), "DDCourse", "学习笔记.json");

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), "utf8")); } catch { return {}; }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function scanFolder(root) {
  const files = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (VIDEO_RE.test(entry.name)) {
        const stat = fs.statSync(fullPath);
        files.push({
          name: entry.name,
          size: stat.size,
          lastModified: stat.mtimeMs,
          webkitRelativePath: path.relative(path.dirname(root), fullPath).split(path.sep).join("/"),
          nativeUrl: pathToFileURL(fullPath).href,
        });
      }
    }
  }
  if (fs.existsSync(root)) walk(root);
  return { folderName: path.basename(root), folderPath: root, files };
}

ipcMain.handle("course-folder:choose", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  const folderPath = result.filePaths[0];
  saveSettings({ ...readSettings(), lastFolder: folderPath });
  return scanFolder(folderPath);
});

ipcMain.handle("course-folder:restore", () => {
  const folderPath = readSettings().lastFolder;
  if (!folderPath || !fs.existsSync(folderPath)) return null;
  return scanFolder(folderPath);
});

ipcMain.handle("notes:save-and-show", (_event, payload) => {
  const filePath = notesPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  shell.showItemInFolder(filePath);
  return filePath;
});

ipcMain.handle("notes:save", (_event, payload) => {
  const filePath = notesPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
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
  window.loadFile(path.join(__dirname, "../desktop-dist/index.html"));
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
