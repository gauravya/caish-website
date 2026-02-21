const GAS_URL = 'https://script.google.com/macros/s/AKfycbyGpHWJ9mztPGSKUKphCowZK0w9cG5SPNJQPTO00rnENxyH2JohqsFumBDJZjvs2Olm/exec';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    if (event.httpMethod === 'POST') {
      const body = await gasPost(GAS_URL, event.body, 0);
      return { statusCode: 200, headers: CORS, body };
    } else {
      const qs = new URLSearchParams(event.queryStringParameters || {}).toString();
      const url = GAS_URL + (qs ? '?' + qs : '');
      const res = await fetch(url, { redirect: 'follow' });
      const body = await res.text();
      return { statusCode: 200, headers: CORS, body };
    }
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, e: String(err) }) };
  }
};
