import { parseMovieIntentFallback } from '../constants/movie-intent';

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

  const query = String(request.body?.query || '').trim().slice(0, 240);
  if (query.length < 3) {
    return response.status(400).json({ error: 'Tell us a little more.' });
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({
    ...parseMovieIntentFallback(query),
    source: 'local',
  });
}
