// Rank the mock scenarios.
//   node mocks/demo.js            Gemini ranking if GEMINI_API_KEY is set, else heuristic
//   node mocks/demo.js --request  print the redacted request body that would go to Gemini

import { buildGeminiRequest, rankSessions } from '../src/index.js';
import { buildDigest } from '../src/digest.js';
import { extractFeatures } from '../src/features.js';
import { prescore } from '../src/prescore.js';
import { allScenarios } from './scenarios.js';

const sessions = allScenarios();

if (process.argv.includes('--request')) {
  const candidates = sessions
    .map((s) => {
      const digest = buildDigest(s.jsonl);
      const features = extractFeatures(digest);
      return { digest, features, prescore: prescore(features) };
    })
    .filter((e) => e.digest.state !== 'running')
    .map((entry, i) => ({ alias: `S${i + 1}`, entry }));
  console.log(JSON.stringify(buildGeminiRequest(candidates), null, 2));
} else {
  const result = await rankSessions(sessions, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  });
  console.log(`source: ${result.source}${result.error ? ` (${result.error})` : ''}`);
  console.log(`top pick: ${result.topPick}\n${result.explanation}\n`);
  for (const r of result.ranking) {
    const urgency = r.urgency === null ? '  -' : String(r.urgency).padStart(3);
    console.log(`${urgency}  ${r.prescore.toFixed(2).padStart(5)}  ${r.sessionId.padEnd(16)} ${r.digest.state.padEnd(20)} ${r.category.padEnd(16)} ${r.reason}`);
  }
}
