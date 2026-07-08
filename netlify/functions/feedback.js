// Netlify Function: receive course feedback from /hardware/feedback and
// append it to the course_feedback table in the HAP Airtable base.
// Anonymous by design; a honeypot field and length caps keep the junk out.
// Reuses the AIRTABLE_SKETCH_TOKEN env var (same base).

const AIRTABLE_BASE = 'app8d6sDud8MgJ4XD';
const AIRTABLE_TABLE = 'tbli8NMRYkRfp0IFd'; // course_feedback

const WHERE_OPTIONS = ['Unit 01', 'Unit 02', 'Unit 03', 'Unit 04', 'Sign-in or site', 'General'];
const TIME_OPTIONS = ['Under 3h', '3-5h', '5-7h', 'Over 7h'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

function respond(statusCode, message) {
  return { statusCode, headers: HEADERS, body: JSON.stringify({ message }) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, 'Method not allowed');
  if (!process.env.AIRTABLE_SKETCH_TOKEN) return respond(503, 'Feedback is not configured yet');

  // Reject oversized bodies before parsing; a real submission is a few KB.
  if ((event.body || '').length > 40000) return respond(413, 'Too much text');

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return respond(400, 'Bad request');
  }

  // Honeypot: real users never fill this. Return 200 so bots see success.
  if (payload.website) return respond(200, 'Thanks');

  const clean = (value, max) => String(value || '').slice(0, max).trim();
  const feedback = clean(payload.feedback, 8000);
  if (!feedback) return respond(400, 'Say what is off before submitting');

  const fields = { feedback };
  const where = clean(payload.where, 40);
  if (WHERE_OPTIONS.includes(where)) fields.where = where;
  const timeTaken = clean(payload.time_taken, 20);
  if (TIME_OPTIONS.includes(timeTaken)) fields.time_taken = timeTaken;
  const cutReading = clean(payload.cut_reading, 500);
  if (cutReading) fields.cut_reading = cutReading;
  const name = clean(payload.name, 120);
  if (name) fields.name = name;

  const response = await fetch(
    'https://api.airtable.com/v0/' + AIRTABLE_BASE + '/' + AIRTABLE_TABLE,
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.AIRTABLE_SKETCH_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: [{ fields }] })
    }
  );

  if (!response.ok) return respond(502, 'Could not save your feedback. Try again in a minute.');
  return respond(200, 'Thanks, noted.');
};
