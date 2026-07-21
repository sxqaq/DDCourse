"use client";

import { useEffect, useRef } from "react";

type Handlers = { enabled: boolean; togglePlayback: () => void; step: (direction: number) => void; adjacent: (direction: number) => void; setSpeed: (speed: number) => void };
const SPEEDS: Record<string, number> = { KeyQ: 1, KeyW: 1.25, KeyE: 1.5, KeyR: 2 };

export function useKeyboardShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button,input,select,textarea,[contenteditable]:not([contenteditable='false'])")) return;
      const current = ref.current;
      if (SPEEDS[event.code]) { event.preventDefault(); current.setSpeed(SPEEDS[event.code]); return; }
      if (!current.enabled) return;
      if (event.code === "Space") { event.preventDefault(); current.togglePlayback(); }
      if (event.code === "ArrowLeft") { event.preventDefault(); current.step(-1); }
      if (event.code === "ArrowRight") { event.preventDefault(); current.step(1); }
      if (event.code === "BracketLeft" || event.code === "KeyP") current.adjacent(-1);
      if (event.code === "BracketRight" || event.code === "KeyN") current.adjacent(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
