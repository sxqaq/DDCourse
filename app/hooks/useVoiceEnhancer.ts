"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type AudioGraph = { context: AudioContext; compressor: DynamicsCompressorNode };

export function useVoiceEnhancer(videoRef: RefObject<HTMLVideoElement | null>, onNotice: (message: string) => void) {
  const [enabled, setEnabled] = useState(false);
  const graphRef = useRef<AudioGraph | null>(null);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (!graphRef.current) {
        const AudioContextClass = window.AudioContext
          || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const context = new AudioContextClass();
        const source = context.createMediaElementSource(video);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -26;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.22;
        source.connect(compressor);
        compressor.connect(context.destination);
        graphRef.current = { context, compressor };
      }
      void graphRef.current.context.resume();
      setEnabled(previous => {
        if (graphRef.current) graphRef.current.compressor.threshold.value = previous ? 0 : -26;
        return !previous;
      });
    } catch (error) {
      console.error("Unable to enable voice enhancement", error);
      onNotice("当前浏览器无法启用人声增强");
    }
  }, [onNotice, videoRef]);

  useEffect(() => () => {
    const graph = graphRef.current;
    graphRef.current = null;
    if (graph) void graph.context.close();
  }, []);

  return { enabled, toggle };
}
