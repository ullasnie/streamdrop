import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  ANALYTICS_ENABLED_KEY,
  trackEvent,
} from '../../constants/analytics';
import { AppLogoLink } from '../../components/app-logo-link';
import { AmbientBackground } from '../../components/ambient-background';
import {
  FALLBACK_PROVIDERS,
  loadStreamingProviders,
  providerOptions,
  StreamingProviderOption,
} from '../../constants/streaming-providers';

const PREF_LANGUAGE_KEY = 'preferredLanguageV3';
const PREF_PLATFORM_KEY = 'preferredPlatform';
const PREF_GENRE_KEY = 'preferredGenre';
const PREF_HOME_LANGUAGES_KEY = 'homeSelectedLanguagesV2';
const PREF_HOME_PLATFORMS_KEY = 'homeSelectedPlatformsV1';
const PREF_HOME_GENRES_KEY = 'homeSelectedGenresV1';
const PREF_CONTENT_TYPES_KEY = 'preferredContentTypesV1';
const PREF_RELEASE_MONTHS_KEY = 'releaseWindowMonths';
const PREF_PROVIDER_LABELS_KEY = 'streamingProviderNamesV1';
const PREF_HIDDEN_TITLES_KEY = 'hiddenHomeTitlesV1';
const HOME_TOUR_SEEN_KEY = 'homeTourSeenV2';
const HOME_TOUR_ACTIVE_STEP_KEY = 'homeTourActiveStepV2';
const HOME_TOUR_AUDIENCE_KEY = 'homeTourAudienceV2';
const ALERTS_ENABLED_KEY = 'alertsEnabled';
const FRIDAY_NOTIFICATION_ID_KEY = 'fridayNotificationId';
const SCREEN_TOP_PADDING = Platform.OS === 'web' ? 34 : 70;
const tmdbLogo = require('../../assets/images/tmdb-logo.svg');

const languages = [
  { label: 'All', code: 'all' },
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Tamil', code: 'ta' },
  { label: 'Telugu', code: 'te' },
  { label: 'Malayalam', code: 'ml' },
  { label: 'Kannada', code: 'kn' },
  { label: 'Korean', code: 'ko' },
  { label: 'Spanish', code: 'es' },
  { label: 'Japanese', code: 'ja' },
  { label: 'French', code: 'fr' },
  { label: 'German', code: 'de' },
  { label: 'Italian', code: 'it' },
  { label: 'Portuguese', code: 'pt' },
  { label: 'Chinese', code: 'zh' },
  { label: 'Arabic', code: 'ar' },
  { label: 'Turkish', code: 'tr' },
  { label: 'Thai', code: 'th' },
  { label: 'Indonesian', code: 'id' },
];

const platforms = [
  { label: 'All', key: 'all' },
  { label: 'Netflix', key: 'netflix' },
  { label: 'Prime', key: 'prime' },
  { label: 'Disney+', key: 'disney' },
  { label: 'Hulu', key: 'hulu' },
  { label: 'Hotstar', key: 'hotstar' },
  { label: 'Apple TV', key: 'apple-tv' },
  { label: 'HBO Max', key: 'hbo-max' },
  { label: 'ZEE5', key: 'tmdb-232-IN' },
  { label: 'Sony LIV', key: 'tmdb-237-IN' },
  { label: 'aha', key: 'tmdb-532-IN' },
  { label: 'Sun NXT', key: 'tmdb-309-IN' },
  { label: 'MUBI (India)', key: 'tmdb-11-IN' },
  { label: 'Crunchyroll (India)', key: 'tmdb-283-IN' },
  { label: 'Peacock', key: 'tmdb-386-US' },
  { label: 'Paramount+', key: 'tmdb-531-US' },
  { label: 'Crunchyroll (US)', key: 'tmdb-283-US' },
  { label: 'MUBI (US)', key: 'tmdb-11-US' },
  { label: 'Kanopy', key: 'tmdb-191-US' },
  { label: 'Tubi', key: 'tmdb-73-US' },
];

const genres = [
  { label: 'All', key: 'all' },
  { label: 'Action', key: 'action' },
  { label: 'Comedy', key: 'comedy' },
  { label: 'Drama', key: 'drama' },
  { label: 'Romance', key: 'romance' },
  { label: 'Thriller', key: 'thriller' },
  { label: 'Family', key: 'family' },
  { label: 'Adventure', key: 'adventure' },
  { label: 'Animation', key: 'animation' },
  { label: 'Crime', key: 'crime' },
  { label: 'Documentary', key: 'documentary' },
  { label: 'Fantasy', key: 'fantasy' },
  { label: 'History', key: 'history' },
  { label: 'Horror', key: 'horror' },
  { label: 'Music', key: 'music' },
  { label: 'Mystery', key: 'mystery' },
  { label: 'Science Fiction', key: 'science-fiction' },
  { label: 'TV Movie', key: 'tv-movie' },
  { label: 'War', key: 'war' },
  { label: 'Western', key: 'western' },
];

const releaseWindows = [
  { label: '1 Month', value: 1 },
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
];

const contentTypes = [
  { label: 'Movies', key: 'movie' },
  { label: 'Series', key: 'tv' },
];

type ActiveSetting = 'content' | 'language' | 'platform' | 'genre' | 'window' | null;
type HiddenTitle = {
  key: string;
  title: string;
  mediaType: 'movie' | 'tv';
};

const parseStoredList = (value: string | null, fallback: string[]) => {
  const parsed = value?.split(',').map((item) => item.trim()).filter(Boolean);
  return parsed?.length ? parsed : fallback;
};

const toggleAllSelection = (selected: string[], key: string) => {
  if (key === 'all') return ['all'];

  const withoutAll = selected.filter((item) => item !== 'all');
  const next = withoutAll.includes(key)
    ? withoutAll.filter((item) => item !== key)
    : [...withoutAll, key];

  return next.length ? next : ['all'];
};

export default function SettingsScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [selectedLanguages, setSelectedLanguages] = useState(['all']);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['all']);
  const [selectedGenres, setSelectedGenres] = useState(['all']);
  const [selectedContentTypes, setSelectedContentTypes] = useState(['movie', 'tv']);
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);
  const [providerLabels, setProviderLabels] = useState<Record<string, string>>({});
  const [providerCatalog, setProviderCatalog] = useState<StreamingProviderOption[]>([
    ...providerOptions(FALLBACK_PROVIDERS.IN, 'IN', true),
    ...providerOptions(FALLBACK_PROVIDERS.US, 'US', true),
  ]);
  const [activeSetting, setActiveSetting] = useState<ActiveSetting>(null);
  const [hiddenTitles, setHiddenTitles] = useState<HiddenTitle[]>([]);
  const [settingsTourVisible, setSettingsTourVisible] = useState(false);

  const loadSettings = useCallback(async () => {
    const entries = await AsyncStorage.multiGet([
      ALERTS_ENABLED_KEY,
      ANALYTICS_ENABLED_KEY,
      PREF_HOME_LANGUAGES_KEY,
      PREF_HOME_PLATFORMS_KEY,
      PREF_HOME_GENRES_KEY,
      PREF_CONTENT_TYPES_KEY,
      PREF_LANGUAGE_KEY,
      PREF_PLATFORM_KEY,
      PREF_GENRE_KEY,
      PREF_RELEASE_MONTHS_KEY,
      PREF_PROVIDER_LABELS_KEY,
      PREF_HIDDEN_TITLES_KEY,
      HOME_TOUR_SEEN_KEY,
      HOME_TOUR_ACTIVE_STEP_KEY,
    ]);
    const values = Object.fromEntries(entries);
    const languagesValue = parseStoredList(
      values[PREF_HOME_LANGUAGES_KEY],
      values[PREF_LANGUAGE_KEY] ? [values[PREF_LANGUAGE_KEY]] : ['all']
    );
    const platformsValue = parseStoredList(
      values[PREF_HOME_PLATFORMS_KEY],
      values[PREF_PLATFORM_KEY] ? [values[PREF_PLATFORM_KEY]] : ['all']
    );
    const genresValue = parseStoredList(
      values[PREF_HOME_GENRES_KEY],
      values[PREF_GENRE_KEY] ? [values[PREF_GENRE_KEY]] : ['all']
    );
    let storedProviderLabels: Record<string, string> = {};
    try {
      storedProviderLabels = JSON.parse(values[PREF_PROVIDER_LABELS_KEY] || '{}');
    } catch {
      storedProviderLabels = {};
    }

    setAlertsEnabled(values[ALERTS_ENABLED_KEY] === 'true');
    setAnalyticsEnabled(values[ANALYTICS_ENABLED_KEY] !== 'false');
    setSelectedLanguages(languagesValue);
    setSelectedPlatforms(platformsValue);
    setSelectedGenres(genresValue);
    setSelectedContentTypes(
      parseStoredList(values[PREF_CONTENT_TYPES_KEY], ['movie', 'tv'])
    );
    setProviderLabels(storedProviderLabels);
    try {
      const parsed = JSON.parse(values[PREF_HIDDEN_TITLES_KEY] || '[]');
      setHiddenTitles(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHiddenTitles([]);
    }
    const showSettingsTour =
      values[HOME_TOUR_SEEN_KEY] !== 'true' &&
      values[HOME_TOUR_ACTIVE_STEP_KEY] === '2';
    setSettingsTourVisible(showSettingsTour);
    if (showSettingsTour) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 0);
    }
    if (values[PREF_RELEASE_MONTHS_KEY]) {
      setReleaseWindowMonths(Number(values[PREF_RELEASE_MONTHS_KEY]) || 3);
    }

    await AsyncStorage.multiSet([
      [PREF_HOME_LANGUAGES_KEY, languagesValue.join(',')],
      [PREF_HOME_PLATFORMS_KEY, platformsValue.join(',')],
      [PREF_HOME_GENRES_KEY, genresValue.join(',')],
    ]);

    const [indiaProviders, usProviders] = await Promise.all([
      loadStreamingProviders('IN'),
      loadStreamingProviders('US'),
    ]);
    const catalog = [
      ...providerOptions(indiaProviders, 'IN', true),
      ...providerOptions(usProviders, 'US', true),
    ];
    const resolvedLabels = {
      ...storedProviderLabels,
      ...Object.fromEntries(catalog.map((provider) => [provider.key, provider.label])),
    };
    setProviderCatalog(catalog);
    setProviderLabels(resolvedLabels);
    await AsyncStorage.setItem(
      PREF_PROVIDER_LABELS_KEY,
      JSON.stringify(resolvedLabels)
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void trackEvent('settings_viewed');
      loadSettings();
    }, [loadSettings])
  );

  const enableFridayAlerts = async () => {
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

    await AsyncStorage.multiSet([
      [ALERTS_ENABLED_KEY, 'true'],
      [FRIDAY_NOTIFICATION_ID_KEY, notificationId],
    ]);
    setAlertsEnabled(true);
  };

  const disableFridayAlerts = async () => {
    const notificationId = await AsyncStorage.getItem(FRIDAY_NOTIFICATION_ID_KEY);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }

    await AsyncStorage.multiRemove([
      ALERTS_ENABLED_KEY,
      FRIDAY_NOTIFICATION_ID_KEY,
    ]);
    setAlertsEnabled(false);
  };

  const toggleFridayAlerts = async (enabled: boolean) => {
    void trackEvent('alerts_changed');
    if (enabled) {
      await enableFridayAlerts();
      return;
    }

    await disableFridayAlerts();
  };

  const toggleAnalytics = async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await AsyncStorage.setItem(ANALYTICS_ENABLED_KEY, String(enabled));
  };

  const selectLanguage = async (code: string) => {
    const next = toggleAllSelection(selectedLanguages, code);
    setSelectedLanguages(next);
    await AsyncStorage.setItem(PREF_HOME_LANGUAGES_KEY, next.join(','));
  };

  const selectPlatform = async (key: string) => {
    const next = toggleAllSelection(selectedPlatforms, key);
    setSelectedPlatforms(next);
    await AsyncStorage.setItem(PREF_HOME_PLATFORMS_KEY, next.join(','));
  };

  const selectGenre = async (key: string) => {
    const next = toggleAllSelection(selectedGenres, key);
    setSelectedGenres(next);
    await AsyncStorage.setItem(PREF_HOME_GENRES_KEY, next.join(','));
  };

  const selectContentType = async (key: string) => {
    const next = selectedContentTypes.includes(key)
      ? selectedContentTypes.filter((item) => item !== key)
      : [...selectedContentTypes, key];
    if (!next.length) return;
    setSelectedContentTypes(next);
    await AsyncStorage.setItem(PREF_CONTENT_TYPES_KEY, next.join(','));
  };

  const selectReleaseWindow = async (months: number) => {
    setReleaseWindowMonths(months);
    setActiveSetting(null);
    await AsyncStorage.setItem(PREF_RELEASE_MONTHS_KEY, String(months));
  };

  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  const finishSettingsTour = async (goHome: boolean) => {
    setSettingsTourVisible(false);
    await AsyncStorage.multiSet([
      [HOME_TOUR_SEEN_KEY, 'true'],
      [HOME_TOUR_ACTIVE_STEP_KEY, ''],
    ]);
    if (goHome) router.replace('/');
  };

  const replayFeatureTour = async () => {
    await AsyncStorage.multiSet([
      [HOME_TOUR_SEEN_KEY, 'false'],
      [HOME_TOUR_ACTIVE_STEP_KEY, '0'],
      [HOME_TOUR_AUDIENCE_KEY, 'new'],
    ]);
    router.replace('/');
  };

  const knownPlatformOptions = [
    ...platforms,
    ...providerCatalog,
    ...Object.entries(providerLabels).map(([key, label]) => ({ key, label })),
  ];
  const knownPlatformLabels = new Map(
    knownPlatformOptions.map((item) => [item.key, item.label])
  );
  const editablePlatforms = [
    ...new Map(
      [
        ...knownPlatformOptions,
        ...selectedPlatforms.map((key) => ({
          key,
          label:
            knownPlatformLabels.get(key) ||
            (key.startsWith('tmdb-')
              ? `Streaming service ${key.split('-')[1]}`
              : key),
        })),
      ].map((item) => [item.key, item])
    ).values(),
  ];

  const settingOptions =
    activeSetting === 'content'
      ? contentTypes.map((item) => ({
          key: item.key,
          label: item.label,
          selected: selectedContentTypes.includes(item.key),
          onPress: () => selectContentType(item.key),
        }))
      : activeSetting === 'language'
      ? languages.map((item) => ({
          key: item.code,
          label: item.label,
          selected: selectedLanguages.includes(item.code),
          onPress: () => selectLanguage(item.code),
        }))
      : activeSetting === 'platform'
        ? editablePlatforms.map((item) => ({
            key: item.key,
            label: item.label,
            selected: selectedPlatforms.includes(item.key),
            onPress: () => selectPlatform(item.key),
          }))
        : activeSetting === 'genre'
          ? genres.map((item) => ({
              key: item.key,
              label: item.label,
              selected: selectedGenres.includes(item.key),
              onPress: () => selectGenre(item.key),
            }))
          : activeSetting === 'window'
            ? releaseWindows.map((item) => ({
                key: String(item.value),
                label: item.label,
                selected: releaseWindowMonths === item.value,
                onPress: () => selectReleaseWindow(item.value),
              }))
            : [];

  const renderSettingCard = (
    label: string,
    selectedKeys: string[],
    options: { label: string; key?: string; code?: string }[],
    setting: Exclude<ActiveSetting, null>,
    onToggle: (key: string) => void
  ) => {
    return (
      <View style={styles.settingCard}>
        <View style={styles.settingCardTopRow}>
          <Text style={styles.settingCardLabel}>{label}</Text>
          <Pressable
            accessibilityLabel={`Add ${label}`}
            style={styles.addPreferenceButton}
            onPress={() => setActiveSetting(setting)}
          >
            <Text style={styles.addPreferenceText}>+ Add</Text>
          </Pressable>
        </View>
        <View style={styles.selectedPreferenceRow}>
          {selectedKeys.map((key) => (
            <View key={key} style={styles.selectedPreferenceChip}>
              <Text style={styles.selectedPreferenceText} numberOfLines={1}>
                {options.find((item) => item.key === key || item.code === key)
                  ?.label || (key.startsWith('tmdb-') ? `Service ${key.split('-')[1]}` : key)}
              </Text>
              {key !== 'all' && setting !== 'window' && (
                <Pressable onPress={() => onToggle(key)} hitSlop={8}>
                  <Text style={styles.removePreferenceText}>×</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <AmbientBackground />
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
      <AppLogoLink style={styles.logo} />
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Preferences</Text>
      {settingsTourVisible && (
        <View style={styles.settingsTourCard}>
          <Text style={styles.settingsTourEyebrow}>3 OF 3</Text>
          <Text style={styles.settingsTourTitle}>Your preferences</Text>
          <Text style={styles.settingsTourBody}>
            Update content types, streaming services, languages, genres, and release window here.
            {hiddenTitles.length > 0
              ? ' You can also manage titles you’ve hidden from Home below.'
              : ''}
          </Text>
          <View style={styles.settingsTourActions}>
            <Pressable
              onPress={() => void finishSettingsTour(false)}
              style={styles.settingsTourSecondary}
            >
              <Text style={styles.settingsTourSecondaryText}>Stay in Settings</Text>
            </Pressable>
            <Pressable
              onPress={() => void finishSettingsTour(true)}
              style={styles.settingsTourPrimary}
            >
              <Text style={styles.settingsTourPrimaryText}>Go to Home</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={styles.defaultsGrid}>
        {renderSettingCard('Content types', selectedContentTypes, contentTypes, 'content', selectContentType)}
        {renderSettingCard('Languages', selectedLanguages, languages, 'language', selectLanguage)}
        {renderSettingCard('Streaming services', selectedPlatforms, editablePlatforms, 'platform', selectPlatform)}
        {renderSettingCard('Genres', selectedGenres, genres, 'genre', selectGenre)}
        {renderSettingCard('Release Window', [String(releaseWindowMonths)], releaseWindows.map((item) => ({ label: item.label, key: String(item.value) })), 'window', (key) => selectReleaseWindow(Number(key)))}
      </View>

      {hiddenTitles.length > 0 && (
        <>
          <Text style={styles.section}>Hidden titles</Text>
          <Pressable
            accessibilityLabel={`Manage ${hiddenTitles.length} hidden titles`}
            onPress={() => router.push('/hidden-titles')}
            style={styles.hiddenTitlesSummary}
          >
            <View style={styles.hiddenTitleCopy}>
              <Text style={styles.hiddenTitleName}>Hidden titles</Text>
              <Text style={styles.hiddenTitlesHint}>
                {hiddenTitles.length} {hiddenTitles.length === 1 ? 'title' : 'titles'} hidden from Home
              </Text>
            </View>
            <Text style={styles.manageHiddenText}>Manage ›</Text>
          </Pressable>
        </>
      )}

      {Platform.OS !== 'web' && (
        <>
          <Text style={styles.section}>Notifications</Text>
          <View style={styles.panel}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>Friday drop alerts</Text>
                <Text style={styles.description}>A weekly reminder for weekend watches.</Text>
              </View>
              <Switch
                value={alertsEnabled}
                onValueChange={toggleFridayAlerts}
                trackColor={{ false: '#2A2E36', true: '#3A1118' }}
                thumbColor={alertsEnabled ? '#EF233C' : '#9CA3AF'}
              />
            </View>
          </View>
        </>
      )}

      {activeSetting && (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => setActiveSetting(null)}
        >
          <View style={styles.preferenceModalBackdrop}>
            <View style={styles.settingPanel}>
              <View style={styles.settingPanelHeader}>
                <Text style={styles.settingPanelTitle}>
                  {activeSetting === 'platform'
                    ? 'Streaming'
                    : activeSetting === 'content'
                      ? 'Content types'
                    : activeSetting === 'window'
                      ? 'Release Window'
                      : activeSetting
                        ? activeSetting[0].toUpperCase() + activeSetting.slice(1)
                        : 'Preferences'}
                </Text>
                <Pressable
                  accessibilityLabel="Close preferences"
                  hitSlop={12}
                  onPress={() => setActiveSetting(null)}
                >
                  <Text style={styles.settingPanelClose}>Done</Text>
                </Pressable>
              </View>
              <Text style={styles.settingPanelHint}>Tap options to add or remove them.</Text>
              <ScrollView
                contentContainerStyle={styles.settingOptionGrid}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={styles.settingOptionsScroll}
              >
                {settingOptions.map((item) => (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.chip,
                      item.selected && styles.chipSelected,
                    ]}
                    onPress={item.onPress}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        item.selected && styles.chipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <Text style={styles.section}>About</Text>
      <View style={styles.creditsPanel}>
        <ExpoImage
          source={tmdbLogo}
          style={styles.tmdbLogo}
          contentFit="contain"
        />
        <Text style={styles.notice}>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </Text>
        <Text style={styles.complianceNote}>
          Movie and series data and images are provided by TMDB and used with attribution.
        </Text>
        <View style={styles.linkRow}>
          <Pressable
            style={styles.linkButton}
            onPress={() => openUrl('https://www.themoviedb.org')}
          >
            <Text style={styles.linkText}>TMDB</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() =>
              openUrl('https://www.themoviedb.org/api-terms-of-use')
            }
          >
            <Text style={styles.linkText}>API Terms</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() =>
              openUrl('https://www.themoviedb.org/about/logos-attribution')
            }
          >
            <Text style={styles.linkText}>Attribution</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>Help & Privacy</Text>
      {Platform.OS === 'ios' && (
        <View style={styles.panel}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Share anonymous usage counts</Text>
              <Text style={styles.description}>
                Sends only feature counters. No identity, search text, location,
                or device identifier.
              </Text>
            </View>
            <Switch
              value={analyticsEnabled}
              onValueChange={toggleAnalytics}
              trackColor={{ false: '#2A2E36', true: '#3A1118' }}
              thumbColor={analyticsEnabled ? '#EF233C' : '#9CA3AF'}
            />
          </View>
        </View>
      )}
      <Pressable
        accessibilityLabel="Replay feature tour"
        style={styles.feedbackButton}
        onPress={() => void replayFeatureTour()}
      >
        <Text style={styles.feedbackText}>Replay Feature Tour</Text>
      </Pressable>
      <Text style={styles.feedbackHint}>
        Review the Home, Not Interested, and Settings highlights.
      </Text>

      <Pressable
        style={styles.feedbackButton}
        onPress={() => router.push('/support')}
      >
        <Text style={styles.feedbackText}>Help & Support</Text>
      </Pressable>
      <Text style={styles.feedbackHint}>
        Troubleshooting and contact information for StreamDrop.
      </Text>

      <Pressable
        style={styles.feedbackButton}
        onPress={() => router.push('/privacy')}
      >
        <Text style={styles.feedbackText}>Privacy Policy</Text>
      </Pressable>
      <Text style={styles.feedbackHint}>
        See how StreamDrop handles local preferences and network requests.
      </Text>

      <Pressable
        style={styles.feedbackButton}
        onPress={() => router.push('/feedback')}
      >
        <Text style={styles.feedbackText}>Share Feedback</Text>
      </Pressable>
      <Text style={styles.feedbackHint}>
        Answer three quick questions to help improve StreamDrop.
      </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0F1115',
    flex: 1,
    position: 'relative',
  },
  container: {
    flex: 1,
    paddingTop: SCREEN_TOP_PADDING,
  },
  content: {
    paddingBottom: 120,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginHorizontal: 16,
    marginBottom: 18,
  },
  logo: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  panel: {
    borderWidth: 1,
    borderColor: '#242832',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 22,
    padding: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    paddingRight: 18,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  section: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  defaultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  settingsTourCard: {
    backgroundColor: '#181C24',
    borderColor: '#EF233C',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    marginHorizontal: 16,
    padding: 14,
  },
  settingsTourEyebrow: {
    color: '#EF233C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  settingsTourTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  settingsTourBody: {
    color: '#AEB4BE',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  settingsTourActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  settingsTourSecondary: {
    borderColor: '#3A414D',
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  settingsTourSecondaryText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '800',
  },
  settingsTourPrimary: {
    backgroundColor: '#EF233C',
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  settingsTourPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  settingCard: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  settingCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addPreferenceButton: {
    borderColor: '#3A414D',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addPreferenceText: {
    color: '#EF233C',
    fontSize: 11,
    fontWeight: '900',
  },
  selectedPreferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  selectedPreferenceChip: {
    alignItems: 'center',
    backgroundColor: '#242832',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedPreferenceText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  hiddenTitlesSummary: {
    alignItems: 'center',
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginHorizontal: 16,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hiddenTitlesHint: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  hiddenTitleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  hiddenTitleName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  manageHiddenText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  removePreferenceText: {
    color: '#EF233C',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
  },
  preferenceModalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  settingCardLabel: {
    color: '#6B7280',
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    paddingRight: 8,
    textTransform: 'uppercase',
  },
  settingPanel: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '90%',
    width: '100%',
    padding: 12,
  },
  settingPanelHint: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  settingPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingPanelTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  settingPanelClose: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  settingOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  settingOptionsScroll: {
    flexShrink: 1,
  },
  chip: {
    alignItems: 'center',
    borderColor: '#2A2E36',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 18,
  },
  chipSelected: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  creditsPanel: {
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 22,
    padding: 16,
  },
  tmdbLogo: {
    height: 48,
    width: 72,
    marginBottom: 12,
  },
  notice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  complianceNote: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  linkButton: {
    borderColor: '#2A2E36',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  linkText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackButton: {
    alignItems: 'center',
    backgroundColor: '#EF233C',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackHint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 16,
    marginTop: 8,
  },
});
