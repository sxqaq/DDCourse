"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
};

export type PictureInPictureController = {
  supported: boolean;
  active: boolean;
  toggle: () => Promise<void>;
  exit: () => Promise<void>;
};

export async function togglePictureInPicture(
  video: PictureInPictureVideo,
  ownerDocument: Document = video.ownerDocument,
): Promise<void> {
  if (!ownerDocument.pictureInPictureEnabled || !video.requestPictureInPicture) {
    throw new Error("Picture-in-picture is unavailable.");
  }
  if (ownerDocument.pictureInPictureElement === video) {
    await ownerDocument.exitPictureInPicture();
    return;
  }
  if (ownerDocument.fullscreenElement && ownerDocument.exitFullscreen) {
    await ownerDocument.exitFullscreen();
  }
  await video.requestPictureInPicture();
}

/** Enter fullscreen after leaving PiP, preserving exclusivity in the other direction. */
export async function requestFullscreenExclusive(
  target: HTMLElement,
  ownerDocument: Document = target.ownerDocument,
): Promise<void> {
  if (ownerDocument.pictureInPictureElement && ownerDocument.exitPictureInPicture) {
    await ownerDocument.exitPictureInPicture();
  }
  if (ownerDocument.fullscreenElement && ownerDocument.fullscreenElement !== target && ownerDocument.exitFullscreen) await ownerDocument.exitFullscreen();
  if (ownerDocument.fullscreenElement !== target) await target.requestFullscreen();
}

export function usePictureInPicture(
  videoRef: RefObject<HTMLVideoElement | null>,
): PictureInPictureController {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current as PictureInPictureVideo | null;
    if (!video || typeof document === "undefined") return;
    setSupported(Boolean(document.pictureInPictureEnabled && video.requestPictureInPicture));
    const entered = () => setActive(true);
    const left = () => setActive(false);
    video.addEventListener("enterpictureinpicture", entered);
    video.addEventListener("leavepictureinpicture", left);
    setActive(document.pictureInPictureElement === video);
    return () => {
      video.removeEventListener("enterpictureinpicture", entered);
      video.removeEventListener("leavepictureinpicture", left);
    };
  }, [videoRef]);

  const exit = useCallback(async () => {
    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  }, []);

  const toggle = useCallback(async () => {
    const video = videoRef.current as PictureInPictureVideo | null;
    if (!video) return;
    await togglePictureInPicture(video);
  }, [videoRef]);

  return { supported, active, toggle, exit };
}
