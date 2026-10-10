#!/usr/bin/env node
// An isolated, real eight-agent demo. Run --prepare, start the named Herdr server,
// then run --launch. Re-running never overwrites an existing agent or worktree.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));
const fixture = path.join(project, "app/demo/team-release");
const root = path.resolve(process.env.PLANESIGHT_DEMO_ROOT ?? path.join(project, "out/eight-claudes-demo"));
const manifestFile = path.join(root, "demo.json");
const herdr = process.env.HERDR_BIN ?? "herdr";
const session = process.env.PLANESIGHT_DEMO_SESSION ?? "planesight-release-demo";
const tasks = JSON.parse(readFileSync(path.join(fixture, "tasks.json"), "utf8"));
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] });
const save = (manifest) => writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
const control = (...args) => JSON.parse(run(herdr, ["--session", session, ...args])).result;

if (process.argv.includes("--prepare")) {
  if (existsSync(manifestFile) || existsSync(path.join(root, "repo"))) throw new Error(`Demo already exists: ${root}. Use it, or choose a new PLANESIGHT_DEMO_ROOT and session.`);
  mkdirSync(root, { recursive: true });
  const repo = path.join(root, "repo");
  cpSync(path.join(fixture, "seed"), repo, { recursive: true });
  run("git", ["init", "-b", "main"], repo);
  // Only the disposable seed gets Entire session tracking; no remotes are created.
  run("entire", ["enable", "--project", "--agent", "claude-code", "--skip-push-sessions", "--telemetry=false"], repo);
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "Seed CrewBoard release demo"], repo);
  save({ root, repo, session, socket: path.join(os.homedir(), ".config/herdr/sessions", session, "herdr.sock"), agents: [] });
  console.log(`Prepared ${root}. Start: ${herdr} --session ${session} server`);
} else if (process.argv.includes("--launch")) {
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  if (manifest.session !== session) throw new Error("Session differs from saved manifest.");
  for (const task of tasks) {
    let agent = manifest.agents.find((a) => a.id === task.id);
    if (agent?.started) { console.log(`${task.id}: already started; preserved`); continue; }
    if (!agent) {
      const cwd = path.join(root, "worktrees", task.id);
      mkdirSync(path.dirname(cwd), { recursive: true });
      const created = control("worktree", "create", "--cwd", manifest.repo, "--branch", `demo/${task.id}`, "--path", cwd, "--label", task.title, "--no-focus");
      agent = { id: task.id, title: task.title, cwd, pane: created.root_pane.pane_id };
      manifest.agents.push(agent); save(manifest);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    try {
      const existing = control("agent", "list").agents.find((a) => a.pane_id === agent.pane);
      if (existing) {
        console.log(`${task.id}: existing agent preserved; inspect startup, then use --prompt ${task.id}`);
        continue;
      }
      control("agent", "start", task.id, "--kind", "claude", "--pane", agent.pane, "--timeout", "30000", "--",
        "--settings", path.join(project, "app/hooks/claude-settings.json"),
        "--permission-mode", "default", "--tools", "Read,Edit,Write,Glob,Grep,Bash,AskUserQuestion",
        "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(node --test *),Bash(git diff *),Bash(git status *)");
      agent.started = true; save(manifest);
      control("agent", "prompt", task.id, task.prompt);
      agent.prompted = true; save(manifest);
      console.log(`${task.id}: launched in ${agent.pane}`);
    } catch (error) {
      console.error(`${task.id}: inspect startup before continuing: ${error.stderr?.toString().slice(0, 1500) ?? error.message}`);
      save(manifest);
    }
  }
  console.log(`Manifest: ${manifestFile}`);
} else if (process.argv.includes("--prompt")) {
  const id = process.argv[process.argv.indexOf("--prompt") + 1];
  const task = tasks.find((t) => t.id === id);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const agent = manifest.agents.find((a) => a.id === id);
  if (!task || !agent || agent.prompted) throw new Error("Unknown or already prompted agent.");
  const current = control("agent", "get", id).agent;
  if (!current.interactive_ready) throw new Error("Inspect and resolve startup first.");
  control("agent", "prompt", id, task.prompt);
  agent.started = true; agent.prompted = true; save(manifest);
} else {
  console.log("Usage: node app/scripts/setup-eight-claudes.mjs --prepare | --launch | --prompt <id>");
}
