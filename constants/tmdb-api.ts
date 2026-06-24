import axios from 'axios';
import { Platform } from 'react-native';

const configuredProxyUrl =
  process.env.EXPO_PUBLIC_TMDB_PROXY_URL?.replace(/\/$/, '');

const getProxyUrl = () => {
  if (configuredProxyUrl) return configuredProxyUrl;
  if (Platform.OS === 'web') return '/api/tmdb';

  throw new Error(
    'EXPO_PUBLIC_TMDB_PROXY_URL must point to the deployed TMDB proxy.'
  );
};

export const getTmdb = (path: string, params: Record<string, unknown> = {}) =>
  axios.get(getProxyUrl(), {
    params: {
      path,
      ...params,
    },
  });
