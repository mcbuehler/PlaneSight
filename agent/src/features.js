// Stage A features: a fixed-length numeric vector per session, each value in [0, 1].
// Computed deterministically from the digest. The learned weights (prescore.js)
// operate on exactly these names.

import { pendingQuestionText } from './digest.js';

export const FEATURE_NAMES = Object.freeze([
  'needsInput', // session is blocked on the developer (any waiting state)
  'explicitQuestion', // agent asked via AskUserQuestion
  'permissionPrompt', // a tool call waits for approval
  'designDecision', // cues for architecture / design / trade-off decisions
  'criticalBug', // cues for crashes, data loss, security, prod breakage
  'routineConfirmation', // "shall I commit?", "continue?" style asks
  'recentErrors', // failing tool calls in the recent past
  'idle', // how long it has been waiting (log-scaled)
]);

const DESIGN_CUES =
  /\b(architecture|architectural|design|approach(?:es)?|trade-?offs?|alternatives?|option [a-d1-4]\b|schema|data model|interface|api (?:shape|design|contract)|contract|migration|refactor(?:ing)?|abstraction|which (?:one|approach|option|library|framework|pattern|strategy)|should (?:we|i) (?:use|go with|switch|keep)|pros and cons|breaking change|backwards? compat\w*|irreversible)\b/gi;

const BUG_CUES =
  /\b(crash(?:es|ed|ing)?|data loss|los(?:e|ing) data|corrupt(?:s|ed|ion)?|security|vulnerab\w*|exploit|injection|leak(?:s|ed|ing)?|production|prod|outage|downtime|regression|deadlock|race condition|segfault|panic|500 errors?|failing tests?|tests? (?:fail|failing)|root cause|critical|urgent|severe|broken)\b/gi;

const ROUTINE_CUES =
  /\b(commit|push|open a pr|create a pr|proceed|continue|go ahead|shall i|want me to|ready to|anything else|next step|sound good|look good)\b/gi;

function cueScore(regex, text, saturation = 3) {
  const matches = text.match(regex);
  return Math.min((matches?.length ?? 0) / saturation, 1);
}

/**
 * @param {import('./digest.js').SessionDigest} digest
 * @returns {Record<string, number>}
 */
export function extractFeatures(digest) {
  const waiting = digest.state !== 'running';
  // Content cues only matter when the session is actually waiting on the developer;
  // a running session discussing a bug does not need attention yet.
  const text = waiting
    ? [pendingQuestionText(digest), ...digest.agentOutput.slice(-3).map((t) => t.text)].join('\n')
    : '';
  const questionText = pendingQuestionText(digest);

  return {
    needsInput: waiting ? 1 : 0,
    explicitQuestion: digest.state === 'awaiting_answer' ? 1 : 0,
    permissionPrompt: digest.state === 'awaiting_permission' ? 1 : 0,
    designDecision: cueScore(DESIGN_CUES, text),
    criticalBug: cueScore(BUG_CUES, text),
    routineConfirmation: waiting ? cueScore(ROUTINE_CUES, questionText, 2) : 0,
    recentErrors: Math.min(digest.recentErrorCount / 3, 1),
    idle: waiting ? Math.min(Math.log1p(digest.idleSeconds / 60) / Math.log1p(120), 1) : 0,
  };
}

/** Feature object -> array in FEATURE_NAMES order. */
export function toVector(features) {
  return FEATURE_NAMES.map((name) => features[name] ?? 0);
}
