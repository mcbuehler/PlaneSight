# Plane Sight

Air traffic control for many coding agents that run in parallel in [Herdr](https://herdr.dev). Every agent is a plane on a pixel-art airfield. Agents that need you queue at the runway in the order the tower ranks them; Gemini drafts the answer and you accept it with one key. Built at the Agentic AI Hack Zürich, 10 October 2026.

## Run it

You need Node 22.12 or newer, [Bun](https://bun.sh), git and Herdr (built on 0.9.3), with Herdr running. Agents need Claude Code or Codex.

```sh
npm run setup   # once: installs the app, builds the embedded Herdr web client, creates .env
npm run up      # Plane Sight on http://127.0.0.1:7777
```

Put your `GEMINI_API_KEY` in `.env`; `.env.example` lists the other settings. For development with hot reload, use `npm run dev` and open http://localhost:5173. Details are in [app/README.md](app/README.md).

## What is where

| Folder | What it is |
|---|---|
| [`app/`](app/README.md) | The live airport: a Phaser 4 web app and a Node server that talks to Herdr, the agents' hooks, Gemini and Entire |
| [`agent/`](agent/) | The tower's decision maker: ranks the agents that need you by urgency, with Gemini, and with rules when Gemini is unavailable. The app loads it directly ([how](app/docs/ranker.md)) |
| [`promo/`](promo/README.md) | The promo video and the airport art, built with Remotion |

## Commands

| Command | What it does |
|---|---|
| `npm run setup` | One-time setup of the app and herdr-web-ui |
| `npm run up` | Builds the app and starts it with herdr-web-ui; Ctrl+C stops both |
| `npm run dev` | The same with Vite and hot reload on :5173 |
| `npm test` | Tests of the decision maker and the app |
| `npm run typecheck` | Type check of the app |
| `npm run promo` | Remotion Studio for the promo (run `npm ci` in `promo/` once) |
| `npm run promo:build` | Bundles the promo |

## Session tracking

Claude Code sessions in this repository are recorded with [Entire](https://entire.io): the hooks are in `.claude/settings.json`, and `git push` uploads the checkpoints. Install the Entire CLI and sign in to take part; without it, the hooks do nothing.
