// Reads Entire's record of an agent session: files touched, tokens, last prompt.
import { execFile } from "node:child_process";

export function sessionInfo(sessionId, cwd) {
  return new Promise((resolve) => {
    execFile("entire", ["session", "info", sessionId, "--json"], { cwd, timeout: 8000 }, (err, out) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(out)); } catch { resolve(null); }
    });
  });
}
