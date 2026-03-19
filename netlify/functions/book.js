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

const GAS_TIMEOUT_MS = Number(process.env.GAS_TIMEOUT_MS || 10000);

function parseJsonSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function calendarServiceErrorMessage(err) {
  return err && err.name === 'AbortError'
    ? 'Calendar service timed out. Please try again.'
    : 'Could not reach the calendar service. Please try again.';
}

/* ── Server-side in-memory slot cache ──────────────────────────────── */
const _slotCache = new Map();
const SLOT_TTL = 5 * 60 * 1000;
const BOOKING_END_MINUTES = 18 * 60;
const LONDON_TIME_ZONE = 'Europe/London';
const LONDON_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function filterSlotsByCutoff(slots, mins) {
  const duration = Number(mins);
  if (!Array.isArray(slots) || !Number.isFinite(duration)) return [];

  return slots.reduce((out, slot) => {
    const h = Number(slot && slot.h);
    const m = Number(slot && slot.m);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return out;
    if ((h * 60) + m + duration <= BOOKING_END_MINUTES) {
      out.push({ h, m });
    }
    return out;
  }, []);
}

function getLondonParts(date) {
  const parts = {};
  for (const part of LONDON_PARTS_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

function londonDateStamp(date) {
  const parts = getLondonParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function londonMinutes(date) {
  const parts = getLondonParts(date);
  return (Number(parts.hour) * 60) + Number(parts.minute);
}

function bookingHoursError(start, end) {
  if (londonDateStamp(start) !== londonDateStamp(end)) return 'outside_booking_hours';
  if (londonMinutes(end) > BOOKING_END_MINUTES) return 'outside_booking_hours';
  return null;
}

function slotCacheGet(key, mins) {
  const entry = _slotCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > SLOT_TTL) { _slotCache.delete(key); return null; }
  return Array.isArray(entry.data) ? filterSlotsByCutoff(entry.data, mins) : entry.data;
}
function slotCacheSet(key, data, mins) {
  const safeData = Array.isArray(data) ? filterSlotsByCutoff(data, mins) : data;
  _slotCache.set(key, { data: safeData, at: Date.now() });
  if (_slotCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _slotCache) {
      if (now - v.at > SLOT_TTL) _slotCache.delete(k);
    }
  }
  return safeData;
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
const GAURAV_BLOCKED_RANGES = [
  // Add exact UK-date ranges here when you want to close Gaurav's calendar
  // for a whole week or a specific stretch of days.
  // { start: '2026-04-06', end: '2026-04-10', label: 'week of 6 April 2026' },
];

const BOOKING_POLICIES = {
  gaurav: {
    gasWho: 'gaurav',
    minLeadDays: 7,
    maxAdvanceDays: 27,
    blockedRanges: GAURAV_BLOCKED_RANGES,
  },
  gaurav_priority: {
    gasWho: 'gaurav',
    minLeadDays: 1,
    maxAdvanceDays: 21,
    blockedRanges: GAURAV_BLOCKED_RANGES,
  },
  justin: {
    gasWho: 'justin',
    minLeadDays: 1,
    maxAdvanceDays: 21,
    blockedRanges: [],
  },
  both: {
    gasWho: 'both',
    minLeadDays: 7,
    maxAdvanceDays: 27,
    blockedRanges: GAURAV_BLOCKED_RANGES,
  },
};

const VALID_WHO = new Set(Object.keys(BOOKING_POLICIES));
const VALID_FORMAT = new Set(['virtual', 'in-person']);
const VALID_MINS = new Set([15, 30, 45, 60]);
const MAX_FIELD = { name: 200, email: 254, topic: 1000 };
const MAX_BODY = 10000; // 10 KB
const MAX_ADVANCE_DAYS = Math.max(...Object.values(BOOKING_POLICIES).map(policy => policy.maxAdvanceDays));

function getPolicy(who = 'both') {
  return BOOKING_POLICIES[who] || BOOKING_POLICIES.both;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDateToLocalDate(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getBlockedRange(date, who) {
  const policy = getPolicy(who);
  const day = startOfDay(date);
  return (policy.blockedRanges || []).find(range => {
    const start = startOfDay(isoDateToLocalDate(range.start));
    const end = startOfDay(isoDateToLocalDate(range.end || range.start));
    return day >= start && day <= end;
  }) || null;
}

function bookingRuleError(date, who) {
  const day = startOfDay(date);
  const policy = getPolicy(who);
  const min = addDays(startOfDay(new Date()), policy.minLeadDays);
  const max = addDays(startOfDay(new Date()), policy.maxAdvanceDays);

  if (day.getDay() === 0 || day.getDay() === 6) return 'outside_booking_window';
  if (day < min) return 'notice_required';
  if (day > max) return 'outside_booking_window';
  if (getBlockedRange(day, who)) return 'blocked_date';
  return null;
}

function validateBooking(raw) {
  if (!raw || raw.length > MAX_BODY) return null;

  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || typeof d !== 'object') return null;

  // Required string fields
  if (typeof d.name !== 'string' || typeof d.email !== 'string') return null;
  if (typeof d.topic !== 'undefined' && typeof d.topic !== 'string') return null;
  if (typeof d.startISO !== 'string' || typeof d.endISO !== 'string') return null;

  const name = d.name.trim();
  const email = d.email.trim();
  const topic = typeof d.topic === 'string' ? d.topic.trim() : '';

  if (!name || name.length > MAX_FIELD.name) return null;
  if (!email || email.length > MAX_FIELD.email) return null;
  if (topic.length > MAX_FIELD.topic) return null;
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

  // Must be within the broad booking horizon for this service.
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_DAYS + 2);
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
function parseEmailList(value) {
  if (!value) return [];
  return String(value)
    .replace(/\s+and\s+/gi, ',')
    .split(/[;,]/)
    .map(v => v.trim())
    .map(v => {
      const angleMatch = v.match(/<([^<>@\s]+@[^<>@\s]+)>/);
      return angleMatch ? angleMatch[1].trim() : v;
    })
    .filter(Boolean)
    .filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
}

function uniqueEmails(list) {
  return [...new Set(list.map(v => v.toLowerCase()))];
}

const DEFAULT_NOTIFY_EMAILS = {
  gaurav: ['gaurav@meridiancambridge.org'],
  gaurav_priority: ['gaurav@meridiancambridge.org'],
  justin: ['justin@meridiancambridge.org'],
  both:   ['gaurav@meridiancambridge.org', 'justin@meridiancambridge.org'],
};
const DEFAULT_RESEND_FROM = 'CAISH Bookings <onboarding@resend.dev>';
let _warnedDefaultFrom = false;
let _warnedMissingEmailProvider = false;
let _warnedMissingNotificationFrom = false;

const GLOBAL_NOTIFY_EMAILS = parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS);
const NOTIFY_EMAILS = {
  gaurav: uniqueEmails([
    ...parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS_GAURAV),
    ...GLOBAL_NOTIFY_EMAILS,
    ...DEFAULT_NOTIFY_EMAILS.gaurav,
  ]),
  gaurav_priority: uniqueEmails([
    ...parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS_GAURAV_PRIORITY),
    ...parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS_GAURAV),
    ...GLOBAL_NOTIFY_EMAILS,
    ...DEFAULT_NOTIFY_EMAILS.gaurav_priority,
  ]),
  justin: uniqueEmails([
    ...parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS_JUSTIN),
    ...GLOBAL_NOTIFY_EMAILS,
    ...DEFAULT_NOTIFY_EMAILS.justin,
  ]),
  both: uniqueEmails([
    ...parseEmailList(process.env.BOOKING_NOTIFICATION_EMAILS_BOTH),
    ...GLOBAL_NOTIFY_EMAILS,
    ...DEFAULT_NOTIFY_EMAILS.both,
  ]),
};
const HOST_LABELS = {
  gaurav: 'Gaurav',
  gaurav_priority: 'Gaurav (priority calendar)',
  justin: 'Justin',
  both: 'Gaurav & Justin',
};

function getPostmarkServerToken() {
  return (
    process.env.POSTMARK_SERVER_TOKEN ||
    process.env.POSTMARK_API_TOKEN ||
    process.env.POSTMARK_TOKEN ||
    ''
  ).trim();
}

function getPostmarkMessageStream() {
  return (process.env.POSTMARK_MESSAGE_STREAM || 'outbound').trim();
}

function getResendApiKey() {
  return (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_API_TOKEN ||
    process.env.RESEND_TOKEN ||
    ''
  ).trim();
}

function getNotificationFrom() {
  return (
    process.env.NOTIFICATION_FROM ||
    process.env.BOOKING_NOTIFICATION_FROM ||
    process.env.RESEND_FROM ||
    process.env.RESEND_SENDER ||
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.POSTMARK_FROM
  ).trim();
}

function isValidReplyTo(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getEmailTransport() {
  const postmarkToken = getPostmarkServerToken();
  if (postmarkToken) return { provider: 'postmark', token: postmarkToken };

  const resendApiKey = getResendApiKey();
  if (resendApiKey) return { provider: 'resend', token: resendApiKey };

  if (!_warnedMissingEmailProvider) {
    console.warn('No email provider configured. Set POSTMARK_SERVER_TOKEN or RESEND_API_KEY to send booking emails.');
    _warnedMissingEmailProvider = true;
  }
  return null;
}

function resolveNotificationFrom(provider) {
  const configured = getNotificationFrom();
  if (configured) return configured;

  if (provider === 'resend') {
    if (!_warnedDefaultFrom) {
      console.warn('No notification sender configured. Falling back to onboarding@resend.dev, which Resend only allows for limited testing to your own account address.');
      _warnedDefaultFrom = true;
    }
    return DEFAULT_RESEND_FROM;
  }

  if (!_warnedMissingNotificationFrom) {
    console.error('Notification sender address not set. Configure NOTIFICATION_FROM (or BOOKING_NOTIFICATION_FROM / POSTMARK_FROM / RESEND_FROM / RESEND_SENDER / EMAIL_FROM / FROM_EMAIL / MAIL_FROM / RESEND_FROM_EMAIL).');
    _warnedMissingNotificationFrom = true;
  }
  return '';
}

async function sendResendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body, data: parseJsonSafe(body) };
}

async function sendPostmarkEmail(serverToken, payload) {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': serverToken,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  const data = parseJsonSafe(body);
  const errorCode = data && Number.isFinite(Number(data.ErrorCode)) ? Number(data.ErrorCode) : 0;
  return { ok: res.ok && errorCode === 0, status: res.status, body, data };
}

async function sendEmailMessage(message) {
  const transport = getEmailTransport();
  if (!transport) return { ok: false, skipped: true, provider: 'none', status: 0, body: '' };

  const fromAddr = resolveNotificationFrom(transport.provider);
  if (!fromAddr) return { ok: false, skipped: true, provider: transport.provider, status: 0, body: '' };

  if (transport.provider === 'postmark') {
    return {
      provider: 'postmark',
      ...(await sendPostmarkEmail(transport.token, {
        From: fromAddr,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        MessageStream: getPostmarkMessageStream(),
        ...(message.replyTo ? { ReplyTo: message.replyTo } : {}),
        ...(message.tag ? { Tag: message.tag } : {}),
        ...(message.metadata ? { Metadata: message.metadata } : {}),
      })),
    };
  }

  const payload = {
    from: fromAddr,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
  if (message.replyTo) payload.replyTo = message.replyTo;

  let resendResult = await sendResendEmail(transport.token, payload);
  if (!resendResult.ok && message.replyTo) {
    console.warn(`Email to ${message.to} failed with replyTo; retrying without it.`, resendResult.status, resendResult.body);
    resendResult = await sendResendEmail(transport.token, {
      from: fromAddr,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  return { provider: 'resend', ...resendResult };
}

function logEmailResult(kind, recipient, result) {
  if (!result || result.skipped) return;
  if (!result.ok) {
    console.error(`${kind} to ${recipient} failed via ${result.provider}:`, result.status, result.body);
    return;
  }

  const id = result.provider === 'postmark'
    ? (result.data && result.data.MessageID)
    : (result.data && result.data.id);
  console.info(`${kind} sent to ${recipient} via ${result.provider}. Id: ${id || 'unknown'}`);
}

/* ── GAS communication ─────────────────────────────────────────────── */

// Google Apps Script POST responses redirect to a Google-hosted URL that must
// be read with GET. Re-posting to that redirect target returns 405.
async function gasPost(url, body) {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error('Calendar service redirect missing location');
    const redirectUrl = new URL(location, url);
    const host = redirectUrl.hostname;
    if (!host.endsWith('.google.com') && !host.endsWith('.googleusercontent.com')) {
      throw new Error('Blocked redirect to non-Google domain');
    }

    const followRes = await fetchWithTimeout(redirectUrl.toString(), {
      redirect: 'follow',
    });
    return {
      ok: followRes.ok,
      status: followRes.status,
      body: await followRes.text(),
    };
  }
  return {
    ok: res.ok,
    status: res.status,
    body: await res.text(),
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBookingEmailContext(booking) {
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
  const topicDisplay = topic || 'Not provided';
  const mins = booking.mins || 30;
  const who = booking.who || 'both';
  const hostLabel = HOST_LABELS[who] || 'Gaurav & Justin';
  const notifyTo = NOTIFY_EMAILS[who] || NOTIFY_EMAILS.both;
  const format = booking.format || 'virtual';
  const formatLabel = format === 'in-person' ? 'In person (Sidney Street)' : 'Google Meet';

  // Sanitize subject: strip control characters to prevent email header injection
  const safeName = booking.name.replace(/[\r\n\x00-\x1f]/g, ' ');
  const replyTo = isValidReplyTo(booking.email) ? booking.email.trim() : null;

  return {
    booking,
    dateStr,
    timeStr,
    name,
    email,
    topic,
    topicDisplay,
    mins,
    who,
    hostLabel,
    notifyTo,
    format,
    formatLabel,
    safeName,
    replyTo,
  };
}

async function sendHostNotifications(ctx) {
  const subject = `New booking with ${ctx.hostLabel}: ${ctx.safeName} — ${ctx.dateStr}`;

  const text = [
    `Someone just booked a meeting with ${ctx.hostLabel}.`,
    '',
    `Name:     ${ctx.booking.name}`,
    `Email:    ${ctx.booking.email}`,
    `Meeting:  ${ctx.hostLabel}`,
    `Format:   ${ctx.formatLabel}`,
    `Date:     ${ctx.dateStr}`,
    `Time:     ${ctx.timeStr}`,
    `Duration: ${ctx.mins} minutes`,
    `Topic:    ${ctx.booking.topic || 'Not provided'}`,
    '',
    'The calendar invite has been sent and the event is on your Google Calendar.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #7e4233; font-size: 20px; font-weight: 600; margin-bottom: 20px;">New meeting booked with ${ctx.hostLabel}</h2>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #e4e4e4; border-radius: 8px;">
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; width: 90px; vertical-align: top;">Name</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Email</td>
          <td style="padding: 10px 14px; font-size: 14px;"><a href="mailto:${ctx.email}" style="color: #7e4233;">${ctx.email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Meeting</td>
          <td style="padding: 10px 14px; font-size: 14px;">With ${ctx.hostLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Format</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.formatLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Date</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.dateStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Time</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.timeStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Duration</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.mins} minutes</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Topic</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.topicDisplay}</td>
        </tr>
      </table>
      <p style="color: #999; font-size: 12px; margin-top: 16px;">The calendar invite has been sent and the event is on your Google Calendar.</p>
    </div>`;

  if (!ctx.notifyTo.length) {
    console.warn(`No booking notification recipients configured for "${ctx.who}".`);
    return;
  }

  for (const recipient of ctx.notifyTo) {
    try {
      const result = await sendEmailMessage({
        to: recipient,
        subject,
        text,
        html,
        replyTo: ctx.replyTo,
        tag: 'booking-host-notification',
        metadata: {
          booking_type: 'host_notification',
          booking_host: ctx.who,
        },
      });
      logEmailResult('Host notification', recipient, result);
    } catch (err) {
      console.error(`Notification to ${recipient} error:`, err);
    }
  }
}

async function sendAttendeeConfirmation(ctx) {
  const subject = `Your meeting with ${ctx.hostLabel} is booked for ${ctx.dateStr}`;
  const text = [
    `Hi ${ctx.booking.name},`,
    '',
    `Your meeting with ${ctx.hostLabel} is booked.`,
    '',
    `Date:     ${ctx.dateStr}`,
    `Time:     ${ctx.timeStr}`,
    `Duration: ${ctx.mins} minutes`,
    `Format:   ${ctx.formatLabel}`,
    '',
    'A calendar invite has been sent to your email address.',
    'If you need to cancel or change the meeting, please reply to this email.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #7e4233; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Your meeting with ${ctx.hostLabel} is booked</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #222;">Hi ${ctx.name},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #222;">Your meeting has been booked successfully.</p>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #e4e4e4; border-radius: 8px;">
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; width: 90px; vertical-align: top;">With</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.hostLabel}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Date</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.dateStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Time</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.timeStr}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0efec;">
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Duration</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.mins} minutes</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #777; font-size: 13px; vertical-align: top;">Format</td>
          <td style="padding: 10px 14px; font-size: 14px;">${ctx.formatLabel}</td>
        </tr>
      </table>
      <p style="font-size: 13px; line-height: 1.6; color: #666; margin-top: 16px;">A calendar invite has been sent to your email address. If you need to cancel or change the meeting, you can reply to this message.</p>
    </div>`;

  const result = await sendEmailMessage({
    to: ctx.booking.email,
    subject,
    text,
    html,
    replyTo: ctx.notifyTo[0] || null,
    tag: 'booking-attendee-confirmation',
    metadata: {
      booking_type: 'attendee_confirmation',
      booking_host: ctx.who,
    },
  });
  logEmailResult('Booking confirmation', ctx.booking.email, result);
}

async function sendBookingEmails(booking) {
  const ctx = buildBookingEmailContext(booking);
  await sendHostNotifications(ctx);
  await sendAttendeeConfirmation(ctx);
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

      const startTime = new Date(validated.startISO);
      const endTime = new Date(validated.endISO);
      const policyError = bookingRuleError(startTime, validated.who) || bookingHoursError(startTime, endTime);
      if (policyError) {
        return {
          statusCode: 200,
          headers: postCorsHeaders(event),
          body: JSON.stringify({ ok: false, e: policyError }),
        };
      }

      /* ── Forward sanitized data to GAS ── */
      const sanitizedBody = JSON.stringify({
        ...validated,
        who: getPolicy(validated.who).gasWho,
      });
      const gasRes = await gasPost(GAS_URL, sanitizedBody);
      if (!gasRes.ok) {
        console.error('GAS POST failed:', gasRes.status, gasRes.body);
        return {
          statusCode: 502,
          headers: postCorsHeaders(event),
          body: JSON.stringify({ ok: false, e: 'Calendar service unavailable. Please try again.' }),
        };
      }

      const gasResult = parseJsonSafe(gasRes.body);
      if (!gasResult || typeof gasResult.ok !== 'boolean') {
        console.error('Invalid GAS POST response:', gasRes.body);
        return {
          statusCode: 502,
          headers: postCorsHeaders(event),
          body: JSON.stringify({ ok: false, e: 'Calendar service unavailable. Please try again.' }),
        };
      }

      /* ── Only send notification + invalidate cache if booking succeeded ── */
      if (gasResult.ok) {
        const dateStr = validated.startISO.split('T')[0];
        for (const m of ['15', '30', '45', '60']) {
          for (const w of ['gaurav', 'gaurav_priority', 'justin', 'both']) {
            _slotCache.delete(`${dateStr}_${m}_${w}`);
          }
        }

        try {
          await sendBookingEmails(validated);
        } catch (err) {
          console.error('Notification error:', err);
        }
      }

      return {
        statusCode: 200,
        headers: postCorsHeaders(event),
        body: JSON.stringify(gasResult),
      };

    } else {
      /* ── GET: availability data ── */
      const params = event.queryStringParameters || {};
      const who = params.who || 'both';
      const mins = params.mins || '30';
      const durationMinutes = Number(mins);
      const gasWho = getPolicy(who).gasWho;

      // Validate GET params
      if (!VALID_WHO.has(who) || !['15', '30', '45', '60'].includes(mins)) {
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
          if (bookingRuleError(isoDateToLocalDate(date), who)) {
            slotCacheSet(key, [], durationMinutes);
            results[date] = [];
            continue;
          }
          const cached = slotCacheGet(key, durationMinutes);
          if (cached !== null) {
            results[date] = cached;
          } else {
            uncached.push(date);
          }
        }

        if (uncached.length > 0) {
          let batchOk = false;
          try {
            const qs = new URLSearchParams({ dates: uncached.join(','), mins, who: gasWho }).toString();
            const res = await fetchWithTimeout(GAS_URL + '?' + qs, { redirect: 'follow' });
            const data = parseJsonSafe(await res.text());
            if (res.ok && data && data.ok && data.batch && data.results) {
              for (const [d, slots] of Object.entries(data.results)) {
                results[d] = slotCacheSet(`${d}_${mins}_${who}`, slots, durationMinutes);
              }
              batchOk = true;
            }
          } catch {}

          if (!batchOk) {
            const unavailable = [];
            const fetches = uncached.map(async (date) => {
              try {
                const qs = new URLSearchParams({ date, mins, who: gasWho }).toString();
                const res = await fetchWithTimeout(GAS_URL + '?' + qs, { redirect: 'follow' });
                if (!res.ok) throw new Error(`Upstream status ${res.status}`);
                const data = parseJsonSafe(await res.text());
                if (!data || !data.ok || !Array.isArray(data.slots)) {
                  throw new Error('Invalid upstream availability response');
                }
                results[date] = slotCacheSet(`${date}_${mins}_${who}`, data.slots, durationMinutes);
              } catch {
                unavailable.push(date);
              }
            });
            await Promise.all(fetches);

            if (unavailable.length > 0) {
              return {
                statusCode: 502,
                headers: CORS_GET,
                body: JSON.stringify({
                  ok: false,
                  e: 'Could not load live availability.',
                  partial: Object.keys(results).length > 0,
                  results,
                  unavailable,
                }),
              };
            }
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
        if (bookingRuleError(isoDateToLocalDate(date), who)) {
          slotCacheSet(key, [], durationMinutes);
          return { statusCode: 200, headers: CORS_GET_CACHED,
            body: JSON.stringify({ ok: true, slots: [] }) };
        }
        const cached = slotCacheGet(key, durationMinutes);
        if (cached !== null) {
          return { statusCode: 200, headers: CORS_GET_CACHED,
            body: JSON.stringify({ ok: true, slots: cached }) };
        }
      }

      const qs = new URLSearchParams({ ...params, who: gasWho }).toString();
      const url = GAS_URL + (qs ? '?' + qs : '');
      const res = await fetchWithTimeout(url, { redirect: 'follow' });
      if (!res.ok) {
        return {
          statusCode: 502,
          headers: CORS_GET,
          body: JSON.stringify({ ok: false, e: 'Could not load live availability.' }),
        };
      }
      const body = await res.text();

      if (date) {
        const data = parseJsonSafe(body);
        if (!data || !data.ok || !Array.isArray(data.slots)) {
          return {
            statusCode: 502,
            headers: CORS_GET,
            body: JSON.stringify({ ok: false, e: 'Could not load live availability.' }),
          };
        }
        const slots = slotCacheSet(`${date}_${mins}_${who}`, data.slots, durationMinutes);
        return {
          statusCode: 200,
          headers: CORS_GET_CACHED,
          body: JSON.stringify({ ok: true, slots }),
        };
      }

      return { statusCode: 200, headers: CORS_GET_CACHED, body };
    }
  } catch (err) {
    console.error('Handler error:', err);
    const headers = event.httpMethod === 'POST' ? postCorsHeaders(event) : CORS_GET;
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ ok: false, e: calendarServiceErrorMessage(err) }),
    };
  }
};
