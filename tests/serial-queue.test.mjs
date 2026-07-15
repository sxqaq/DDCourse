import assert from "node:assert/strict";
import test from "node:test";
import queueModule from "../electron/serial-queue.cjs";

test("desktop note writes remain ordered and recover after a failure", async () => {
  const events = [];
  const enqueue = queueModule.createSerialQueue(async value => {
    events.push(`start:${value}`);
    await new Promise(resolve => setTimeout(resolve, value === 1 ? 15 : 1));
    events.push(`end:${value}`);
    if (value === 2) throw new Error("expected failure");
    return value;
  });
  const first = enqueue(1);
  const second = enqueue(2).catch(() => undefined);
  const third = enqueue(3);
  assert.equal(await first, 1);
  await second;
  assert.equal(await third, 3);
  assert.deepEqual(events, ["start:1", "end:1", "start:2", "end:2", "start:3", "end:3"]);
});
