import {
  parseMovieIntentFallback,
  sanitizeMovieIntent,
} from '../constants/movie-intent';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description: 'One short sentence explaining the filters chosen.',
    },
    filters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        languages: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['all', 'en', 'hi', 'ta', 'te', 'ml', 'kn'],
          },
        },
        platforms: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'all',
              'netflix',
              'prime',
              'disney',
              'hulu',
              'hotstar',
              'apple-tv',
              'hbo-max',
            ],
          },
        },
        genres: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'all',
              'action',
              'comedy',
              'drama',
              'romance',
              'thriller',
              'family',
            ],
          },
        },
        releaseWindowMonths: {
          type: 'number',
          enum: [1, 3, 6, 12],
        },
      },
      required: [
        'languages',
        'platforms',
        'genres',
        'releaseWindowMonths',
      ],
    },
  },
  required: ['summary', 'filters'],
};

const parseOpenAIText = (body: any) => {
  const outputText = body.output_text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText;
  }

  const textItem = body.output
    ?.flatMap((item: any) => item.content || [])
    ?.find((content: any) => content.type === 'output_text');

  return typeof textItem?.text === 'string' ? textItem.text : '';
};

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(200).json({
      ...parseMovieIntentFallback(query),
      source: 'fallback',
    });
  }

  try {
    const upstreamResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content:
              'Convert a movie-discovery request into StreamDrop filters. Use only supported filter values. Prefer specific matches, otherwise use all. Return only JSON.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'streamdrop_movie_intent',
            schema: responseSchema,
            strict: true,
          },
        },
      }),
    });

    if (!upstreamResponse.ok) {
      return response.status(200).json({
        ...parseMovieIntentFallback(query),
        source: 'fallback',
      });
    }

    const body = await upstreamResponse.json();
    const text = parseOpenAIText(body);
    const parsed = text ? JSON.parse(text) : null;

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ...sanitizeMovieIntent(parsed),
      source: 'openai',
    });
  } catch {
    return response.status(200).json({
      ...parseMovieIntentFallback(query),
      source: 'fallback',
    });
  }
}
