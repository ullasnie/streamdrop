import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const ANALYTICS_ENABLED_KEY = 'analyticsEnabled';

const ANALYTICS_URL = 'https://streamdrop-eight.vercel.app/api/analytics';

export type AnalyticsEvent =
  | 'home_viewed'
  | 'settings_viewed'
  | 'watchlist_viewed'
  | 'movie_opened'
  | 'watchlist_added'
  | 'watchlist_removed'
  | 'search_used'
  | 'refresh_tapped'
  | 'filter_changed'
  | 'alerts_changed';

export const trackEvent = async (event: AnalyticsEvent) => {
  if (__DEV__ || Platform.OS !== 'ios') return;

  const analyticsEnabled = await AsyncStorage.getItem(ANALYTICS_ENABLED_KEY);
  if (analyticsEnabled === 'false') return;

  try {
    await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    });
  } catch {
    // Analytics must never interrupt the app experience.
  }
};
