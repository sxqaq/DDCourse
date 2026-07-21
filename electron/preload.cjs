const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ddcourseDesktop", {
  chooseFolder: () => ipcRenderer.invoke("course-folder:choose"),
  restoreFolder: () => ipcRenderer.invoke("course-folder:restore"),
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveAndShowNotes: payload => ipcRenderer.invoke("notes:save-and-show", payload),
  saveNotes: payload => ipcRenderer.invoke("notes:save", payload),
  revealPath: nativeUrlOrPath => ipcRenderer.invoke("course-file:reveal", nativeUrlOrPath),
  getNativePath: nativeUrlOrPath => ipcRenderer.invoke("course-file:native-path", nativeUrlOrPath),
  readSubtitle: nativeUrlOrPath => ipcRenderer.invoke("subtitle:read", nativeUrlOrPath),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: listener => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on("updates:status", handler);
    return () => ipcRenderer.removeListener("updates:status", handler);
  },
});
