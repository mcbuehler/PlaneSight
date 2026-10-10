/** Only changes to actionable work should ask the tower for updated priorities. */
export function rankingSignature(items) {
  return JSON.stringify(items.map(({ key, kind, collision, card }) => ({
    key, kind,
    collision: collision ? { file: collision.file, otherSession: collision.otherSession } : null,
    card: card ?? null,
  })).sort((a, b) => a.key.localeCompare(b.key)));
}

/** Waiting tasks keep their places, even when the model proposes a different order. */
export function stableFallback(previous, next) {
  const byKey = new Map(next.map((item) => [item.key, item]));
  const seen = new Set();
  return [...previous, ...next].flatMap(({ key }) => {
    if (!byKey.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [byKey.get(key)];
  });
}

export class QueueRanking {
  constructor({ rank, publish, onError, delayMs = 1200 }) {
    this.rank = rank;
    this.publish = publish;
    this.onError = onError;
    this.delayMs = delayMs;
    this.signature = null;
    this.version = 0;
    this.order = [];
    this.timer = null;
  }

  schedule(items) {
    const signature = rankingSignature(items);
    if (signature === this.signature) return;
    this.signature = signature;
    const version = ++this.version;
    clearTimeout(this.timer);
    // Release a place as soon as a task leaves. A returning task joins the tail,
    // even if it comes back before the next model response.
    const active = new Set(items.map(({ key }) => key));
    const remaining = this.order.filter(({ key }) => active.has(key));
    if (remaining.length !== this.order.length) {
      this.order = remaining;
      this.publish(this.order);
    }
    if (!items.length) return;
    this.timer = setTimeout(async () => {
      let proposed = [];
      try {
        ({ order: proposed } = await this.rank(items));
      } catch (error) {
        if (version === this.version) this.onError?.(error);
      }
      // A new need or completed task invalidates older, still-running requests.
      if (version !== this.version) return;
      // Ignore invented keys and duplicates; keep every current task even if the
      // model omits it or fails. Its latest reason can change without moving it.
      const seen = new Set();
      const complete = [...proposed, ...this.order, ...items.map(({ key }) => ({ key, reason: "" }))]
        .filter(({ key }) => active.has(key) && !seen.has(key) && seen.add(key));
      // Gemini orders the initial batch and any simultaneous new arrivals.
      // Once admitted, a plane stays in line until that actionable task leaves.
      this.order = stableFallback(this.order, complete);
      this.publish(this.order);
    }, this.delayMs);
  }
}
