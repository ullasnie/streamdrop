import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    FlatList,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { emitWatchlistUpdated } from '../../constants/watchlist-events';

const SCREEN_TOP_PADDING = Platform.OS === 'web' ? 34 : 70;

type SavedMovie = {
  id?: number; // optional for old data
  title: string;
  posterPath: string;
  releaseDate: string;
  overview: string;
  providers?: string[];
  genres?: string[];
  certification?: string;
  runtime?: number | null;
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

export default function WatchlistScreen() {
  const [movies, setMovies] = useState<SavedMovie[]>([]);

  const loadWatchlist = async () => {
    try {
      const data = await AsyncStorage.getItem('watchlist');
      const parsed = data ? JSON.parse(data) : [];
      setMovies(parsed);
    } catch (error) {
      console.log('Error loading watchlist:', error);
    }
  };

  const removeMovie = async (movie: SavedMovie) => {
    const updated = movies.filter((m) => {
      if (movie.id && m.id) {
        return m.id !== movie.id;
      }
      return m.title !== movie.title; // fallback for old data
    });

    setMovies(updated);
    await AsyncStorage.setItem('watchlist', JSON.stringify(updated));
    emitWatchlistUpdated();
  };

  const openDetails = (movie: SavedMovie) => {
    router.push({
      pathname: '/details',
      params: {
        id: movie.id ? String(movie.id) : '',
        title: movie.title,
        releaseDate: movie.releaseDate,
        posterPath: movie.posterPath || '',
        overview: movie.overview || '',
        providers: JSON.stringify(movie.providers || []),
        genres: JSON.stringify(movie.genres || []),
        certification: movie.certification || '',
        runtime: movie.runtime ? String(movie.runtime) : '',
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Watchlist</Text>

      {movies.length === 0 ? (
        <Text style={styles.empty}>No saved movies</Text>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={(item, index) =>
            item.id ? item.id.toString() : index.toString()
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable onPress={() => openDetails(item)}>
                {item.posterPath ? (
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/w500${item.posterPath}`,
                    }}
                    style={styles.poster}
                  />
                ) : null}

                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.date}>{formatDisplayDate(item.releaseDate)}</Text>
              </Pressable>

              <Pressable
                style={styles.remove}
                onPress={() => removeMovie(item)}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
    paddingTop: SCREEN_TOP_PADDING,
  },
  header: {
    color: '#FFFFFF',
    fontSize: 26,
    margin: 16,
    fontWeight: '800',
  },
  empty: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 50,
  },
  card: {
    margin: 16,
  },
  poster: {
    width: '100%',
    height: 220,
    borderRadius: 10,
  },
  title: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  date: {
    color: '#EF233C',
    marginTop: 4,
  },
  remove: {
    marginTop: 10,
    backgroundColor: '#333333',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeText: {
    color: '#FFFFFF',
  },
});
