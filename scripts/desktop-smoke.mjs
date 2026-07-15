import { _electron as electron } from "playwright";

const application = await electron.launch({
  args: ["."],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
});

try {
  const window = await application.firstWindow({ timeout: 30_000 });
  await window.waitForLoadState("domcontentloaded");
  const title = await window.title();
  if (!title.includes("DDCourse")) throw new Error(`Unexpected desktop title: ${title}`);
  await window.getByRole("button", { name: "选择课程文件夹" }).waitFor({ state: "visible", timeout: 15_000 });
  console.log("Electron smoke test passed: desktop window loaded the learning workspace.");
} finally {
  await application.close();
}
