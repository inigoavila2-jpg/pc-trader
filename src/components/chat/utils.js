export const cbUid = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const cbToday = () => new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
export const cbFmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

// Parse the date formats this app stores (for example "Sep 25, 2026") plus
// ISO dates. Historical business calculations should always compare timestamps,
// not raw date strings.
export const cbDateMs = (value) => {
  if (!value) return NaN;

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? NaN : d.getTime();
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini's free tier is easy to hit during normal use — every tool-using message burns at
// least 2 requests (the message itself, then the function response). A 429 here usually means
// "wait a few seconds," not "something is broken," so retry with backoff before surfacing it
// as an actual error.
export const isRateLimitError = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  return err?.status === 429 || err?.code === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('too many requests');
};

export const sendWithRetry = async (sendFn, maxRetries = 2) => {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendFn();
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && attempt < maxRetries) {
        const waitMs = 3000 * (attempt + 1);
        console.warn(`Rate limited by Gemini (429) — retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
};
