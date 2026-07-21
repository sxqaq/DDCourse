import { expect, test, type Page } from "@playwright/test";

async function loadCourses(page: Page) {
  await page.locator("input[webkitdirectory]").evaluate(input => {
    const files = [
      { name: "01-intro.mp4", path: "Course/A/01-intro.mp4" },
      { name: "02-detail.mp4", path: "Course/B/02-detail.mp4" },
    ].map(item => {
      const file = new File([item.name], item.name, { type: "video/mp4" });
      Object.defineProperty(file, "webkitRelativePath", { value: item.path });
      return file;
    });
    const transfer = new DataTransfer(); files.forEach(file => transfer.items.add(file));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("2 个视频", { exact: true })).toBeVisible();
}

test("video context actions persist manual completion and can restore hidden lessons", async ({ page }) => {
  await page.goto("/");
  await loadCourses(page);
  const lesson = page.getByRole("button", { name: /intro/ });
  await lesson.click({ button: "right" });
  await page.getByRole("menuitem", { name: "标记为已看完" }).click();
  await expect(lesson).toHaveClass(/done/);
  await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("lumacourse_progress_v1") || "{}"))[0])).toMatchObject({ done: true, doneOverride: true });

  await lesson.click({ button: "right" });
  await page.getByRole("menuitem", { name: "从课程列表隐藏" }).click();
  await expect(page.getByRole("button", { name: /intro/ })).toHaveCount(0);
  await page.getByRole("button", { name: /恢复隐藏/ }).click();
  await expect(page.getByRole("button", { name: /intro/ })).toBeVisible();
});

test("collection menu renames, pins and excludes skipped collections from overall progress", async ({ page }) => {
  await page.goto("/");
  await loadCourses(page);
  const collection = page.locator(".collection-card").filter({ hasText: /^A/ });
  await collection.click({ button: "right" });
  page.once("dialog", dialog => dialog.accept("自定义合集"));
  await page.getByRole("menuitem", { name: "重命名合集" }).click();
  await expect(page.getByRole("button", { name: /自定义合集/ })).toBeVisible();

  await page.getByRole("button", { name: /自定义合集/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "置顶合集" }).click();
  await expect(page.getByRole("button", { name: /自定义合集/ }).locator("strong")).toContainText("★");

  await page.getByRole("button", { name: /自定义合集/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: /暂不学习/ }).click();
  await expect(page.getByText(/全库进度 0\/1 节/)).toBeVisible();
});

test("appearance theme is independent from the system and fullscreen controls are distinct", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Aa 显示" }).click();
  await page.getByLabel("界面主题").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await loadCourses(page);
  await page.getByRole("button", { name: /intro/ }).click();
  await expect(page.getByRole("button", { name: "视频全屏" })).toBeVisible();
  await expect(page.getByRole("button", { name: /应用全屏/ })).toBeVisible();
});
