import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { QueueRanking, rankingSignature, stableFallback } from "./queue-ranking.mjs";

const item = (key, extra = {}) => ({ key, kind: "landed", card: null, collision: null, ...extra });
const result = (keys, failed = false) => ({ order: keys.map(key => ({ key, reason: key })), failed });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test("clock ticks and input iteration order do not rerank unchanged tasks", async () => {
  let calls = 0;
  const queue = new QueueRanking({ delayMs: 0, rank: async () => { calls++; return result(["a", "b"]); }, publish: () => {} });
  queue.schedule([item("a", { waiting_seconds: 1 }), item("b")]);
  await wait(10);
  queue.schedule([item("b"), item("a", { waiting_seconds: 900 })]);
  await wait(10);
  assert.equal(calls, 1);
  assert.notEqual(rankingSignature([item("a")]), rankingSignature([item("a", { collision: { file: "auth.js", otherSession: "b" } })]));
});

test("late replies cannot overwrite a newer queue, including during the debounce window", async () => {
  const older = deferred(), newer = deferred();
  const published = [];
  let calls = 0;
  const queue = new QueueRanking({ delayMs: 0, rank: () => (++calls === 1 ? older.promise : newer.promise), publish: order => published.push(order.map(item => item.key)) });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("b"), item("c")]);
  older.resolve(result(["a", "b"]));
  await wait(10);
  assert.deepEqual(published, []);
  newer.resolve(result(["c", "b"]));
  await wait(10);
  assert.deepEqual(published, [["c", "b"]]);
});

test("timeouts retain the established order while removing departed tasks and adding new tasks", async () => {
  const replies = [result(["b", "a"]), result(["a", "b"], true), result(["c", "a"], true), result(["c", "a"])];
  const published = [];
  const queue = new QueueRanking({ delayMs: 0, rank: async () => replies.shift(), publish: order => published.push(order.map(item => item.key)) });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("a", { card: { category: "review" } }), item("b")]);
  await wait(10);
  queue.schedule([item("a"), item("c")]);
  await wait(10);
  queue.schedule([item("a"), item("c", { card: { category: "error" } })]);
  await wait(10);
  assert.deepEqual(published, [["b", "a"], ["b", "a"], ["a", "c"], ["c", "a"]]);
  assert.deepEqual(stableFallback([], result(["a", "b"]).order).map(item => item.key), ["a", "b"]);
});
