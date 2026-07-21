import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { load } from "js-yaml";

const require = createRequire(import.meta.url);

test("runtime parsers are pinned above the audited vulnerable versions", () => {
  const yaml = require("js-yaml/package.json");
  const postcss = require("postcss/package.json");
  const sharp = JSON.parse(readFileSync(new URL("../node_modules/sharp/package.json", import.meta.url), "utf8"));

  assert.equal(yaml.version, "4.3.0");
  assert.equal(postcss.version, "8.5.21");
  assert.equal(sharp.version, "0.35.3");
});

test("the secured YAML parser still accepts electron-updater metadata", () => {
  assert.deepEqual(load([
    "version: 1.5.6",
    "files:",
    "  - url: DDCourse-Setup-1.5.6.exe",
    "    sha512: dGVzdA==",
    "path: DDCourse-Setup-1.5.6.exe",
    "sha512: dGVzdA==",
  ].join("\n")), {
    version: "1.5.6",
    files: [{ url: "DDCourse-Setup-1.5.6.exe", sha512: "dGVzdA==" }],
    path: "DDCourse-Setup-1.5.6.exe",
    sha512: "dGVzdA==",
  });
});
