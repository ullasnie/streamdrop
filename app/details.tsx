import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { emitWatchlistUpdated } from '../constants/watchlist-events';

const TMDB_API_KEY = '92b45ae5994028d3786552aad05e5a4d';

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

export default function DetailsScreen() {
  const params = useLocalSearchParams();
  const initialRuntime = Number(params.runtime);
  const [runtime, setRuntime] = useState<number | null>(
    Number.isFinite(initialRuntime) && initialRuntime > 0 ? initialRuntime : null
  );
  const [isSaved, setIsSaved] = useState(false);

  const id = Number(params.id);
  const title = String(params.title || '');
  const releaseDate = String(params.releaseDate || '');
  const posterPath = String(params.posterPath || '');
  const overview = String(params.overview || '');
  const providers = parseListParam(params.providers);
  const genres = parseListParam(params.genres);
  const certification = String(params.certification || '');
  const visibleProviders = cleanProviderList(providers);

  useEffect(() => {
    const fetchRuntime = async () => {
      if (!Number.isFinite(id)) return;

      try {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
          params: { api_key: TMDB_API_KEY },
        });
        setRuntime(res.data.runtime || null);
      } catch (error) {
        console.log('Runtime fetch error:', error);
      }
    };

    fetchRuntime();
  }, [id]);

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
        runtime,
      };

      const alreadySaved = watchlist.some((m: any) => m.title === title);

      if (!alreadySaved) {
        watchlist.push(movie);
        await AsyncStorage.setItem('watchlist', JSON.stringify(watchlist));
        setIsSaved(true);
        emitWatchlistUpdated();
        Alert.alert('Saved', 'Added to watchlist');
      } else {
        setIsSaved(true);
      }
    } catch (error) {
      console.log('Error saving:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scroll}>
        {posterPath ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w500${posterPath}` }}
            style={styles.poster}
          />
        ) : null}

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.date}>
            {formatDisplayDate(releaseDate) || 'Coming soon'}
          </Text>

          <TouchableOpacity
            style={[styles.button, isSaved && styles.savedButton]}
            onPress={saveMovie}
            disabled={isSaved}
          >
            <Text style={[styles.buttonText, isSaved && styles.savedButtonText]}>
              {isSaved ? 'Saved to Watchlist' : 'Save to Watchlist'}
            </Text>
          </TouchableOpacity>

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
  backButton: {
    position: 'absolute',
    top: 55,
    left: 16,
    zIndex: 10,
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
    width: '100%',
    height: 500,
  },
  content: {
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
  button: {
    backgroundColor: '#EF233C',
    padding: 12,
    borderRadius: 10,
    marginVertical: 15,
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
