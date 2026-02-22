const GAS_URL = 'https://script.google.com/macros/s/AKfycbypDh04zDGMw0iwzl0TXlQLgruNCQgkgObo6FCHhh78mK0mkCZFDtbmAYTtWrxEeBFK/exec';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

const NOTIFY_EMAILS = {
  gaurav: ['gaurav@meridiancambridge.org'],
  justin: ['justin@meridiancambridge.org'],
  both:   ['gaurav@meridiancambridge.org', 'justin@meridiancambridge.org'],
};
const HOST_LABELS = { gaurav: 'Gaurav', justin: 'Justin', both: 'Gaurav & Justin' };

// Follow POST redirects manually — standard fetch changes POST→GET on 302, losing the body
async function gasPost(url, body, depth) {
  if (depth > 5) throw new Error('Too many redirects');
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
    .replace(/"/g, '&quot;');
}

// Send booking notification email via Resend
// Runs after GAS has already created the calendar event.
// This is independent of Google — it sends a real email TO your inbox.
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

  const subject = `New booking with ${hostLabel}: ${booking.name} — ${dateStr}`;

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

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddr, to: notifyTo, subject, text, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Notification email failed:', res.status, err);
    }
  } catch (err) {
    console.error('Notification email error:', err);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    if (event.httpMethod === 'POST') {
      const body = await gasPost(GAS_URL, event.body, 0);

      // Send notification email (never blocks the booking response on failure)
      try {
        const booking = JSON.parse(event.body);
        await sendNotification(booking);
      } catch (notifyErr) {
        console.error('Notification error:', notifyErr);
      }

      return { statusCode: 200, headers: CORS, body };
    } else {
      const params = event.queryStringParameters || {};

      // Batch mode: ?dates=2026-03-02,2026-03-03&mins=30&who=gaurav
      // Fires parallel GAS requests and returns all results in one response.
      if (params.dates) {
        const dates = params.dates.split(',').slice(0, 25); // cap at 25 dates
        const mins = params.mins || '30';
        const who  = params.who  || 'both';

        const results = {};
        const fetches = dates.map(async (date) => {
          try {
            const qs = new URLSearchParams({ date, mins, who }).toString();
            const res = await fetch(GAS_URL + '?' + qs, { redirect: 'follow' });
            const data = JSON.parse(await res.text());
            results[date] = data.ok ? data.slots : [];
          } catch {
            results[date] = [];
          }
        });

        await Promise.all(fetches);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, batch: true, results }) };
      }

      // Single-date mode (existing behaviour)
      const qs = new URLSearchParams(params).toString();
      const url = GAS_URL + (qs ? '?' + qs : '');
      const res = await fetch(url, { redirect: 'follow' });
      const body = await res.text();
      return { statusCode: 200, headers: CORS, body };
    }
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, e: String(err) }) };
  }
};
