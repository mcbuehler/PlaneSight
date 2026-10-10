// Entry point: rank sessions by urgency.
// Stage A (deterministic, personalized weights) always runs; Stage B (Gemini) reranks
// the sessions that are waiting for the developer and explains the order. If Gemini is
// unavailable, the Stage A order is returned with source: 'heuristic'.

import { buildDigest } from './digest.js';
import { extractFeatures } from './features.js';
import { buildGeminiRequest, callGemini, CATEGORIES, DEFAULT_MODEL } from './gemini.js';
import { selectSimilarDecisions } from './learn.js';
import { DEFAULT_WEIGHTS, heuristicReason, prescore } from './prescore.js';

/**
 * @typedef {object} SessionInput
 * @property {string} [sessionId]   overrides the id found in the log
 * @property {string} [jsonl]       raw session log text
 * @property {object[]} [records]   or already-parsed records
 *
 * @typedef {object} RankedSession
 * @property {string} sessionId
 * @property {number | null} urgency    0–100 from Gemini; null when not scored by Gemini
 * @property {string} category
 * @property {string} reason
 * @property {number} prescore          Stage A score
 * @property {Record<string, number>} features
 * @property {import('./digest.js').SessionDigest} digest
 *
 * @typedef {object} RankingResult
 * @property {RankedSession[]} ranking  most urgent first
 * @property {string | null} topPick    sessionId, null when nothing waits for the developer
 * @property {string} explanation
 * @property {'gemini' | 'heuristic'} source
 * @property {string} [error]           why Gemini was skipped or failed
 */

function heuristicCategory(entry) {
  const f = entry.features;
  if (entry.digest.state === 'running') return 'running';
  if (f.criticalBug >= f.designDecision && f.criticalBug > 0) return 'critical_bug';
  if (f.designDecision > 0) return 'design_decision';
  if (f.routineConfirmation > 0) return 'routine';
  return 'blocked';
}

function heuristicEntry(entry, weights) {
  return {
    sessionId: entry.sessionId,
    urgency: null,
    category: heuristicCategory(entry),
    reason: heuristicReason(entry.features, weights),
    prescore: entry.prescore,
    features: entry.features,
    digest: entry.digest,
  };
}

/**
 * @param {SessionInput[]} sessions
 * @param {object} [options]
 * @param {string} [options.apiKey]           Gemini API key; without it only Stage A runs
 * @param {string} [options.model]
 * @param {Record<string, number>} [options.weights]   learned Stage A weights
 * @param {string} [options.profile]          free-text developer preferences
 * @param {import('./learn.js').Decision[]} [options.pastDecisions]
 * @param {number} [options.maxCandidates]    max sessions sent to Gemini
 * @param {number} [options.maxExamples]      max past decisions sent to Gemini
 * @param {number} [options.now]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<RankingResult>}
 */
export async function rankSessions(sessions, options = {}) {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    weights = DEFAULT_WEIGHTS,
    profile = '',
    pastDecisions = [],
    maxCandidates = 8,
    maxExamples = 4,
    now = Date.now(),
    fetchImpl,
    timeoutMs,
  } = options;

  const entries = sessions
    .map((s) => {
      const digest = buildDigest(s.records ?? s.jsonl ?? [], { now });
      const sessionId = s.sessionId ?? digest.sessionId;
      const features = extractFeatures(digest);
      return { sessionId, digest: { ...digest, sessionId }, features, prescore: prescore(features, weights) };
    })
    .sort((a, b) => b.prescore - a.prescore);

  const waiting = entries.filter((e) => e.digest.state !== 'running');
  const heuristic = (error) => ({
    ranking: entries.map((e) => heuristicEntry(e, weights)),
    topPick: waiting[0]?.sessionId ?? null,
    explanation: waiting[0]
      ? `Heuristic ranking: ${heuristicReason(waiting[0].features, weights)}.`
      : 'No session is waiting for you.',
    source: 'heuristic',
    ...(error ? { error } : {}),
  });

  if (waiting.length === 0) return heuristic();
  if (!apiKey) return heuristic('No Gemini API key provided');

  const candidates = waiting.slice(0, maxCandidates).map((entry, i) => ({ alias: `S${i + 1}`, entry }));
  const byAlias = new Map(candidates.map((c) => [c.alias, c.entry]));
  const examples = selectSimilarDecisions(pastDecisions, candidates.map((c) => c.entry.features), maxExamples);

  let llm;
  try {
    const body = buildGeminiRequest(candidates, { profile, pastDecisions: examples });
    llm = await callGemini(body, { apiKey, model, fetchImpl, timeoutMs });
  } catch (err) {
    return heuristic(err.message);
  }

  // Merge: trust Gemini's order for the candidates it returned, then append anything it
  // dropped (in Stage A order), then sessions that were not sent (overflow, running).
  const ranking = [];
  const seen = new Set();
  for (const item of Array.isArray(llm?.ranking) ? llm.ranking : []) {
    const entry = byAlias.get(item?.id);
    if (!entry || seen.has(entry.sessionId)) continue;
    seen.add(entry.sessionId);
    ranking.push({
      sessionId: entry.sessionId,
      urgency: Math.max(0, Math.min(100, Math.round(Number(item.urgency) || 0))),
      category: CATEGORIES.includes(item.category) ? item.category : heuristicCategory(entry),
      reason: String(item.reason ?? ''),
      prescore: entry.prescore,
      features: entry.features,
      digest: entry.digest,
    });
  }
  for (const e of entries) if (!seen.has(e.sessionId)) ranking.push(heuristicEntry(e, weights));

  const top = byAlias.get(llm?.topPick)?.sessionId ?? ranking[0].sessionId;
  return {
    ranking,
    topPick: top,
    explanation: String(llm?.explanation ?? ''),
    source: 'gemini',
  };
}
