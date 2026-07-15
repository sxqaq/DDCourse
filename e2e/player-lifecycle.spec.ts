import { expect, test, type Page } from "@playwright/test";

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

test("switching collections fully stops and unloads the current video", async ({ page }) => {
  await page.goto("/");
  await loadCourse(page);
  await page.getByRole("button", { name: /01/ }).click();
  await expect(page.locator("video")).toHaveClass(/visible/);

  await page.getByRole("button", { name: /^B/ }).click();
  await expect(page.locator("video")).not.toHaveClass(/visible/);
  await expect.poll(() => page.locator("video").evaluate(element => { const video = element as HTMLVideoElement; return { src: video.getAttribute("src"), paused: video.paused }; }))
    .toEqual({ src: null, paused: true });
});

test("reset stops playback before removing the active progress record", async ({ page }) => {
  await page.goto("/");
  await loadCourse(page);
  await page.getByRole("button", { name: /01/ }).click();
  const fileId = "Course/A/01.mp4::1";
  await page.evaluate(id => localStorage.setItem("lumacourse_progress_v1", JSON.stringify({ [id]: { time: 10, duration: 100, done: false, updatedAt: new Date().toISOString() } })), fileId);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "重置" }).click();

  await expect(page.locator("video")).not.toHaveClass(/visible/);
  await expect.poll(() => page.evaluate(id => Object.hasOwn(JSON.parse(localStorage.getItem("lumacourse_progress_v1") || "{}"), id), fileId)).toBe(false);
});
