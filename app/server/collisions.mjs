import path from "node:path";

// A shared edited file is a review warning, not proof of a Git merge conflict.
export function findCollision(unit, units) {
  const request = unit.held ?? (unit.status === "blocked" ? unit.screenRequest : null);
  const file = request?.input?.file_path ?? request?.input?.path;
  const editing = file && /^(Write|Edit|Update|MultiEdit|NotebookEdit)$/.test(request?.tool ?? "");
  const targets = editing
    ? [path.relative(unit.cwd, path.resolve(unit.cwd, file))]
    : unit.landed ? [...unit.files] : [];
  const repository = unit.repoRoot ?? unit.repo;
  if (!repository || repository === "unknown") return null;
  for (const other of units.values()) {
    if (other === unit || other.status === "gone" || (other.repoRoot ?? other.repo) !== repository) continue;
    const shared = targets.find((target) => other.files.has(target));
    if (shared) return { file: shared, other: other.name ?? other.title ?? other.sessionId.slice(0, 8), otherSession: other.sessionId };
  }
  return null;
}
