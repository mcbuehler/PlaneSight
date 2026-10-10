import { expect, it } from "bun:test";
import { sentPane } from "../src/herdrEmbed";

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

it("ignores other events, malformed payloads and other machines", () => {
  for (const data of [null, "sent", {}, { ...message, type: "herdr:message-queued" }, { ...message, machineId: "remote" }, { ...message, paneId: null }, { ...message, paneId: "" }]) {
    expect(sentPane({ ...event, data }, frame)).toBeNull();
  }
});
