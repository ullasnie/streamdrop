import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getTmdb } from '../../constants/tmdb-api';
import { getHomeFeed } from '../../constants/home-feed-api';
import { trackEvent } from '../../constants/analytics';
import { AppLogoLink } from '../../components/app-logo-link';
import { parseMovieIntent } from '../../constants/ai-search';
import {
  ENABLE_SEARCH_RECOMMENDATIONS,
  ENABLE_WATCHLIST_RECOMMENDATIONS,
} from '../../constants/feature-flags';

type Movie = {
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
  media_type?: 'movie' | 'tv';
};

type SavedMovie = {
  id?: number;
  title: string;
  posterPath: string;
  releaseDate: string;
  overview: string;
};

type HiddenTitle = {
  key: string;
  title: string;
  mediaType: 'movie' | 'tv';
};

type NotInterestedSection = 'weekend' | 'recent_movies' | 'new_series';

type DateRange = { startDate: string; endDate: string };

const languages = [
  { label: 'All', code: 'all' },
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Tamil', code: 'ta' },
  { label: 'Telugu', code: 'te' },
  { label: 'Malayalam', code: 'ml' },
  { label: 'Kannada', code: 'kn' },
  { label: 'Korean', code: 'ko' },
  { label: 'Spanish', code: 'es' },
  { label: 'Japanese', code: 'ja' },
  { label: 'French', code: 'fr' },
  { label: 'German', code: 'de' },
  { label: 'Italian', code: 'it' },
  { label: 'Portuguese', code: 'pt' },
  { label: 'Chinese', code: 'zh' },
  { label: 'Arabic', code: 'ar' },
  { label: 'Turkish', code: 'tr' },
  { label: 'Thai', code: 'th' },
  { label: 'Indonesian', code: 'id' },
];

const platforms = [
  { label: 'All', key: 'all', providerId: null, providerNames: [] },
  { label: 'Netflix', key: 'netflix', providerId: 8, providerNames: ['Netflix'] },
  {
    label: 'Prime',
    key: 'prime',
    providerId: 9,
    providerIdsByRegion: { IN: [119], US: [9] },
    providerNames: ['Amazon Prime Video', 'Prime Video'],
  },
  {
    label: 'Disney+',
    key: 'disney',
    providerId: 337,
    providerNames: ['Disney Plus', 'Disney+'],
  },
  { label: 'Hulu', key: 'hulu', providerId: 15, providerNames: ['Hulu'] },
  {
    label: 'Hotstar',
    key: 'hotstar',
    providerId: 619,
    providerNames: ['Hotstar', 'Disney+ Hotstar'],
  },
  {
    label: 'Apple TV',
    key: 'apple-tv',
    providerId: 350,
    providerNames: ['Apple TV', 'Apple TV Plus'],
  },
  {
    label: 'HBO Max',
    key: 'hbo-max',
    providerId: 1899,
    providerNames: ['Max', 'HBO Max'],
  },
];

const genres = [
  { label: 'All', key: 'all', genreId: null },
  { label: 'Action', key: 'action', genreId: 28 },
  { label: 'Comedy', key: 'comedy', genreId: 35 },
  { label: 'Drama', key: 'drama', genreId: 18 },
  { label: 'Romance', key: 'romance', genreId: 10749 },
  { label: 'Thriller', key: 'thriller', genreId: 53 },
  { label: 'Family', key: 'family', genreId: 10751 },
  { label: 'Adventure', key: 'adventure', genreId: 12 },
  { label: 'Animation', key: 'animation', genreId: 16 },
  { label: 'Crime', key: 'crime', genreId: 80 },
  { label: 'Documentary', key: 'documentary', genreId: 99 },
  { label: 'Fantasy', key: 'fantasy', genreId: 14 },
  { label: 'History', key: 'history', genreId: 36 },
  { label: 'Horror', key: 'horror', genreId: 27 },
  { label: 'Music', key: 'music', genreId: 10402 },
  { label: 'Mystery', key: 'mystery', genreId: 9648 },
  { label: 'Science Fiction', key: 'science-fiction', genreId: 878 },
  { label: 'TV Movie', key: 'tv-movie', genreId: 10770 },
  { label: 'War', key: 'war', genreId: 10752 },
  { label: 'Western', key: 'western', genreId: 37 },
];

const formatDisplayDate = (value: string) => {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const PREF_LANGUAGE_KEY = 'preferredLanguageV3';
const PREF_PLATFORM_KEY = 'preferredPlatform';
const PREF_GENRE_KEY = 'preferredGenre';
const PREF_HOME_LANGUAGES_KEY = 'homeSelectedLanguagesV2';
const PREF_HOME_PLATFORMS_KEY = 'homeSelectedPlatformsV1';
const PREF_HOME_GENRES_KEY = 'homeSelectedGenresV1';
const PREF_RELEASE_MONTHS_KEY = 'releaseWindowMonths';
const PREF_CONTENT_TYPES_KEY = 'preferredContentTypesV1';
const PREF_HIDDEN_TITLES_KEY = 'hiddenHomeTitlesV1';
const PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY = 'permanentlyHiddenHomeTitleKeysV1';
const HOME_TOUR_AUDIENCE_KEY = 'homeTourAudienceV2';
const HOME_TOUR_SEEN_KEY = 'homeTourSeenV2';
const HOME_TOUR_ACTIVE_STEP_KEY = 'homeTourActiveStepV2';
const TMDB_METADATA_CONCURRENCY = 6;
const TMDB_RECOMMENDATION_CANDIDATE_LIMIT = 18;
const HOME_TOP_PICKS_CANDIDATE_LIMIT = 8;
const RECOMMENDATION_MAX_AGE_YEARS = 3;
const HOME_TOP_PADDING = Platform.OS === 'web' ? 28 : 60;
const HOME_BOTTOM_PADDING = Platform.OS === 'web' ? 112 : 120;
const FEATURED_CARD_WIDTH = Platform.OS === 'web' ? 158 : 178;
const FEATURED_POSTER_HEIGHT = Platform.OS === 'web' ? 226 : 266;
const TMDB_OTT_RELEASE_TYPES = [4, 6];
let genreMapCache: Record<number, string> | null = null;
const providerCache = new Map<string, string[]>();
const releaseInfoCache = new Map<
  string,
  { certification: string; ottReleaseDates: string[] }
>();
const titleSearchCache = new Map<string, Movie[]>();

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
) => {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += limit) {
    const chunk = items.slice(index, index + limit);
    results.push(...(await Promise.all(chunk.map(task))));
  }

  return results;
};

const LANGUAGE_REGION: Record<string, string> = {
  en: 'US',
  hi: 'IN', ta: 'IN', te: 'IN', ml: 'IN', kn: 'IN',
  ko: 'KR', es: 'ES', ja: 'JP', fr: 'FR', de: 'DE', it: 'IT',
  pt: 'BR', zh: 'TW', ar: 'AE', tr: 'TR', th: 'TH', id: 'ID',
};

const getRegionCode = (lang: string) => LANGUAGE_REGION[lang] || 'US';

const getSelectedLanguageCodes = (selected: string[]) =>
  selected.includes('all')
    ? languages.filter((item) => item.code !== 'all').map((item) => item.code)
    : selected;

const normalizeProviderName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getAllowedProviderNames = (platformKeys: string[]) => {
  const selectedPlatformKeys = platformKeys.includes('all')
    ? platforms.filter((item) => item.key !== 'all').map((item) => item.key)
    : platformKeys;

  return selectedPlatformKeys.flatMap(
    (key) => platforms.find((item) => item.key === key)?.providerNames || []
  );
};

const providerMatches = (providerName: string, allowedNames: string[]) => {
  const normalizedProvider = normalizeProviderName(providerName);

  return allowedNames.some(
    (allowedName) => normalizedProvider === normalizeProviderName(allowedName)
  );
};

const filterMoviesBySelectedProviders = (
  movies: Movie[],
  platformKeys: string[]
) => {
  // TMDB already applied custom provider IDs during discovery. Their names are
  // dynamic, so avoid removing them with the fixed provider-name allowlist.
  if (platformKeys.some((key) => key.startsWith('tmdb-'))) return movies;

  const allowedNames = getAllowedProviderNames(platformKeys);
  if (!allowedNames.length) return movies;

  return movies
    .map((movie) => {
      const matchingProviders =
        movie.providerNames?.filter((providerName) =>
          providerMatches(providerName, allowedNames)
        ) || [];

      return {
        ...movie,
        providerNames: matchingProviders,
      };
    })
    .filter((movie) => movie.providerNames.length > 0);
};

const getGenreId = (key: string) =>
  genres.find((genre) => genre.key === key)?.genreId;

const getGenreMap = async (): Promise<Record<number, string>> => {
  if (genreMapCache) return genreMapCache;

  const res = await getTmdb('genre/movie/list');

  const nextGenreMap = (res.data.genres || []).reduce(
    (map: Record<number, string>, genre: { id: number; name: string }) => {
      map[genre.id] = genre.name;
      return map;
    },
    {}
  );

  genreMapCache = nextGenreMap;
  return nextGenreMap;
};

const formatRecommendationSource = (items: SavedMovie[]) => {
  const titles = items.map((item) => item.title).filter(Boolean);

  if (titles.length <= 1) return titles[0] || '';
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;

  return `${titles[0]}, ${titles[1]} +${titles.length - 2}`;
};

const parseStoredList = (value: string | null, fallback: string[]) => {
  const parsed = value?.split(',').map((item) => item.trim()).filter(Boolean);
  return parsed?.length ? parsed : fallback;
};

const areStringListsEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const formatSelectedLabels = (
  selected: string[],
  options: { label: string; key?: string; code?: string }[]
) => {
  const labels = selected
    .map(
      (value) =>
        options.find((item) => item.key === value || item.code === value)?.label ||
        (value.startsWith('tmdb-') ? 'More services' : '')
    )
    .filter((label, index, values) => Boolean(label) && values.indexOf(label) === index);

  if (labels.length <= 1) return labels[0] || '';
  return `${labels[0]} +${labels.length - 1}`;
};

const sortByPopularitySignal = (a: Movie, b: Movie) =>
  (b.vote_count || 0) - (a.vote_count || 0);

const getMovieDisplayDate = (movie: Movie) =>
  movie.ottReleaseDate || movie.release_date;

const normalizeSeries = (series: any): Movie => ({
  ...series,
  title: series.name || series.original_name || 'Untitled series',
  release_date: series.first_air_date || '',
  media_type: 'tv',
});

const fetchTitleSuggestions = async (
  query: string,
  contentTypeKeys: string[]
) => {
  const cacheKey = `${contentTypeKeys.slice().sort().join(',')}:${query.toLowerCase()}`;
  const cached = titleSearchCache.get(cacheKey);
  if (cached) return cached;

  let suggestions: Movie[];
  if (contentTypeKeys.includes('movie') && contentTypeKeys.includes('tv')) {
    const response = await getTmdb('search/multi', {
      query,
      include_adult: false,
    });
    const mixedResults = (response.data.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: any) =>
        item.media_type === 'tv'
          ? normalizeSeries(item)
          : { ...item, media_type: 'movie' as const }
      )
      .filter((item: Movie) => item.title);
    const movieResults = mixedResults.filter(
      (item: Movie) => item.media_type === 'movie'
    );
    const seriesResults = mixedResults.filter(
      (item: Movie) => item.media_type === 'tv'
    );

    const balancedResults = Array.from({ length: 3 }, (_, index) => [
      movieResults[index],
      seriesResults[index],
    ])
      .flat()
      .filter((item): item is Movie => Boolean(item));
    const balancedIds = new Set(
      balancedResults.map((item) => `${item.media_type}:${item.id}`)
    );

    suggestions = [
      ...balancedResults,
      ...mixedResults.filter(
        (item: Movie) => !balancedIds.has(`${item.media_type}:${item.id}`)
      ),
    ].slice(0, 6);
  } else {
    const mediaType = contentTypeKeys.includes('tv') ? 'tv' : 'movie';
    const response = await getTmdb(`search/${mediaType}`, {
      query,
      include_adult: false,
    });
    suggestions = mediaType === 'tv'
      ? (response.data.results || []).map(normalizeSeries).slice(0, 6)
      : (response.data.results || [])
          .filter((item: Movie) => item.title)
          .map((item: Movie) => ({ ...item, media_type: 'movie' as const }))
          .slice(0, 6);
  }

  if (titleSearchCache.size >= 40) {
    const oldestKey = titleSearchCache.keys().next().value;
    if (oldestKey) titleSearchCache.delete(oldestKey);
  }
  titleSearchCache.set(cacheKey, suggestions);
  return suggestions;
};

const getFeedDateLabel = (movie: Movie) => {
  if (movie.ottReleaseDate) {
    return `Streaming ${formatDisplayDate(movie.ottReleaseDate)}`;
  }

  return movie.release_date
    ? `${movie.media_type === 'tv' ? 'Series premiere' : 'Movie release'} ${formatDisplayDate(movie.release_date)}`
    : 'Release date unknown';
};

const getDateInRange = (dates: string[], range: DateRange) =>
  dates.find((date) => date >= range.startDate && date <= range.endDate) || '';

const mergeMovieLists = (
  lists: Movie[][],
  sorter: (a: Movie, b: Movie) => number = sortByPopularitySignal
) => {
  const seen = new Set<string>();
  const merged: Movie[] = [];

  lists.flat().forEach((movie) => {
    const key = `${movie.media_type || 'movie'}:${movie.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(movie);
  });

  return merged.sort(sorter);
};

const isRecentRecommendation = (movie: Movie) => {
  if (!movie.release_date) return false;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RECOMMENDATION_MAX_AGE_YEARS);

  const today = new Date();
  const releaseDate = new Date(`${movie.release_date}T00:00:00`);

  return (
    !Number.isNaN(releaseDate.getTime()) &&
    releaseDate >= cutoff &&
    releaseDate <= today
  );
};

const getOttProviders = async (
  movieId: number,
  region: string,
  mediaType: 'movie' | 'tv' = 'movie'
) => {
  const cacheKey = `${mediaType}:${movieId}:${region}`;
  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  const res = await getTmdb(`${mediaType}/${movieId}/watch/providers`);

  const providers = (
    res.data.results?.[region]?.flatrate?.map(
      (provider: { provider_name: string }) => provider.provider_name
    ) || []
  );

  providerCache.set(cacheKey, providers);
  return providers;
};

const getReleaseInfo = async (movieId: number, region: string) => {
  const cacheKey = `${movieId}:${region}`;
  const cached = releaseInfoCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const res = await getTmdb(`movie/${movieId}/release_dates`);

  const regionRelease = res.data.results?.find(
    (item: { iso_3166_1: string }) => item.iso_3166_1 === region
  );
  const regionReleaseDates = regionRelease?.release_dates || [];

  const certification =
    regionReleaseDates.find(
      (release: { certification?: string }) => release.certification
    )?.certification || '';
  const ottReleaseDates =
    regionReleaseDates
      .filter((release: { release_date?: string; type?: number }) =>
        release.type ? TMDB_OTT_RELEASE_TYPES.includes(release.type) : false
      )
      .map((release: { release_date: string }) =>
        release.release_date.split('T')[0]
      )
      .filter(Boolean)
      .sort((a: string, b: string) => b.localeCompare(a));

  const releaseInfo = { certification, ottReleaseDates };
  releaseInfoCache.set(cacheKey, releaseInfo);
  return releaseInfo;
};

const enrichMovies = async (
  items: Movie[],
  region: string,
  genreMap: Record<number, string>,
  range?: DateRange
) => {
  const enriched = await mapWithConcurrency(
    items,
    TMDB_METADATA_CONCURRENCY,
    async (movie) => {
      const [providerNames, releaseInfo] = await Promise.all([
        getOttProviders(movie.id, region),
        getReleaseInfo(movie.id, region),
      ]);

      return {
        ...movie,
        providerNames,
        certification: releaseInfo.certification,
        ottReleaseDate: range
          ? getDateInRange(releaseInfo.ottReleaseDates, range)
          : releaseInfo.ottReleaseDates[0] || '',
        genreNames: (movie.genre_ids || [])
          .map((id) => genreMap[id])
          .filter(Boolean),
      };
    }
  );

  return enriched.filter(
    (movie) => movie.providerNames.length > 0 && (!range || movie.ottReleaseDate)
  );
};

const enrichSeries = async (
  items: Movie[],
  region: string,
  genreMap: Record<number, string>
) => {
  const enriched = await mapWithConcurrency(
    items,
    TMDB_METADATA_CONCURRENCY,
    async (series) => ({
      ...series,
      providerNames: await getOttProviders(series.id, region, 'tv'),
      genreNames: (series.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
    })
  );
  return enriched.filter((series) => series.providerNames.length > 0);
};

const enrichRecommendations = async (
  items: Movie[],
  region: string,
  genreMap: Record<number, string>
) => {
  const enriched = await mapWithConcurrency(
    items,
    TMDB_METADATA_CONCURRENCY,
    async (item) => ({
      ...item,
      providerNames: await getOttProviders(
        item.id,
        region,
        item.media_type || 'movie'
      ),
      genreNames: (item.genre_ids || [])
        .map((id) => genreMap[id])
        .filter(Boolean),
    })
  );

  return enriched.filter((item) => item.providerNames.length > 0);
};

export default function HomeScreen() {
  const homeFetchIdRef = useRef(0);
  const suggestionFetchIdRef = useRef(0);
  const activeSearchRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentHomeRefreshRef = useRef(false);
  const homeTourCheckedRef = useRef(false);
  const homeScrollViewRef = useRef<ScrollView>(null);
  const weekendSectionYRef = useRef(0);
  const seriesSectionYRef = useRef(0);
  const [weekendMovies, setWeekendMovies] = useState<Movie[]>([]);
  const [recentMovies, setRecentMovies] = useState<Movie[]>([]);
  const [recentSeries, setRecentSeries] = useState<Movie[]>([]);
  const [topPicks, setTopPicks] = useState<Movie[]>([]);
  const [recommendationSource, setRecommendationSource] = useState('');
  const [searchRecommendations, setSearchRecommendations] = useState<Movie[]>([]);
  const [searchRecommendationSource, setSearchRecommendationSource] = useState('');
  const [showSearchRecommendations, setShowSearchRecommendations] = useState(true);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiError, setAiError] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Movie[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [selectedLanguages, setSelectedLanguages] = useState(['all']);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['all']);
  const [selectedGenres, setSelectedGenres] = useState(['all']);
  const [selectedContentTypes, setSelectedContentTypes] = useState(['movie', 'tv']);
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);

  const [loading, setLoading] = useState(true);
  const [weekendLoading, setWeekendLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [hiddenTitles, setHiddenTitles] = useState<HiddenTitle[]>([]);
  const [permanentlyHiddenTitleKeys, setPermanentlyHiddenTitleKeys] = useState<string[]>([]);
  const [undoHiddenTitle, setUndoHiddenTitle] = useState<HiddenTitle | null>(null);
  const [homeTourPromptVisible, setHomeTourPromptVisible] = useState(false);
  const [homeTourStep, setHomeTourStep] = useState<number | null>(null);
  const [tourSeriesRevealed, setTourSeriesRevealed] = useState(false);

  const openDetails = (item: Movie) => {
    void trackEvent('movie_opened');
    router.push({
      pathname: '/details',
      params: {
        id: item.id.toString(),
        title: item.title,
        releaseDate: getMovieDisplayDate(item),
        posterPath: item.poster_path || '',
        overview: item.overview || '',
        providers: JSON.stringify(item.providerNames || []),
        genres: JSON.stringify(item.genreNames || []),
        certification: item.certification || '',
        rating:
          typeof item.vote_average === 'number' && item.vote_average > 0
            ? item.vote_average.toString()
            : '',
        mediaType: item.media_type || 'movie',
        region: getRegionCode(item.original_language || 'en'),
      },
    });
  };

  const fetchTopPicks = useCallback(async (
    langs: string[],
    genreKeys: string[],
    hiddenTitleKeys = ''
  ) => {
    try {
      const data = await AsyncStorage.getItem('watchlist');
      const watchlist: SavedMovie[] = data ? JSON.parse(data) : [];
      const genreIds = genreKeys
        .filter((key) => key !== 'all')
        .map(getGenreId)
        .filter(Boolean);
      const genreMap = await getGenreMap();
      const savedWithIds = watchlist
        .filter((movie) => Number.isFinite(Number(movie.id)))
        .slice(-3)
        .reverse();
      const savedIds = new Set(
        watchlist
          .map((movie) => Number(movie.id))
          .filter((id) => Number.isFinite(id))
      );
      const savedTitles = new Set(
        watchlist
          .map((movie) => movie.title?.trim().toLowerCase())
          .filter(Boolean)
      );
      const hiddenKeys = new Set(hiddenTitleKeys.split(',').filter(Boolean));

      if (!savedWithIds.length) {
        setTopPicks([]);
        setRecommendationSource('');
        return;
      }

      setRecommendationSource(formatRecommendationSource(savedWithIds));

      const similarResults = await Promise.all(
        savedWithIds.map(async (movie) => {
          try {
            const res = await getTmdb(`movie/${movie.id}/similar`);
            return res.data.results || [];
          } catch (error) {
            console.log('Similar movies error:', error);
            return [];
          }
        })
      );

      const seenIds = new Set<number>();
      const candidates = similarResults
        .flat()
        .filter((m: Movie) =>
          m.original_language ? langs.includes(m.original_language) : false
        )
        .filter(isRecentRecommendation)
        .filter(
          (m: Movie) =>
            !genreIds.length ||
            m.genre_ids?.some((genreId) => genreIds.includes(genreId))
        )
        .filter((m: Movie) => !savedIds.has(m.id))
        .filter((m: Movie) => !hiddenKeys.has(`movie:${m.id}`))
        .filter(
          (m: Movie) => !savedTitles.has(m.title?.trim().toLowerCase() || '')
        )
        .filter((m: Movie) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        })
        .slice(0, HOME_TOP_PICKS_CANDIDATE_LIMIT);

      const enrichedByRegion = await Promise.all(
        langs.map((lang) => {
          const regionCandidates = candidates.filter(
            (movie) => movie.original_language === lang
          );
          return enrichRecommendations(
            regionCandidates,
            getRegionCode(lang),
            genreMap
          );
        })
      );
      const filtered = mergeMovieLists(enrichedByRegion).slice(0, 8);

      setTopPicks(filtered);
    } catch (e) {
      console.log('Top picks error:', e);
      setTopPicks([]);
      setRecommendationSource('');
    }
  }, []);

  const fetchHomeSections = useCallback(
    async (
      langs: string[],
      platformKeys: string[],
      genreKeys: string[],
      months: number,
      contentTypeKeys: string[],
      hiddenTitleKeys: string
    ) => {
      const fetchId = homeFetchIdRef.current + 1;
      homeFetchIdRef.current = fetchId;
      const isCurrentFetch = () => homeFetchIdRef.current === fetchId;
      const silentRefresh = silentHomeRefreshRef.current;
      silentHomeRefreshRef.current = false;

      try {
        if (!silentRefresh) {
          setLoading(true);
          setWeekendLoading(contentTypeKeys.length > 0);
        }
        setErrorMessage('');
        const response = await getHomeFeed({
          languages: langs.join(','),
          platforms: platformKeys.join(','),
          genres: genreKeys.join(','),
          content_types: contentTypeKeys.join(','),
          months,
          hidden_ids: hiddenTitleKeys,
        });
        if (!isCurrentFetch()) return;

        setWeekendMovies((response.data.weekend || []).slice(0, 6));
        setRecentMovies((response.data.recentMovies || []).slice(0, 12));
        setRecentSeries((response.data.recentSeries || []).slice(0, 12));
        if (!silentRefresh) {
          setLoading(false);
          setWeekendLoading(false);
        }
      } catch (e) {
        console.log(e);
        if (!isCurrentFetch()) return;
        if (!silentRefresh) {
          setErrorMessage('Couldn’t load releases. Try again.');
          setLoading(false);
          setWeekendLoading(false);
        }
      }
    },
    []
  );

  const scheduleFridayReminder = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎬 New Friday Drops',
        body: 'Check what’s new this weekend!',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 6,
        hour: 9,
        minute: 0,
      },
    });

    await AsyncStorage.setItem('alertsEnabled', 'true');
    await AsyncStorage.setItem('fridayNotificationId', notificationId);
    setAlertsEnabled(true);
  };

  const loadPreferences = useCallback(async () => {
    try {
      const entries = await AsyncStorage.multiGet([
        'alertsEnabled',
        PREF_LANGUAGE_KEY,
        PREF_PLATFORM_KEY,
        PREF_GENRE_KEY,
        PREF_HOME_LANGUAGES_KEY,
        PREF_HOME_PLATFORMS_KEY,
        PREF_HOME_GENRES_KEY,
        PREF_RELEASE_MONTHS_KEY,
        PREF_CONTENT_TYPES_KEY,
        PREF_HIDDEN_TITLES_KEY,
        PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY,
      ]);
      const values = Object.fromEntries(entries);

      const nextLanguages = parseStoredList(
        values[PREF_HOME_LANGUAGES_KEY],
        values[PREF_LANGUAGE_KEY] ? [values[PREF_LANGUAGE_KEY]] : ['all']
      );
      const nextPlatforms = parseStoredList(
        values[PREF_HOME_PLATFORMS_KEY],
        values[PREF_PLATFORM_KEY] ? [values[PREF_PLATFORM_KEY]] : ['all']
      );
      const nextGenres = parseStoredList(
        values[PREF_HOME_GENRES_KEY],
        values[PREF_GENRE_KEY] ? [values[PREF_GENRE_KEY]] : ['all']
      );
      const nextReleaseWindowMonths = values[PREF_RELEASE_MONTHS_KEY]
        ? Number(values[PREF_RELEASE_MONTHS_KEY]) || 3
        : 3;
      const nextContentTypes = parseStoredList(
        values[PREF_CONTENT_TYPES_KEY],
        ['movie', 'tv']
      );
      const nextAlertsEnabled = values.alertsEnabled === 'true';
      let nextHiddenTitles: HiddenTitle[] = [];
      try {
        const parsed = JSON.parse(values[PREF_HIDDEN_TITLES_KEY] || '[]');
        if (Array.isArray(parsed)) {
          nextHiddenTitles = parsed.filter(
            (item): item is HiddenTitle =>
              typeof item?.key === 'string' &&
              typeof item?.title === 'string' &&
              (item?.mediaType === 'movie' || item?.mediaType === 'tv')
          );
        }
      } catch {
        nextHiddenTitles = [];
      }
      let nextPermanentlyHiddenTitleKeys: string[] = [];
      try {
        const parsed = JSON.parse(
          values[PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY] || '[]'
        );
        if (Array.isArray(parsed)) {
          nextPermanentlyHiddenTitleKeys = parsed.filter(
            (key): key is string => typeof key === 'string'
          );
        }
      } catch {
        nextPermanentlyHiddenTitleKeys = [];
      }

      setSelectedLanguages((current) =>
        areStringListsEqual(current, nextLanguages) ? current : nextLanguages
      );
      setSelectedPlatforms((current) =>
        areStringListsEqual(current, nextPlatforms) ? current : nextPlatforms
      );
      setSelectedGenres((current) =>
        areStringListsEqual(current, nextGenres) ? current : nextGenres
      );
      setSelectedContentTypes((current) =>
        areStringListsEqual(current, nextContentTypes) ? current : nextContentTypes
      );
      setReleaseWindowMonths((current) =>
        current === nextReleaseWindowMonths ? current : nextReleaseWindowMonths
      );
      setAlertsEnabled((current) =>
        current === nextAlertsEnabled ? current : nextAlertsEnabled
      );
      setHiddenTitles(nextHiddenTitles);
      setPermanentlyHiddenTitleKeys(nextPermanentlyHiddenTitleKeys);
    } finally {
      setPreferencesLoaded((current) => (current ? current : true));
    }
  }, []);

  const loadContentTypePreference = useCallback(async () => {
    const storedContentTypes = await AsyncStorage.getItem(PREF_CONTENT_TYPES_KEY);
    const nextContentTypes = parseStoredList(storedContentTypes, ['movie', 'tv']);
    setSelectedContentTypes((current) =>
      areStringListsEqual(current, nextContentTypes) ? current : nextContentTypes
    );
  }, []);

  const clearSearch = () => {
    activeSearchRef.current = false;
    setAiQuery('');
    setAiSummary('');
    setAiError('');
    setSubmittedSearchQuery('');
    setSearchSuggestions([]);
    setSuggestionsVisible(false);
    setSuggestionsLoading(false);
    setSearchRecommendations([]);
    setSearchRecommendationSource('');
    void loadPreferences();
  };

  const refreshReleases = () => {
    void trackEvent('refresh_tapped');
    const languageCodes = getSelectedLanguageCodes(selectedLanguages);
    fetchHomeSections(
      languageCodes,
      selectedPlatforms,
      selectedGenres,
      releaseWindowMonths,
      selectedContentTypes,
      [...hiddenTitles.map((item) => item.key), ...permanentlyHiddenTitleKeys]
        .sort()
        .join(',')
    );
    if (ENABLE_WATCHLIST_RECOMMENDATIONS) {
      fetchTopPicks(
        languageCodes,
        selectedGenres,
        [...hiddenTitles.map((item) => item.key), ...permanentlyHiddenTitleKeys]
          .sort()
          .join(',')
      );
    }
  };

  const applyAiSearch = async (queryOverride?: string) => {
    const query = (queryOverride || aiQuery).trim();
    if (query.length < 3 || aiLoading) return;

    setSuggestionsVisible(false);
    setSearchSuggestions([]);
    setSuggestionsLoading(false);
    setAiQuery(query);
    setAiLoading(true);
    setAiError('');

    try {
      const result = await parseMovieIntent(query, {
        languages: selectedLanguages,
        platforms: selectedPlatforms,
        genres: selectedGenres,
        releaseWindowMonths,
      });
      const nextLanguages = result.filters.languages.includes('all')
        ? selectedLanguages
        : result.filters.languages;
      const nextPlatforms = result.filters.platforms.includes('all')
        ? selectedPlatforms
        : result.filters.platforms;
      const nextGenres = result.filters.genres.includes('all')
        ? selectedGenres
        : result.filters.genres;
      const nextReleaseWindowMonths = result.filters.releaseWindowMonths;

      setSelectedLanguages(nextLanguages);
      setSelectedPlatforms(nextPlatforms);
      setSelectedGenres(nextGenres);
      setReleaseWindowMonths(nextReleaseWindowMonths);
      activeSearchRef.current = true;
      setSubmittedSearchQuery(query);
      setAiSummary(result.summary);

      void trackEvent('filter_changed');
    } catch {
      setAiError('Search is unavailable right now.');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchSearchRecommendations = async (sourceMovie: Movie) => {
    try {
      const [similarResponse, genreMap] = await Promise.all([
        getTmdb(`${sourceMovie.media_type || 'movie'}/${sourceMovie.id}/similar`),
        getGenreMap(),
      ]);
      const languageCodes = getSelectedLanguageCodes(selectedLanguages);
      const genreIds = selectedGenres
        .filter((key) => key !== 'all')
        .map(getGenreId)
        .filter(Boolean);
      const seenIds = new Set<number>([sourceMovie.id]);
      const candidates = (similarResponse.data.results || [])
        .map((item: any) => sourceMovie.media_type === 'tv' ? normalizeSeries(item) : item)
        .filter((movie: Movie) => movie.title && movie.poster_path)
        .filter((movie: Movie) =>
          movie.original_language ? languageCodes.includes(movie.original_language) : true
        )
        .filter(
          (movie: Movie) =>
            !genreIds.length || movie.genre_ids?.some((genreId) => genreIds.includes(genreId))
        )
        .filter((movie: Movie) => {
          if (seenIds.has(movie.id)) return false;
          seenIds.add(movie.id);
          return true;
        })
        .slice(0, TMDB_RECOMMENDATION_CANDIDATE_LIMIT);

      const enriched = await Promise.all(
        candidates.map(async (movie: Movie) => {
          const region = getRegionCode(movie.original_language || 'en');
          const results = movie.media_type === 'tv'
            ? await enrichSeries([movie], region, genreMap)
            : await enrichMovies([movie], region, genreMap);
          return results[0];
        })
      );
      const availableRecommendations = filterMoviesBySelectedProviders(
        enriched.filter(Boolean) as Movie[],
        selectedPlatforms
      ).slice(0, 8);

      setSearchRecommendations(availableRecommendations);
      setSearchRecommendationSource(sourceMovie.title);
    } catch (error) {
      console.log('Search recommendations error:', error);
      setSearchRecommendations([]);
      setSearchRecommendationSource('');
    }
  };

  const selectSearchSuggestion = async (movie: Movie) => {
    setAiQuery(movie.title);
    setSuggestionsVisible(false);
    setSearchSuggestions([]);
    setSuggestionsLoading(false);
    setSubmittedSearchQuery(movie.title);
    activeSearchRef.current = true;
    if (ENABLE_SEARCH_RECOMMENDATIONS) {
      void fetchSearchRecommendations(movie);
    }
    setAiLoading(true);

    try {
      const region = getRegionCode(movie.original_language || 'en');
      const [providerNames, releaseInfo, genreMap] = await Promise.all([
        getOttProviders(movie.id, region, movie.media_type || 'movie'),
        movie.media_type === 'tv'
          ? Promise.resolve({ certification: '', ottReleaseDates: [] as string[] })
          : getReleaseInfo(movie.id, region),
        getGenreMap(),
      ]);
      openDetails({
        ...movie,
        providerNames,
        certification: releaseInfo.certification,
        ottReleaseDate: releaseInfo.ottReleaseDates[0] || '',
        genreNames: (movie.genre_ids || [])
          .map((genreId) => genreMap[genreId])
          .filter(Boolean),
      });
    } catch (error) {
      console.log('Search movie metadata error:', error);
      openDetails(movie);
    } finally {
      setAiLoading(false);
    }
  };

  const submitSearch = async () => {
    const query = aiQuery.trim();
    if (query.length < 3 || aiLoading) return;

    const normalizedQuery = query.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    let titleMatches = searchSuggestions;

    if (titleMatches.length === 0) {
      try {
        titleMatches = await fetchTitleSuggestions(query, selectedContentTypes);
      } catch {
        // Descriptive discovery still works if title lookup is temporarily unavailable.
      }
    }

    const exactTitleMatch = titleMatches.find((movie) =>
      movie.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalizedQuery
    );

    if (exactTitleMatch) {
      await selectSearchSuggestion(exactTitleMatch);
      return;
    }

    await applyAiSearch(query);
  };

  useFocusEffect(
    useCallback(() => {
      void trackEvent('home_viewed');
      void loadContentTypePreference();
      if (!activeSearchRef.current) loadPreferences();
      void AsyncStorage.multiGet([
        HOME_TOUR_SEEN_KEY,
        HOME_TOUR_ACTIVE_STEP_KEY,
      ]).then((entries) => {
        const values = Object.fromEntries(entries);
        const activeStep = values[HOME_TOUR_ACTIVE_STEP_KEY];
        if (
          values[HOME_TOUR_SEEN_KEY] !== 'true' &&
          (activeStep === '0' || activeStep === '1')
        ) {
          setHomeTourPromptVisible(false);
          setHomeTourStep(Number(activeStep));
        }
      });
    }, [loadContentTypePreference, loadPreferences])
  );

  useEffect(() => {
    if (!preferencesLoaded) return;

    const languageCodes = getSelectedLanguageCodes(selectedLanguages);
    let cancelled = false;
    let recommendationTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      await fetchHomeSections(
        languageCodes,
        selectedPlatforms,
        selectedGenres,
        releaseWindowMonths,
        selectedContentTypes,
        [...hiddenTitles.map((item) => item.key), ...permanentlyHiddenTitleKeys]
          .sort()
          .join(',')
      );
      if (cancelled) return;
      if (ENABLE_WATCHLIST_RECOMMENDATIONS) {
        recommendationTimer = setTimeout(() => {
          void fetchTopPicks(
            languageCodes,
            selectedGenres,
            [...hiddenTitles.map((item) => item.key), ...permanentlyHiddenTitleKeys]
              .sort()
              .join(',')
          );
        }, 750);
      }
    })();

    return () => {
      cancelled = true;
      if (recommendationTimer) clearTimeout(recommendationTimer);
    };
  }, [
    fetchHomeSections,
    fetchTopPicks,
    preferencesLoaded,
    releaseWindowMonths,
    selectedContentTypes,
    selectedGenres,
    hiddenTitles,
    permanentlyHiddenTitleKeys,
    selectedLanguages,
    selectedPlatforms,
  ]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!preferencesLoaded || homeTourCheckedRef.current) return;
    homeTourCheckedRef.current = true;
    void AsyncStorage.multiGet([
      HOME_TOUR_SEEN_KEY,
      HOME_TOUR_AUDIENCE_KEY,
      HOME_TOUR_ACTIVE_STEP_KEY,
    ]).then((entries) => {
      const values = Object.fromEntries(entries);
      if (values[HOME_TOUR_SEEN_KEY] === 'true') return;
      if (values[HOME_TOUR_ACTIVE_STEP_KEY] === '0' || values[HOME_TOUR_ACTIVE_STEP_KEY] === '1') {
        setHomeTourStep(Number(values[HOME_TOUR_ACTIVE_STEP_KEY]));
        return;
      }
      if (values[HOME_TOUR_AUDIENCE_KEY] === 'new') {
        setHomeTourStep(0);
      } else {
        setHomeTourPromptVisible(true);
      }
    });
  }, [preferencesLoaded]);

  const dismissHomeTour = async () => {
    setHomeTourPromptVisible(false);
    setHomeTourStep(null);
    await AsyncStorage.multiSet([
      [HOME_TOUR_SEEN_KEY, 'true'],
      [HOME_TOUR_AUDIENCE_KEY, ''],
      [HOME_TOUR_ACTIVE_STEP_KEY, ''],
    ]);
  };

  const startHomeTour = async () => {
    setHomeTourPromptVisible(false);
    setHomeTourStep(0);
    setTourSeriesRevealed(false);
    await AsyncStorage.setItem(HOME_TOUR_ACTIVE_STEP_KEY, '0');
  };

  const continueHomeTour = async () => {
    if (homeTourStep === null) return;
    if (homeTourStep === 0) {
      setHomeTourStep(1);
      setTourSeriesRevealed(false);
      await AsyncStorage.setItem(HOME_TOUR_ACTIVE_STEP_KEY, '1');
      setTimeout(() => {
        homeScrollViewRef.current?.scrollTo({
          y: Math.max(0, weekendSectionYRef.current - 20),
          animated: true,
        });
      }, 0);
      return;
    }
    setHomeTourStep(null);
    await AsyncStorage.setItem(HOME_TOUR_ACTIVE_STEP_KEY, '2');
    router.push('/settings');
  };

  const hideFromHome = async (
    item: Movie,
    section?: NotInterestedSection
  ) => {
    if (section) {
      void trackEvent(`not_interested_${section}`);
    }

    const mediaType = item.media_type || 'movie';
    const hiddenTitle: HiddenTitle = {
      key: `${mediaType}:${item.id}`,
      title: item.title,
      mediaType,
    };
    const next = [
      ...hiddenTitles.filter((hidden) => hidden.key !== hiddenTitle.key),
      hiddenTitle,
    ];

    silentHomeRefreshRef.current = true;
    setHiddenTitles(next);
    setWeekendMovies((items) =>
      items.filter((movie) => `${movie.media_type || 'movie'}:${movie.id}` !== hiddenTitle.key)
    );
    setRecentMovies((items) =>
      items.filter((movie) => `${movie.media_type || 'movie'}:${movie.id}` !== hiddenTitle.key)
    );
    setRecentSeries((items) =>
      items.filter((movie) => `${movie.media_type || 'tv'}:${movie.id}` !== hiddenTitle.key)
    );
    setTopPicks((items) =>
      items.filter((movie) => `${movie.media_type || 'movie'}:${movie.id}` !== hiddenTitle.key)
    );
    setSearchRecommendations((items) =>
      items.filter((movie) => `${movie.media_type || 'movie'}:${movie.id}` !== hiddenTitle.key)
    );
    setUndoHiddenTitle(hiddenTitle);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoHiddenTitle(null), 5000);
    await AsyncStorage.setItem(PREF_HIDDEN_TITLES_KEY, JSON.stringify(next));
  };

  const undoHideFromHome = async () => {
    if (!undoHiddenTitle) return;
    const next = hiddenTitles.filter((item) => item.key !== undoHiddenTitle.key);
    silentHomeRefreshRef.current = true;
    setHiddenTitles(next);
    setUndoHiddenTitle(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await AsyncStorage.setItem(PREF_HIDDEN_TITLES_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    const query = aiQuery.trim();
    if (query.length < 3 || aiLoading || submittedSearchQuery === query) {
      suggestionFetchIdRef.current += 1;
      setSearchSuggestions([]);
      setSuggestionsVisible(false);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsVisible(false);

    const timeout = setTimeout(async () => {
      const fetchId = suggestionFetchIdRef.current + 1;
      suggestionFetchIdRef.current = fetchId;

      try {
        const suggestions = await fetchTitleSuggestions(query, selectedContentTypes);
        if (suggestionFetchIdRef.current !== fetchId) return;
        setSearchSuggestions(suggestions);
        setSuggestionsVisible(suggestions.length > 0);
        setSuggestionsLoading(false);
      } catch {
        if (suggestionFetchIdRef.current !== fetchId) return;
        setSearchSuggestions([]);
        setSuggestionsVisible(false);
        setSuggestionsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [aiLoading, aiQuery, selectedContentTypes, submittedSearchQuery]);

  const renderCard = (
    item: Movie,
    featured = false,
    section?: NotInterestedSection
  ) => (
    <Pressable
      style={[styles.card, featured && styles.featuredCard]}
      onPress={() => openDetails(item)}
    >
      <View style={[styles.posterWrap, featured && styles.featuredPosterWrap]}>
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
          style={[styles.poster, featured && styles.featuredPoster]}
        />
        <Pressable
          accessibilityLabel={`Not interested in ${item.title}`}
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            void hideFromHome(item, section);
          }}
          style={[
            styles.notInterestedButton,
            homeTourStep === 1 && styles.tourTarget,
          ]}
        >
          <Text style={styles.notInterestedIcon}>×</Text>
        </Pressable>
        {item.original_language && (
          <View
            accessible
            accessibilityLabel={`Language: ${
              languages.find((language) => language.code === item.original_language)
                ?.label || item.original_language.toUpperCase()
            }`}
            style={styles.languageBadge}
          >
            <Text style={styles.languageBadgeText} numberOfLines={1}>
              {languages.find(
                (language) => language.code === item.original_language
              )?.label || item.original_language.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, featured && styles.featuredTitle]} numberOfLines={2}>
        {item.title}
      </Text>

      <Text style={styles.date}>
        {getFeedDateLabel(item)}
      </Text>

      <Text style={styles.contentTypeLabel}>
        {item.media_type === 'tv' ? 'Series' : 'Movie'}
      </Text>

      {item.providerNames?.[0] && (
        <Text style={styles.providerPill} numberOfLines={1}>
          {item.providerNames[0]}
        </Text>
      )}

    </Pressable>
  );

  const genreLabel = formatSelectedLabels(selectedGenres, genres);
  const languageLabel = formatSelectedLabels(selectedLanguages, languages);
  const hasActiveFilters =
    !selectedLanguages.includes('all') ||
    !selectedPlatforms.includes('all') ||
    !selectedGenres.includes('all');
  const weekendEmptyText = hasActiveFilters
    ? 'No weekend drops match your filters. Try changing your filters.'
    : 'No weekend drops found.';
  const recentMovieEmptyText =
    selectedGenres.includes('all')
      ? `No ${languageLabel} movie releases found for this window.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} movies found for this window.`;
  const recentSeriesEmptyText =
    selectedGenres.includes('all')
      ? `No ${languageLabel} series found for this window.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} series found for this window.`;
  const weekendMovieIds = new Set(
    weekendMovies.map((movie) => `${movie.media_type || 'movie'}:${movie.id}`)
  );
  const remainingRecentMovies = recentMovies.filter(
    (movie) => !weekendMovieIds.has(`${movie.media_type || 'movie'}:${movie.id}`)
  );
  const remainingRecentSeries = recentSeries.filter(
    (series) => !weekendMovieIds.has(`${series.media_type || 'tv'}:${series.id}`)
  );
  const ambientHero =
    weekendMovies[0] || remainingRecentMovies[0] || remainingRecentSeries[0];

  const renderAmbientBackdrop = (item?: Movie) =>
    item?.poster_path ? (
      <View pointerEvents="none" style={styles.ambientBackdrop}>
        <Image
          blurRadius={44}
          source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
          style={styles.ambientPoster}
        />
        <View style={styles.ambientShade} />
      </View>
    ) : null;

  const renderSkeletonCards = (featured = false) => (
    <View style={styles.skeletonRow}>
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          style={[styles.skeletonCard, featured && styles.featuredSkeletonCard]}
        >
          <View
            style={[
              styles.skeletonPoster,
              featured && styles.featuredSkeletonPoster,
            ]}
          />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonShortLine} />
        </View>
      ))}
    </View>
  );

  const renderHomeTourCallout = (step: 0 | 1) => (
    <View style={styles.homeTourInline}>
      <Text style={styles.homeTourEyebrow}>{step + 1} OF 3</Text>
      <Text style={styles.homeTourTitle}>
        {step === 0 ? 'Movies and series' : 'Make Home yours'}
      </Text>
      <Text style={styles.homeTourBody}>
        {step === 0
          ? 'Weekend releases, recent movies, and new series now have their own sections.'
          : 'Tap the highlighted × on a card to hide it. A confirmation appears at the top with an immediate Undo option.'}
      </Text>
      {step === 0 && selectedContentTypes.includes('tv') && (
        <Pressable
          onPress={() => {
            setTourSeriesRevealed(true);
            homeScrollViewRef.current?.scrollTo({
              y: Math.max(0, seriesSectionYRef.current - 20),
              animated: true,
            });
          }}
          style={styles.homeTourExploreButton}
        >
          <Text style={styles.homeTourExploreText}>Show New Series ↓</Text>
        </Pressable>
      )}
      <View style={styles.homeTourActions}>
        <Pressable onPress={() => void dismissHomeTour()} style={styles.homeTourSkipButton}>
          <Text style={styles.homeTourSkipText}>Skip tour</Text>
        </Pressable>
        <Pressable onPress={() => void continueHomeTour()} style={styles.homeTourNextButton}>
          <Text style={styles.homeTourNextText}>
            {step === 0 ? 'Next' : 'Next: Preferences'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={homeScrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
      {ambientHero?.poster_path ? (
        <View pointerEvents="none" style={styles.headerAmbientLayer}>
          <Image
            blurRadius={60}
            source={{ uri: `https://image.tmdb.org/t/p/w500${ambientHero.poster_path}` }}
            style={styles.headerAmbientPoster}
          />
        </View>
      ) : null}
      <AppLogoLink style={styles.logo} />

      <View style={styles.aiPanel}>
        <Text style={styles.aiEyebrow}>Search</Text>
        <Text style={styles.aiTitle}>Tell StreamDrop what you want to watch</Text>
        <View style={styles.aiInputRow}>
          <View style={styles.aiInputContainer}>
            <TextInput
              value={aiQuery}
              onChangeText={(value) => {
                if (!value.trim() && aiQuery.trim()) {
                  clearSearch();
                  return;
                }
                setAiQuery(value);
                setAiSummary('');
                setAiError('');
                setSubmittedSearchQuery('');
              }}
              onFocus={() => {
                if (searchSuggestions.length > 0) setSuggestionsVisible(true);
              }}
              onSubmitEditing={() => void submitSearch()}
              placeholder="Search for a movie or series"
              placeholderTextColor="#6B7280"
              returnKeyType="search"
              style={[styles.aiInput, aiQuery.length > 0 && styles.aiInputWithClear]}
            />
            {aiQuery.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={clearSearch}
                style={styles.clearSearchButton}
              >
                <Text style={styles.clearSearchText}>Clear all</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            style={[
              styles.aiButton,
              (aiLoading || aiQuery.trim().length < 3) && styles.aiButtonDisabled,
            ]}
            onPress={() => void submitSearch()}
            disabled={aiLoading || aiQuery.trim().length < 3}
          >
            <Text style={styles.aiButtonText}>
              {aiLoading ? 'Finding…' : 'Find'}
            </Text>
          </Pressable>
        </View>
        {suggestionsLoading || suggestionsVisible ? (
          <View style={styles.searchSuggestionMenu}>
            {suggestionsLoading ? (
              <Text style={styles.searchSuggestionLoading}>
                Searching {selectedContentTypes.length > 1 ? 'movies and series' : selectedContentTypes.includes('tv') ? 'series' : 'movies'}…
              </Text>
            ) : searchSuggestions.map((movie) => (
              <Pressable
                key={`suggestion-${movie.media_type || 'movie'}-${movie.id}`}
                style={styles.searchSuggestionItem}
                onPress={() => void selectSearchSuggestion(movie)}
              >
                <Text style={styles.searchSuggestionTitle} numberOfLines={1}>
                  {movie.title}
                </Text>
                <Text style={styles.searchSuggestionYear}>
                  {movie.media_type === 'tv' ? 'Series' : 'Movie'} ·{' '}
                  {movie.release_date?.slice(0, 4) || 'Date unknown'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {aiSummary ? <Text style={styles.aiSummary}>{aiSummary}</Text> : null}
        {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
      </View>

      {Platform.OS !== 'web' && (
        !alertsEnabled ? (
          <Pressable style={styles.alertBtn} onPress={scheduleFridayReminder}>
            <Text style={styles.alertText}>Enable Friday Alerts 🔔</Text>
          </Pressable>
        ) : (
          <Text style={styles.enabledText}>Friday alerts are on</Text>
        )
      )}

      {ENABLE_SEARCH_RECOMMENDATIONS &&
        !showSearchRecommendations &&
        searchRecommendations.length > 0 && (
        <View style={styles.collapsedRecommendationSection}>
          <Text style={styles.collapsedRecommendationText} numberOfLines={1}>
            Search recommendations hidden
          </Text>
          <Pressable
            accessibilityLabel="Show search recommendations"
            hitSlop={8}
            onPress={() => setShowSearchRecommendations(true)}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>Show</Text>
          </Pressable>
        </View>
      )}

      {ENABLE_SEARCH_RECOMMENDATIONS &&
        showSearchRecommendations &&
        searchRecommendations.length > 0 && (
        <View style={styles.searchRecommendationSection}>
          <View style={styles.searchRecommendationHeader}>
            <Text style={styles.searchRecommendationTitle} numberOfLines={2}>
              Because you searched for {searchRecommendationSource}
            </Text>
            <Pressable
              accessibilityLabel="Hide search recommendations for this session"
              hitSlop={8}
              onPress={() => setShowSearchRecommendations(false)}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshText}>Hide</Text>
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={searchRecommendations}
            keyExtractor={(item) => `search-recommendation-${item.id}`}
            renderItem={({ item }) => renderCard(item)}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      <View>
        {selectedContentTypes.length > 0 && (
          <View style={styles.ambientSection}>
        {renderAmbientBackdrop(weekendMovies[0])}
        {homeTourStep === 0 && renderHomeTourCallout(0)}

        <View
          onLayout={(event) => {
            weekendSectionYRef.current = event.nativeEvent.layout.y;
          }}
          style={[
            styles.sectionHeader,
            homeTourStep === 0 && styles.tourSectionTarget,
          ]}
        >
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>This Weekend</Text>
            <Text style={styles.sectionSubtitle}>
              A curated selection of up to 6 verified streaming releases
            </Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={refreshReleases}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {homeTourStep === 1 && renderHomeTourCallout(1)}

        {errorMessage ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <Pressable style={styles.retryButton} onPress={refreshReleases}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : weekendLoading ? (
          renderSkeletonCards(true)
        ) : weekendMovies.length > 0 ? (
          <>
            <FlatList
              horizontal
              data={weekendMovies}
              keyExtractor={(i) => `${i.media_type || 'movie'}-${i.id}`}
              renderItem={({ item }) => renderCard(item, true, 'weekend')}
              showsHorizontalScrollIndicator={false}
            />
            <Text style={styles.scrollHint}>More releases below</Text>
          </>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>{weekendEmptyText}</Text>
          </View>
        )}
          </View>
        )}

        {/* Top Picks only if available */}
        {ENABLE_WATCHLIST_RECOMMENDATIONS && topPicks.length > 0 && (
          <>
            <Text style={styles.section}>
              Because you saved {recommendationSource}
            </Text>
            <FlatList
              horizontal
              data={topPicks}
              keyExtractor={(i) => i.id.toString()}
              renderItem={({ item }) => renderCard(item)}
              showsHorizontalScrollIndicator={false}
            />
          </>
        )}

        {selectedContentTypes.includes('movie') && (
          <View style={styles.ambientSection}>
            {renderAmbientBackdrop(remainingRecentMovies[0])}
            <Text style={styles.section}>Recent Movies</Text>
            <Text style={styles.sectionNote}>
              Up to 12 curated movie releases based on your filters.
            </Text>
            {loading && !errorMessage ? (
              renderSkeletonCards()
            ) : remainingRecentMovies.length > 0 ? (
              <FlatList
                horizontal
                data={remainingRecentMovies}
                keyExtractor={(i) => `movie-${i.id}`}
                renderItem={({ item }) => renderCard(item, false, 'recent_movies')}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyText}>{recentMovieEmptyText}</Text>
              </View>
            )}
          </View>
        )}

        {selectedContentTypes.includes('tv') && (
          <View
            onLayout={(event) => {
              seriesSectionYRef.current = event.nativeEvent.layout.y;
            }}
            style={[
              styles.ambientSection,
              homeTourStep === 0 &&
                tourSeriesRevealed &&
                styles.tourSeriesTarget,
            ]}
          >
            {renderAmbientBackdrop(remainingRecentSeries[0])}
            <Text style={styles.section}>New Series</Text>
            <Text style={styles.sectionNote}>
              Up to 12 curated series based on your filters.
            </Text>
            {homeTourStep === 0 && tourSeriesRevealed && (
              <View style={styles.seriesTourArrival}>
                <Text style={styles.homeTourEyebrow}>NEW SERIES</Text>
                <Text style={styles.homeTourBody}>
                  This row contains personalized series releases. Continue when you&apos;re ready.
                </Text>
                <View style={styles.homeTourActions}>
                  <Pressable
                    onPress={() => void dismissHomeTour()}
                    style={styles.homeTourSkipButton}
                  >
                    <Text style={styles.homeTourSkipText}>Skip tour</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void continueHomeTour()}
                    style={styles.homeTourNextButton}
                  >
                    <Text style={styles.homeTourNextText}>Next</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {loading && !errorMessage ? (
              renderSkeletonCards()
            ) : remainingRecentSeries.length > 0 ? (
              <FlatList
                horizontal
                data={remainingRecentSeries}
                keyExtractor={(i) => `series-${i.id}`}
                renderItem={({ item }) => renderCard(item, false, 'new_series')}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyPanel}>
                <Text style={styles.emptyText}>{recentSeriesEmptyText}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.tmdbFooter}>Movie and series data from TMDB</Text>
      </View>

      </ScrollView>

      {homeTourPromptVisible && (
        <View style={styles.homeTourLayer} pointerEvents="box-none">
          <View style={styles.homeTourCard}>
            <Text style={styles.homeTourEyebrow}>STREAMDROP V2 IS HERE</Text>
            <Text style={styles.homeTourTitle}>See what&apos;s new</Text>
            <Text style={styles.homeTourBody}>
              Take a quick tour of movies and series, Home controls, and Settings.
            </Text>
            <View style={styles.homeTourActions}>
              <Pressable onPress={() => void dismissHomeTour()} style={styles.homeTourSkipButton}>
                <Text style={styles.homeTourSkipText}>Skip</Text>
              </Pressable>
              <Pressable onPress={() => void startHomeTour()} style={styles.homeTourNextButton}>
                <Text style={styles.homeTourNextText}>Show me</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {undoHiddenTitle && (
        <View pointerEvents="box-none" style={styles.undoBannerLayer}>
          <View style={styles.undoBanner}>
            <Text style={styles.undoBannerText} numberOfLines={1}>
              Hidden from Home
            </Text>
            <Pressable
              accessibilityLabel={`Undo hiding ${undoHiddenTitle.title}`}
              onPress={() => void undoHideFromHome()}
            >
              <Text style={styles.undoBannerAction}>Undo</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0F1115', flex: 1 },
  container: { flex: 1, backgroundColor: '#0F1115', paddingTop: HOME_TOP_PADDING },
  content: {
    paddingBottom: HOME_BOTTOM_PADDING,
    position: 'relative',
  },
  headerAmbientLayer: {
    left: -40,
    position: 'absolute',
    right: -40,
    top: -110,
    height: 390,
    overflow: 'hidden',
  },
  headerAmbientPoster: {
    height: '100%',
    opacity: 0.13,
    width: '100%',
  },
  logo: {
    marginLeft: 16,
    marginBottom: 16,
  },
  aiPanel: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  searchRecommendationSection: {
    marginBottom: 12,
  },
  searchRecommendationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  searchRecommendationTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    marginRight: 12,
  },
  collapsedRecommendationSection: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  collapsedRecommendationText: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    marginRight: 10,
  },
  aiEyebrow: {
    color: '#EF233C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  aiTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  aiInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  aiInputContainer: {
    flex: 1,
    position: 'relative',
  },
  aiInput: {
    backgroundColor: '#0F1115',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    width: '100%',
  },
  aiInputWithClear: {
    paddingRight: 62,
  },
  clearSearchButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 5,
    top: Platform.OS === 'web' ? 5 : 3,
  },
  clearSearchText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '800',
  },
  aiButton: {
    alignItems: 'center',
    backgroundColor: '#EF233C',
    borderRadius: 10,
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  searchSuggestionMenu: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  searchSuggestionItem: {
    alignItems: 'center',
    borderBottomColor: '#242832',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchSuggestionTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  searchSuggestionYear: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  searchSuggestionLoading: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  aiSummary: {
    color: '#AEB4BE',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  aiError: {
    color: '#EF233C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  section: { color: '#fff', margin: 16, fontWeight: '700' },
  sectionNote: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: -8,
  },
  ambientSection: {
    borderRadius: 18,
    marginBottom: 10,
    marginHorizontal: 8,
    overflow: 'hidden',
    paddingBottom: 14,
    position: 'relative',
  },
  ambientBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientPoster: {
    bottom: -45,
    left: -35,
    opacity: 0.24,
    position: 'absolute',
    right: -35,
    top: -45,
  },
  ambientShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.78)',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  sectionHeaderCopy: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  tourSectionTarget: {
    backgroundColor: '#181C24',
    borderColor: '#EF233C',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  tourSeriesTarget: {
    backgroundColor: '#12151C',
    borderColor: '#EF233C',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 8,
    paddingBottom: 12,
  },
  seriesTourArrival: {
    backgroundColor: '#181C24',
    borderColor: '#3A414D',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 8,
    padding: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '700' },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 3,
  },
  refreshButton: {
    borderColor: '#2A2E36',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '800',
  },
  card: { width: 140, marginLeft: 16 },
  featuredCard: { width: FEATURED_CARD_WIDTH },
  posterWrap: {
    height: 210,
    position: 'relative',
    width: 140,
  },
  featuredPosterWrap: {
    height: FEATURED_POSTER_HEIGHT,
    width: FEATURED_CARD_WIDTH,
  },
  poster: { width: 140, height: 210, borderRadius: 10 },
  featuredPoster: { width: FEATURED_CARD_WIDTH, height: FEATURED_POSTER_HEIGHT },
  languageBadge: {
    backgroundColor: 'rgba(12, 15, 20, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 120,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  languageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  notInterestedButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 15, 20, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    left: 8,
    position: 'absolute',
    top: 8,
    width: 28,
  },
  notInterestedIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  tourTarget: {
    borderColor: '#EF233C',
    borderWidth: 2,
    shadowColor: '#EF233C',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  homeTourLayer: {
    alignItems: 'center',
    left: 16,
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'web' ? 78 : 94,
    zIndex: 30,
  },
  homeTourInline: {
    backgroundColor: '#181C24',
    borderColor: '#EF233C',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    marginHorizontal: 16,
    padding: 14,
  },
  homeTourCard: {
    backgroundColor: '#181C24',
    borderColor: '#EF233C',
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 420,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    width: '100%',
  },
  homeTourEyebrow: {
    color: '#EF233C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  homeTourTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  homeTourBody: {
    color: '#AEB4BE',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  homeTourActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  homeTourSkipButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  homeTourSkipText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '800',
  },
  homeTourNextButton: {
    backgroundColor: '#EF233C',
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  homeTourNextText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  homeTourExploreButton: {
    alignSelf: 'flex-start',
    borderColor: '#EF233C',
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  homeTourExploreText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  undoBanner: {
    alignItems: 'center',
    backgroundColor: '#242832',
    borderColor: '#3A414D',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: '100%',
  },
  undoBannerLayer: {
    alignItems: 'center',
    left: 16,
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'web' ? 16 : 54,
    zIndex: 20,
  },
  undoBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  undoBannerAction: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  title: { color: '#fff', marginTop: 6 },
  featuredTitle: { fontSize: 16, fontWeight: '700' },
  date: { color: '#EF233C', fontSize: 12 },
  rating: { color: '#FFD700', fontSize: 11 },
  contentTypeLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '800' },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  providerPill: {
    backgroundColor: '#3A1118',
    borderColor: '#4A1D24',
    borderRadius: 5,
    borderWidth: 1,
    color: '#EF233C',
    alignSelf: 'flex-start',
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    maxWidth: 96,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  genreText: {
    color: '#9CA3AF',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: '#9CA3AF',
    lineHeight: 20,
  },
  emptyPanel: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
  },
  scrollHint: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 10,
  },
  statePanel: {
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
  },
  stateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF233C',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  skeletonRow: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  skeletonCard: {
    marginLeft: 16,
    width: 140,
  },
  featuredSkeletonCard: {
    width: 178,
  },
  skeletonPoster: {
    backgroundColor: '#1B1F27',
    borderRadius: 10,
    height: 210,
    width: 140,
  },
  featuredSkeletonPoster: {
    height: 266,
    width: 178,
  },
  skeletonLine: {
    backgroundColor: '#1B1F27',
    borderRadius: 5,
    height: 10,
    marginTop: 8,
    width: '82%',
  },
  skeletonShortLine: {
    backgroundColor: '#1B1F27',
    borderRadius: 5,
    height: 10,
    marginTop: 6,
    width: '52%',
  },
  filterSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  personalizationCard: {
    alignItems: 'center',
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    marginHorizontal: 16,
    minHeight: 66,
    paddingHorizontal: 14,
  },
  personalizationCopy: { flex: 1, minWidth: 0 },
  personalizationEyebrow: {
    color: '#EF233C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  personalizationSummary: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  tuneButton: {
    backgroundColor: '#291318',
    borderRadius: 8,
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tuneButtonText: { color: '#EF233C', fontSize: 13, fontWeight: '900' },
  filterButton: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterButtonActive: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  filterButtonTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButtonLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  filterChevron: {
    color: '#EF233C',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  filterChevronActive: {
    color: '#FFFFFF',
  },
  filterButtonValueRow: {
    marginTop: 5,
  },
  filterButtonValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  filterButtonValueActive: {
    color: '#EF233C',
  },
  filterButtonHint: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  filterModalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterModalDismissArea: { flex: 1 },
  filterSheet: {
    alignSelf: 'center',
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '84%',
    maxWidth: 640,
    paddingBottom: Platform.OS === 'web' ? 24 : 34,
    paddingHorizontal: 18,
    width: '100%',
  },
  filterSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#4B5563',
    borderRadius: 2,
    height: 4,
    marginBottom: 18,
    marginTop: 10,
    width: 42,
  },
  filterPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterPanelTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  filterSelectedCount: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  preferenceSections: { gap: 8, marginBottom: 14 },
  preferenceSection: {
    alignItems: 'center',
    backgroundColor: '#0F1115',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 14,
  },
  preferenceSectionActive: { backgroundColor: '#291318', borderColor: '#EF233C' },
  preferenceSectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  preferenceSectionCount: { color: '#9CA3AF', fontSize: 11, marginTop: 3 },
  preferenceSectionChevron: { color: '#EF233C', fontSize: 22, fontWeight: '800' },
  filterPanelClose: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  filterSearchInput: {
    backgroundColor: '#0F1115',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterOptionsScroll: { flexShrink: 1 },
  filterOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  chip: {
    alignItems: 'center',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    width: '48%',
  },
  chipSelected: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipIndicator: { color: '#EF233C', fontSize: 17, fontWeight: '900' },
  filterSheetFooter: {
    borderTopColor: '#242832',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
  },
  filterClearButton: {
    alignItems: 'center',
    borderColor: '#3A3F49',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 22,
  },
  filterClearText: { color: '#D1D5DB', fontSize: 14, fontWeight: '800' },
  filterApplyButton: {
    alignItems: 'center',
    backgroundColor: '#EF233C',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  filterApplyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  alertBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF233C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginLeft: 16,
    marginBottom: 12,
  },
  alertText: { color: '#fff' },
  enabledText: { color: '#9CA3AF', marginLeft: 16, marginBottom: 12, fontSize: 12 },
  tmdbFooter: {
    color: '#6B7280',
    fontSize: 11,
    marginHorizontal: 16,
    marginTop: 24,
  },
});
