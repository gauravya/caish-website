// Netlify Function to fetch events from Luma API
// This keeps the API key secure on the server side

const LUMA_EVENTS_URL = 'https://api.lu.ma/public/v1/calendar/list-events';
const CAISH_TAG = 'CAISH';
const CAISH_FULL_NAME = 'CAMBRIDGE AI SAFETY HUB';

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
            error: 'Unable to load events at this time. Please try again later.'
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

    let events = allEntries;

    // Debug mode: ?debug=true returns all event names from the API (unfiltered)
    if (event.queryStringParameters?.debug === 'true') {
      const allNames = allEntries.map(entry => {
        const eventData = entry.event || entry;
        return {
          name: eventData.name,
          api_id: eventData.api_id,
          start_at: eventData.start_at
        };
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          total_from_api: allEntries.length,
          all_events: allNames,
          fetched_at: new Date().toISOString()
        })
      };
    }

    events = events.filter(entry => {
      const eventData = entry.event || entry;
      const name = (eventData.name || '').toUpperCase();
      const description = (eventData.description || '').toUpperCase();

      return (
        name.includes(CAISH_TAG) ||
        name.includes(CAISH_FULL_NAME) ||
        description.includes(CAISH_TAG) ||
        description.includes(CAISH_FULL_NAME)
      );
    });

    events.sort((a, b) => {
      const dateA = new Date((a.event || a).start_at || (a.event || a).start_time);
      const dateB = new Date((b.event || b).start_at || (b.event || b).start_time);
      return dateA - dateB;
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    events = events.filter(entry => {
      const eventData = entry.event || entry;
      const startDate = new Date(eventData.start_at || eventData.start_time);
      return startDate >= oneWeekAgo;
    });

    // Validate and sanitize limit parameter (max 100 events)
    const MAX_LIMIT = 100;
    let limit = null;

    if (event.queryStringParameters?.limit) {
      const parsedLimit = Number.parseInt(event.queryStringParameters.limit, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, MAX_LIMIT);
      }
    }

    if (limit) {
      events = events.slice(0, limit);
    }

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
    console.error('Error fetching events:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Unable to load events at this time. Please try again later.'
      })
    };
  }
};
