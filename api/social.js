// Vercel Serverless Function to redirect to the most upcoming CAISH social event
// This keeps the API key secure on the server side

export default async function handler(req, res) {
  // Set cache headers - cache for 1 hour since events don't change that frequently
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.LUMA_API_KEY;

  if (!API_KEY) {
    console.error('LUMA_API_KEY environment variable not set');
    return res.status(500).send('API configuration error');
  }

  try {
    // Fetch events from Luma API
    const response = await fetch('https://api.lu.ma/public/v1/calendar/list-events', {
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
    let events = data.entries || data.events || [];

    // Build tag dictionary so we can resolve tag IDs to names
    const tagDictionary = new Map();
    const tagList = data.tags || data.tag_list || [];
    tagList.forEach(tag => {
      const id = tag?.api_id || tag?.id;
      const name = typeof tag === 'string' ? tag : (tag?.name || '');
      if (id && name) {
        tagDictionary.set(id, name);
      }
    });

    // Filter for CAISH social events
    // Check tags, name, and description for CAISH reference (abbreviation or full name)
    const isCaishRelated = (text) => {
      const upper = text.toUpperCase();
      return upper.includes('CAISH') || upper.includes('CAMBRIDGE AI SAFETY HUB');
    };

    events = events.filter(entry => {
      const event = entry.event || entry;
      const name = (event.name || '').toLowerCase();
      if (!name.includes('social')) return false;

      // Check name and description
      if (isCaishRelated(event.name || '') || isCaishRelated(event.description || '')) {
        return true;
      }

      // Check tags (direct tag names and resolved tag IDs)
      const directTags = (event.tags || entry.tags || []).map(t =>
        (typeof t === 'string' ? t : (t?.name || '')).toUpperCase()
      ).filter(Boolean);
      const tagIds = event.tag_ids || entry.tag_ids || [];
      const resolvedTags = tagIds.map(id => tagDictionary.get(id)).filter(Boolean).map(n => n.toUpperCase());
      const allTags = [...directTags, ...resolvedTags];

      return allTags.some(tag => tag.includes('CAISH'));
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
