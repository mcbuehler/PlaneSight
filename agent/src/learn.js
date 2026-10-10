// Learning from past decisions. A "decision" records which session the developer
// actually attended to out of a ranked set. Decisions feed two mechanisms:
//  - learnFromDecision(): updates the Stage A weights.
//  - selectSimilarDecisions(): picks few-shot examples for the Gemini prompt.
// Storage is the caller's job; decisions are plain JSON.

import { pendingQuestionText } from './digest.js';
import { toVector } from './features.js';
import { updateWeights } from './prescore.js';

/**
 * @typedef {object} DecisionCandidate
 * @property {string} sessionId
 * @property {string} project
 * @property {string} state
 * @property {string} summary   short text of what the session was asking
 * @property {Record<string, number>} features
 *
 * @typedef {object} Decision
 * @property {string} ts
 * @property {DecisionCandidate} chosen
 * @property {DecisionCandidate[]} others
 * @property {string | null} agentTopPick
 * @property {string} [note]   optional free-text reason from the developer
 */

function toCandidate(entry) {
  const question = pendingQuestionText(entry.digest);
  return {
    sessionId: entry.sessionId,
    project: entry.digest.project,
    state: entry.digest.state,
    summary: (question || entry.digest.lastUserPrompt || '').slice(0, 240),
    features: entry.features,
  };
}

/**
 * Create a decision record from a rankSessions() result and the session the developer picked.
 * Only sessions that were waiting for input are kept as alternatives.
 * @returns {Decision}
 */
export function makeDecision(result, chosenSessionId, { now = Date.now(), note } = {}) {
  const chosenEntry = result.ranking.find((r) => r.sessionId === chosenSessionId);
  if (!chosenEntry) throw new Error(`Session ${chosenSessionId} is not part of this ranking`);
  const others = result.ranking.filter((r) => r.sessionId !== chosenSessionId && r.digest.state !== 'running');
  return {
    ts: new Date(now).toISOString(),
    chosen: toCandidate(chosenEntry),
    others: others.map(toCandidate),
    agentTopPick: result.topPick,
    ...(note ? { note } : {}),
  };
}

/** Update Stage A weights from one decision. Returns new weights. */
export function learnFromDecision(weights, decision, options) {
  if (decision.others.length === 0) return { ...weights };
  return updateWeights(
    weights,
    decision.chosen.features,
    decision.others.map((o) => o.features),
    options,
  );
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Pick the k past decisions most similar to the current situation, judged by the
 * best feature-vector match between any past candidate and any current candidate.
 * Ties go to the more recent decision.
 * @param {Decision[]} pastDecisions
 * @param {Record<string, number>[]} currentFeatures
 */
export function selectSimilarDecisions(pastDecisions, currentFeatures, k = 4) {
  if (!pastDecisions?.length || k <= 0) return [];
  const current = currentFeatures.map(toVector);
  return pastDecisions
    .map((d, index) => {
      const past = [d.chosen, ...d.others].map((c) => toVector(c.features));
      let best = 0;
      for (const p of past) for (const c of current) best = Math.max(best, cosine(p, c));
      return { d, best, index };
    })
    .sort((a, b) => b.best - a.best || b.index - a.index)
    .slice(0, k)
    .map((x) => x.d);
}
