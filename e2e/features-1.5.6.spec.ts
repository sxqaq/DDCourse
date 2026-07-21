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
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await page.getByRole("button", { name: /恢复隐藏/ }).click();
  await expect(page.getByRole("button", { name: /intro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /intro/ })).not.toHaveClass(/done/);
});

test("malformed course preferences cannot white-screen startup", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ddcourse_collection_names_v1", JSON.stringify(["wrong shape"]));
    localStorage.setItem("ddcourse_collection_order_v1", JSON.stringify({ wrong: true }));
    localStorage.setItem("ddcourse_skipped_collections_v1", JSON.stringify("wrong shape"));
    localStorage.setItem("ddcourse_hidden_files_v1", JSON.stringify({ length: 10 }));
    localStorage.setItem("ddcourse_collapsed_collections_v1", JSON.stringify(["wrong shape"]));
    localStorage.setItem("lumacourse_last_v1", JSON.stringify({ collection: [], id: 12 }));
  });
  await page.goto("/");
  await expect(page.getByText("DDCourse", { exact: true }).first()).toBeVisible();
  await loadCourses(page);
  await expect(page.getByRole("button", { name: /intro/ })).toBeVisible();
});

test("note full-text search opens a result from another collection", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem("ddcourse_notes_v1", JSON.stringify([{ id: "cross-note", fileId: "Course/B/02-detail.mp4::13", fileName: "02-detail", time: 5, text: "跨合集关键字", createdAt: now, updatedAt: now }]));
  });
  await page.goto("/");
  await loadCourses(page);
  await page.getByPlaceholder("搜索课程、笔记或收藏…").fill("跨合集关键字");
  const result = page.getByRole("button", { name: /detail/ });
  await expect(result).toContainText("B ·");
  await result.click();
  await expect(page.locator(".collection-card.active")).toContainText("B");
  await expect(page.getByRole("button", { name: /detail/ })).toHaveClass(/active/);
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
