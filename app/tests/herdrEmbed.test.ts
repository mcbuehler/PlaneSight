import { expect, it } from "bun:test";
import { resumedPane, sentPane } from "../src/herdrEmbed";
import type { Plane } from "../src/types";

const source = {} as Window;
const frame = { contentWindow: source, src: "http://127.0.0.1:7317/?pane=w6%3Ap1" };
const message = { type: "herdr:message-sent", machineId: "local", paneId: "w6:p1" };
const event = { source, origin: "http://127.0.0.1:7317", data: message };

it("accepts a delivered message only from the current Herdr frame and origin", () => {
  expect(sentPane(event, frame)).toBe("w6:p1");
  expect(sentPane({ ...event, source: {} as Window }, frame)).toBeNull();
  expect(sentPane({ ...event, origin: "http://unrelated.example" }, frame)).toBeNull();
  expect(sentPane(event, { ...frame, contentWindow: null })).toBeNull();
});

const waiting: Plane = {
  session: "demo", pane: "w6:p1", status: "done", agent: "claude", name: "authentication",
  title: null, repo: null, tokens: null, files: [], herdrUrl: null, need: null,
};

it("returns from a native terminal when that exact session starts working", () => {
  expect(resumedPane(waiting.pane, [waiting], [{ ...waiting, status: "working" }])).toEqual(waiting);
});

it("does not return on opening a working session, unrelated activity, or an unchanged snapshot", () => {
  const working = { ...waiting, status: "working" };
  expect(resumedPane(waiting.pane, [working], [working])).toBeNull();
  expect(resumedPane(waiting.pane, [waiting], [waiting])).toBeNull();
  expect(resumedPane("w5:p1", [waiting], [working])).toBeNull();
  expect(resumedPane("overview", [waiting], [working])).toBeNull();
  expect(resumedPane(null, [waiting], [working])).toBeNull();
  expect(resumedPane(waiting.pane, [waiting], [{ ...working, session: "replacement" }])).toBeNull();
});

it("ignores other events, malformed payloads and other machines", () => {
  for (const data of [null, "sent", {}, { ...message, type: "herdr:message-queued" }, { ...message, machineId: "remote" }, { ...message, paneId: null }, { ...message, paneId: "" }]) {
    expect(sentPane({ ...event, data }, frame)).toBeNull();
  }
});
