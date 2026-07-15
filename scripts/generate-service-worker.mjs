import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { generateSW } from "workbox-build";

const clientDirectory = path.resolve("dist/client");

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.name !== "sw.js") files.push(relative);
  }
  return files.sort();
}

const files = await listFiles(clientDirectory);
const revisionHash = createHash("sha256");
for (const file of files) {
  revisionHash.update(file);
  revisionHash.update(await readFile(path.join(clientDirectory, file)));
}

const result = await generateSW({
  globDirectory: clientDirectory,
  swDest: path.join(clientDirectory, "sw.js"),
  globPatterns: ["**/*.{js,css,html,png,webmanifest,woff,woff2}"],
  globIgnores: ["sw.js", "workbox-*.js"],
  additionalManifestEntries: [{ url: "/offline-shell", revision: revisionHash.digest("hex") }],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: "/offline-shell",
  navigateFallbackDenylist: [/^\/_vinext\/image/],
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  inlineWorkboxRuntime: true,
  sourcemap: false,
});

if (result.warnings.length) throw new Error(result.warnings.join("\n"));
console.log(`Generated offline service worker with ${result.count} precached resources (${result.size} bytes).`);
