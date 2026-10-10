#!/bin/sh
# Codex has no http hook type: pipe the event JSON on stdin to Plane Sight and print its reply.
# $1 = path suffix ("" or "/permission"), $2 = curl max time in seconds.
curl -s --max-time "${2:-5}" -H 'content-type: application/json' \
     -H "X-Herdr-Pane: $HERDR_PANE_ID" --data-binary @- \
     "http://127.0.0.1:${PLANESIGHT_PORT:-7777}/hook/codex$1" || echo '{}'
