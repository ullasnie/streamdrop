import { getTmdb } from './tmdb-api';

export type ProviderRegion = 'IN' | 'US';

export type StreamingProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

export type StreamingProviderOption = {
  key: string;
  label: string;
};

const FEATURED_PROVIDER_IDS = new Set([
  8, // Netflix
  9, // Amazon Prime Video (US)
  15, // Hulu
  119, // Amazon Prime Video (India)
  337, // Disney+
  350, // Apple TV+
  619, // JioHotstar
  1899, // Max
]);

export const FALLBACK_PROVIDERS: Record<ProviderRegion, StreamingProvider[]> = {
  IN: [
    { provider_id: 232, provider_name: 'ZEE5', logo_path: null },
    { provider_id: 237, provider_name: 'Sony LIV', logo_path: null },
    { provider_id: 532, provider_name: 'aha', logo_path: null },
    { provider_id: 309, provider_name: 'Sun NXT', logo_path: null },
    { provider_id: 11, provider_name: 'MUBI', logo_path: null },
    { provider_id: 283, provider_name: 'Crunchyroll', logo_path: null },
  ],
  US: [
    { provider_id: 386, provider_name: 'Peacock', logo_path: null },
    { provider_id: 531, provider_name: 'Paramount Plus', logo_path: null },
    { provider_id: 283, provider_name: 'Crunchyroll', logo_path: null },
    { provider_id: 11, provider_name: 'MUBI', logo_path: null },
    { provider_id: 191, provider_name: 'Kanopy', logo_path: null },
    { provider_id: 73, provider_name: 'Tubi TV', logo_path: null },
  ],
};

export const providerKey = (providerId: number, region: ProviderRegion) =>
  `tmdb-${providerId}-${region}`;

export const providerOptions = (
  providers: StreamingProvider[],
  region: ProviderRegion,
  includeRegion = false
): StreamingProviderOption[] =>
  providers.map((provider) => ({
    key: providerKey(provider.provider_id, region),
    label: includeRegion
      ? `${provider.provider_name} (${region === 'IN' ? 'India' : 'US'})`
      : provider.provider_name,
  }));

export const loadStreamingProviders = async (
  region: ProviderRegion
): Promise<StreamingProvider[]> => {
  if (__DEV__) return FALLBACK_PROVIDERS[region];

  try {
    const response = await getTmdb('watch/providers/movie', {
      watch_region: region,
    });
    return (response.data.results || [])
      .filter(
        (provider: StreamingProvider) =>
          !FEATURED_PROVIDER_IDS.has(provider.provider_id)
      )
      .slice(0, 40);
  } catch {
    return FALLBACK_PROVIDERS[region];
  }
};
