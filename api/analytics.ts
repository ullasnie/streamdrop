const ALLOWED_EVENTS = new Set([
  'home_viewed',
  'settings_viewed',
  'watchlist_viewed',
  'movie_opened',
  'watchlist_added',
  'watchlist_removed',
  'search_used',
  'refresh_tapped',
  'filter_changed',
  'alerts_changed',
]);

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const event = request.body?.event;
  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return response.status(400).json({ error: 'Unsupported analytics event' });
  }

  const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    return response.status(500).json({ error: 'Analytics is not configured' });
  }

  try {
    const upstreamResponse = await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: projectToken,
        event,
        properties: {
          distinct_id: 'streamdrop_aggregate',
          $geoip_disable: true,
        },
      }),
    });

    if (!upstreamResponse.ok) {
      return response.status(502).json({ error: 'Analytics request failed' });
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(202).json({ accepted: true });
  } catch {
    return response.status(502).json({ error: 'Analytics request failed' });
  }
}
