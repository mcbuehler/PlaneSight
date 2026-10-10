// Plane Sight server. Holds agent approvals and questions from Claude Code and Codex hooks,
// polls Herdr for agent state, asks Gemini for a card per waiting item and a ranking,
// and pushes the whole state to the browser over Server-Sent Events.
import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as h from "./herdr.mjs";
import * as gemini from "./gemini.mjs";
import { sessionInfo } from "./entire.mjs";
import * as ranker from "./ranker.mjs";
import { findCollision } from "./collisions.mjs";
import { QueueRanking } from "./queue-ranking.mjs";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = new URL("..", import.meta.url).pathname;
const WEB = path.join(ROOT, "dist"); // the built app: npm run build
const DATA = path.join(ROOT, "data");
const DECISIONS = path.join(DATA, "decisions.jsonl");
const CODEX_HOLD_MS = Number(process.env.CODEX_HOLD_MS ?? 60_000); // Codex blocks its terminal while held
const CLAUDE_HOLD_MS = Number(process.env.CLAUDE_HOLD_MS ?? 3_590_000); // just under the hook timeout
// Only show agents whose cwd starts with one of these prefixes (comma separated). Empty = all.
const ONLY = (process.env.PLANESIGHT_ONLY ?? "").split(",").filter(Boolean);
mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------- state

/** sessionId -> unit. A unit is one agent session (one plane). */
const units = new Map();
const cards = new Map(); // need key -> card | "pending"
let ranking = []; // [{ key, reason }]
const repoCache = new Map(); // cwd -> repo name

function unit(sessionId) {
  let u = units.get(sessionId);
  if (!u) {
    u = { sessionId, paneId: null, agent: "agent", name: null, title: null, cwd: null, repo: null,
      status: "unknown", statusSince: Date.now(), held: null, landed: null, blockedAt: null,
      files: new Set(), lastPrompt: null, tokens: null, skipped: new Set() };
    units.set(sessionId, u);
  }
  return u;
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function repoOf(cwd) {
  if (!cwd) return Promise.resolve({ name: "unknown", root: null });
  if (repoCache.has(cwd)) return Promise.resolve(repoCache.get(cwd));
  return new Promise((resolve) => {
    execFile("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], (err, out) => {
      const root = err ? path.resolve(cwd) : out.trim();
      const repo = { name: err ? path.basename(cwd) : path.basename(path.dirname(root)), root };
      repoCache.set(cwd, repo);
      resolve(repo);
    });
  });
}

const rel = (u, file) => (file && u.cwd ? path.relative(u.cwd, path.resolve(u.cwd, file)) : file);

// What the unit needs from the user right now, or null.
function needOf(u) {
  if (u.held) return { kind: u.held.kind, key: `held:${u.held.id}` };
  // Right after an answer Herdr still says blocked for a moment; wait for its next status.
  if (u.status === "blocked" && !u.answeredBlocked) return { kind: "blocked", key: `blocked:${u.sessionId}:${u.blockedAt}` };
  if (u.landed) return { kind: "landed", key: `landed:${u.sessionId}:${u.landed.at}` };
  return null;
}

const collisionOf = (u) => findCollision(u, units);

// ---------------------------------------------------------------- hooks

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

// Body for a held hook. `pass` means no decision: the agent falls back to its own terminal UI.
function hookReply(agent, kind, ev, answer) {
  if (answer.action === "pass") return agent === "codex" ? "{}" : "";
  if (kind === "question") {
    if (answer.action === "deny") {
      return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny",
        permissionDecisionReason: `The user already answered this question from the dashboard. Their answer: ${answer.text}` } });
    }
    const questions = ev.tool_input?.questions ?? [];
    const answers = Object.fromEntries(questions.map((q) => [q.question, answer.text || q.options?.[0]?.label || "yes"]));
    return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow",
      updatedInput: { ...ev.tool_input, answers } } });
  }
  const decision = answer.action === "allow"
    ? { behavior: "allow" }
    : { behavior: "deny", message: answer.text || "The user denied this from their dashboard." };
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision } });
}

async function onHook(req, res, agent, kind) {
  let ev = {};
  try { ev = JSON.parse(await readBody(req)); } catch { return res.end(agent === "codex" ? "{}" : ""); }
  const name = ev.hook_event_name ?? "";
  if (!ev.session_id) return res.end(agent === "codex" ? "{}" : "");
  if (ONLY.length && !ONLY.some((p) => ev.cwd?.startsWith(p))) return res.end(agent === "codex" ? "{}" : "");
  const u = unit(ev.session_id);
  u.agent = agent;
  u.paneId ??= req.headers["x-herdr-pane"] ?? null;
  if (ev.cwd && !u.cwd) {
    u.cwd = ev.cwd;
    const repo = await repoOf(ev.cwd);
    u.repo = repo.name; u.repoRoot = repo.root;
  }
  if (ev.transcript_path) u.transcriptPath = ev.transcript_path;

  if (name === "UserPromptSubmit") { u.lastPrompt = ev.prompt ?? u.lastPrompt; u.landed = null; }
  if (/^(PostToolUse)$/.test(name)) {
    const file = ev.tool_input?.file_path ?? ev.tool_input?.path;
    if (file && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(ev.tool_name ?? "")) u.files.add(rel(u, file));
  }
  if (name === "Stop") u.landed = { at: Date.now(), message: ev.last_assistant_message ?? null };

  // The user answered in the terminal: the agent moves on but never closes the held hook.
  if (/^(PostToolUse|PostToolUseFailure|Stop|UserPromptSubmit|Interrupt|SessionEnd)$/.test(name) && u.held) {
    log("stale", u.held.tool, u.sessionId.slice(0, 8));
    u.held.resolve?.({ action: "pass" });
    u.held = null;
  }
  changed();

  const isQuestion = kind === "question" || (agent === "codex" && /request_user_input|ask/i.test(ev.tool_name ?? ""));
  const hold = kind === "permission" || (isQuestion && name === "PreToolUse");
  if (!hold) return res.end(agent === "codex" ? "{}" : "");

  const holdKind = isQuestion ? "question" : "approval";
  const id = randomUUID().slice(0, 8);
  const answer = await new Promise((resolve) => {
    u.held = { id, kind: holdKind, tool: ev.tool_name, input: ev.tool_input, since: Date.now(), resolve, expired: false };
    log("holding", holdKind, ev.tool_name, u.sessionId.slice(0, 8));
    changed();
    setTimeout(() => resolve({ action: "pass", timeout: true }), agent === "codex" ? CODEX_HOLD_MS : CLAUDE_HOLD_MS);
    res.on("close", () => { if (!res.writableFinished) resolve({ action: "cancelled" }); });
  });
  if (u.held?.id === id) {
    if (answer.timeout) {
      // Keep the request on screen. Answers now go through Herdr keys instead of the hook.
      u.held.expired = true;
      u.held.resolve = null;
    } else {
      u.held = null;
    }
    changed();
  }
  if (answer.action === "cancelled") return;
  res.end(hookReply(agent, holdKind, { tool_input: u.held?.input ?? {}, ...ev }, answer));
}

// ---------------------------------------------------------------- herdr polling

async function poll() {
  let agents;
  try { agents = await h.listAgents(); } catch (e) { log("herdr", e.message); return; }
  const seen = new Set();
  for (const a of agents) {
    const sessionId = a.agent_session?.value ?? `pane:${a.pane_id}`;
    const cwd = a.foreground_cwd ?? a.cwd;
    if (ONLY.length && !ONLY.some((p) => cwd?.startsWith(p))) continue;
    seen.add(sessionId);
    const u = unit(sessionId);
    u.paneId = a.pane_id;
    u.agent = a.agent ?? u.agent;
    u.name = a.name ?? u.name;
    u.title = a.terminal_title_stripped || u.title;
    if (!u.cwd) {
      u.cwd = cwd;
      const repo = await repoOf(cwd);
      u.repo = repo.name; u.repoRoot = repo.root;
      // Seed edited files from Entire so a server restart keeps collision data.
      if (a.agent_session?.value) {
        sessionInfo(u.sessionId, cwd).then((info) => {
          for (const f of info?.files_touched ?? []) u.files.add(rel(u, f));
          u.tokens = info?.tokens?.total ?? u.tokens;
          u.lastPrompt ??= info?.last_prompt ?? null;
          if (info) changed();
        });
      }
    }
    const status = a.agent_status ?? "unknown";
    if (status !== u.status) {
      u.answeredBlocked = false;
      if (status === "blocked") u.blockedAt = Date.now();
      if (status === "done" && !u.landed) u.landed = { at: Date.now(), message: null };
      if (status === "working") { u.landed = null; if (u.held?.expired) u.held = null; }
      u.status = status;
      u.statusSince = Date.now();
      changed();
    }
  }
  for (const u of units.values()) {
    if (!seen.has(u.sessionId) && u.status !== "gone" && u.paneId && !u.held) {
      u.status = "gone";
      changed();
    }
  }
}

// ---------------------------------------------------------------- cards and ranking

async function itemFor(u, need) {
  const item = {
    key: need.key, kind: need.kind, agent: u.agent, repo: u.repo, title: u.title,
    waiting_seconds: Math.round((Date.now() - (u.held?.since ?? u.blockedAt ?? u.landed?.at ?? Date.now())) / 1000),
    last_user_prompt: u.lastPrompt?.slice(0, 600) ?? null,
  };
  if (u.held) item.request = { tool: u.held.tool, input: truncate(u.held.input) };
  const collision = collisionOf(u);
  if (collision) item.collision = collision;
  if (need.kind === "landed") {
    item.last_message = u.landed.message?.slice(0, 2000) ?? null;
    const info = await sessionInfo(u.sessionId, u.cwd);
    if (info) {
      u.tokens = info.tokens?.total ?? u.tokens;
      u.lastPrompt ??= info.last_prompt;
      item.entire = { files_touched: info.files_touched, turns: info.turns, tokens: info.tokens?.total, last_prompt: info.last_prompt };
    }
  }
  if (need.kind === "blocked" || (need.kind === "landed" && !item.last_message)) {
    item.terminal = await h.readPane(u.paneId, 40).catch(() => "");
  }
  if (need.kind === "blocked") {
    // A Claude edit prompt on screen looks like "⏺ Write(/path/to/file)". Use it for the collision check.
    // Only an edit prompt that is on screen now counts, not an old Write further up the scrollback.
    const recent = item.terminal.split("\n").slice(-25).join("\n");
    const prompting = /Do you want to (create|make this edit|edit|overwrite)/i.test(recent);
    const m = prompting ? [...recent.matchAll(/(Write|Edit|Update)\(([^)\n]+)\)/g)].pop() : null;
    u.screenRequest = m ? { tool: m[1], input: { file_path: m[2].trim() } } : null;
    const collision = collisionOf(u);
    if (collision) item.collision = collision;
  }
  return item;
}

function truncate(v) {
  const s = JSON.stringify(v ?? {});
  return s.length > 3000 ? s.slice(0, 3000) + "…" : v;
}

function fetchCards() {
  for (const u of units.values()) {
    const need = needOf(u);
    if (!need) continue;
    const card = cards.get(need.key);
    // Rewrite the card when a collision appears or goes away after it was written.
    if (card && card !== "pending" && Boolean(card.collision) !== Boolean(collisionOf(u))) cards.delete(need.key);
    if (cards.has(need.key)) continue;
    cards.set(need.key, "pending");
    itemFor(u, need)
      .then((item) => gemini.writeCard(item).then((card) => ({ ...card, collision: item.collision ?? null })))
      .then((card) => { cards.set(need.key, card); log("card", need.kind, card.proposal?.action, u.sessionId.slice(0, 8)); changed(); })
      .catch((e) => { cards.delete(need.key); log("card failed", e.message); });
  }
}

function queueItems() {
  const out = [];
  for (const u of units.values()) {
    const need = needOf(u);
    if (!need || u.skipped.has(need.key) || u.status === "gone") continue;
    const card = cards.get(need.key);
    out.push({ key: need.key, kind: need.kind, repo: u.repo, agent: u.agent,
      waiting_seconds: Math.round((Date.now() - (u.held?.since ?? u.blockedAt ?? u.landed?.at ?? Date.now())) / 1000),
      collision: collisionOf(u),
      card: card && card !== "pending" ? { category: card.category, summary: card.summary, effort_seconds: card.effort_seconds, risk: card.risk } : null });
  }
  return out;
}

// What the team's decision maker gets: one entry per waiting agent, with its Claude Code transcript.
function teamItems() {
  const out = [];
  for (const u of units.values()) {
    const need = needOf(u);
    if (!need || u.skipped.has(need.key) || u.status === "gone") continue;
    const transcript = u.agent === "claude" ? (u.transcriptPath ?? ranker.transcriptPathFor(u.sessionId, u.cwd)) : null;
    out.push({ key: need.key, sessionId: u.sessionId, transcript });
  }
  return out;
}

const queueRanking = new QueueRanking({
  rank: async (items) => {
    const teamOrder = await ranker.rankWithTeam(teamItems(), DATA);
    if (teamOrder) return { order: teamOrder, failed: Boolean(ranker.status.error) };
    const order = await gemini.rank(items, recentDecisions());
    return { order, failed: Boolean(gemini.status.rankError) };
  },
  publish: (order) => {
    ranking = order;
    log("ranked", ranking.map((r) => r.key.split(":")[0]).join(" "));
    broadcast();
  },
  onError: (error) => log("ranking failed", error.message),
});

function scheduleRank() { queueRanking.schedule(queueItems()); }

// ---------------------------------------------------------------- decisions

function recentDecisions(n = 20) {
  if (!existsSync(DECISIONS)) return [];
  return readFileSync(DECISIONS, "utf8").trim().split("\n").filter(Boolean).slice(-n).map((l) => JSON.parse(l));
}

async function answer(sessionId, { choice, action, text, key }) {
  const u = units.get(sessionId);
  const need = u && needOf(u);
  if (!need) throw new Error("nothing to answer");
  // The browser names the item it showed; refuse if the agent moved on since.
  if (key && key !== need.key) throw new Error("this item changed; look again");
  const card = cards.get(need.key);
  const waited = Math.round((Date.now() - (u.held?.since ?? u.blockedAt ?? u.landed?.at ?? Date.now())) / 1000);
  if (choice === "skip") {
    u.skipped.add(need.key);
  } else {
    action ??= card?.proposal?.action;
    text ??= card?.proposal?.text ?? "";
    await execute(u, need, action, text);
  }
  ranker.recordChoice(u.sessionId, choice, DATA);
  appendFileSync(DECISIONS, JSON.stringify({ t: new Date().toISOString(), choice, kind: need.kind, category: card?.category,
    repo: u.repo, agent: u.agent, action, proposed: card?.proposal?.action,
    waited_seconds: waited }) + "\n");
  log("answered", choice, action, u.sessionId.slice(0, 8));
  changed();
}

async function execute(u, need, action, text) {
  const target = u.paneId;
  if (u.status === "blocked") u.answeredBlocked = true;
  if (u.held && !u.held.expired) {
    const hookAction = action === "allow" || action === "answer" ? "allow" : "deny";
    u.held.resolve({ action: hookAction, text });
    u.held = null;
    return;
  }
  if (need.kind === "landed") {
    if (action === "prompt" && text) await h.prompt(target, text);
    u.landed = null;
    return;
  }
  // A prompt on the agent's screen (expired hold, or an agent without our hooks).
  if (action === "allow" || action === "answer") {
    await h.sendKeys(target, ["enter"]);
  } else {
    await h.sendKeys(target, ["esc"]);
    if (text) setTimeout(() => h.prompt(target, text).catch((e) => log("prompt failed", e.message)), 1500);
  }
  u.held = null;
}

// ---------------------------------------------------------------- SSE

const clients = new Set();
let changeTimer = null;
function changed() {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => { fetchCards(); scheduleRank(); broadcast(); }, 80);
}

function snapshot() {
  const order = new Map(ranking.map((r, i) => [r.key, i]));
  const planes = [...units.values()].filter((u) => u.status !== "gone").map((u) => {
    const need = needOf(u);
    const card = need ? cards.get(need.key) : null;
    return {
      session: u.sessionId, pane: u.paneId, herdrUrl: u.paneId ? h.webUrl(u.paneId) : null, agent: u.agent, name: u.name, title: u.title, repo: u.repo, status: u.status,
      tokens: u.tokens, files: [...u.files],
      need: need && { ...need, skipped: u.skipped.has(need.key), since: u.held?.since ?? u.blockedAt ?? u.landed?.at,
        rank: order.get(need.key) ?? null, reason: ranking.find((r) => r.key === need.key)?.reason ?? null,
        urgency: ranking.find((r) => r.key === need.key)?.urgency ?? null,
        request: u.held ? { tool: u.held.tool, input: truncate(u.held.input), expired: u.held.expired } : null,
        message: u.landed?.message?.slice(0, 600) ?? null, collision: collisionOf(u),
        card: card === "pending" ? null : card ?? null, cardPending: card === "pending" },
    };
  });
  return { now: Date.now(), herdrUrl: h.webUrl(), gemini: { enabled: gemini.geminiEnabled(), ...gemini.status }, ranker: ranker.status, planes };
}

function broadcast() {
  const data = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(data);
}

// ---------------------------------------------------------------- http

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  // The Tower view in herdr-web-ui (another port) reads this server directly.
  res.setHeader("access-control-allow-origin", "*");
  try {
    if (req.method === "POST" && parts[0] === "hook") return await onHook(req, res, parts[1], parts[2]);

    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      clients.add(res);
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "answer") {
      await answer(decodeURIComponent(parts[2]), JSON.parse((await readBody(req)) || "{}"));
      return res.end("ok");
    }
    if (req.method === "GET" && parts[0] === "api" && parts[1] === "tail") {
      const u = units.get(decodeURIComponent(parts[2]));
      return res.end(u?.paneId ? await h.readPane(u.paneId, 60) : "");
    }
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "prompt") {
      const u = units.get(decodeURIComponent(parts[2]));
      const { text } = JSON.parse((await readBody(req)) || "{}");
      if (!u?.paneId || !text) throw new Error("no agent or no text");
      await h.prompt(u.paneId, text);
      u.landed = null;
      changed();
      return res.end("ok");
    }
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "stop") {
      const u = units.get(decodeURIComponent(parts[2]));
      if (u?.paneId) await h.sendKeys(u.paneId, ["esc"]);
      return res.end("ok");
    }
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "launch") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!body.repo || !body.prompt) throw new Error("repo and prompt are required");
      const slug = body.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "flight";
      const name = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      log("launch", name, body.kind, body.repo);
      h.launch({ ...body, name }).then(() => log("launched", name)).catch((e) => log("launch failed", name, e.message));
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ name }));
    }
    if (req.method === "POST" && parts[0] === "api" && parts[1] === "focus") {
      const u = units.get(decodeURIComponent(parts[2]));
      if (u?.paneId) await h.focus(u.paneId);
      return res.end("ok");
    }
    if (req.method === "GET") {
      const file = path.join(WEB, path.normalize(url.pathname === "/" ? "/index.html" : url.pathname));
      if (file.startsWith(WEB) && existsSync(file)) {
        res.setHeader("content-type", TYPES[path.extname(file)] ?? "application/octet-stream");
        return res.end(readFileSync(file));
      }
    }
    res.statusCode = 404;
    res.end();
  } catch (e) {
    log("error", req.url, e.message);
    res.statusCode = 500;
    res.end(e.message);
  }
}).listen(PORT, "127.0.0.1", () => {
  log(`Plane Sight on http://127.0.0.1:${PORT}  gemini=${gemini.geminiEnabled() ? "on" : "off (heuristics)"}`);
});

await ranker.loadRanker();
log(`ranking: ${ranker.teamRankerLoaded() ? `team decision maker (${ranker.status.entry})` : "built-in"}${ranker.status.error ? ` (${ranker.status.error})` : ""}`);
setInterval(poll, 1000);
poll();
