const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const WEEKEND_LIMIT = 6;
const RECENT_MOVIE_LIMIT = 12;
const RECENT_SERIES_LIMIT = 12;
const MAX_LANGUAGES = 3;
const MAX_PLATFORMS = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const OTT_RELEASE_TYPES = [4, 6];

type MediaType = 'movie' | 'tv';

type FeedItem = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
  vote_average?: number | null;
  vote_count?: number | null;
  original_language?: string;
  genre_ids?: number[];
  genreNames?: string[];
  ottReleaseDate?: string;
  providerNames?: string[];
  certification?: string;
  media_type: MediaType;
};

const LANGUAGE_REGION: Record<string, string> = {
  en: 'US',
  hi: 'IN',
  ta: 'IN',
  te: 'IN',
  ml: 'IN',
  kn: 'IN',
  ko: 'KR',
  es: 'ES',
  ja: 'JP',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  pt: 'BR',
  zh: 'TW',
  ar: 'AE',
  tr: 'TR',
  th: 'TH',
  id: 'ID',
};

const PLATFORM_IDS: Record<string, { default: number[]; IN?: number[]; US?: number[] }> = {
  netflix: { default: [8] },
  prime: { default: [9], IN: [119], US: [9] },
  disney: { default: [337] },
  hulu: { default: [15] },
  hotstar: { default: [619] },
  'apple-tv': { default: [350] },
  'hbo-max': { default: [1899] },
};

const GENRE_IDS: Record<string, number> = {
  action: 28,
  comedy: 35,
  drama: 18,
  romance: 10749,
  thriller: 53,
  family: 10751,
  adventure: 12,
  animation: 16,
  crime: 80,
  documentary: 99,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  'science-fiction': 878,
  'tv-movie': 10770,
  war: 10752,
  western: 37,
};

const GENRE_NAMES = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([key, id]) => [
    id,
    key
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
  ])
) as Record<number, string>;

const feedCache = new Map<
  string,
  { expiresAt: number; value: Record<string, unknown> }
>();
const pendingFeeds = new Map<string, Promise<Record<string, unknown>>>();

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getDateRange = (months: number) => {
  const today = new Date();
  const past = new Date(today);
  past.setMonth(today.getMonth() - months);
  return { startDate: formatDate(past), endDate: formatDate(today) };
};

const getWeekendRange = () => {
  const today = new Date();
  const day = today.getDay();
  const daysUntilThursday = day === 0 ? -3 : 4 - day;
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysUntilThursday);
  const sunday = new Date(thursday);
  sunday.setDate(thursday.getDate() + 3);
  return { startDate: formatDate(thursday), endDate: formatDate(sunday) };
};

const parseList = (value: string | null, fallback: string[]) => {
  const parsed = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed?.length ? parsed : fallback;
};

const getProviderIds = (keys: string[], region: string) =>
  keys
    .filter((key) => key !== 'all')
    .flatMap((key) => {
      if (key.startsWith('tmdb-')) {
        const id = Number(key.split('-')[1]);
        return Number.isFinite(id) ? [id] : [];
      }
      const configured = PLATFORM_IDS[key];
      return configured?.[region as 'IN' | 'US'] || configured?.default || [];
    });

const fetchTmdb = async (
  apiKey: string,
  path: string,
  params: Record<string, string | number | boolean> = {}
) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) =>
    searchParams.set(key, String(value))
  );
  searchParams.set('api_key', apiKey);
  const response = await fetch(
    `${TMDB_API_BASE_URL}/${path}?${searchParams.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) throw new Error(`TMDB ${path} failed`);
  return response.json();
};

const normalizeItem = (item: any, mediaType: MediaType): FeedItem => ({
  ...item,
  title:
    mediaType === 'tv'
      ? item.name || item.original_name || 'Untitled series'
      : item.title || item.original_title || 'Untitled movie',
  release_date:
    mediaType === 'tv' ? item.first_air_date || '' : item.release_date || '',
  media_type: mediaType,
  genreNames: (item.genre_ids || [])
    .map((id: number) => GENRE_NAMES[id])
    .filter(Boolean),
});

const uniqueItems = (items: FeedItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchProviders = async (
  apiKey: string,
  item: FeedItem,
  region: string
) => {
  const data = await fetchTmdb(
    apiKey,
    `${item.media_type}/${item.id}/watch/providers`
  );
  return (data.results?.[region]?.flatrate || []).map(
    (provider: { provider_name: string }) => provider.provider_name
  );
};

const fetchMovieReleaseInfo = async (
  apiKey: string,
  movieId: number,
  region: string
) => {
  const data = await fetchTmdb(apiKey, `movie/${movieId}/release_dates`);
  const releaseDates =
    data.results?.find(
      (item: { iso_3166_1: string }) => item.iso_3166_1 === region
    )?.release_dates || [];
  const certification =
    releaseDates.find(
      (release: { certification?: string }) => release.certification
    )?.certification || '';
  const ottReleaseDates = releaseDates
    .filter((release: { type?: number }) =>
      release.type ? OTT_RELEASE_TYPES.includes(release.type) : false
    )
    .map((release: { release_date: string }) =>
      release.release_date?.split('T')[0]
    )
    .filter(Boolean);
  return { certification, ottReleaseDates };
};

const buildFeed = async (
  apiKey: string,
  languages: string[],
  platforms: string[],
  genreKeys: string[],
  contentTypes: string[],
  months: number,
  hiddenKeys: Set<string>
) => {
  const startedAt = Date.now();
  const weekendRange = getWeekendRange();
  const recentRange = getDateRange(months);
  const genreIds = genreKeys
    .filter((key) => key !== 'all')
    .map((key) => GENRE_IDS[key])
    .filter(Boolean);

  const discoveryBatches = await Promise.all(
    languages.map(async (language) => {
      const region = LANGUAGE_REGION[language] || 'US';
      const providerIds = getProviderIds(platforms, region);
      const sharedParams: Record<string, string> = {
        with_original_language: language,
        watch_region: region,
        with_watch_monetization_types: 'flatrate',
      };
      if (providerIds.length) {
        sharedParams.with_watch_providers = providerIds.join('|');
      }
      if (genreIds.length) sharedParams.with_genres = genreIds.join('|');

      const [
        weekendMovies,
        weekendSeries,
        recentMovies,
        recentSeries,
      ] = await Promise.all([
        contentTypes.includes('movie')
          ? fetchTmdb(apiKey, 'discover/movie', {
              ...sharedParams,
              sort_by: 'release_date.desc',
              with_release_type: OTT_RELEASE_TYPES.join('|'),
              'release_date.gte': weekendRange.startDate,
              'release_date.lte': weekendRange.endDate,
            })
          : Promise.resolve({ results: [] }),
        contentTypes.includes('tv')
          ? fetchTmdb(apiKey, 'discover/tv', {
              ...sharedParams,
              sort_by: 'first_air_date.desc',
              'first_air_date.gte': weekendRange.startDate,
              'first_air_date.lte': weekendRange.endDate,
            })
          : Promise.resolve({ results: [] }),
        contentTypes.includes('movie')
          ? fetchTmdb(apiKey, 'discover/movie', {
              ...sharedParams,
              sort_by: 'release_date.desc',
              with_release_type: OTT_RELEASE_TYPES.join('|'),
              'release_date.gte': recentRange.startDate,
              'release_date.lte': recentRange.endDate,
            })
          : Promise.resolve({ results: [] }),
        contentTypes.includes('tv')
          ? fetchTmdb(apiKey, 'discover/tv', {
              ...sharedParams,
              sort_by: 'first_air_date.desc',
              'first_air_date.gte': recentRange.startDate,
              'first_air_date.lte': recentRange.endDate,
            })
          : Promise.resolve({ results: [] }),
      ]);

      return {
        region,
        weekend: [
          ...(weekendMovies.results || [])
            .slice(0, 8)
            .map((item: any) => normalizeItem(item, 'movie')),
          ...(weekendSeries.results || [])
            .slice(0, 8)
            .map((item: any) => normalizeItem(item, 'tv')),
        ],
        recent: [
          ...(recentMovies.results || [])
            .slice(0, 10)
            .map((item: any) => normalizeItem(item, 'movie')),
          ...(recentSeries.results || [])
            .slice(0, 10)
            .map((item: any) => normalizeItem(item, 'tv')),
        ],
      };
    })
  );

  const regionByItem = new Map<string, string>();
  discoveryBatches.forEach((batch) => {
    [...batch.weekend, ...batch.recent].forEach((item) => {
      regionByItem.set(`${item.media_type}:${item.id}`, batch.region);
    });
  });

  const allWeekendCandidates = uniqueItems(
    discoveryBatches.flatMap((batch) => batch.weekend)
  )
    .filter((item) => !hiddenKeys.has(`${item.media_type}:${item.id}`))
    .sort((a, b) => b.release_date.localeCompare(a.release_date));
  const weekendMovies = allWeekendCandidates.filter(
    (item) => item.media_type === 'movie'
  );
  const weekendSeries = allWeekendCandidates.filter(
    (item) => item.media_type === 'tv'
  );
  const weekendCandidates = Array.from({ length: 6 }, (_, index) => [
    weekendMovies[index],
    weekendSeries[index],
  ])
    .flat()
    .filter((item): item is FeedItem => Boolean(item))
    .slice(0, 12);
  const enrichedWeekend = await Promise.all(
    weekendCandidates.map(async (item) => {
      const region =
        regionByItem.get(`${item.media_type}:${item.id}`) || 'US';
      try {
        const providerNames = await fetchProviders(apiKey, item, region);
        const releaseInfo =
          item.media_type === 'movie'
            ? await fetchMovieReleaseInfo(apiKey, item.id, region)
            : { certification: '', ottReleaseDates: [item.release_date] };
        const ottReleaseDate = releaseInfo.ottReleaseDates.find(
          (date: string) =>
            date >= weekendRange.startDate && date <= weekendRange.endDate
        ) || '';
        return {
          ...item,
          providerNames,
          certification: releaseInfo.certification,
          ottReleaseDate,
        };
      } catch {
        return { ...item, providerNames: [], ottReleaseDate: '' };
      }
    })
  );
  const weekend = enrichedWeekend
    .filter(
      (item) => item.providerNames.length > 0 && Boolean(item.ottReleaseDate)
    )
    .slice(0, WEEKEND_LIMIT);

  const weekendIds = new Set(
    weekend.map((item) => `${item.media_type}:${item.id}`)
  );
  const recentCandidates = uniqueItems(
    discoveryBatches.flatMap((batch) => batch.recent)
  )
    .filter((item) => !hiddenKeys.has(`${item.media_type}:${item.id}`))
    .filter((item) => !weekendIds.has(`${item.media_type}:${item.id}`))
    .sort((a, b) => b.release_date.localeCompare(a.release_date));
  const enrichRecentItems = (items: FeedItem[]) =>
    Promise.all(
      items.map(async (item) => {
        const region =
          regionByItem.get(`${item.media_type}:${item.id}`) || 'US';
        try {
          const providerNames = await fetchProviders(apiKey, item, region);
          return { ...item, providerNames };
        } catch {
          return { ...item, providerNames: [] };
        }
      })
    );
  const [enrichedRecentMovies, enrichedRecentSeries] = await Promise.all([
    enrichRecentItems(
      recentCandidates
        .filter((item) => item.media_type === 'movie')
        .slice(0, 16)
    ),
    enrichRecentItems(
      recentCandidates
        .filter((item) => item.media_type === 'tv')
        .slice(0, 16)
    ),
  ]);
  const recentMovies = enrichedRecentMovies
    .filter((item) => item.providerNames.length > 0)
    .slice(0, RECENT_MOVIE_LIMIT);
  const recentSeries = enrichedRecentSeries
    .filter((item) => item.providerNames.length > 0)
    .slice(0, RECENT_SERIES_LIMIT);

  return {
    weekend,
    recentMovies,
    recentSeries,
    limits: {
      weekend: WEEKEND_LIMIT,
      recentMovies: RECENT_MOVIE_LIMIT,
      recentSeries: RECENT_SERIES_LIMIT,
    },
    appliedLanguages: languages,
    generatedInMs: Date.now() - startedAt,
  };
};

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'TMDB API is not configured' });
  }

  const requestUrl = new URL(request.url, 'https://streamdrop.local');
  const languages = parseList(
    requestUrl.searchParams.get('languages'),
    ['en']
  ).slice(0, MAX_LANGUAGES);
  const platforms = parseList(
    requestUrl.searchParams.get('platforms'),
    ['all']
  ).slice(0, MAX_PLATFORMS);
  const genres = parseList(requestUrl.searchParams.get('genres'), ['all']);
  const contentTypes = parseList(
    requestUrl.searchParams.get('content_types'),
    ['movie', 'tv']
  ).filter((type) => type === 'movie' || type === 'tv');
  const months = Math.min(
    6,
    Math.max(1, Number(requestUrl.searchParams.get('months')) || 3)
  );
  const hiddenKeys = new Set(
    parseList(requestUrl.searchParams.get('hidden_ids'), [])
      .filter((key) => /^(movie|tv):\d+$/.test(key))
      .slice(0, 100)
  );
  const cacheKey = JSON.stringify({
    languages,
    platforms,
    genres,
    contentTypes,
    months,
    hiddenKeys: [...hiddenKeys].sort(),
  });
  const cached = feedCache.get(cacheKey);

  response.setHeader(
    'Cache-Control',
    's-maxage=600, stale-while-revalidate=3600'
  );
  if (cached && cached.expiresAt > Date.now()) {
    response.setHeader('X-StreamDrop-Cache', 'HIT');
    return response.status(200).json(cached.value);
  }

  let pending = pendingFeeds.get(cacheKey);
  if (!pending) {
    pending = buildFeed(
      apiKey,
      languages,
      platforms,
      genres,
      contentTypes.length ? contentTypes : ['movie', 'tv'],
      months,
      hiddenKeys
    );
    pendingFeeds.set(cacheKey, pending);
  }

  try {
    const value = await pending;
    feedCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value,
    });
    response.setHeader('X-StreamDrop-Cache', 'MISS');
    return response.status(200).json(value);
  } catch {
    return response.status(502).json({ error: 'Home feed is unavailable' });
  } finally {
    pendingFeeds.delete(cacheKey);
  }
}
