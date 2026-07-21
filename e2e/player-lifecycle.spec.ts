import { expect, test, type Page } from "@playwright/test";

const lessonAt = (page: Page, index: number) => page.locator(`.lesson[data-course-index='${index}']`);

async function loadCourse(page: Page) {
  await page.locator("input[webkitdirectory]").evaluate(input => {
    const files = [
      { name: "01.mp4", path: "Course/A/01.mp4", contents: "a" },
      { name: "02.mp4", path: "Course/B/02.mp4", contents: "b" },
    ].map(item => {
      const file = new File([item.contents], item.name, { type: "video/mp4" });
      Object.defineProperty(file, "webkitRelativePath", { value: item.path });
      return file;
    });
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("2 个视频", { exact: true })).toBeVisible();
}

async function loadSameCollection(page: Page) {
  await page.locator("input[webkitdirectory]").evaluate(input => {
    const transfer = new DataTransfer();
    ["01.mp4", "02.mp4"].forEach(name => {
      const file = new File([name === "01.mp4" ? "a" : "b"], name, { type: "video/mp4" });
      Object.defineProperty(file, "webkitRelativePath", { value: `Course/A/${name}` });
      transfer.items.add(file);
    });
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("2 个视频", { exact: true })).toBeVisible();
}

async function loadRecordedCourse(page: Page) {
  await page.locator("input[webkitdirectory]").evaluate(async input => {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const stream = canvas.captureStream(12);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise<void>(resolve => recorder.onstop = () => resolve());
    recorder.start(100);
    const started = performance.now();
    while (performance.now() - started < 1400) {
      context.fillStyle = `hsl(${Math.round(performance.now() - started) % 360} 80% 50%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: "video/webm" });
    const transfer = new DataTransfer();
    for (const name of ["01-real.webm", "02-real.webm"]) {
      const file = new File([blob], name, { type: blob.type });
      Object.defineProperty(file, "webkitRelativePath", { value: `Course/Real/${name}` });
      transfer.items.add(file);
    }
    const subtitle = new File(["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n真实字幕\n"], "02-real.vtt", { type: "text/vtt" });
    Object.defineProperty(subtitle, "webkitRelativePath", { value: "Course/Real/02-real.vtt" });
    transfer.items.add(subtitle);
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("2 个视频", { exact: true })).toBeVisible();
}

test("switching collections fully stops and unloads the current video", async ({ page }) => {
  await page.goto("/");
  await loadCourse(page);
  await lessonAt(page, 0).click();
  const player = page.locator(".player-wrap > video");
  await expect(player).toHaveClass(/visible/);

  await page.getByRole("button", { name: /^B/ }).click();
  await expect(player).not.toHaveClass(/visible/);
  await expect.poll(() => player.evaluate(element => { const video = element as HTMLVideoElement; return { src: video.getAttribute("src"), paused: video.paused }; }))
    .toEqual({ src: null, paused: true });
});

test("reset stops playback before removing the active progress record", async ({ page }) => {
  await page.goto("/");
  await loadCourse(page);
  await lessonAt(page, 0).click();
  const fileId = "Course/A/01.mp4::1";
  await page.evaluate(id => localStorage.setItem("lumacourse_progress_v1", JSON.stringify({ [id]: { time: 10, duration: 100, done: false, updatedAt: new Date().toISOString() } })), fileId);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "重置" }).click();

  await expect(page.locator(".player-wrap > video")).not.toHaveClass(/visible/);
  await expect.poll(() => page.evaluate(id => Object.hasOwn(JSON.parse(localStorage.getItem("lumacourse_progress_v1") || "{}"), id), fileId)).toBe(false);
});

test("a delayed programmatic pause cannot overwrite the next lesson progress", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lumacourse_progress_v1", JSON.stringify({
      "Course/A/01.mp4::1": { time: 12, duration: 100, done: false, updatedAt: new Date().toISOString() },
      "Course/A/02.mp4::1": { time: 42, duration: 100, done: false, updatedAt: new Date().toISOString() },
    }));
    const playing = new WeakSet<HTMLMediaElement>();
    Object.defineProperty(HTMLMediaElement.prototype, "paused", { configurable: true, get() { return !playing.has(this); } });
    HTMLMediaElement.prototype.play = function () { playing.add(this); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () {
      if (!playing.delete(this)) return;
      window.setTimeout(() => this.dispatchEvent(new Event("pause")), 100);
    };
  });
  await page.goto("/");
  await loadSameCollection(page);
  await lessonAt(page, 0).click();
  await lessonAt(page, 1).click();
  await page.waitForTimeout(650);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lumacourse_progress_v1") || "{}")["Course/A/02.mp4::1"]?.time)).toBe(42);
});

test("real media supports subtitles, previews and jumping from another lesson's note", async ({ page }) => {
  await page.goto("/");
  await loadRecordedCourse(page);
  const player = page.locator(".player-wrap > video");
  await lessonAt(page, 1).click();
  await expect.poll(() => player.evaluate(video => (video as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(1);
  await expect(player.locator("track[kind='subtitles']")).toHaveCount(1);
  await expect(page.getByRole("slider", { name: "视频进度预览" })).toBeVisible();
  await expect(page.locator(".player-wrap video")).toHaveCount(2);
  await player.evaluate(video => { (video as HTMLVideoElement).currentTime = 0.35; });
  page.once("dialog", dialog => dialog.accept("跨视频笔记"));
  await page.getByRole("button", { name: /添加笔记/ }).click();

  await lessonAt(page, 0).click();
  const second = lessonAt(page, 1);
  await second.click({ button: "right" });
  await page.getByRole("menuitem", { name: "查看该视频的笔记与收藏" }).click();
  await page.locator(".marker-row .jump").filter({ hasText: "跨视频笔记" }).click();
  await expect(second).toHaveClass(/active/);
  await expect.poll(() => player.evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);

  await expect(page.getByRole("button", { name: "视频全屏" })).toBeVisible();
  const pipButton = page.getByRole("button", { name: "画中画" });
  if (await pipButton.count()) await expect.poll(() => page.evaluate(() => "pictureInPictureEnabled" in document)).toBe(true);
});

test("Space is not handled twice when the native video has focus", async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    Object.defineProperty(window, "__playCalls", { configurable: true, writable: true, value: 0 });
    HTMLMediaElement.prototype.play = function () {
      (window as typeof window & { __playCalls: number }).__playCalls += 1;
      return play.call(this);
    };
  });
  await page.goto("/");
  await loadSameCollection(page);
  await lessonAt(page, 0).click();
  const player = page.locator(".player-wrap > video");
  await player.focus();
  const before = await page.evaluate(() => (window as typeof window & { __playCalls: number }).__playCalls);
  await player.dispatchEvent("keydown", { code: "Space", key: " ", bubbles: true });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __playCalls: number }).__playCalls)).toBe(before);
});
