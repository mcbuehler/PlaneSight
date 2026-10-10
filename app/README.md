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
