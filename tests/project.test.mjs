import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("desktop build is configured as DDCourse", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "ddcourse");
  assert.equal(pkg.build.productName, "DDCourse");
  assert.match(pkg.build.artifactName, /^DDCourse-Setup-/);
});

test("desktop persistence and note management are wired", async () => {
  const [main, preload, page] = await Promise.all([
    readFile(new URL("../electron/main.cjs", import.meta.url), "utf8"),
    readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(main, /course-folder:restore/);
  assert.match(main, /notes:save/);
  assert.match(preload, /chooseFolder/);
  assert.match(page, /editNote/);
  assert.match(page, /deleteNote/);
  assert.match(page, /editBookmark/);
  assert.match(page, /deleteBookmark/);
});

test("required application icons exist", async () => {
  await Promise.all([
    access(new URL("../public/icons/icon-192.png", import.meta.url)),
    access(new URL("../public/icons/icon-512.png", import.meta.url)),
  ]);
});
