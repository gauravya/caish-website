/* ── GAS Keep-Alive ──────────────────────────────────────────────────
 * Runs every 5 minutes via Netlify Scheduled Functions.
 * Pings Google Apps Script so the V8 runtime stays warm.
 *
 * GAS cold start: 3-10 s.  GAS warm response: ~0.5-1 s.
 * This single trick eliminates the #1 latency bottleneck.
 *
 * Also pre-populates GAS CacheService for the next 10 weekdays,
 * so even the warm GAS calls skip Calendar API reads entirely. */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbx3I6JmcW33pQ3LtUxYtJAL7tBCRns3jGKpDjHybLQj2PUHrEGqOTYmBwsujCASDzk/exec';

exports.handler = async () => {
  // Next 10 weekdays
  const dates = [];
  const d = new Date();
  while (dates.length < 10) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  // Warm GAS for all 3 who options in parallel
  // → keeps V8 warm + fills GAS CacheService for next 2 weeks
  const dateStr = dates.join(',');
  await Promise.all(
    ['gaurav', 'justin', 'both'].map(who =>
      fetch(`${GAS_URL}?dates=${dateStr}&mins=30&who=${who}`, { redirect: 'follow' })
        .catch(() => {}) // swallow errors — this is best-effort
    )
  );

  return { statusCode: 200, body: 'warmed' };
};
