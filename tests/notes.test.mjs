import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStudyItems, parseNotesDocument } from "../app/notes-schema.mjs";

const createdAt = "2026-07-13T08:00:00.000Z";

test("legacy note data is migrated with updatedAt timestamps", () => {
  const parsed = parseNotesDocument({
    app: "DDCourse",
    exportedAt: createdAt,
    folder: "Course",
    notes: [{ id: "n1", fileId: "lesson::10", fileName: "lesson", time: 4, text: "note", createdAt }],
    bookmarks: [{ id: "b1", fileId: "lesson::10", fileName: "lesson", time: 5, createdAt }],
  }, { allowLegacy: true });
  assert.equal(parsed.notes[0].updatedAt, createdAt);
  assert.equal(parsed.bookmarks[0].updatedAt, createdAt);
  assert.equal(parsed.bookmarks[0].label, "重点");
});

test("desktop note schema rejects malformed and unsafe payloads", () => {
  assert.throws(() => parseNotesDocument({ app: "Other", notes: [], bookmarks: [] }));
  assert.throws(() => parseNotesDocument({ app: "DDCourse", updatedAt: createdAt, notes: [{ time: -1 }], bookmarks: [] }));
});

test("a corrupt local item does not hide valid notes", () => {
  const items = normalizeStudyItems([
    { id: "n1", fileId: "lesson::10", fileName: "lesson", time: 4, text: "valid", createdAt },
    { id: "n2", time: -1 },
  ], "note", () => "generated");
  assert.equal(items.length, 1);
  assert.equal(items[0].text, "valid");
});
