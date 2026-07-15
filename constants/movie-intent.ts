export type MovieIntentFilters = {
  languages: string[];
  platforms: string[];
  genres: string[];
  releaseWindowMonths: number;
};

export type MovieIntentResult = {
  summary: string;
  filters: MovieIntentFilters;
};

const LANGUAGE_MATCHES = [
  { code: 'en', names: ['english', 'hollywood'] },
  { code: 'hi', names: ['hindi', 'bollywood'] },
  { code: 'ta', names: ['tamil', 'kollywood'] },
  { code: 'te', names: ['telugu', 'tollywood'] },
  { code: 'ml', names: ['malayalam', 'mollywood'] },
  { code: 'kn', names: ['kannada', 'sandalwood'] },
];

const PLATFORM_MATCHES = [
  { key: 'netflix', names: ['netflix'] },
  { key: 'prime', names: ['prime', 'amazon', 'amazon prime', 'prime video'] },
  { key: 'disney', names: ['disney', 'disney+', 'disney plus'] },
  { key: 'hulu', names: ['hulu'] },
  { key: 'hotstar', names: ['hotstar', 'jiohotstar', 'jio hotstar'] },
  { key: 'apple-tv', names: ['apple tv', 'apple tv+', 'apple'] },
  { key: 'hbo-max', names: ['hbo', 'hbo max', 'max'] },
];

const GENRE_MATCHES = [
  { key: 'action', names: ['action', 'fight', 'mass'] },
  { key: 'comedy', names: ['comedy', 'funny', 'light', 'feel good', 'feel-good'] },
  { key: 'drama', names: ['drama', 'emotional', 'serious'] },
  { key: 'romance', names: ['romance', 'romantic', 'love'] },
  { key: 'thriller', names: ['thriller', 'suspense', 'mystery', 'crime'] },
  { key: 'family', names: ['family', 'kids', 'children'] },
];

const unique = (values: string[]) => Array.from(new Set(values));

const includesAny = (normalizedQuery: string, names: string[]) =>
  names.some((name) => normalizedQuery.includes(name));

export const parseMovieIntentFallback = (query: string): MovieIntentResult => {
  const normalizedQuery = query.trim().toLowerCase();
  const languages = unique(
    LANGUAGE_MATCHES.filter((item) =>
      includesAny(normalizedQuery, item.names)
    ).map((item) => item.code)
  );
  const platforms = unique(
    PLATFORM_MATCHES.filter((item) =>
      includesAny(normalizedQuery, item.names)
    ).map((item) => item.key)
  );
  const genres = unique(
    GENRE_MATCHES.filter((item) =>
      includesAny(normalizedQuery, item.names)
    ).map((item) => item.key)
  );

  let releaseWindowMonths = 3;
  if (normalizedQuery.includes('this week') || normalizedQuery.includes('weekend')) {
    releaseWindowMonths = 1;
  } else if (
    normalizedQuery.includes('new') ||
    normalizedQuery.includes('latest') ||
    normalizedQuery.includes('recent')
  ) {
    releaseWindowMonths = 3;
  } else if (
    normalizedQuery.includes('older') ||
    normalizedQuery.includes('last year') ||
    normalizedQuery.includes('past year')
  ) {
    releaseWindowMonths = 12;
  }

  return {
    summary:
      languages.length || platforms.length || genres.length
        ? 'Applied the closest matching filters from your request.'
        : 'I could not infer a specific filter yet, so I kept All selected.',
    filters: {
      languages: languages.length ? languages : ['all'],
      platforms: platforms.length ? platforms : ['all'],
      genres: genres.length ? genres : ['all'],
      releaseWindowMonths,
    },
  };
};

export const sanitizeMovieIntent = (value: unknown): MovieIntentResult => {
  const fallback = parseMovieIntentFallback('');
  if (!value || typeof value !== 'object') return fallback;

  const parsed = value as Partial<MovieIntentResult>;
  const filters = parsed.filters || {};

  const normalizeList = (items: unknown, allowed: string[]) => {
    if (!Array.isArray(items)) return ['all'];
    const filtered = unique(
      items.filter((item): item is string => allowed.includes(String(item)))
    );
    return filtered.length ? filtered : ['all'];
  };

  const releaseWindowMonths = Number(filters.releaseWindowMonths);

  return {
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.summary,
    filters: {
      languages: normalizeList(filters.languages, [
        'all',
        'en',
        'hi',
        'ta',
        'te',
        'ml',
        'kn',
      ]),
      platforms: normalizeList(filters.platforms, [
        'all',
        'netflix',
        'prime',
        'disney',
        'hulu',
        'hotstar',
        'apple-tv',
        'hbo-max',
      ]),
      genres: normalizeList(filters.genres, [
        'all',
        'action',
        'comedy',
        'drama',
        'romance',
        'thriller',
        'family',
      ]),
      releaseWindowMonths: [1, 3, 6, 12].includes(releaseWindowMonths)
        ? releaseWindowMonths
        : fallback.filters.releaseWindowMonths,
    },
  };
};
