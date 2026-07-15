import { expect, test } from "@playwright/test";

test("the learning workspace loads and exposes its primary actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /把本地课程/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择课程文件夹" })).toBeVisible();
  await expect(page.getByText("Local First", { exact: false }).first()).toBeVisible();
});

test("the installed application starts while fully offline", async ({ page, context }) => {
  await page.goto("/");
  const unavailable = await page.evaluate(async () => {
    const source = await (await fetch("/sw.js")).text();
    const urls = [...source.matchAll(/\{url:"([^"]+)"/g)].map(match => match[1]);
    const responses = await Promise.all(urls.map(async url => ({ url, status: (await fetch(url)).status })));
    return responses.filter(response => response.status >= 400);
  });
  expect(unavailable).toEqual([]);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (registration.active) return;
    const worker = registration.installing || registration.waiting;
    if (!worker) throw new Error("Service Worker did not start installing");
    await new Promise<void>((resolve, reject) => worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
      if (worker.state === "redundant") reject(new Error("Service Worker installation failed"));
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cacheState = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(names.map(async name => ({
      name,
      urls: (await (await caches.open(name)).keys()).map(request => request.url),
    })));
    return entries;
  });
  expect(cacheState.some(cache => cache.urls.some(url => new URL(url).pathname === "/offline-shell"))).toBe(true);

  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /把本地课程/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "选择课程文件夹" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
