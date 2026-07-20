import { expect, test, type Page } from "@playwright/test";

async function loadCollections(page: Page) {
  await page.locator("input[webkitdirectory]").evaluate(input => {
    const transfer = new DataTransfer();
    for (const folder of ["A", "B", "C", "D", "E", "F", "G"]) {
      const file = new File([folder], `${folder}.mp4`, { type: "video/mp4" });
      Object.defineProperty(file, "webkitRelativePath", { value: `Course/${folder}/${folder}.mp4` });
      transfer.items.add(file);
    }
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator(".collection-card")).toHaveCount(7);
}

test("course collections use a compact three-column two-row grid", async ({ page }) => {
  await page.goto("/");
  await loadCollections(page);
  const layout = await page.locator(".collection-grid").evaluate(element => {
    const style = getComputedStyle(element);
    return { columns: style.gridTemplateColumns.split(" ").length, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });
  expect(layout.columns).toBe(3);
  expect(layout.clientHeight).toBeLessThanOrEqual(104);
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
});

test("completed and context-menu collections can be collapsed and restored", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lumacourse_progress_v1", JSON.stringify({
      "Course/A/A.mp4::1": { time: 1, duration: 1, done: true, updatedAt: new Date().toISOString() },
    }));
  });
  await page.goto("/");
  await loadCollections(page);

  await page.getByRole("button", { name: "收起已完成" }).click();
  await expect(page.locator(".collection-card", { hasText: "A" })).toHaveCount(0);

  await page.locator(".collection-card", { hasText: "B" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "收起此合集" }).click();
  await expect(page.locator(".collection-card", { hasText: "B" })).toHaveCount(0);
  await expect(page.getByText("已收起 2 个合集")).toBeVisible();

  await page.getByText("已收起 2 个合集").click();
  await page.locator(".collapsed-collections button", { hasText: "A" }).click();
  await expect(page.locator(".collection-card", { hasText: "A" })).toHaveCount(1);
});
