#!/bin/sh
# One-time setup for Plane Sight: checks the tools, installs the app, and builds the
# embedded Herdr web client (herdr-web-ui) at a pinned version with our patch.
# Safe to run again; every step skips what is already done.
set -eu

APP=$(cd "$(dirname "$0")/.." && pwd)
ROOT=$(cd "$APP/.." && pwd)
# The herdr-web-ui version our embedding patch was written for.
HERDR_WEB_UI_REPO=https://github.com/devswha/herdr-web-ui.git
HERDR_WEB_UI_COMMIT=21d1b9208ac489f8690fe8ba758dc5cd73842cf6
WEB_UI=${HERDR_WEB_UI_DIR:-$APP/vendor/herdr-web-ui}
PATCH=$APP/integrations/herdr-web-ui-embedding.patch

step() { printf '\n== %s\n' "$1"; }
fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

step "Checking tools"
has node || fail "Node.js is missing. Install Node 22.12 or newer."
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 22 ] || fail "Node $(node --version) is too old. Install Node 22.12 or newer."
has bun || fail "Bun is missing (herdr-web-ui runs on it). Install it: curl -fsSL https://bun.sh/install | bash"
has git || fail "git is missing."
has herdr || fail "Herdr is missing. Install it from https://herdr.dev (Plane Sight was built on 0.9.3)."
has claude || echo "Warning: Claude Code (claude) is not on PATH. New flights with Cloud Code will fail."
has codex || echo "Note: Codex is not on PATH. New flights with OpenAir will fail."
has entire || echo "Note: the Entire CLI is not on PATH. Agents still run; the flight recorder stays empty."
echo "node $(node --version), bun $(bun --version), $(herdr --version 2>/dev/null | head -1)"

step "Installing the app"
(cd "$APP" && npm install --no-audit --no-fund)

step "Environment"
if [ -f "$ROOT/.env" ]; then
  echo "$ROOT/.env exists; leaving it as it is."
else
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created $ROOT/.env. Put your GEMINI_API_KEY in it (without one, simple rules replace Gemini)."
fi

# the Herdr socket: from the environment, else from .env, else Herdr's default
SOCKET=${HERDR_SOCKET_PATH:-$(sed -n 's/^HERDR_SOCKET_PATH=//p' "$ROOT/.env" | tail -1)}
SOCKET=${SOCKET:-$HOME/.config/herdr/herdr.sock}

step "herdr-web-ui at ${HERDR_WEB_UI_COMMIT%"${HERDR_WEB_UI_COMMIT#???????}"}"
if [ ! -d "$WEB_UI/.git" ]; then
  mkdir -p "$(dirname "$WEB_UI")"
  git clone --quiet "$HERDR_WEB_UI_REPO" "$WEB_UI"
fi
if git -C "$WEB_UI" apply --reverse --check "$PATCH" 2>/dev/null; then
  echo "The embedding patch is already applied."
else
  git -C "$WEB_UI" fetch --quiet origin
  git -C "$WEB_UI" checkout --quiet "$HERDR_WEB_UI_COMMIT"
  git -C "$WEB_UI" apply "$PATCH"
  echo "Applied the embedding patch."
fi
# herdr-web-ui reads this file itself (Bun loads .env). It lets only the airport frame it.
cat > "$WEB_UI/.env" <<EOF
HERDR_SOCKET=$SOCKET
HERDR_WEB_FRAME_ANCESTORS=http://127.0.0.1:7777,http://localhost:7777,http://127.0.0.1:5173,http://localhost:5173
EOF
(cd "$WEB_UI" && bun install && bun run build)

step "Building the app"
(cd "$APP" && npm run build)

printf '\nReady. Start everything with: cd %s && npm run up\n' "$APP"
