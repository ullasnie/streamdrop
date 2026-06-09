import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
};

type SavedMovie = {
  id?: number;
  title: string;
  posterPath: string;
  releaseDate: string;
  overview: string;
};

type ActiveFilter = 'language' | 'platform' | 'genre' | null;
type DateRange = { startDate: string; endDate: string };

const TMDB_API_KEY = '92b45ae5994028d3786552aad05e5a4d';

const languages = [
  { label: 'All', code: 'all' },
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Tamil', code: 'ta' },
  { label: 'Telugu', code: 'te' },
  { label: 'Malayalam', code: 'ml' },
  { label: 'Kannada', code: 'kn' },
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
    providerNames: ['Apple TV', 'Apple TV Plus', 'Apple TV Amazon Channel'],
  },
  {
    label: 'HBO Max',
    key: 'hbo-max',
    providerId: 1899,
    providerNames: ['Max', 'HBO Max', 'Max Amazon Channel'],
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
];

const formatDate = (date: Date) => date.toISOString().split('T')[0];

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
const TMDB_METADATA_CONCURRENCY = 6;
const TMDB_DISCOVER_RESULT_LIMIT = 12;
const TMDB_RECOMMENDATION_CANDIDATE_LIMIT = 18;
const TMDB_SEARCH_RESULT_LIMIT = 8;
const RECOMMENDATION_MAX_AGE_YEARS = 3;
const INITIAL_HOME_LANGUAGE_LIMIT = 3;
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

const getDateRange = (months: number) => {
  const today = new Date();
  const past = new Date();
  past.setMonth(today.getMonth() - months);

  return {
    startDate: formatDate(past),
    endDate: formatDate(today),
  };
};

const getWeekendRange = () => {
  const today = new Date();
  const day = today.getDay();
  const daysUntilThursday = day === 0 ? -3 : 4 - day;
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysUntilThursday);

  const sunday = new Date(thursday);
  sunday.setDate(thursday.getDate() + 3);

  return {
    startDate: formatDate(thursday),
    endDate: formatDate(sunday),
  };
};

const getRegionCode = (lang: string) => (lang === 'en' ? 'US' : 'IN');

const getSelectedLanguageCodes = (selected: string[]) =>
  selected.includes('all')
    ? languages.filter((item) => item.code !== 'all').map((item) => item.code)
    : selected;

const splitInitialLanguages = (langs: string[]) => ({
  initialLangs: langs.slice(0, INITIAL_HOME_LANGUAGE_LIMIT),
  deferredLangs: langs.slice(INITIAL_HOME_LANGUAGE_LIMIT),
});

const getProviderIds = (key: string, region: string) => {
  const platform = platforms.find((p) => p.key === key);
  if (!platform || platform.key === 'all') return [];

  const regionProviderIds =
    'providerIdsByRegion' in platform
      ? platform.providerIdsByRegion?.[region as keyof typeof platform.providerIdsByRegion]
      : undefined;

  if (regionProviderIds?.length) return regionProviderIds;
  return platform.providerId ? [platform.providerId] : [];
};

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

  return allowedNames.some((allowedName) => {
    const normalizedAllowed = normalizeProviderName(allowedName);
    if (normalizedAllowed.length <= 3) {
      return normalizedProvider === normalizedAllowed;
    }

    return (
      normalizedProvider === normalizedAllowed ||
      normalizedProvider.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalizedProvider)
    );
  });
};

const filterMoviesBySelectedProviders = (
  movies: Movie[],
  platformKeys: string[]
) => {
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

  const res = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {
    params: { api_key: TMDB_API_KEY },
  });

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

const hasRating = (item: Movie) =>
  typeof item.vote_average === 'number' &&
  typeof item.vote_count === 'number' &&
  item.vote_average > 0 &&
  item.vote_count > 0;

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

const formatSelectedLabels = (
  selected: string[],
  options: { label: string; key?: string; code?: string }[]
) => {
  const labels = selected
    .map(
      (value) =>
        options.find((item) => item.key === value || item.code === value)?.label
    )
    .filter(Boolean);

  if (labels.length <= 1) return labels[0] || '';
  if (labels.length === 2) return labels.join(', ');

  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
};

const toggleLanguageSelection = (selected: string[], code: string) => {
  return toggleAllSelection(selected, code);
};

const toggleAllSelection = (
  selected: string[],
  key: string,
  allKey = 'all'
) => {
  if (key === allKey) return [allKey];

  const withoutAll = selected.filter((item) => item !== allKey);
  const next = withoutAll.includes(key)
    ? withoutAll.filter((item) => item !== key)
    : [...withoutAll, key];

  return next.length ? next : [allKey];
};

const sortByRecentRelease = (a: Movie, b: Movie) => {
  const aTime = new Date(`${getMovieDisplayDate(a)}T00:00:00`).getTime();
  const bTime = new Date(`${getMovieDisplayDate(b)}T00:00:00`).getTime();

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;

  return bTime - aTime;
};

const sortByPopularitySignal = (a: Movie, b: Movie) =>
  (b.vote_count || 0) - (a.vote_count || 0);

const getMovieDisplayDate = (movie: Movie) =>
  movie.ottReleaseDate || movie.release_date;

const getDateInRange = (dates: string[], range: DateRange) =>
  dates.find((date) => date >= range.startDate && date <= range.endDate) || '';

const mergeMovieLists = (
  lists: Movie[][],
  sorter: (a: Movie, b: Movie) => number = sortByPopularitySignal
) => {
  const seen = new Set<number>();
  const merged: Movie[] = [];

  lists.flat().forEach((movie) => {
    if (seen.has(movie.id)) return;
    seen.add(movie.id);
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

const getOttProviders = async (movieId: number, region: string) => {
  const cacheKey = `${movieId}:${region}`;
  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  const res = await axios.get(
    `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
    { params: { api_key: TMDB_API_KEY } }
  );

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

  const res = await axios.get(
    `https://api.themoviedb.org/3/movie/${movieId}/release_dates`,
    { params: { api_key: TMDB_API_KEY } }
  );

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

export default function HomeScreen() {
  const homeFetchIdRef = useRef(0);
  const searchFetchIdRef = useRef(0);
  const [weekendMovies, setWeekendMovies] = useState<Movie[]>([]);
  const [recentMovies, setRecentMovies] = useState<Movie[]>([]);
  const [topPicks, setTopPicks] = useState<Movie[]>([]);
  const [recommendationSource, setRecommendationSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const [selectedLanguages, setSelectedLanguages] = useState(['all']);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['all']);
  const [selectedGenres, setSelectedGenres] = useState(['all']);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const dismissActiveFilter = () => {
    if (activeFilter) setActiveFilter(null);
  };

  const keepActiveFilterOpen = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
  };

  const openDetails = (item: Movie) => {
    dismissActiveFilter();
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
      },
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setSearchLoading(false);
  };

  const fetchSearchResults = useCallback(
    async (query: string, langs: string[], platformKeys: string[], genreKeys: string[]) => {
      const fetchId = searchFetchIdRef.current + 1;
      searchFetchIdRef.current = fetchId;
      const isCurrentFetch = () => searchFetchIdRef.current === fetchId;

      try {
        setSearchLoading(true);
        setSearchError('');

        const genreMap = await getGenreMap();
        const selectedLanguageCodes = getSelectedLanguageCodes(langs);
        const selectedGenreIds = genreKeys
          .filter((key) => key !== 'all')
          .map(getGenreId)
          .filter(Boolean);
        const primaryLanguage = selectedLanguageCodes[0] || 'en';
        const region = getRegionCode(primaryLanguage);

        const res = await axios.get('https://api.themoviedb.org/3/search/movie', {
          params: {
            api_key: TMDB_API_KEY,
            include_adult: false,
            query,
          },
        });

        const seenIds = new Set<number>();
        const candidates = (res.data.results || [])
          .filter((movie: Movie) => {
            if (seenIds.has(movie.id)) return false;
            seenIds.add(movie.id);
            return true;
          })
          .filter((movie: Movie) =>
            movie.original_language
              ? selectedLanguageCodes.includes(movie.original_language)
              : true
          )
          .filter(
            (movie: Movie) =>
              !selectedGenreIds.length ||
              movie.genre_ids?.some((genreId) => selectedGenreIds.includes(genreId))
          )
          .slice(0, TMDB_SEARCH_RESULT_LIMIT);

        const enriched = await enrichMovies(candidates, region, genreMap);
        const filtered = filterMoviesBySelectedProviders(enriched, platformKeys);
        if (!isCurrentFetch()) return;

        setSearchResults(filtered);
      } catch (error) {
        console.log('Search error:', error);
        if (!isCurrentFetch()) return;

        setSearchResults([]);
        setSearchError('Search is unavailable right now.');
      } finally {
        if (isCurrentFetch()) setSearchLoading(false);
      }
    },
    []
  );

  const fetchTopPicks = useCallback(async (langs: string[], genreKeys: string[]) => {
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

      if (!savedWithIds.length) {
        setTopPicks([]);
        setRecommendationSource('');
        return;
      }

      setRecommendationSource(formatRecommendationSource(savedWithIds));

      const similarResults = await Promise.all(
        savedWithIds.map(async (movie) => {
          try {
            const res = await axios.get(
              `https://api.themoviedb.org/3/movie/${movie.id}/similar`,
              { params: { api_key: TMDB_API_KEY } }
            );
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
        .filter(
          (m: Movie) => !savedTitles.has(m.title?.trim().toLowerCase() || '')
        )
        .filter((m: Movie) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        })
        .slice(0, TMDB_RECOMMENDATION_CANDIDATE_LIMIT);

      const enrichedByRegion = await Promise.all(
        langs.map((lang) => {
          const regionCandidates = candidates.filter(
            (movie) => movie.original_language === lang
          );
          return enrichMovies(regionCandidates, getRegionCode(lang), genreMap);
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

  const fetchMovieSection = useCallback(
    async (
      lang: string,
      platformKeys: string[],
      genreKeys: string[],
      range: { startDate: string; endDate: string },
      genreMap: Record<number, string>
    ) => {
      const region = getRegionCode(lang);
      const providerIds = platformKeys
        .filter((key) => key !== 'all')
        .flatMap((key) => getProviderIds(key, region));
      const genreIds = genreKeys
        .filter((key) => key !== 'all')
        .map(getGenreId)
        .filter(Boolean);

      const params: any = {
        api_key: TMDB_API_KEY,
        sort_by: 'release_date.desc',
        with_original_language: lang,
        watch_region: region,
        with_origin_country: region,
        with_watch_monetization_types: 'flatrate',
        with_release_type: TMDB_OTT_RELEASE_TYPES.join('|'),
        'release_date.gte': range.startDate,
        'release_date.lte': range.endDate,
      };

      if (providerIds.length) {
        params.with_watch_providers = providerIds.join('|');
      }

      if (genreIds.length) {
        params.with_genres = genreIds.join('|');
      }

      const res = await axios.get(
        'https://api.themoviedb.org/3/discover/movie',
        { params }
      );

      const discoverResults = (res.data.results || []).slice(
        0,
        TMDB_DISCOVER_RESULT_LIMIT
      );
      const ottMovies = await enrichMovies(
        discoverResults,
        region,
        genreMap,
        range
      );
      return filterMoviesBySelectedProviders(ottMovies, platformKeys);
    },
    []
  );

  const fetchHomeSections = useCallback(
    async (
      langs: string[],
      platformKeys: string[],
      genreKeys: string[],
      months: number
    ) => {
      const fetchId = homeFetchIdRef.current + 1;
      homeFetchIdRef.current = fetchId;
      const isCurrentFetch = () => homeFetchIdRef.current === fetchId;
      const fetchSectionsForLanguages = (
        languageBatch: string[],
        genreMap: Record<number, string>
      ) =>
        Promise.all([
          Promise.all(
            languageBatch.map((lang) =>
              fetchMovieSection(
                lang,
                platformKeys,
                genreKeys,
                getWeekendRange(),
                genreMap
              )
            )
          ),
          Promise.all(
            languageBatch.map((lang) =>
              fetchMovieSection(
                lang,
                platformKeys,
                genreKeys,
                getDateRange(months),
                genreMap
              )
            )
          ),
        ]);

      try {
        setLoading(true);
        setErrorMessage('');
        const genreMap = await getGenreMap();
        const { initialLangs, deferredLangs } = splitInitialLanguages(langs);

        const [weekendLists, recentLists] = await fetchSectionsForLanguages(
          initialLangs,
          genreMap
        );
        if (!isCurrentFetch()) return;

        setWeekendMovies(mergeMovieLists(weekendLists));
        setRecentMovies(mergeMovieLists(recentLists, sortByRecentRelease));
        setLoading(false);

        if (deferredLangs.length) {
          try {
            const [deferredWeekendLists, deferredRecentLists] =
              await fetchSectionsForLanguages(deferredLangs, genreMap);
            if (!isCurrentFetch()) return;

            setWeekendMovies(
              mergeMovieLists([...weekendLists, ...deferredWeekendLists])
            );
            setRecentMovies(
              mergeMovieLists(
                [...recentLists, ...deferredRecentLists],
                sortByRecentRelease
              )
            );
          } catch (backgroundError) {
            console.log('Deferred home fetch error:', backgroundError);
          }
        }
      } catch (e) {
        console.log(e);
        if (!isCurrentFetch()) return;
        setErrorMessage('Couldn’t load releases. Try again.');
        setLoading(false);
      }
    },
    [fetchMovieSection]
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
      ]);
      const values = Object.fromEntries(entries);

      setSelectedLanguages(
        parseStoredList(
          values[PREF_HOME_LANGUAGES_KEY],
          values[PREF_LANGUAGE_KEY] ? [values[PREF_LANGUAGE_KEY]] : ['all']
        )
      );
      setSelectedPlatforms(
        parseStoredList(
          values[PREF_HOME_PLATFORMS_KEY],
          values[PREF_PLATFORM_KEY] ? [values[PREF_PLATFORM_KEY]] : ['all']
        )
      );
      setSelectedGenres(
        parseStoredList(
          values[PREF_HOME_GENRES_KEY],
          values[PREF_GENRE_KEY] ? [values[PREF_GENRE_KEY]] : ['all']
        )
      );
      if (values[PREF_RELEASE_MONTHS_KEY]) {
        setReleaseWindowMonths(Number(values[PREF_RELEASE_MONTHS_KEY]) || 3);
      }
      setAlertsEnabled(values.alertsEnabled === 'true');
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  const handleLanguageSelect = async (code: string) => {
    const next = toggleLanguageSelection(selectedLanguages, code);
    setSelectedLanguages(next);
    await AsyncStorage.setItem(PREF_HOME_LANGUAGES_KEY, next.join(','));
  };

  const handlePlatformSelect = async (key: string) => {
    const next = toggleAllSelection(selectedPlatforms, key);
    setSelectedPlatforms(next);
    await AsyncStorage.setItem(PREF_HOME_PLATFORMS_KEY, next.join(','));
  };

  const handleGenreSelect = async (key: string) => {
    const next = toggleAllSelection(selectedGenres, key);
    setSelectedGenres(next);
    await AsyncStorage.setItem(PREF_HOME_GENRES_KEY, next.join(','));
  };

  const refreshReleases = () => {
    dismissActiveFilter();
    const languageCodes = getSelectedLanguageCodes(selectedLanguages);
    fetchHomeSections(
      languageCodes,
      selectedPlatforms,
      selectedGenres,
      releaseWindowMonths
    );
    fetchTopPicks(languageCodes, selectedGenres);
  };

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  useEffect(() => {
    if (!preferencesLoaded) return;

    const languageCodes = getSelectedLanguageCodes(selectedLanguages);
    fetchHomeSections(
      languageCodes,
      selectedPlatforms,
      selectedGenres,
      releaseWindowMonths
    );
    fetchTopPicks(languageCodes, selectedGenres);
  }, [
    fetchHomeSections,
    fetchTopPicks,
    preferencesLoaded,
    releaseWindowMonths,
    selectedGenres,
    selectedLanguages,
    selectedPlatforms,
  ]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      searchFetchIdRef.current += 1;
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      fetchSearchResults(
        query,
        selectedLanguages,
        selectedPlatforms,
        selectedGenres
      );
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    fetchSearchResults,
    searchQuery,
    selectedGenres,
    selectedLanguages,
    selectedPlatforms,
  ]);

  const renderCard = (item: Movie, featured = false) => (
    <Pressable
      style={[styles.card, featured && styles.featuredCard]}
      onPress={() => openDetails(item)}
    >
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
        style={[styles.poster, featured && styles.featuredPoster]}
      />

      <Text style={[styles.title, featured && styles.featuredTitle]} numberOfLines={2}>
        {item.title}
      </Text>

      <Text style={styles.date}>
        {formatDisplayDate(getMovieDisplayDate(item))}
      </Text>

      {item.providerNames?.[0] && (
        <Text style={styles.providerPill} numberOfLines={1}>
          {item.providerNames[0]}
        </Text>
      )}

      <View style={styles.metaRow}>
        {(item.genreNames?.[0] || item.certification) && (
          <Text style={styles.genreText} numberOfLines={1}>
            {[item.genreNames?.[0], item.certification]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>

      {hasRating(item) && (
        <Text style={styles.rating}>
          ⭐ {item.vote_average!.toFixed(1)}
        </Text>
      )}

    </Pressable>
  );

  const platformLabel = formatSelectedLabels(selectedPlatforms, platforms);
  const genreLabel = formatSelectedLabels(selectedGenres, genres);
  const languageLabel = formatSelectedLabels(selectedLanguages, languages);
  const filterOptions =
    activeFilter === 'language'
      ? languages.map((item) => ({
          key: item.code,
          label: item.label,
          selected: selectedLanguages.includes(item.code),
          onPress: () => handleLanguageSelect(item.code),
        }))
      : activeFilter === 'platform'
        ? platforms.map((item) => ({
            key: item.key,
            label: item.label,
            selected: selectedPlatforms.includes(item.key),
            onPress: () => handlePlatformSelect(item.key),
          }))
        : activeFilter === 'genre'
          ? genres.map((item) => ({
              key: item.key,
              label: item.label,
              selected: selectedGenres.includes(item.key),
              onPress: () => handleGenreSelect(item.key),
            }))
          : [];
  const releaseSectionTitle =
    selectedGenres.includes('all')
      ? `${platformLabel} Releases: Last ${releaseWindowMonths} Months`
      : `${genreLabel} on ${platformLabel}: Last ${releaseWindowMonths} Months`;
  const weekendEmptyText =
    selectedGenres.includes('all')
      ? `No ${languageLabel} weekend drops found on ${platformLabel}.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} drops found on ${platformLabel} this weekend.`;
  const recentEmptyText =
    selectedGenres.includes('all')
      ? `No ${languageLabel} OTT releases found for this window.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} releases found for this window.`;

  const renderFilterButton = (
    label: string,
    value: string,
    filter: Exclude<ActiveFilter, null>
  ) => {
    const selected = activeFilter === filter;

    return (
      <Pressable
        style={[styles.filterButton, selected && styles.filterButtonActive]}
        onPress={() => setActiveFilter(selected ? null : filter)}
      >
        <View style={styles.filterButtonTopRow}>
          <Text style={styles.filterButtonLabel}>{label}</Text>
          <Text
            style={[
              styles.filterChevron,
              selected && styles.filterChevronActive,
            ]}
          >
            {selected ? '⌃' : '⌄'}
          </Text>
        </View>
        <View style={styles.filterButtonValueRow}>
          <Text
            style={[
              styles.filterButtonValue,
              selected && styles.filterButtonValueActive,
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
        <Text style={styles.filterButtonHint}>Tap to change</Text>
      </Pressable>
    );
  };

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

  const renderSearchResult = (item: Movie) => (
    <Pressable
      key={item.id}
      style={styles.searchResult}
      onPress={() => openDetails(item)}
    >
      {item.poster_path ? (
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
          style={styles.searchPoster}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.searchPosterPlaceholder}>
          <Text style={styles.searchPosterPlaceholderText}>No poster</Text>
        </View>
      )}

      <View style={styles.searchResultContent}>
        <Text style={styles.searchTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.searchDate}>
          {formatDisplayDate(getMovieDisplayDate(item)) || 'Release date unknown'}
        </Text>
        {item.providerNames?.[0] && (
          <Text style={styles.providerPill} numberOfLines={1}>
            {item.providerNames[0]}
          </Text>
        )}
        {(item.genreNames?.[0] || item.certification) && (
          <Text style={styles.searchMeta} numberOfLines={1}>
            {[item.genreNames?.[0], item.certification]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        {item.overview ? (
          <Text style={styles.searchOverview} numberOfLines={2}>
            {item.overview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  const searchActive = searchQuery.trim().length >= 2;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      onScrollBeginDrag={dismissActiveFilter}
      onTouchStart={dismissActiveFilter}
    >
      <View style={styles.logo} onTouchStart={dismissActiveFilter}>
        <Text style={styles.logoStream}>Stream</Text>
        <Text style={styles.logoDrop}>Drop</Text>
      </View>

      <View
        style={[styles.searchBar, searchFocused && styles.searchBarFocused]}
        onTouchStart={keepActiveFilterOpen}
      >
        <Text style={styles.searchIcon}>Search</Text>
        <TextInput
          value={searchQuery}
          onBlur={() => setSearchFocused(false)}
          onChangeText={(value) => {
            dismissActiveFilter();
            setSearchQuery(value);
          }}
          onFocus={() => setSearchFocused(true)}
          placeholder="Find a movie"
          placeholderTextColor="#6B7280"
          returnKeyType="search"
          style={[
            styles.searchInput,
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
          ]}
        />
        {searchQuery ? (
          <Pressable style={styles.searchClearButton} onPress={clearSearch}>
            <Text style={styles.searchClearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {searchActive ? (
        <View style={styles.searchSection} onTouchStart={dismissActiveFilter}>
          <View style={styles.searchHeader}>
            <View>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <Text style={styles.sectionSubtitle}>
                Matching movies from TMDB
              </Text>
            </View>
            {searchLoading && (
              <ActivityIndicator color="#EF233C" size="small" />
            )}
          </View>

          {searchError ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyText}>{searchError}</Text>
            </View>
          ) : !searchLoading && searchResults.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyText}>
                No matching movies found for “{searchQuery.trim()}”.
              </Text>
            </View>
          ) : (
            <View style={styles.searchResultsList}>
              {searchResults.map(renderSearchResult)}
            </View>
          )}
        </View>
      ) : (
        <>
          {Platform.OS !== 'web' && (
            !alertsEnabled ? (
              <Pressable style={styles.alertBtn} onPress={scheduleFridayReminder}>
                <Text style={styles.alertText}>Enable Friday Alerts 🔔</Text>
              </Pressable>
            ) : (
              <Text style={styles.enabledText}>Friday alerts are on</Text>
            )
          )}

          <View style={styles.filterSummaryRow} onTouchStart={keepActiveFilterOpen}>
            {renderFilterButton('Language', languageLabel, 'language')}
            {renderFilterButton('Streaming', platformLabel, 'platform')}
            {renderFilterButton('Genre', genreLabel, 'genre')}
          </View>

          {activeFilter && (
            <View style={styles.filterPanel} onTouchStart={keepActiveFilterOpen}>
              <View style={styles.filterPanelHeader}>
                <Text style={styles.filterPanelTitle}>
                  {activeFilter === 'platform' ? 'Streaming' : activeFilter}
                </Text>
                <Pressable onPress={() => setActiveFilter(null)}>
                  <Text style={styles.filterPanelClose}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.filterOptionGrid}>
                {filterOptions.map((item) => (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.chip,
                      item.selected && styles.chipSelected,
                    ]}
                    onPress={item.onPress}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        item.selected && styles.chipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View onTouchStart={dismissActiveFilter}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>This Weekend</Text>
            <Text style={styles.sectionSubtitle}>Thu-Sun releases</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={refreshReleases}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <Pressable style={styles.retryButton} onPress={refreshReleases}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : loading ? (
          renderSkeletonCards(true)
        ) : weekendMovies.length > 0 ? (
          <>
            <FlatList
              horizontal
              data={weekendMovies}
              keyExtractor={(i) => i.id.toString()}
              renderItem={({ item }) => renderCard(item, true)}
              showsHorizontalScrollIndicator={false}
            />
            <Text style={styles.scrollHint}>More releases below</Text>
          </>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>{weekendEmptyText}</Text>
          </View>
        )}

        {/* Top Picks only if available */}
        {topPicks.length > 0 && (
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

        <Text style={styles.section}>
          {releaseSectionTitle}
        </Text>
        <Text style={styles.sectionNote}>
          Beta note: Showing a curated sample from TMDB, not every matching release.
        </Text>

        {loading && !errorMessage ? (
          renderSkeletonCards()
        ) : !loading && recentMovies.length > 0 ? (
          <FlatList
            horizontal
            data={recentMovies}
            keyExtractor={(i) => i.id.toString()}
            renderItem={({ item }) => renderCard(item)}
            showsHorizontalScrollIndicator={false}
          />
        ) : !loading ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>{recentEmptyText}</Text>
          </View>
        ) : null}

        <Text style={styles.tmdbFooter}>Movie data from TMDB</Text>
      </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115', paddingTop: HOME_TOP_PADDING },
  content: { paddingBottom: HOME_BOTTOM_PADDING },
  logo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 16,
    marginBottom: 16,
  },
  logoStream: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  logoDrop: {
    color: '#EF233C',
    fontSize: 34,
    fontStyle: 'italic',
    fontWeight: '900',
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 16,
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
  poster: { width: 140, height: 210, borderRadius: 10 },
  featuredPoster: { width: FEATURED_CARD_WIDTH, height: FEATURED_POSTER_HEIGHT },
  title: { color: '#fff', marginTop: 6 },
  featuredTitle: { fontSize: 16, fontWeight: '700' },
  date: { color: '#EF233C', fontSize: 12 },
  rating: { color: '#FFD700', fontSize: 11 },
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
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchBarFocused: {
    borderColor: '#EF233C',
  },
  searchIcon: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  searchInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    minHeight: 48,
  },
  searchClearButton: {
    borderColor: '#3A1118',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchClearText: {
    color: '#EF233C',
    fontSize: 11,
    fontWeight: '900',
  },
  searchSection: {
    marginTop: 4,
  },
  searchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  searchResultsList: {
    gap: 12,
    marginHorizontal: 16,
  },
  searchResult: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  searchPoster: {
    backgroundColor: '#1B1F27',
    borderRadius: 7,
    height: 126,
    width: 84,
  },
  searchPosterPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#1B1F27',
    borderRadius: 7,
    height: 126,
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: 84,
  },
  searchPosterPlaceholderText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  searchResultContent: {
    flex: 1,
    minWidth: 0,
  },
  searchTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  searchDate: {
    color: '#EF233C',
    fontSize: 12,
    marginTop: 4,
  },
  searchMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  searchOverview: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
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
  filterPanel: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
  },
  filterPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterPanelTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  filterPanelClose: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  filterOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2E36',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
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
