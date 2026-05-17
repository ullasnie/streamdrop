import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

const TMDB_API_KEY = '92b45ae5994028d3786552aad05e5a4d';

const languages = [
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Tamil', code: 'ta' },
  { label: 'Telugu', code: 'te' },
  { label: 'Malayalam', code: 'ml' },
  { label: 'Kannada', code: 'kn' },
];

const platforms = [
  { label: 'All', key: 'all', providerId: null },
  { label: 'Netflix', key: 'netflix', providerId: 8 },
  { label: 'Prime', key: 'prime', providerId: 9 },
  { label: 'Disney+', key: 'disney', providerId: 337 },
  { label: 'Hulu', key: 'hulu', providerId: 15 },
  { label: 'Hotstar', key: 'hotstar', providerId: 619 },
  { label: 'Apple TV', key: 'apple-tv', providerId: 350 },
  { label: 'HBO Max', key: 'hbo-max', providerId: 1899 },
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

const PREF_LANGUAGE_KEY = 'preferredLanguage';
const PREF_PLATFORM_KEY = 'preferredPlatform';
const PREF_GENRE_KEY = 'preferredGenre';
const PREF_RELEASE_MONTHS_KEY = 'releaseWindowMonths';
const TMDB_METADATA_CONCURRENCY = 6;
let genreMapCache: Record<number, string> | null = null;
const providerCache = new Map<string, string[]>();
const certificationCache = new Map<string, string>();

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

const getProviderId = (key: string) =>
  platforms.find((p) => p.key === key)?.providerId;

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

const getCertification = async (movieId: number, region: string) => {
  const cacheKey = `${movieId}:${region}`;
  const cached = certificationCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const res = await axios.get(
    `https://api.themoviedb.org/3/movie/${movieId}/release_dates`,
    { params: { api_key: TMDB_API_KEY } }
  );

  const regionRelease = res.data.results?.find(
    (item: { iso_3166_1: string }) => item.iso_3166_1 === region
  );

  const certification = (
    regionRelease?.release_dates?.find(
      (release: { certification?: string }) => release.certification
    )?.certification || ''
  );

  certificationCache.set(cacheKey, certification);
  return certification;
};

const enrichMovies = async (
  items: Movie[],
  region: string,
  genreMap: Record<number, string>
) => {
  const enriched = await mapWithConcurrency(
    items,
    TMDB_METADATA_CONCURRENCY,
    async (movie) => {
      const [providerNames, certification] = await Promise.all([
        getOttProviders(movie.id, region),
        getCertification(movie.id, region),
      ]);

      return {
        ...movie,
        providerNames,
        certification,
        genreNames: (movie.genre_ids || [])
          .map((id) => genreMap[id])
          .filter(Boolean),
      };
    }
  );

  return enriched.filter((movie) => movie.providerNames.length > 0);
};

export default function HomeScreen() {
  const [weekendMovies, setWeekendMovies] = useState<Movie[]>([]);
  const [recentMovies, setRecentMovies] = useState<Movie[]>([]);
  const [topPicks, setTopPicks] = useState<Movie[]>([]);
  const [recommendationSource, setRecommendationSource] = useState('');

  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const openDetails = (item: Movie) => {
    router.push({
      pathname: '/details',
      params: {
        id: item.id.toString(),
        title: item.title,
        releaseDate: item.release_date,
        posterPath: item.poster_path || '',
        overview: item.overview || '',
        providers: JSON.stringify(item.providerNames || []),
        genres: JSON.stringify(item.genreNames || []),
        certification: item.certification || '',
      },
    });
  };

  const fetchTopPicks = useCallback(async (lang: string, genreKey: string) => {
    try {
      const data = await AsyncStorage.getItem('watchlist');
      const watchlist: SavedMovie[] = data ? JSON.parse(data) : [];
      const region = getRegionCode(lang);
      const genreId = getGenreId(genreKey);
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
        .filter((m: Movie) => m.original_language === lang)
        .filter((m: Movie) => !genreId || m.genre_ids?.includes(genreId))
        .filter((m: Movie) => !savedIds.has(m.id))
        .filter(
          (m: Movie) => !savedTitles.has(m.title?.trim().toLowerCase() || '')
        )
        .filter((m: Movie) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        })
        .slice(0, 30);

      const filtered = (await enrichMovies(candidates, region, genreMap)).slice(
        0,
        10
      );

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
      platformKey: string,
      genreKey: string,
      range: { startDate: string; endDate: string },
      genreMap: Record<number, string>
    ) => {
      const region = getRegionCode(lang);
      const providerId = getProviderId(platformKey);
      const genreId = getGenreId(genreKey);

      const params: any = {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        with_original_language: lang,
        watch_region: region,
        with_origin_country: region,
        with_watch_monetization_types: 'flatrate',
        'primary_release_date.gte': range.startDate,
        'primary_release_date.lte': range.endDate,
      };

      if (providerId) {
        params.with_watch_providers = providerId;
      }

      if (genreId) {
        params.with_genres = genreId;
      }

      const res = await axios.get(
        'https://api.themoviedb.org/3/discover/movie',
        { params }
      );

      const ottMovies = await enrichMovies(
        res.data.results || [],
        region,
        genreMap
      );
      return ottMovies;
    },
    []
  );

  const fetchHomeSections = useCallback(
    async (
      lang: string,
      platformKey: string,
      genreKey: string,
      months: number
    ) => {
      try {
        setLoading(true);
        setErrorMessage('');
        const genreMap = await getGenreMap();

        const [weekend, recent] = await Promise.all([
          fetchMovieSection(
            lang,
            platformKey,
            genreKey,
            getWeekendRange(),
            genreMap
          ),
          fetchMovieSection(
            lang,
            platformKey,
            genreKey,
            getDateRange(months),
            genreMap
          ),
        ]);

        setWeekendMovies(weekend);
        setRecentMovies(recent);
      } catch (e) {
        console.log(e);
        setErrorMessage('Couldn’t load releases. Try again.');
      } finally {
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
    const [alertVal, languageVal, platformVal, genreVal, monthsVal] =
      await Promise.all([
        AsyncStorage.getItem('alertsEnabled'),
        AsyncStorage.getItem(PREF_LANGUAGE_KEY),
        AsyncStorage.getItem(PREF_PLATFORM_KEY),
        AsyncStorage.getItem(PREF_GENRE_KEY),
        AsyncStorage.getItem(PREF_RELEASE_MONTHS_KEY),
      ]);

    if (languageVal) setSelectedLanguage(languageVal);
    if (platformVal) setSelectedPlatform(platformVal);
    if (genreVal) setSelectedGenre(genreVal);
    if (monthsVal) setReleaseWindowMonths(Number(monthsVal) || 3);
    setAlertsEnabled(alertVal === 'true');
  }, []);

  const handleLanguageSelect = async (code: string) => {
    setSelectedLanguage(code);
    await AsyncStorage.setItem(PREF_LANGUAGE_KEY, code);
  };

  const handlePlatformSelect = async (key: string) => {
    setSelectedPlatform(key);
    await AsyncStorage.setItem(PREF_PLATFORM_KEY, key);
  };

  const refreshReleases = () => {
    fetchHomeSections(
      selectedLanguage,
      selectedPlatform,
      selectedGenre,
      releaseWindowMonths
    );
    fetchTopPicks(selectedLanguage, selectedGenre);
  };

  const checkAlertStatus = useCallback(async () => {
    const val = await AsyncStorage.getItem('alertsEnabled');
    setAlertsEnabled(val === 'true');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  useEffect(() => {
    fetchHomeSections(
      selectedLanguage,
      selectedPlatform,
      selectedGenre,
      releaseWindowMonths
    );
    fetchTopPicks(selectedLanguage, selectedGenre);
    checkAlertStatus();
  }, [
    checkAlertStatus,
    fetchHomeSections,
    fetchTopPicks,
    releaseWindowMonths,
    selectedGenre,
    selectedLanguage,
    selectedPlatform,
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

      <Text style={styles.date}>{formatDisplayDate(item.release_date)}</Text>

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

  const platformLabel =
    platforms.find((p) => p.key === selectedPlatform)?.label || 'All';
  const genreLabel = genres.find((g) => g.key === selectedGenre)?.label || 'All';
  const languageLabel =
    languages.find((language) => language.code === selectedLanguage)?.label ||
    'selected language';
  const releaseSectionTitle =
    selectedGenre === 'all'
      ? `${platformLabel} Releases: Last ${releaseWindowMonths} Months`
      : `${genreLabel} on ${platformLabel}: Last ${releaseWindowMonths} Months`;
  const weekendEmptyText =
    selectedGenre === 'all'
      ? `No ${languageLabel} weekend drops found on ${platformLabel}.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} drops found on ${platformLabel} this weekend.`;
  const recentEmptyText =
    selectedGenre === 'all'
      ? `No ${languageLabel} OTT releases found for this window.`
      : `No ${languageLabel} ${genreLabel.toLowerCase()} releases found for this window.`;

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.logo}>
        <Text style={styles.logoStream}>Stream</Text>
        <Text style={styles.logoDrop}>Drop</Text>
      </View>

      {!alertsEnabled ? (
        <Pressable style={styles.alertBtn} onPress={scheduleFridayReminder}>
          <Text style={styles.alertText}>Enable Friday Alerts 🔔</Text>
        </Pressable>
      ) : (
        <Text style={styles.enabledText}>Friday alerts are on</Text>
      )}

      <Text style={styles.filterLabel}>Language</Text>
      <FlatList
        horizontal
        data={languages}
        style={[styles.chipList, styles.languageChipList]}
        contentContainerStyle={styles.chipListContent}
        keyExtractor={(i) => i.code}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              selectedLanguage === item.code && styles.chipSelected,
            ]}
            onPress={() => handleLanguageSelect(item.code)}
          >
            <Text
              style={[
                styles.chipText,
                selectedLanguage === item.code && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.filterLabel}>Streaming</Text>
      <FlatList
        horizontal
        data={platforms}
        style={styles.chipList}
        contentContainerStyle={styles.chipListContent}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              selectedPlatform === item.key && styles.chipSelected,
            ]}
            onPress={() => handlePlatformSelect(item.key)}
          >
            <Text
              style={[
                styles.chipText,
                selectedPlatform === item.key && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

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
        <FlatList
          horizontal
          data={weekendMovies}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => renderCard(item, true)}
          showsHorizontalScrollIndicator={false}
        />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115', paddingTop: 60 },
  content: { paddingBottom: 120 },
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
  featuredCard: { width: 178 },
  poster: { width: 140, height: 210, borderRadius: 10 },
  featuredPoster: { width: 178, height: 266 },
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
  filterLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipList: {
    flexGrow: 0,
    height: 48,
  },
  languageChipList: {
    marginBottom: 10,
  },
  chipListContent: {
    paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2E36',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
