"use client";

import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePwaInstall(onNotice: (message: string) => void) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined"
    && (window.matchMedia("(display-mode: standalone)").matches || navigator.userAgent.includes("Electron")));

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && window.location.protocol !== "file:" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(error => console.error("Unable to register Service Worker", error));
    }
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const complete = () => {
      setInstalled(true);
      setInstallPrompt(null);
      onNotice("DDCourse 已安装完成");
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, [onNotice]);

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      onNotice("请使用 Chrome 或 Edge 的“安装此应用”功能");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }, [installPrompt, onNotice]);

  return { installed, installApp };
}
