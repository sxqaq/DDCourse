"use client";

import { ChangeEvent, useEffect, useState } from "react";

const FONT_KEY = "ddcourse_font_v1";
const SCALE_KEY = "ddcourse_font_scale_v1";
const families: Record<string, string> = {
  misans: '"MiSans","HarmonyOS Sans","OPPO Sans","Source Han Sans SC","PingFang SC",sans-serif',
  system: 'system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif',
  serif: '"Noto Serif SC","Source Han Serif SC","Songti SC",serif',
  mono: '"JetBrains Mono","Cascadia Code","Microsoft YaHei",monospace',
  custom: '"DDCourse Custom Font","MiSans",sans-serif',
};

function browserStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function fontDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable"));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ddcourse-assets", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("fonts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeFont(buffer: ArrayBuffer) {
  const db = await fontDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("fonts", "readwrite").objectStore("fonts").put(buffer, "custom");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function loadStoredFont() {
  const db = await fontDatabase();
  const buffer = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
    const request = db.transaction("fonts").objectStore("fonts").get("custom");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return buffer;
}

async function activateCustomFont(buffer: ArrayBuffer) {
  if (typeof FontFace === "undefined" || typeof document === "undefined") throw new Error("Custom fonts are unavailable");
  const face = new FontFace("DDCourse Custom Font", buffer);
  await face.load();
  document.fonts.add(face);
}

export function useAppearance() {
  const [font, setFont] = useState(() => browserStorageValue(FONT_KEY) || "misans");
  const [scale, setScale] = useState(() => Number(browserStorageValue(SCALE_KEY)) || 1);
  const [fontName, setFontName] = useState("自定义字体");

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font", families[font] || families.misans);
    try { localStorage.setItem(FONT_KEY, font); } catch { /* Preferences remain in memory. */ }
  }, [font]);
  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
    try { localStorage.setItem(SCALE_KEY, String(scale)); } catch { /* Preferences remain in memory. */ }
  }, [scale]);
  useEffect(() => {
    if (font === "custom") loadStoredFont().then(buffer => buffer && activateCustomFont(buffer)).catch(console.error);
  }, [font]);

  const importFont = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await activateCustomFont(buffer);
    await storeFont(buffer);
    setFontName(file.name);
    setFont("custom");
    event.target.value = "";
  };

  return { font, setFont, scale, setScale, fontName, importFont };
}
