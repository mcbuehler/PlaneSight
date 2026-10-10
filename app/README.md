# Plane Sight app

The live airport over the coding agents that run in Herdr. It uses copies of the team's art in `src/assets/` (the airport, the Cloud Code and OpenAir planes, the logo; the originals are in `../promo/public/`) and draws it with Phaser 4. Gemini ranks the agents that need you and drafts the answer.

## Run it

You need Node 22.12 or newer, [Bun](https://bun.sh), git and [Herdr](https://herdr.dev) (built on 0.9.3), with Herdr running. Agents need Claude Code (`claude`) or Codex (`codex`). The [Entire CLI](https://entire.io) is optional and fills the flight recorder.

```sh
cd app
npm run setup    # once: installs the app, builds herdr-web-ui with our patch, creates ../.env
npm run up       # starts herdr-web-ui on :7317 and Plane Sight on http://127.0.0.1:7777
```

Put your `GEMINI_API_KEY` in the `.env` file at the repository root; `.env.example` lists the other settings. Without a key, simple rules replace Gemini. `npm run up` stops both servers on Ctrl+C. Logs from herdr-web-ui go to `app/data/logs/`.

`npm run setup` fetches [herdr-web-ui](https://github.com/devswha/herdr-web-ui) at the pinned commit in `scripts/setup.sh` into `app/vendor/` (not committed) and applies `integrations/herdr-web-ui-embedding.patch`. It is safe to run again. To use a checkout you already have, set `HERDR_WEB_UI_DIR` for both commands.

To show only the demo agents, start with `PLANESIGHT_ONLY=$HOME/.herdr/worktrees/<repo> npm run up`. To launch new agents on a cheaper model, add `CLAUDE_EXTRA="--model claude-haiku-5-5"`.

For development, run `npm run server` and `npm run dev` instead, and open http://localhost:5173.

### Open a session in Herdr

The top bar stays visible in both views. Its top-left **Herdr →** button opens the selected agent’s session (or the Herdr overview when no agents are available), then becomes **← Back to airport** in exactly the same place.

The **Herdr** button in each plane's card opens that agent's chat in an embedded [herdr-web-ui](https://github.com/devswha/herdr-web-ui) view, in the same tab. Sending a message returns to the airport after Herdr confirms delivery. Failed sends stay open; queued messages return after delivery, preserving their live connection while waiting. **Back to airport** (or browser Back) also returns to the airport with the same plane selected. The web client also offers the live terminal.

`npm run setup` and `npm run up` take care of herdr-web-ui. Both servers must use the same Herdr socket: for a named Herdr session, set `HERDR_SOCKET_PATH` in `.env` before `npm run setup`. If the web client runs at another address, set `HERDR_WEB_URL`. Links use Herdr's pane ID to select the matching session.

The patch lets only the airport's origins (ports 7777 and 5173) frame herdr-web-ui and keeps its other content-security rules. Plane Sight passes `embed_origin` to opt into a `herdr:message-sent` notification containing only the machine and pane IDs. The airport accepts it only from its current iframe and that frame's exact origin; standalone Herdr sessions do not send notifications.

## The airport

- **Hold lines:** the first three agents that need you wait at the three connectors, #1 on the right. More wait behind them on the taxiway.
- **Outline colour:** red needs approval, blue needs a decision, green is ready for review, yellow is a collision.
- **Airline:** Cloud Code planes are Claude Code agents, OpenAir planes are Codex agents.
- **Stands at the concourse:** idle agents. Each keeps its stand; it pushes back before it taxis out. **Grass below:** agents in flight, circling.
- **Click a plane** to answer it, send it a prompt, stop it, read its terminal output or open it in Herdr.
- **Click the terminal**, or press N, to start a new agent in its own worktree.

| Key | Action |
|---|---|
| Enter | Accept the proposal in the bubble |
| E | Edit the text, then send it with ⌘Enter |
| S | Skip: the agent leaves the queue until it needs you again |
| ← → or Tab | Choose another plane in the queue |
| N | New flight |
| Esc | Close the bubble |

## Layout

- `src/` is the client: `main.ts` (data and keys), `AirportScene.ts` (Phaser: planes, flight strips, taxi routes), `ui.ts` (the bubble), `model.ts` (where each agent stands).
- `server/` is the backend: hooks, the Herdr socket, Gemini cards and ranking, Entire session data.
- `hooks/` holds the Claude Code and Codex hook settings. `scripts/launch-demo.sh` starts a demo fleet.
