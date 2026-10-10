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

test("successful replies and timeouts keep the established order as tasks arrive or change", async () => {
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
  assert.deepEqual(published, [["b", "a"], ["b", "a"], ["a"], ["a", "c"], ["a", "c"]]);
  assert.deepEqual(stableFallback([], result(["a", "b"]).order).map(item => item.key), ["a", "b"]);
});

test("a new plane cannot move the runway plane or reshuffle waiting planes", async () => {
  const replies = [result(["b", "a"]), result(["d", "a", "c", "b"])];
  const published = [];
  const queue = new QueueRanking({ delayMs: 0, rank: async () => replies.shift(), publish: order => published.push(order.map(item => item.key)) });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("a"), item("b"), item("c"), item("d")]);
  await wait(10);
  assert.deepEqual(published, [["b", "a"], ["b", "a", "d", "c"]]);
});

test("a departing plane releases its place immediately and returns at the tail", async () => {
  const late = deferred();
  let calls = 0;
  const published = [];
  const queue = new QueueRanking({ delayMs: 0, rank: () => ++calls === 2 ? late.promise : Promise.resolve(result(["a", "b"])), publish: order => published.push(order.map(item => item.key)) });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("b")]);
  assert.deepEqual(published.at(-1), ["b"]);
  await wait(10);
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  late.resolve(result(["a", "b"]));
  await wait(10);
  assert.deepEqual(published.at(-1), ["b", "a"]);
});

test("updated reasons do not move planes, and incomplete replies cannot lose or duplicate them", async () => {
  const replies = [result(["b", "a"]), { order: [{ key: "a", reason: "Updated priority" }, { key: "a", reason: "Duplicate" }, { key: "invented", reason: "Unknown" }] }];
  let order;
  const queue = new QueueRanking({ delayMs: 0, rank: async () => replies.shift(), publish: next => { order = next; } });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("a", { card: { summary: "New summary" } }), item("b"), item("c")]);
  await wait(10);
  assert.deepEqual(order.map(item => item.key), ["b", "a", "c"]);
  assert.equal(order[1].reason, "Updated priority");
});

test("a thrown model request still admits new tasks without moving existing ones", async () => {
  let calls = 0, error;
  let order;
  const queue = new QueueRanking({ delayMs: 0, rank: async () => {
    if (++calls === 1) return result(["b", "a"]);
    throw new Error("Google unavailable");
  }, onError: next => { error = next; }, publish: next => { order = next; } });
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  queue.schedule([item("a"), item("b"), item("c")]);
  await wait(10);
  assert.deepEqual(order.map(item => item.key), ["b", "a", "c"]);
  assert.match(error.message, /Google unavailable/);
});

test("an empty airport invalidates pending replies and lets the next batch be ranked anew", async () => {
  const late = deferred();
  let calls = 0;
  const published = [];
  const queue = new QueueRanking({ delayMs: 0, rank: () => ++calls === 1 ? late.promise : Promise.resolve(result(["b", "a"])), publish: order => published.push(order.map(item => item.key)) });
  queue.schedule([item("a")]);
  await wait(10);
  queue.schedule([]);
  late.resolve(result(["a"]));
  await wait(10);
  assert.deepEqual(published, []);
  queue.schedule([item("a"), item("b")]);
  await wait(10);
  assert.deepEqual(published, [["b", "a"]]);
  queue.schedule([]);
  assert.deepEqual(published.at(-1), []);
  assert.equal(calls, 2);
});
