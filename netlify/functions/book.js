const GAS_URL = 'https://script.google.com/macros/s/AKfycbx3I6JmcW33pQ3LtUxYtJAL7tBCRns3jGKpDjHybLQj2PUHrEGqOTYmBwsujCASDzk/exec';

/* ── CORS ──────────────────────────────────────────────────────────────
 * GET: open (public availability data — no sensitive info).
 * POST: restricted to same origin (prevents cross-site booking spam).
 * Same-origin requests from the booking page work regardless of CORS
 * headers, so this only blocks other websites from calling POST. */
const ALLOWED_ORIGINS = new Set(
  [process.env.URL, process.env.DEPLOY_PRIME_URL]
    .filter(Boolean)
    .map(u => u.replace(/\/$/, ''))
);

const CORS_GET = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};
const CORS_GET_CACHED = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

function postCorsHeaders(event) {
  const origin = (event.headers || {}).origin || '';
  const h = { 'Content-Type': 'application/json' };
  if (ALLOWED_ORIGINS.size > 0) {
    if (ALLOWED_ORIGINS.has(origin)) {
      h['Access-Control-Allow-Origin'] = origin;
      h['Vary'] = 'Origin';
    }
    // If origin not in allowed list, omit ACAO → browser blocks cross-origin response
  } else {
    // Dev/local (no URL env var): allow all origins
    h['Access-Control-Allow-Origin'] = origin || '*';
  }
  return h;
}

/* ── Server-side in-memory slot cache ──────────────────────────────── */
const _slotCache = new Map();
const SLOT_TTL = 5 * 60 * 1000;

function slotCacheGet(key) {
  const entry = _slotCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > SLOT_TTL) { _slotCache.delete(key); return null; }
  return entry.data;
}
function slotCacheSet(key, data) {
  _slotCache.set(key, { data, at: Date.now() });
  if (_slotCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _slotCache) {
      if (now - v.at > SLOT_TTL) _slotCache.delete(k);
    }
  }
}

/* ── IP-based rate limiter for POST ────────────────────────────────── *
 * In-memory — resets on cold start, not shared across instances.       *
 * Catches the common case (rapid-fire curl loop).                      */
const _rateLimit = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX_POST = 5;               // max 5 bookings per IP per hour

function isRateLimited(ip) {
  const now = Date.now();
  const entry = _rateLimit.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    _rateLimit.set(ip, { start: now, count: 1 });
    if (_rateLimit.size > 1000) {
      for (const [k, v] of _rateLimit) {
        if (now - v.start > RATE_WINDOW_MS) _rateLimit.delete(k);
      }
    }
    return false;
  }
  if (entry.count >= RATE_MAX_POST) return true;
  entry.count++;
  return false;
}

function getClientIp(event) {
  const h = event.headers || {};
  return h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

/* ── Input validation ──────────────────────────────────────────────── */
const VALID_WHO = new Set(['gaurav', 'justin', 'both']);
const VALID_FORMAT = new Set(['virtual', 'in-person']);
const VALID_MINS = new Set([30, 60]);
const MAX_FIELD = { name: 200, email: 254, topic: 1000 };
const MAX_BODY = 10000; // 10 KB

function validateBooking(raw) {
  if (!raw || raw.length > MAX_BODY) return null;

  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || typeof d !== 'object') return null;

  // Required string fields
  if (typeof d.name !== 'string' || typeof d.email !== 'string' || typeof d.topic !== 'string') return null;
  if (typeof d.startISO !== 'string' || typeof d.endISO !== 'string') return null;

  const name = d.name.trim();
  const email = d.email.trim();
  const topic = d.topic.trim();

  if (!name || name.length > MAX_FIELD.name) return null;
  if (!email || email.length > MAX_FIELD.email) return null;
  if (!topic || topic.length > MAX_FIELD.topic) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  // Enum fields
  const who = d.who || 'both';
  const format = d.format || 'virtual';
  const mins = typeof d.mins === 'number' ? d.mins : 30;
  if (!VALID_WHO.has(who) || !VALID_FORMAT.has(format) || !VALID_MINS.has(mins)) return null;

  // Date validation
  const start = new Date(d.startISO);
  const end = new Date(d.endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  // Must be in the future (5 min grace for clock skew)
  const grace = new Date(); grace.setMinutes(grace.getMinutes() - 5);
  if (start < grace) return null;

  // Must be within 25 days
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 25);
  if (start > maxDate) return null;

  // Duration must roughly match mins param (1 min tolerance)
  const durationMs = end - start;
  if (Math.abs(durationMs - mins * 60000) > 60000) return null;

  return { name, email, topic, startISO: d.startISO, endISO: d.endISO, mins, who, format };
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime());
}

/* ── Notify emails ─────────────────────────────────────────────────── */
const NOTIFY_EMAILS = {
  gaurav: ['gaurav@meridiancambridge.org'],
  justin: ['justin@meridiancambridge.org'],
  both:   ['gaurav@meridiancambridge.org', 'justin@meridiancambridge.org'],
};
const HOST_LABELS = { gaurav: 'Gaurav', justin: 'Justin', both: 'Gaurav & Justin' };

/* ── GAS communication ─────────────────────────────────────────────── */

// Follow POST redirects manually — standard fetch changes POST→GET on 302
async function gasPost(url, body, depth) {
  if (depth > 5) throw new Error('Too many redirects');
  // Only follow redirects to Google-owned domains
  if (depth > 0) {
    const host = new URL(url).hostname;
    if (!host.endsWith('.google.com') && !host.endsWith('.googleusercontent.com')) {
      throw new Error('Blocked redirect to non-Google domain');
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    return gasPost(res.headers.get('location'), body, depth + 1);
  }
  return res.text();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Send booking notification email via Resend
async function sendNotification(booking) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping booking notification email');
    return;
  }

  const fromAddr = process.env.NOTIFICATION_FROM || 'CAISH Bookings <onboarding@resend.dev>';

  const date = new Date(booking.startISO);
  const dateStr = date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/London',
  });
  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London',
  });

  const name = escapeHtml(booking.name);
  const email = escapeHtml(booking.email);
  const topic = escapeHtml(booking.topic);
  const mins = booking.mins || 30;
  const who = booking.who || 'both';
  const hostLabel = HOST_LABELS[who] || 'Gaurav & Justin';
  const notifyTo = NOTIFY_EMAILS[who] || NOTIFY_EMAILS.both;
  const format = booking.format || 'virtual';
  const formatLabel = format === 'in-person' ? 'In person (Sidney Street)' : 'Google Meet';

  // Sanitize subject: strip control characters to prevent email header injection
  const safeName = booking.name.replace(/[\r\n\x00-\x1f]/g, ' ');
  const subject = `New booking with ${hostLabel}: ${safeName} — ${dateStr}`;

  const text = [
    `Someone just booked a meeting with ${hostLabel}.`,
    '',
    `Name:     ${booking.name}`,
    `Email:    ${booking.email}`,
    `Meeting:  ${hostLabel}`,
    `Format:   ${formatLabel}`,
    `Date:     ${dateStr}`,
    `Time:     ${timeStr}`,
    `Duration: ${mins} minutes`,
    `Topic:    ${booking.topic}`,
    '',
    'The calendar invite has been sent and the event is on your Google Calendar.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #7e4233; font-size: 20px; font-weight: 600; margin-bottom: 20px;">New meeting booked with ${hostLabel}</h2>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #e4e4e4; border-radius: 8px;">
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; width: 90px; vertical-align: top;">Name</td>
          <td style="padding: 10px 14px; font-size: 14px;">${name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Email</td>
          <td style="padding: 10px 14px; font-size: 14px;"><a href="mailto:${email}" style="color: #7e4233;">${email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Meeting</td>
          <td style="padding: 10px 14px; font-size: 14px;">With ${hostLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Format</td>
          <td style="padding: 10px 14px; font-size: 14px;">${formatLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Date</td>
          <td style="padding: 10px 14px; font-size: 14px;">${dateStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Time</td>
          <td style="padding: 10px 14px; font-size: 14px;">${timeStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Duration</td>
          <td style="padding: 10px 14px; font-size: 14px;">${mins} minutes</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Topic</td>
          <td style="padding: 10px 14px; font-size: 14px;">${topic}</td>
        </tr>
      </table>
      <p style="color: #999; font-size: 12px; margin-top: 16px;">The calendar invite has been sent and the event is on your Google Calendar.</p>
    </div>`;

  for (const recipient of notifyTo) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromAddr, to: [recipient], subject, text, html }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`Notification to ${recipient} failed:`, res.status, err);
      }
    } catch (err) {
      console.error(`Notification to ${recipient} error:`, err);
    }
  }
}

/* ── Main handler ──────────────────────────────────────────────────── */
exports.handler = async (event) => {
  // OPTIONS preflight — only grant CORS for allowed origins on POST
  if (event.httpMethod === 'OPTIONS') {
    const origin = (event.headers || {}).origin || '';
    const h = { 'Content-Type': 'application/json' };
    if (ALLOWED_ORIGINS.size === 0 || ALLOWED_ORIGINS.has(origin)) {
      h['Access-Control-Allow-Origin'] = origin || '*';
      h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      h['Access-Control-Allow-Headers'] = 'Content-Type';
      h['Access-Control-Max-Age'] = '86400';
    }
    return { statusCode: 204, headers: h, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      /* ── Rate limit ── */
      const ip = getClientIp(event);
      if (isRateLimited(ip)) {
        return {
          statusCode: 429,
          headers: postCorsHeaders(event),
          body: JSON.stringify({ ok: false, e: 'Too many requests. Please try again later.' }),
        };
      }

      /* ── Validate + sanitize input ── */
      const validated = validateBooking(event.body);
      if (!validated) {
        return {
          statusCode: 400,
          headers: postCorsHeaders(event),
          body: JSON.stringify({ ok: false, e: 'Invalid booking data.' }),
        };
      }

      /* ── Forward sanitized data to GAS ── */
      const sanitizedBody = JSON.stringify(validated);
      const gasBody = await gasPost(GAS_URL, sanitizedBody, 0);

      let gasResult;
      try { gasResult = JSON.parse(gasBody); } catch { gasResult = { ok: false }; }

      /* ── Only send notification + invalidate cache if booking succeeded ── */
      if (gasResult.ok) {
        const dateStr = validated.startISO.split('T')[0];
        for (const m of ['30', '60']) {
          for (const w of ['gaurav', 'justin', 'both']) {
            _slotCache.delete(`${dateStr}_${m}_${w}`);
          }
        }

        try {
          await sendNotification(validated);
        } catch (err) {
          console.error('Notification error:', err);
        }
      }

      return { statusCode: 200, headers: postCorsHeaders(event), body: gasBody };

    } else {
      /* ── GET: availability data ── */
      const params = event.queryStringParameters || {};
      const who = params.who || 'both';
      const mins = params.mins || '30';

      // Validate GET params
      if (!VALID_WHO.has(who) || !['30', '60'].includes(mins)) {
        return { statusCode: 400, headers: CORS_GET,
          body: JSON.stringify({ ok: false, e: 'Invalid parameters.' }) };
      }

      // Batch mode: ?dates=2026-03-02,2026-03-03&mins=30&who=gaurav
      if (params.dates) {
        const dates = params.dates.split(',').slice(0, 25);
        if (!dates.every(isValidDateStr)) {
          return { statusCode: 400, headers: CORS_GET,
            body: JSON.stringify({ ok: false, e: 'Invalid date format.' }) };
        }

        const results = {};
        const uncached = [];

        for (const date of dates) {
          const key = `${date}_${mins}_${who}`;
          const cached = slotCacheGet(key);
          if (cached !== null) {
            results[date] = cached;
          } else {
            uncached.push(date);
          }
        }

        if (uncached.length > 0) {
          let batchOk = false;
          try {
            const qs = new URLSearchParams({ dates: uncached.join(','), mins, who }).toString();
            const res = await fetch(GAS_URL + '?' + qs, { redirect: 'follow' });
            const data = JSON.parse(await res.text());
            if (data.ok && data.batch && data.results) {
              for (const [d, slots] of Object.entries(data.results)) {
                slotCacheSet(`${d}_${mins}_${who}`, slots);
                results[d] = slots;
              }
              batchOk = true;
            }
          } catch {}

          if (!batchOk) {
            const fetches = uncached.map(async (date) => {
              try {
                const qs = new URLSearchParams({ date, mins, who }).toString();
                const res = await fetch(GAS_URL + '?' + qs, { redirect: 'follow' });
                const data = JSON.parse(await res.text());
                const slots = data.ok ? data.slots : [];
                slotCacheSet(`${date}_${mins}_${who}`, slots);
                results[date] = slots;
              } catch {
                results[date] = [];
              }
            });
            await Promise.all(fetches);
          }
        }

        return { statusCode: 200, headers: CORS_GET_CACHED,
          body: JSON.stringify({ ok: true, batch: true, results }) };
      }

      // Single-date mode
      const date = params.date;
      if (date) {
        if (!isValidDateStr(date)) {
          return { statusCode: 400, headers: CORS_GET,
            body: JSON.stringify({ ok: false, e: 'Invalid date format.' }) };
        }

        const key = `${date}_${mins}_${who}`;
        const cached = slotCacheGet(key);
        if (cached !== null) {
          return { statusCode: 200, headers: CORS_GET_CACHED,
            body: JSON.stringify({ ok: true, slots: cached }) };
        }
      }

      const qs = new URLSearchParams(params).toString();
      const url = GAS_URL + (qs ? '?' + qs : '');
      const res = await fetch(url, { redirect: 'follow' });
      const body = await res.text();

      if (date) {
        try {
          const data = JSON.parse(body);
          if (data.ok) slotCacheSet(`${date}_${mins}_${who}`, data.slots);
        } catch {}
      }

      return { statusCode: 200, headers: CORS_GET_CACHED, body };
    }
  } catch (err) {
    console.error('Handler error:', err);
    const headers = event.httpMethod === 'POST' ? postCorsHeaders(event) : CORS_GET;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, e: 'Something went wrong. Please try again.' }),
    };
  }
};
