import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";
import { VideoPreviewBar, formatPreviewTime } from "../app/components/VideoPreviewBar";
import { requestFullscreenExclusive, togglePictureInPicture } from "../app/hooks/useMediaFeatures";
import { createSubtitleObjectUrl, decodeSubtitleBytes, srtToVtt, subtitleKindFromName } from "../app/media-utils";

test("subtitle helpers decode UTF-8 and convert SRT timestamps", () => {
  const source = "1\r\n00:00:01,250 --> 00:00:03,500\r\n你好\r\n";
  assert.equal(decodeSubtitleBytes(new TextEncoder().encode(source)), source);
  assert.equal(srtToVtt(source), "WEBVTT\n\n1\n00:00:01.250 --> 00:00:03.500\n你好\n");
  assert.equal(subtitleKindFromName("lesson.SRT"), "srt");
  assert.equal(subtitleKindFromName("lesson.mp4"), null);
  assert.equal(decodeSubtitleBytes(Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4])), "中文");
});

test("subtitle object URL cleanup is idempotent", () => {
  const revoked: string[] = [];
  const urlApi = {
    createObjectURL: () => "blob:subtitle",
    revokeObjectURL: (url: string) => revoked.push(url),
  };
  const result = createSubtitleObjectUrl(new TextEncoder().encode("WEBVTT\n\n"), "vtt", urlApi);
  result.revoke();
  result.revoke();
  assert.deepEqual(revoked, ["blob:subtitle"]);
});

test("PiP exits fullscreen before entering and exits when already active", async () => {
  const calls: string[] = [];
  const video = { requestPictureInPicture: async () => { calls.push("pip"); } } as unknown as HTMLVideoElement;
  const doc = {
    pictureInPictureEnabled: true,
    pictureInPictureElement: null,
    fullscreenElement: {},
    exitFullscreen: async () => { calls.push("fullscreen"); },
  } as unknown as Document;
  await togglePictureInPicture(video, doc);
  assert.deepEqual(calls, ["fullscreen", "pip"]);

  (doc as unknown as { pictureInPictureElement: Element }).pictureInPictureElement = video;
  (doc as unknown as { exitPictureInPicture: () => Promise<void> }).exitPictureInPicture = async () => { calls.push("exit-pip"); };
  await togglePictureInPicture(video, doc);
  assert.equal(calls.at(-1), "exit-pip");

  const fullscreenTarget = { ownerDocument: doc, requestFullscreen: async () => { calls.push("enter-fullscreen"); } } as unknown as HTMLElement;
  (doc as unknown as { fullscreenElement: Element | null }).fullscreenElement = null;
  await requestFullscreenExclusive(fullscreenTarget, doc);
  assert.deepEqual(calls.slice(-2), ["exit-pip", "enter-fullscreen"]);
});

test("preview bar is SSR safe and owns a separate hidden video and canvas", () => {
  const html = renderToString(<VideoPreviewBar src="blob:preview" duration={120} onSeek={() => undefined} />);
  assert.match(html, /role="slider"/);
  assert.match(html, /<video/);
  assert.match(html, /<canvas/);
  assert.equal(formatPreviewTime(65), "1:05");
  assert.equal(formatPreviewTime(3661), "1:01:01");
});
