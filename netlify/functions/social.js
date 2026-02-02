// Netlify Function to redirect to the most upcoming CAISH social event
// This keeps the API key secure on the server side

const LUMA_EVENTS_URL = 'https://api.lu.ma/public/v1/calendar/list-events';

exports.handler = async (event) => {
  const headers = {
    'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: 'Method not allowed'
    };
  }

  const apiKey = process.env.LUMA_API_KEY;

  if (!apiKey) {
    console.error('LUMA_API_KEY environment variable not set');
    return {
      statusCode: 500,
      headers,
      body: 'API configuration error'
    };
  }

  try {
    const response = await fetch(LUMA_EVENTS_URL, {
      method: 'GET',
      headers: {
        'x-luma-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Luma API error:', response.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: 'Failed to fetch events from Luma'
      };
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
      const eventData = entry.event || entry;
      const name = (eventData.name || '').toLowerCase();
      if (!name.includes('social')) return false;

      // Check name and description
      if (isCaishRelated(eventData.name || '') || isCaishRelated(eventData.description || '')) {
        return true;
      }

      // Check tags (direct tag names and resolved tag IDs)
      const directTags = (eventData.tags || entry.tags || []).map(t =>
        (typeof t === 'string' ? t : (t?.name || '')).toUpperCase()
      ).filter(Boolean);
      const tagIds = eventData.tag_ids || entry.tag_ids || [];
      const resolvedTags = tagIds.map(id => tagDictionary.get(id)).filter(Boolean).map(n => n.toUpperCase());
      const allTags = [...directTags, ...resolvedTags];

      return allTags.some(tag => tag.includes('CAISH'));
    });

    // Filter to only show upcoming events (events that haven't happened yet)
    const now = new Date();
    events = events.filter(entry => {
      const eventData = entry.event || entry;
      const startDate = new Date(eventData.start_at || eventData.start_time);
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
      return {
        statusCode: 404,
        headers,
        body: 'No upcoming CAISH social events found. Please check back later!'
      };
    }

    const nextEvent = events[0];
    const eventData = nextEvent.event || nextEvent;

    // Get the Luma URL
    const lumaUrl = eventData.url || `https://lu.ma/${eventData.api_id || eventData.id}`;

    console.log(`Redirecting to upcoming CAISH social: ${eventData.name} at ${lumaUrl}`);

    // Return a redirect response
    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location': lumaUrl
      },
      body: ''
    };

  } catch (error) {
    console.error('Error fetching events:', error);
    return {
      statusCode: 500,
      headers,
      body: 'Internal server error: ' + error.message
    };
  }
};
