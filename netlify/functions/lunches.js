// Netlify Function to fetch CAISH Lunches events from Luma API

const LUMA_EVENTS_URL = 'https://api.lu.ma/public/v1/calendar/list-events';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const apiKey = process.env.LUMA_API_KEY;

  if (!apiKey) {
    console.error('LUMA_API_KEY environment variable not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'API configuration error' })
    };
  }

  try {
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
          'x-luma-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Luma API error:', response.status, errorText);
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'Unable to load lunches at this time. Please try again later.'
          })
        };
      }

      const data = await response.json();
      const entries = data.entries || data.events || [];
      allEntries = allEntries.concat(entries);

      if (!data.has_more || !data.next_cursor) {
        break;
      }
      cursor = data.next_cursor;
    }

    // Filter for events with "lunches" in the name
    let events = allEntries.filter(entry => {
      const eventData = entry.event || entry;
      const name = (eventData.name || '').toUpperCase();
      return name.includes('LUNCH');
    });

    // Sort by start date ascending
    events.sort((a, b) => {
      const dateA = new Date((a.event || a).start_at || (a.event || a).start_time);
      const dateB = new Date((b.event || b).start_at || (b.event || b).start_time);
      return dateA - dateB;
    });

    // Only show events from one week ago onwards
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    events = events.filter(entry => {
      const eventData = entry.event || entry;
      const startDate = new Date(eventData.start_at || eventData.start_time);
      return startDate >= oneWeekAgo;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        events,
        count: events.length,
        fetched_at: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error fetching lunches:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Unable to load lunches at this time. Please try again later.'
      })
    };
  }
};
