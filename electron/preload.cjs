const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ddcourseDesktop", {
  chooseFolder: () => ipcRenderer.invoke("course-folder:choose"),
  restoreFolder: () => ipcRenderer.invoke("course-folder:restore"),
  loadNotes: () => ipcRenderer.invoke("notes:load"),
  saveAndShowNotes: payload => ipcRenderer.invoke("notes:save-and-show", payload),
  saveNotes: payload => ipcRenderer.invoke("notes:save", payload),
});
