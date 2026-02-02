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

    // Filter for CAISH social events
    // Look for events that contain "social" and reference CAISH (by abbreviation or full name)
    // in the name, description, or tags (case-insensitive)
    const isCaishRelated = (text) => {
      const lower = text.toLowerCase();
      return lower.includes('caish') || lower.includes('cambridge ai safety hub');
    };

    events = events.filter(entry => {
      const eventData = entry.event || entry;
      const name = (eventData.name || '').toLowerCase();
      const description = (eventData.description || '').toLowerCase();
      if (!name.includes('social')) return false;
      return isCaishRelated(eventData.name || '') || isCaishRelated(eventData.description || '');
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
