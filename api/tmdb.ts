const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

const ALLOWED_PATHS = [
  /^genre\/movie\/list$/,
  /^watch\/providers\/movie$/,
  /^search\/movie$/,
  /^search\/multi$/,
  /^discover\/movie$/,
  /^movie\/\d+$/,
  /^movie\/\d+\/similar$/,
  /^movie\/\d+\/videos$/,
  /^movie\/\d+\/watch\/providers$/,
  /^movie\/\d+\/release_dates$/,
  /^genre\/tv\/list$/,
  /^watch\/providers\/tv$/,
  /^search\/tv$/,
  /^discover\/tv$/,
  /^tv\/\d+$/,
  /^tv\/\d+\/similar$/,
  /^tv\/\d+\/videos$/,
  /^tv\/\d+\/watch\/providers$/,
  /^tv\/\d+\/content_ratings$/,
];

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'TMDB API is not configured' });
  }

  const requestUrl = new URL(request.url, 'https://streamdrop.local');
  const path = requestUrl.searchParams.get('path')?.replace(/^\/+|\/+$/g, '');

  if (!path || !ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    return response.status(400).json({ error: 'Unsupported TMDB path' });
  }

  requestUrl.searchParams.delete('path');
  requestUrl.searchParams.delete('api_key');
  requestUrl.searchParams.set('api_key', apiKey);

  const upstreamUrl = `${TMDB_API_BASE_URL}/${path}?${requestUrl.searchParams.toString()}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
    });
    const body = await upstreamResponse.text();

    response.setHeader('Content-Type', 'application/json');
    response.setHeader(
      'Cache-Control',
      upstreamResponse.ok
        ? 's-maxage=300, stale-while-revalidate=3600'
        : 'no-store'
    );

    return response.status(upstreamResponse.status).send(body);
  } catch {
    return response.status(502).json({ error: 'TMDB request failed' });
  }
}
