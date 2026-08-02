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
  | 'not_interested_weekend'
  | 'not_interested_recent_movies'
  | 'not_interested_new_series'
  | 'filter_changed'
  | 'alerts_changed';

export type FeedbackEvent =
  | 'feedback_useful'
  | 'feedback_useful_okay'
  | 'feedback_useful_not_yet'
  | 'feedback_discovery_easy'
  | 'feedback_discovery_somewhat'
  | 'feedback_discovery_hard'
  | 'feedback_accuracy_good'
  | 'feedback_accuracy_mostly'
  | 'feedback_accuracy_needs_work';

const sendEvent = async (event: AnalyticsEvent | FeedbackEvent) => {
  if (__DEV__) return true;
  if (Platform.OS !== 'ios') return false;

  try {
    const response = await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const trackEvent = async (event: AnalyticsEvent) => {
  if (__DEV__ || Platform.OS !== 'ios') return;
  const analyticsEnabled = await AsyncStorage.getItem(ANALYTICS_ENABLED_KEY);
  if (analyticsEnabled === 'false') return;

  await sendEvent(event);
};

export const submitFeedbackEvent = (event: FeedbackEvent) => sendEvent(event);
