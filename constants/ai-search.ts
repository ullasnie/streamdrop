import {
  MovieIntentResult,
  parseMovieIntentFallback,
  sanitizeMovieIntent,
} from './movie-intent';

const configuredAiSearchUrl =
  process.env.EXPO_PUBLIC_AI_SEARCH_URL?.replace(/\/$/, '');
const productionAiSearchUrl = 'https://streamdrop-eight.vercel.app/api/ai-search';

const getAiSearchUrl = () => configuredAiSearchUrl || productionAiSearchUrl;

export const parseMovieIntent = async (
  query: string
): Promise<MovieIntentResult & { source: string }> => {
  if (__DEV__ && !configuredAiSearchUrl) {
    return {
      ...parseMovieIntentFallback(query),
      source: 'fallback',
    };
  }

  try {
    const response = await fetch(getAiSearchUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new Error('AI search failed');

    const body = await response.json();
    return {
      ...sanitizeMovieIntent(body),
      source: typeof body.source === 'string' ? body.source : 'openai',
    };
  } catch {
    return {
      ...parseMovieIntentFallback(query),
      source: 'fallback',
    };
  }
};
