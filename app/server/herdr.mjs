// Minimal client for the Herdr socket API: one newline-delimited JSON request per connection.
import net from "node:net";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SOCK = process.env.HERDR_SOCKET_PATH ?? path.join(os.homedir(), ".config/herdr/herdr.sock");
let seq = 0;

// The browser client selects an agent by its Herdr pane, not its Claude/Codex session ID.
export function webUrl(paneId = null) {
  let url;
  try { url = new URL(process.env.HERDR_WEB_URL ?? "http://127.0.0.1:7317/"); }
  catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (paneId) {
    url.searchParams.set("machine", "local");
    url.searchParams.set("pane", paneId);
    url.searchParams.set("view", "chat");
  }
  return url.href;
}

export function herdr(method, params = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const id = `planesight:${++seq}`;
    const sock = net.createConnection(SOCK);
    let buf = "";
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`herdr ${method} timed out`));
    }, timeoutMs);
    sock.on("connect", () => sock.write(JSON.stringify({ id, method, params }) + "\n"));
    sock.on("data", (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      clearTimeout(timer);
      sock.end();
      let msg;
      try { msg = JSON.parse(buf.slice(0, nl)); } catch (e) { return reject(e); }
      if (msg.error) return reject(Object.assign(new Error(`herdr ${method}: ${msg.error.message}`), { code: msg.error.code }));
      resolve(msg.result);
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export const listAgents = async () => (await herdr("agent.list")).agents ?? [];
export const prompt = (target, text) => herdr("agent.prompt", { target, text });
export const sendKeys = (target, keys) => herdr("agent.send_keys", { target, keys });
export const focus = (target) => herdr("agent.focus", { target });
export async function readPane(paneId, lines = 60) {
  const r = await herdr("pane.read", { pane_id: paneId, source: "recent", lines, strip_ansi: true });
  return r?.read?.text ?? r?.text ?? "";
}

// Start an agent the way scripts/launch-demo.sh does: a new worktree, the agent with our hooks, then the prompt.
const HOOKS = new URL("../hooks/", import.meta.url).pathname;
const cli = (args, timeout = 60_000) =>
  new Promise((resolve, reject) => {
    execFile("herdr", args, { timeout }, (err, out) => {
      let msg = null;
      try { msg = JSON.parse(out); } catch { /* plain text output */ }
      if (msg?.error) return reject(new Error(msg.error.message));
      if (err && !msg) return reject(err);
      resolve(msg?.result ?? out);
    });
  });

export async function launch({ repo, kind = "claude", prompt: text, name }) {
  const created = await cli(["worktree", "create", "--cwd", repo, "--branch", name, "--label", name, "--no-focus"]);
  const pane = created.root_pane.pane_id;
  const args = kind === "codex"
    ? ["-a", "on-request", "-s", "read-only", "--dangerously-bypass-hook-trust"]
    : ["--settings", `${HOOKS}claude-settings.json`, "--permission-mode", "default", ...(process.env.CLAUDE_EXTRA?.split(" ").filter(Boolean) ?? [])];
  await cli(["agent", "start", name, "--kind", kind, "--pane", pane, "--", ...args]).catch(() => {});
  // Answer startup prompts (folder trust, update notice) until the agent is ready, then send the task.
  for (let i = 0; i < 15; i++) {
    const agent = await herdr("agent.get", { target: name }).catch(() => null);
    if (agent?.agent?.interactive_ready) break;
    const screen = await readPane(pane, 30).catch(() => "");
    if (/trust/i.test(screen)) await sendKeys(name, kind === "claude" ? ["down", "enter"] : ["enter"]).catch(() => {});
    else if (/update (available|now)|new version/i.test(screen)) await sendKeys(name, ["down", "enter"]).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (text) {
    await new Promise((r) => setTimeout(r, 1500));
    await prompt(name, text);
    // A prompt typed while the agent is still settling can stay unsent in its input line; press Enter then.
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const agent = await herdr("agent.get", { target: name }).catch(() => null);
      if (agent?.agent?.agent_status === "working") break;
      const screen = await readPane(pane, 12).catch(() => "");
      if (i === 5 && screen.includes(text.slice(0, 40))) await sendKeys(name, ["enter"]).catch(() => {});
    }
  }
  return { pane, name };
}
