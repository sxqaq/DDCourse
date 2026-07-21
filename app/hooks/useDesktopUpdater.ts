"use client";

import { useCallback, useEffect, useState } from "react";
import type { UpdateStatus } from "../types";

const initialStatus: UpdateStatus = { state: "idle" };

export function useDesktopUpdater() {
  const api = typeof window === "undefined" ? undefined : window.ddcourseDesktop;
  const [status, setStatus] = useState<UpdateStatus>(initialStatus);

  useEffect(() => {
    if (!api) return;
    return api.onUpdateStatus(setStatus);
  }, [api]);

  const checkForUpdates = useCallback(async () => {
    if (!api) return;
    setStatus({ state: "checking" });
    try { await api.checkForUpdates(); }
    catch { setStatus({ state: "error", message: "检查更新失败，请稍后重试。" }); }
  }, [api]);

  const downloadUpdate = useCallback(async () => {
    if (!api) return;
    try { await api.downloadUpdate(); }
    catch { setStatus({ state: "error", message: "下载更新失败，请稍后重试。" }); }
  }, [api]);

  const installUpdate = useCallback(async () => {
    if (!api) return;
    try { await api.installUpdate(); }
    catch { setStatus({ state: "error", message: "安装更新失败，请重新下载。" }); }
  }, [api]);

  return { isDesktop: Boolean(api), status, checkForUpdates, downloadUpdate, installUpdate };
}
