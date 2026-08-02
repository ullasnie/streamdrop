import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { emitWatchlistUpdated } from '../constants/watchlist-events';
import { trackEvent } from '../constants/analytics';
import { getTmdb } from '../constants/tmdb-api';
import { AppLogoLink } from '../components/app-logo-link';
import { AmbientBackground } from '../components/ambient-background';

const DETAILS_POSTER_WIDTH = Platform.OS === 'web' ? 260 : 300;

type Trailer = {
  key: string;
  name: string;
};

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

const parseListParam = (value: unknown) => {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
};

const formatRuntime = (minutes: number | null) => {
  if (!minutes) return '';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;

  return `${hours}h ${remainingMinutes}m`;
};

const cleanProviderList = (value: string[]) => {
  if (value.length <= 1) return value;

  const primary = value.filter(
    (provider) => !provider.toLowerCase().includes('channel')
  );

  return primary.length ? primary : value.slice(0, 1);
};

const getBestTrailer = (videos: any[]): Trailer | null => {
  const youtubeVideos = videos.filter(
    (video) => video?.site === 'YouTube' && typeof video.key === 'string'
  );

  const officialTrailer =
    youtubeVideos.find((video) => video.type === 'Trailer' && video.official) ||
    youtubeVideos.find((video) => video.type === 'Trailer') ||
    youtubeVideos.find((video) => video.type === 'Teaser' && video.official) ||
    youtubeVideos.find((video) => video.type === 'Teaser');

  if (!officialTrailer) return null;

  return {
    key: officialTrailer.key,
    name: officialTrailer.name || 'Trailer',
  };
};

export default function DetailsScreen() {
  const params = useLocalSearchParams();
  const initialRuntime = Number(params.runtime);
  const [runtime, setRuntime] = useState<number | null>(
    Number.isFinite(initialRuntime) && initialRuntime > 0 ? initialRuntime : null
  );
  const [isSaved, setIsSaved] = useState(false);
  const [trailer, setTrailer] = useState<Trailer | null>(null);
  const [providers, setProviders] = useState<string[]>(() =>
    parseListParam(params.providers)
  );

  const id = Number(params.id);
  const mediaType = String(params.mediaType || 'movie');
  const providerRegion = String(params.region || '');
  const title = String(params.title || '');
  const releaseDate = String(params.releaseDate || '');
  const posterPath = String(params.posterPath || '');
  const overview = String(params.overview || '');
  const genres = parseListParam(params.genres);
  const certification = String(params.certification || '');
  const rating = Number(params.rating);
  const visibleProviders = cleanProviderList(providers);

  useEffect(() => {
    const fetchProviders = async () => {
      if (!Number.isFinite(id) || (!providerRegion && providers.length > 0)) {
        return;
      }

      try {
        const res = await getTmdb(`${mediaType}/${id}/watch/providers`);
        const region = providerRegion || 'US';
        const providerNames = (
          res.data.results?.[region]?.flatrate || []
        ).map((provider: { provider_name: string }) => provider.provider_name);

        if (providerNames.length > 0) setProviders(providerNames);
      } catch (error) {
        console.log('Provider fetch error:', error);
      }
    };

    void fetchProviders();
    // Initial provider params are only a fallback while authoritative data loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mediaType, providerRegion]);

  useEffect(() => {
    const fetchRuntime = async () => {
      if (!Number.isFinite(id)) return;

      try {
        const res = await getTmdb(`${mediaType}/${id}`);
        setRuntime(res.data.runtime || res.data.episode_run_time?.[0] || null);
      } catch (error) {
        console.log('Runtime fetch error:', error);
      }
    };

    fetchRuntime();
  }, [id, mediaType]);

  useEffect(() => {
    const fetchTrailer = async () => {
      if (!Number.isFinite(id)) return;

      try {
        const res = await getTmdb(`${mediaType}/${id}/videos`);
        setTrailer(getBestTrailer(res.data.results || []));
      } catch (error) {
        console.log('Trailer fetch error:', error);
        setTrailer(null);
      }
    };

    fetchTrailer();
  }, [id, mediaType]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      try {
        const existing = await AsyncStorage.getItem('watchlist');
        const watchlist = existing ? JSON.parse(existing) : [];

        setIsSaved(
          watchlist.some((m: any) => {
            if (Number.isFinite(id) && m.id) {
              return Number(m.id) === id;
            }

            return m.title === title;
          })
        );
      } catch (error) {
        console.log('Error checking saved status:', error);
      }
    };

    checkSavedStatus();
  }, [id, title]);

  const saveMovie = async () => {
    try {
      const existing = await AsyncStorage.getItem('watchlist');
      const watchlist = existing ? JSON.parse(existing) : [];

      const movie = {
        id: Number.isFinite(id) ? id : undefined,
        title,
        releaseDate,
        posterPath,
        overview,
        providers,
        genres,
        certification,
        rating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
        mediaType,
        runtime,
      };

      const alreadySaved = watchlist.some((m: any) => m.title === title);

      if (!alreadySaved) {
        watchlist.push(movie);
        await AsyncStorage.setItem('watchlist', JSON.stringify(watchlist));
        setIsSaved(true);
        emitWatchlistUpdated();
        void trackEvent('watchlist_added');
        Alert.alert('Saved', 'Added to watchlist');
      } else {
        setIsSaved(true);
      }
    } catch (error) {
      console.log('Error saving:', error);
    }
  };

  const launchTrailer = async (trailerKey: string) => {
    const youtubeAppUrl = `youtube://watch?v=${trailerKey}`;
    const youtubeWebUrl = `https://www.youtube.com/watch?v=${trailerKey}`;

    try {
      const canOpenYoutube = await Linking.canOpenURL(youtubeAppUrl);
      await Linking.openURL(canOpenYoutube ? youtubeAppUrl : youtubeWebUrl);
    } catch (error) {
      console.log('Trailer open error:', error);
      await Linking.openURL(youtubeWebUrl);
    }
  };

  const openTrailer = () => {
    if (!trailer) return;

    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis.confirm !== 'function' ||
        globalThis.confirm('Open YouTube to watch this trailer?');

      if (confirmed) void launchTrailer(trailer.key);
      return;
    }

    Alert.alert(
      'Leave StreamDrop?',
      'The trailer will open in YouTube or your browser.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave App',
          style: 'default',
          onPress: () => {
            void launchTrailer(trailer.key);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AmbientBackground posterPath={posterPath} />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <AppLogoLink compact />
      </View>

      <ScrollView style={styles.scroll}>
        {posterPath ? (
          <View style={styles.posterWrap}>
            <Image
              source={{ uri: `https://image.tmdb.org/t/p/w500${posterPath}` }}
              style={styles.poster}
              resizeMode="cover"
            />
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.date}>
            {formatDisplayDate(releaseDate) || 'Coming soon'}
          </Text>
          <Text style={styles.mediaType}>{mediaType === 'tv' ? 'Series' : 'Movie'}</Text>

          <TouchableOpacity
            style={[styles.button, isSaved && styles.savedButton]}
            onPress={saveMovie}
            disabled={isSaved}
          >
            <Text style={[styles.buttonText, isSaved && styles.savedButtonText]}>
              {isSaved ? 'Saved to Watchlist' : 'Save to Watchlist'}
            </Text>
          </TouchableOpacity>

          {trailer ? (
            <TouchableOpacity
              style={styles.trailerButton}
              onPress={openTrailer}
              accessibilityRole="link"
            >
              <Text style={styles.trailerButtonText}>Watch Trailer</Text>
            </TouchableOpacity>
          ) : null}

          {(visibleProviders.length > 0 ||
            genres.length > 0 ||
            certification ||
            runtime) && (
            <View style={styles.quickMetaRow}>
              <Text style={styles.quickMetaText}>
                {[
                  visibleProviders[0],
                  formatRuntime(runtime),
                  genres[0],
                  certification,
                  Number.isFinite(rating) && rating > 0
                    ? `⭐ ${rating.toFixed(1)}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          )}

          <Text style={styles.section}>About</Text>
          <Text style={styles.overview}>
            {overview || 'No description available.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  scroll: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 55,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  poster: {
    borderRadius: 12,
    height: DETAILS_POSTER_WIDTH * 1.5,
    width: DETAILS_POSTER_WIDTH,
  },
  posterWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 13, 18, 0.52)',
    paddingBottom: 16,
    paddingTop: 86,
  },
  content: {
    backgroundColor: 'rgba(15, 17, 21, 0.9)',
    padding: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  date: {
    color: '#EF233C',
    marginVertical: 10,
  },
  mediaType: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#EF233C',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  savedButton: {
    backgroundColor: '#1B1F27',
    borderColor: '#2A2E36',
    borderWidth: 1,
  },
  savedButtonText: {
    color: '#9CA3AF',
  },
  trailerButton: {
    alignItems: 'center',
    borderColor: '#EF233C',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 15,
    padding: 12,
  },
  trailerButtonText: {
    color: '#EF233C',
    fontWeight: '800',
  },
  quickMetaRow: {
    marginBottom: 12,
  },
  quickMetaText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  section: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 20,
    fontWeight: '700',
  },
  overview: {
    color: '#9CA3AF',
    marginTop: 10,
    lineHeight: 22,
  },
});
