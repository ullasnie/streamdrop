import axios from 'axios';
import { Platform } from 'react-native';

const configuredProxyUrl =
  process.env.EXPO_PUBLIC_TMDB_PROXY_URL?.replace(/\/$/, '');
const productionApiBaseUrl = 'https://streamdrop-eight.vercel.app/api';

const getHomeFeedUrl = () => {
  if (configuredProxyUrl) {
    return configuredProxyUrl.replace(/\/tmdb$/, '/home-feed');
  }
  if (Platform.OS === 'web') return '/api/home-feed';
  return `${productionApiBaseUrl}/home-feed`;
};

export const getHomeFeed = (params: Record<string, unknown>) =>
  axios.get(getHomeFeedUrl(), { params });
