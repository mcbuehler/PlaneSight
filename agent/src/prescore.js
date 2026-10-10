// Stage A: linear pre-score  score = Σ w_i · x_i  over the features from features.js.
//
// Where the weights come from:
//  1. DEFAULT_WEIGHTS are hand-set priors encoding the definition of "urgent"
//     (design decisions and critical bugs dominate, routine confirmations are negative).
//  2. updateWeights() personalizes them from the developer's actual choices with a
//     pairwise logistic (Bradley–Terry) SGD step: "developer picked X over Y" pushes
//     w toward the features where X differs from Y. An L2 pull toward the priors keeps
//     a few noisy clicks from wrecking the ranking.
// The caller persists the weights (e.g. as JSON) between runs.

import { FEATURE_NAMES } from './features.js';

export const DEFAULT_WEIGHTS = Object.freeze({
  needsInput: 1.0,
  explicitQuestion: 0.5,
  permissionPrompt: 0.3,
  designDecision: 2.0,
  criticalBug: 2.5,
  routineConfirmation: -0.8,
  recentErrors: 0.8,
  idle: 0.3,
});

export function prescore(features, weights = DEFAULT_WEIGHTS) {
  let score = 0;
  for (const name of FEATURE_NAMES) score += (weights[name] ?? DEFAULT_WEIGHTS[name]) * (features[name] ?? 0);
  return score;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * One online learning step from a single decision.
 * @param {Record<string, number>} weights        current weights
 * @param {Record<string, number>} chosen         features of the session the developer attended to
 * @param {Record<string, number>[]} rejected     features of the sessions they passed over
 * @param {{learningRate?: number, priorStrength?: number, prior?: Record<string, number>}} [options]
 * @returns {Record<string, number>} new weights (input is not mutated)
 */
export function updateWeights(weights, chosen, rejected, { learningRate = 0.1, priorStrength = 0.01, prior = DEFAULT_WEIGHTS } = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  for (const other of rejected) {
    const diff = Object.fromEntries(FEATURE_NAMES.map((n) => [n, (chosen[n] ?? 0) - (other[n] ?? 0)]));
    const margin = FEATURE_NAMES.reduce((s, n) => s + w[n] * diff[n], 0);
    const gradientScale = 1 - sigmoid(margin); // ≈0 when the model already agreed
    for (const n of FEATURE_NAMES) {
      w[n] += learningRate * (gradientScale * diff[n] - priorStrength * (w[n] - prior[n]));
    }
  }
  return w;
}

const LABELS = {
  needsInput: 'waiting for you',
  explicitQuestion: 'asked an explicit question',
  permissionPrompt: 'waiting for tool permission',
  designDecision: 'design-decision cues',
  criticalBug: 'critical-bug cues',
  recentErrors: 'recent tool errors',
  idle: 'waiting for a while',
};

/** Short human-readable reason from the biggest positive contributions. */
export function heuristicReason(features, weights = DEFAULT_WEIGHTS) {
  const parts = FEATURE_NAMES.map((n) => [n, (weights[n] ?? 0) * (features[n] ?? 0)])
    .filter(([n, c]) => c > 0.05 && LABELS[n])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => LABELS[n]);
  return parts.length ? parts.join(' · ') : 'running, no input needed';
}
