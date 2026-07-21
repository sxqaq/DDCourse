import assert from "node:assert/strict";
import test from "node:test";
import { buildCourseSearchEntries, virtualCourseRange } from "../app/components/CourseSidebar";
import { idOf } from "../app/course-utils";
import { buildCollections } from "../app/hooks/useCourseLibrary";
import { normalizeLastSelection, normalizeStringList, normalizeStringListRecord, normalizeStringRecord } from "../app/storage";
import type { Collection, CourseFile } from "../app/types";

function courseFile(path: string, index = 0): CourseFile {
  return { name: path.split("/").at(-1)!, size: index + 1, lastModified: index, webkitRelativePath: path, type: "video/mp4" };
}

test("malformed course preferences are normalized without trusting their JSON shape", () => {
  assert.deepEqual(normalizeStringList({ 0: "not-an-array" }), []);
  assert.deepEqual(normalizeStringList([" one ", 12, "one", "", "two"]), ["one", "two"]);
  assert.deepEqual(normalizeStringRecord(["not-an-object"]), {});
  assert.deepEqual(normalizeStringRecord({ good: " name ", broken: 1, __proto__: "ignored" }), { good: "name" });
  assert.deepEqual(normalizeStringListRecord({ root: ["a", false, "a", "b"], broken: "not-an-array" }), { root: ["a", "b"], broken: [] });
  assert.equal(normalizeLastSelection({ collection: [], id: 3 }), null);
  assert.deepEqual(normalizeLastSelection({ collection: " course ", id: " lesson " }), { collection: "course", id: "lesson" });
});

test("hidden lessons stay in the source set used by reset, reports and statistics", () => {
  const files = [courseFile("Root/A/one.mp4", 1), courseFile("Root/A/two.mp4", 2)];
  const collections = buildCollections(files, {}, [idOf(files[1])], [], []);
  assert.equal(collections.length, 1);
  assert.deepEqual(collections[0].files.map(idOf), [idOf(files[0])]);
  assert.deepEqual(collections[0].allFiles.map(idOf), files.map(idOf));
});

test("note search returns matching lessons from every collection", () => {
  const first = courseFile("Root/A/one.mp4", 1), second = courseFile("Root/B/two.mp4", 2);
  const collections: Collection[] = [
    { key: "Root/A", name: "A", files: [first], allFiles: [first] },
    { key: "Root/B", name: "B", files: [second], allFiles: [second] },
  ];
  const results = buildCourseSearchEntries(collections, collections[0], "a note phrase", false, {}, new Set([idOf(second)]));
  assert.deepEqual(results.map(result => [result.collectionKey, idOf(result.file)]), [["Root/B", idOf(second)]]);
});

test("10k lessons group and filter correctly while the rendered window stays bounded", () => {
  const files = Array.from({ length: 10_000 }, (_, index) => courseFile(`Root/C${index % 20}/lesson-${index}.mp4`, index));
  const collections = buildCollections(files, {}, [], [], []);
  assert.equal(collections.length, 20);
  assert.equal(collections.reduce((sum, collection) => sum + collection.allFiles.length, 0), 10_000);

  const fiveThousand: Collection = { key: "Root/Large", name: "Large", files: files.slice(0, 5_000), allFiles: files.slice(0, 5_000) };
  const results = buildCourseSearchEntries([fiveThousand], fiveThousand, "", false, {}, new Set());
  const range = virtualCourseRange(results.length, 120_000, 720);
  assert.equal(results.length, 5_000);
  assert(range.end - range.start < 40, `virtualized window rendered ${range.end - range.start} rows`);
  assert.equal(range.top + (range.end - range.start) * 58 + range.bottom, 5_000 * 58);
});
