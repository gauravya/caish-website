// Netlify Function: receive project sketch submissions from the AI Assurance
// course and upsert them into the HAP Airtable base (one row per email).
// The Airtable token lives in the AIRTABLE_SKETCH_TOKEN env var, server-side
// only. Identity comes from the caller's Supabase session token, verified
// against Supabase auth, so the email cannot be spoofed.

const SUPABASE_URL = 'https://joggzpdemdmyvnlhtjte.supabase.co';
const AIRTABLE_BASE = 'app8d6sDud8MgJ4XD';
const AIRTABLE_TABLE = 'tblqO7vd9h6LIfvJM'; // Project Sketches

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

function respond(statusCode, message) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ message }) };
}

async function verifyUser(token) {
  // The anon key is the public client key; it only lets us ask "whose token
  // is this?". Read it from env with a fallback to the one shipped in the site.
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: anonKey }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user && user.email ? user : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, 'Method not allowed');
  if (!process.env.AIRTABLE_SKETCH_TOKEN) return respond(503, 'Submissions are not configured yet');

  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return respond(401, 'Sign in required');

  let user;
  try {
    user = await verifyUser(token);
  } catch (error) {
    return respond(502, 'Could not verify your session');
  }
  if (!user) return respond(401, 'Session expired. Sign in again.');

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return respond(400, 'Bad request');
  }

  const answers = payload.answers || {};
  const clean = (key, max) => String(answers[key] || '').slice(0, max || 8000).trim();
  const metadata = user.user_metadata || {};
  const name = String(
    payload.name ||
    metadata.full_name ||
    metadata.name ||
    user.email
  ).slice(0, 120).trim();
  const project = clean('q1');
  if (!project) return respond(400, 'The first question is required');

  const fields = {
    name,
    email: user.email.toLowerCase(),
    project,
    problem: clean('q2'),
    path_to_impact: clean('q3'),
    evidence_first_test: clean('q4'),
    getting_seen: clean('q5'),
    scope_stopping: clean('q6'),
    submitted_at: new Date().toISOString()
  };

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + process.env.AIRTABLE_SKETCH_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: ['email'] },
      records: [{ fields }]
    })
  });

  if (!response.ok) {
    console.error('Airtable upsert failed:', response.status, await response.text());
    return respond(502, 'Could not save your sketch. Please try again.');
  }
  return respond(200, 'Saved');
};
