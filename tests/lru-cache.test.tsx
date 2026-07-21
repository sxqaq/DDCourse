import assert from "node:assert/strict";
import test from "node:test";
import { LruCache } from "../app/lru-cache";

test("thumbnail cache evicts the least recently used entry at its bound", () => {
  const cache = new LruCache<number, string>(2);
  cache.set(1, "one");
  cache.set(2, "two");
  assert.equal(cache.get(1), "one");
  cache.set(3, "three");
  assert.equal(cache.size, 2);
  assert.equal(cache.get(2), undefined);
  assert.equal(cache.get(1), "one");
  assert.equal(cache.get(3), "three");
});
