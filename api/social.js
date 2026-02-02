// Vercel Serverless Function to redirect to the most upcoming CAISH social event
// This keeps the API key secure on the server side

const LUMA_GET_EVENT_URL = 'https://api.lu.ma/public/v1/event/get';

// --- MANUAL OVERRIDE ---
// Hardcoded redirect for cross-listed events not returned by the Luma calendar API.
// Remove or update this when the event passes or the API issue is resolved.
const MANUAL_SOCIAL_URL = 'https://lu.ma/dnnq32q4';
const MANUAL_SOCIAL_EXPIRY = '2026-02-12T00:00:00Z'; // day after the event (11 Feb 2026)
// --- END MANUAL OVERRIDE ---

// Fetch individual events by ID from the LUMA_EXTRA_EVENT_IDS env var
async function fetchExtraEvents(apiKey) {
  const extraIds = (process.env.LUMA_EXTRA_EVENT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (extraIds.length === 0) return [];

  const results = await Promise.allSettled(
    extraIds.map(async (eventId) => {
      const url = new URL(LUMA_GET_EVENT_URL);
      url.searchParams.set('event_api_id', eventId);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-luma-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.event ? { event: data.event } : null;
    })
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

export default async function handler(req, res) {
  // Set cache headers - cache for 1 hour since events don't change that frequently
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use manual override if it hasn't expired yet
  if (MANUAL_SOCIAL_URL && new Date() < new Date(MANUAL_SOCIAL_EXPIRY)) {
    return res.redirect(302, MANUAL_SOCIAL_URL);
  }

  const API_KEY = process.env.LUMA_API_KEY;

  if (!API_KEY) {
    console.error('LUMA_API_KEY environment variable not set');
    return res.status(500).send('API configuration error');
  }

  try {
    const LUMA_EVENTS_URL = 'https://api.lu.ma/public/v1/calendar/list-events';

    // Fetch all pages of events from the Luma API using cursor-based pagination
    let allEntries = [];
    let cursor = null;
    const MAX_PAGES = 10;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(LUMA_EVENTS_URL);
      if (cursor) {
        url.searchParams.set('pagination_cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-luma-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Luma API error:', response.status, errorText);
        return res.status(500).send('Failed to fetch events from Luma');
      }

      const data = await response.json();
      const entries = data.entries || data.events || [];
      allEntries = allEntries.concat(entries);

      if (!data.has_more || !data.next_cursor) {
        break;
      }
      cursor = data.next_cursor;
    }

    // Fetch extra events not managed by the CAISH calendar
    const extraEntries = await fetchExtraEvents(API_KEY);
    const seenIds = new Set(allEntries.map(e => (e.event || e).api_id).filter(Boolean));
    for (const entry of extraEntries) {
      const id = (entry.event || entry).api_id;
      if (id && !seenIds.has(id)) {
        allEntries.push(entry);
        seenIds.add(id);
      }
    }

    let events = allEntries;

    // Filter for CAISH social events
    // Check name and description for CAISH reference (abbreviation or full name)
    const isCaishRelated = (text) => {
      const upper = text.toUpperCase();
      return upper.includes('CAISH') || upper.includes('CAMBRIDGE AI SAFETY HUB');
    };

    events = events.filter(entry => {
      const event = entry.event || entry;
      const name = (event.name || '').toLowerCase();
      if (!name.includes('social')) return false;
      return isCaishRelated(event.name || '') || isCaishRelated(event.description || '');
    });

    // Filter to only show upcoming events (events that haven't happened yet)
    const now = new Date();
    events = events.filter(entry => {
      const event = entry.event || entry;
      const startDate = new Date(event.start_at || event.start_time);
      return startDate >= now;
    });

    // Sort by start time (upcoming first)
    events.sort((a, b) => {
      const dateA = new Date((a.event || a).start_at || (a.event || a).start_time);
      const dateB = new Date((b.event || b).start_at || (b.event || b).start_time);
      return dateA - dateB;
    });

    // Get the first (most upcoming) event
    if (events.length === 0) {
      console.error('No upcoming CAISH social events found');
      return res.status(404).send('No upcoming CAISH social events found. Please check back later!');
    }

    const nextEvent = events[0];
    const event = nextEvent.event || nextEvent;

    // Get the Luma URL
    const lumaUrl = event.url || `https://lu.ma/${event.api_id || event.id}`;

    console.log(`Redirecting to upcoming CAISH social: ${event.name} at ${lumaUrl}`);

    // Redirect to the event page
    return res.redirect(302, lumaUrl);

  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).send('Internal server error: ' + error.message);
  }
}
