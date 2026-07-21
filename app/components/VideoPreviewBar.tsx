"use client";
/* eslint-disable @next/next/no-img-element -- data URL thumbnails are generated locally. */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Props = {
  src: string;
  duration: number;
  currentTime?: number;
  onSeek: (time: number) => void;
  slotSeconds?: number;
  throttleMs?: number;
  className?: string;
  ariaLabel?: string;
};

export function VideoPreviewBar({
  src,
  duration,
  currentTime = 0,
  onSeek,
  slotSeconds = 10,
  throttleMs = 120,
  className,
  ariaLabel = "视频进度预览",
}: Props) {
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef(new Map<number, string>());
  const pendingSlotRef = useRef<number | null>(null);
  const lastRequestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const [preview, setPreview] = useState<{ source: string; time: number; left: number; image?: string } | null>(null);

  useEffect(() => {
    cacheRef.current.clear();
    pendingSlotRef.current = null;
  }, [src]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const captureSlot = useCallback((slot: number) => {
    const video = previewVideoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    pendingSlotRef.current = slot;
    video.currentTime = Math.min(video.duration, slot * slotSeconds);
  }, [slotSeconds]);

  const requestSlot = useCallback((slot: number) => {
    const cached = cacheRef.current.get(slot);
    if (cached) {
      setPreview(value => value?.source === src ? { ...value, image: cached } : value);
      return;
    }
    const elapsed = performance.now() - lastRequestRef.current;
    const run = () => {
      lastRequestRef.current = performance.now();
      captureSlot(slot);
    };
    if (elapsed >= throttleMs) run();
    else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, throttleMs - elapsed);
    }
  }, [captureSlot, src, throttleMs]);

  const locate = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
    const time = ratio * Math.max(0, duration);
    setPreview({ source: src, time, left: ratio * 100, image: cacheRef.current.get(Math.round(time / slotSeconds)) });
    requestSlot(Math.round(time / slotSeconds));
    if (draggingRef.current) onSeek(time);
  }, [duration, onSeek, requestSlot, slotSeconds, src]);

  const onSeeked = useCallback(() => {
    const video = previewVideoRef.current;
    const canvas = canvasRef.current;
    const slot = pendingSlotRef.current;
    if (!video || !canvas || slot === null || !video.videoWidth || !video.videoHeight) return;
    const width = 240;
    const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    try {
      const image = canvas.toDataURL("image/jpeg", 0.72);
      cacheRef.current.set(slot, image);
      setPreview(value => value?.source === src && Math.round(value.time / slotSeconds) === slot ? { ...value, image } : value);
    } catch {
      // A source with restrictive CORS may be seekable but not drawable to canvas.
    }
  }, [slotSeconds, src]);

  return (
    <div
      className={className}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, duration)}
      aria-valuenow={Math.max(0, Math.min(duration, currentTime))}
      tabIndex={0}
      style={{ position: "relative", height: 12, cursor: "pointer", touchAction: "none" }}
      onPointerEnter={locate}
      onPointerMove={locate}
      onPointerLeave={() => { if (!draggingRef.current) setPreview(null); }}
      onPointerDown={event => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        locate(event);
      }}
      onPointerUp={event => {
        draggingRef.current = false;
        locate(event);
        event.currentTarget.releasePointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration)));
      }}
      onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onSeek(Math.max(0, Math.min(duration, currentTime + (event.key === "ArrowLeft" ? -5 : 5))));
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(127,127,127,.35)" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, width: `${duration > 0 ? Math.max(0, Math.min(100, currentTime / duration * 100)) : 0}%`, borderRadius: 999, background: "currentColor" }} />
      {preview?.source === src && (
        <output style={{ position: "absolute", left: `${preview.left}%`, bottom: 20, transform: "translateX(-50%)", pointerEvents: "none" }}>
          {preview.image && <img src={preview.image} width={160} alt="" />}
          <span>{formatPreviewTime(preview.time)}</span>
        </output>
      )}
      <video ref={previewVideoRef} src={src} muted preload="metadata" playsInline onSeeked={onSeeked} aria-hidden="true" style={hiddenMediaStyle} />
      <canvas ref={canvasRef} aria-hidden="true" style={hiddenMediaStyle} />
    </div>
  );
}

const hiddenMediaStyle = {
  position: "fixed",
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: "none",
  left: -10_000,
  top: -10_000,
} as const;

export function formatPreviewTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole % 3600 / 60);
  const rest = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}
