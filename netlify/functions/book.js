const GAS_URL = 'https://script.google.com/macros/s/AKfycbyGpHWJ9mztPGSKUKphCowZK0w9cG5SPNJQPTO00rnENxyH2JohqsFumBDJZjvs2Olm/exec';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    let url = GAS_URL;
    const opts = { method: event.httpMethod, redirect: 'follow' };

    if (event.httpMethod === 'GET') {
      const qs = new URLSearchParams(event.queryStringParameters || {}).toString();
      if (qs) url += '?' + qs;
    } else if (event.httpMethod === 'POST') {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = event.body;
    }

    const res = await fetch(url, opts);
    const body = await res.text();
    return { statusCode: 200, headers: CORS, body };
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, e: String(err) }) };
  }
};
