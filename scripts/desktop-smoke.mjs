import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

const packagedExecutable = process.argv[2] ? path.resolve(process.argv[2]) : undefined;

const application = await electron.launch({
  ...(packagedExecutable ? { executablePath: packagedExecutable, args: [] } : { args: ["."] }),
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
});

try {
  const window = await application.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState("domcontentloaded");
  const title = await window.title();
  if (!title.includes("DDCourse")) throw new Error(`Unexpected desktop title: ${title}`);
  const bridge = await window.evaluate(() => ({
    chooseFolder: typeof window.ddcourseDesktop?.chooseFolder,
    loadNotes: typeof window.ddcourseDesktop?.loadNotes,
    saveNotes: typeof window.ddcourseDesktop?.saveNotes,
  }));
  assert.deepEqual(bridge, { chooseFolder: "function", loadNotes: "function", saveNotes: "function" });
  await window.getByRole("button", { name: "选择课程文件夹" }).waitFor({ state: "visible", timeout: 15_000 });
  console.log(`Electron smoke test passed: ${packagedExecutable ? "packaged" : "development"} desktop window loaded the learning workspace.`);
} finally {
  await application.close();
}
