// The seam to the team's Gemini decision maker (branch feat/session-urgency-ranker).
//
// By default it loads agent/src/index.js from this repository; PLANESIGHT_RANKER overrides the path.
// Plane Sight sends it, for every agent that needs you, the agent's Claude Code
// transcript as { sessionId, jsonl }, together with the decisions you made in the airport.
// Its order replaces the built-in ranking. Without the variable, or if it fails, the
// built-in ranking in gemini.mjs stays in charge.
import { appendFileSync, existsSync, openSync, readSync, closeSync, statSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_TRANSCRIPT = 2_000_000; // bytes from the end of a transcript; enough for the recent turns
const PROFILE = process.env.PLANESIGHT_PROFILE ?? "";

let team = null;
export const status = { source: "built-in", entry: null, error: null, explanation: null };

// The team's decision maker lives in the repository at agent/; PLANESIGHT_RANKER can point elsewhere.
const BUNDLED = new URL("../../agent/src/index.js", import.meta.url).pathname;

export async function loadRanker() {
  const entry = process.env.PLANESIGHT_RANKER || (existsSync(BUNDLED) ? BUNDLED : null);
  if (!entry) return null;
  try {
    team = await import(pathToFileURL(path.resolve(entry)).href);
    if (typeof team.rankSessions !== "function") throw new Error("the module does not export rankSessions()");
    status.source = "team";
    status.entry = path.relative(process.cwd(), entry);
    return team;
  } catch (e) {
    status.error = `ranker: ${e.message}`;
    team = null;
    return null;
  }
}

export const teamRankerLoaded = () => team !== null;

/** Claude Code keeps each session at ~/.claude/projects/<cwd with / and . as ->/<session>.jsonl. */
export function transcriptPathFor(sessionId, cwd) {
  if (!cwd) return null;
  const file = path.join(os.homedir(), ".claude", "projects", cwd.replace(/[/.]/g, "-"), `${sessionId}.jsonl`);
  return existsSync(file) ? file : null;
}

/** The end of a transcript, cut at a line boundary so every record parses. */
function readTail(file) {
  const size = statSync(file).size;
  if (size <= MAX_TRANSCRIPT) return readFileSync(file, "utf8");
  const buf = Buffer.alloc(MAX_TRANSCRIPT);
  const fd = openSync(file, "r");
  readSync(fd, buf, 0, MAX_TRANSCRIPT, size - MAX_TRANSCRIPT);
  closeSync(fd);
  const text = buf.toString("utf8");
  return text.slice(text.indexOf("\n") + 1);
}

let lastResult = null; // the team ranker's last result, for recording what you chose
const DECISIONS = (dataDir) => path.join(dataDir, "ranker-decisions.jsonl");

function pastDecisions(dataDir, n = 40) {
  const file = DECISIONS(dataDir);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").trim().split("\n").filter(Boolean).slice(-n).map((l) => JSON.parse(l));
}

/**
 * Ranks the waiting agents with the team's decision maker.
 * @param {{ key: string, sessionId: string, transcript: string | null }[]} items  one per agent that needs you
 * @returns {Promise<{ key: string, reason: string, urgency: number | null, category: string }[] | null>}
 *   null when the team ranker is not loaded or cannot rank these agents; the caller falls back.
 */
export async function rankWithTeam(items, dataDir) {
  if (!team) return null;
  const sessions = items
    .filter((i) => i.transcript)
    .map((i) => ({ sessionId: i.sessionId, jsonl: readTail(i.transcript) }));
  if (sessions.length === 0) return null;
  try {
    const result = await team.rankSessions(sessions, {
      apiKey: process.env.GEMINI_API_KEY,
      profile: PROFILE,
      pastDecisions: pastDecisions(dataDir),
    });
    lastResult = result;
    status.source = `team (${result.source})`;
    status.error = result.error ?? null;
    status.explanation = result.explanation || null;
    const keyOf = new Map(items.map((i) => [i.sessionId, i.key]));
    const order = result.ranking
      .filter((r) => keyOf.has(r.sessionId))
      .map((r) => ({ key: keyOf.get(r.sessionId), reason: r.reason, urgency: r.urgency, category: r.category }));
    // agents without a transcript (Codex) keep their place after the ranked ones
    for (const i of items) if (!order.some((o) => o.key === i.key)) order.push({ key: i.key, reason: "", urgency: null, category: "" });
    return order;
  } catch (e) {
    status.error = `ranker: ${e.message}`;
    return null;
  }
}

/** Tells the team ranker which agent you attended to, in its own decision format. */
export function recordChoice(sessionId, choice, dataDir) {
  if (!team?.makeDecision || !lastResult || choice === "skip") return;
  try {
    const decision = team.makeDecision(lastResult, sessionId, { note: choice === "edit" ? "edited the proposal" : undefined });
    appendFileSync(DECISIONS(dataDir), JSON.stringify(decision) + "\n");
  } catch {
    // the session was not part of the last ranking; nothing to learn from
  }
}
