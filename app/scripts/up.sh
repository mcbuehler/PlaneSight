#!/bin/sh
# Starts Plane Sight: the embedded Herdr web client on :7317 in the background, then the
# Plane Sight server on :7777, which builds and serves the app. Ctrl+C stops everything.
# With --dev, the server runs in the background and Vite serves the app with hot reload
# on :5173 instead. Run `npm run setup` once before. Herdr itself must already be running.
set -eu

APP=$(cd "$(dirname "$0")/.." && pwd)
WEB_UI=${HERDR_WEB_UI_DIR:-$APP/vendor/herdr-web-ui}
LOGS=$APP/data/logs
mkdir -p "$LOGS"

[ -d "$WEB_UI/dist" ] || { echo "herdr-web-ui is not built. Run: npm run setup" >&2; exit 1; }
SOCKET=${HERDR_SOCKET_PATH:-$(sed -n 's/^HERDR_SOCKET_PATH=//p' "$APP/../.env" 2>/dev/null | tail -1)}
[ -S "${SOCKET:-$HOME/.config/herdr/herdr.sock}" ] || echo "Warning: no Herdr socket found. Start Herdr first."

listening() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

DEV=false
[ "${1:-}" = "--dev" ] && DEV=true

PIDS=
if listening 7317; then
  echo "herdr-web-ui is already running on :7317."
else
  # PORT is Plane Sight's; herdr-web-ui gets its own
  (cd "$WEB_UI" && PORT=7317 exec bun run server) >"$LOGS/herdr-web-ui.log" 2>&1 &
  PIDS=$!
  echo "herdr-web-ui on http://127.0.0.1:7317 (log: data/logs/herdr-web-ui.log)"
fi
stop() { [ -n "$PIDS" ] && kill $PIDS 2>/dev/null; true; }
trap stop EXIT INT TERM

listening 7777 && { echo "Port 7777 is in use. Stop the other Plane Sight server first." >&2; exit 1; }
cd "$APP"
if $DEV; then
  npm run server &
  PIDS="$PIDS $!"
  echo "Plane Sight on http://localhost:5173 (Vite, hot reload; the server is on :7777)"
  npm run dev
else
  # build every time, so the server never serves an app older than the code
  npm run build --silent
  echo "Plane Sight on http://127.0.0.1:7777"
  npm run server
fi
