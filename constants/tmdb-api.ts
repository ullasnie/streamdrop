import axios from 'axios';
import { Platform } from 'react-native';

const configuredProxyUrl =
  process.env.EXPO_PUBLIC_TMDB_PROXY_URL?.replace(/\/$/, '');
const productionProxyUrl = 'https://streamdrop-eight.vercel.app/api/tmdb';

const getProxyUrl = () => {
  if (configuredProxyUrl) return configuredProxyUrl;
  if (Platform.OS === 'web') return '/api/tmdb';
  return productionProxyUrl;
};

export const getTmdb = (path: string, params: Record<string, unknown> = {}) =>
  axios.get(getProxyUrl(), {
    params: {
      path,
      ...params,
    },
  });
