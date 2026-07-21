"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContextMenuItem = { label: string; onClick: () => void; disabled?: boolean; danger?: boolean };

type Props = { x: number; y: number; items: ContextMenuItem[]; onClose: () => void };

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({ left: Math.max(6, Math.min(x, window.innerWidth - box.width - 6)), top: Math.max(6, Math.min(y, window.innerHeight - box.height - 6)) });
  }, [x, y, items.length]);
  useEffect(() => {
    const close = () => onClose();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", key); };
  }, [onClose]);
  return <div ref={ref} className="context-menu" role="menu" style={position} onPointerDown={event => event.stopPropagation()}>
    {items.map(item => <button key={item.label} role="menuitem" className={item.danger ? "danger" : ""} disabled={item.disabled} onClick={() => { item.onClick(); onClose(); }}>{item.label}</button>)}
  </div>;
}
