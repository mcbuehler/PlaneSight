# Plane Sight app

The live airport over the coding agents that run in Herdr. It uses the team's art from `../public/` (the airport, the Cloud Code and OpenAir planes, the logo) and draws it with Phaser 4. Gemini ranks the agents that need you and drafts the answer.

## Run it

```sh
cd app
npm install
echo "GEMINI_API_KEY=..." > ../.env     # without it, simple rules replace Gemini
npm run server                          # the backend on :7777 (hooks, Herdr, Gemini, Entire)
npm run dev                             # the app on http://localhost:5173
```

For the demo, build once and let the server serve the app: `npm start`, then open http://127.0.0.1:7777.

To show only the demo agents, start the server with `PLANESIGHT_ONLY=$HOME/.herdr/worktrees/<repo> npm run server`. To launch new agents on a cheaper model, add `CLAUDE_EXTRA="--model claude-haiku-5-5"`.

### Open a session in Herdr

The **Herdr** button in each plane's card opens that agent's chat in an embedded [herdr-web-ui](https://github.com/devswha/herdr-web-ui) view, in the same tab. Sending a message returns to the airport after Herdr confirms delivery. Failed sends stay open; queued messages return after delivery, preserving their live connection while waiting. **Back to airport** (or browser Back) also returns to the airport with the same plane selected. The web client also offers the live terminal.

Run herdr-web-ui separately on `http://127.0.0.1:7317`. Both servers must connect to the same Herdr socket: set `HERDR_SOCKET_PATH` for Plane Sight and `HERDR_SOCKET` for herdr-web-ui. For a named session, use `~/.config/herdr/sessions/<name>/herdr.sock` (expand `~` in the environment value).

If the web client runs at another address, set `HERDR_WEB_URL` in Plane Sight's `app/.env` and restart the Plane Sight server. Links use Herdr's pane ID to select the matching session, rather than relying on whichever terminal was last focused.

Herdr blocks embedding by default. Apply `integrations/herdr-web-ui-embedding.patch` in the herdr-web-ui checkout and set `HERDR_WEB_FRAME_ANCESTORS=http://127.0.0.1:7777,http://localhost:7777` in its `.env`, then restart its server. Include the exact airport origin you use (for Vite development, port `5173`). This permits only those configured origins to frame Herdr and leaves its other content-security rules enforced.

Rebuild the Herdr client after applying the patch. Plane Sight passes `embed_origin` to opt into a `herdr:message-sent` notification containing only the machine and pane IDs. The airport accepts it only from its current iframe and that frame's exact origin; standalone Herdr sessions do not send notifications.

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
