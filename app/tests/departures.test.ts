import { expect, it } from "bun:test";
import { Departures } from "../src/departures";
import type { Plane } from "../src/types";

const waiting: Plane = {
  session: "runway", pane: "w4:p1", herdrUrl: null, agent: "claude", name: "authentication",
  title: null, repo: "demo", status: "done", tokens: null, files: [],
  need: { key: "landed:runway:1", kind: "landed", skipped: false, since: 1, rank: 0, reason: null,
    urgency: null, request: null, message: null, collision: null, card: null, cardPending: false },
};

it("does not restore the old plane when takeoff finishes before the server catches up", () => {
  const departures = new Departures();
  expect(departures.start(waiting)).toBe(true);
  expect(departures.start(waiting)).toBe(false);
  departures.finish(waiting.session, [waiting]);
  expect(departures.sessions.has(waiting.session)).toBe(true);
  departures.reconcile([{ ...waiting, need: null }]);
  expect(departures.sessions.has(waiting.session)).toBe(true);
  departures.reconcile([{ ...waiting, status: "working", need: null }]);
  expect(departures.sessions.has(waiting.session)).toBe(false);
});

it("finishes the takeoff before showing a quickly returned agent's new request", () => {
  const departures = new Departures();
  departures.start(waiting);
  const returned = { ...waiting, need: { ...waiting.need!, key: "landed:runway:2" } };
  departures.reconcile([returned]);
  expect(departures.sessions.has(waiting.session)).toBe(true);
  departures.finish(waiting.session, [returned]);
  expect(departures.sessions.has(waiting.session)).toBe(false);
  expect(departures.start(returned)).toBe(true);
});

it("does not cancel takeoff when a working status arrives early or the agent disappears", () => {
  const departures = new Departures();
  departures.start(waiting);
  departures.reconcile([{ ...waiting, status: "working", need: null }]);
  expect(departures.sessions.has(waiting.session)).toBe(true);
  departures.finish(waiting.session, []);
  expect(departures.sessions.size).toBe(0);
});
