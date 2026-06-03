import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const PREF_LANGUAGE_KEY = 'preferredLanguageV3';
const PREF_PLATFORM_KEY = 'preferredPlatform';
const PREF_GENRE_KEY = 'preferredGenre';
const PREF_RELEASE_MONTHS_KEY = 'releaseWindowMonths';
const ALERTS_ENABLED_KEY = 'alertsEnabled';
const FRIDAY_NOTIFICATION_ID_KEY = 'fridayNotificationId';
const FEEDBACK_EMAIL = 'ullasnie@gmail.com';
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
];

const genres = [
  { label: 'All', key: 'all' },
  { label: 'Action', key: 'action' },
  { label: 'Comedy', key: 'comedy' },
  { label: 'Drama', key: 'drama' },
  { label: 'Romance', key: 'romance' },
  { label: 'Thriller', key: 'thriller' },
  { label: 'Family', key: 'family' },
];

const releaseWindows = [
  { label: '1 Month', value: 1 },
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
];

type ActiveSetting = 'language' | 'platform' | 'genre' | 'window' | null;

export default function SettingsScreen() {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);
  const [activeSetting, setActiveSetting] = useState<ActiveSetting>(null);

  const loadSettings = useCallback(async () => {
    const [alertVal, languageVal, platformVal, genreVal, monthsVal] =
      await Promise.all([
        AsyncStorage.getItem(ALERTS_ENABLED_KEY),
        AsyncStorage.getItem(PREF_LANGUAGE_KEY),
        AsyncStorage.getItem(PREF_PLATFORM_KEY),
        AsyncStorage.getItem(PREF_GENRE_KEY),
        AsyncStorage.getItem(PREF_RELEASE_MONTHS_KEY),
      ]);

    setAlertsEnabled(alertVal === 'true');
    if (languageVal) setSelectedLanguage(languageVal);
    if (platformVal) setSelectedPlatform(platformVal);
    if (genreVal) setSelectedGenre(genreVal);
    if (monthsVal) setReleaseWindowMonths(Number(monthsVal) || 3);
  }, []);

  useFocusEffect(
    useCallback(() => {
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
    if (enabled) {
      await enableFridayAlerts();
      return;
    }

    await disableFridayAlerts();
  };

  const selectLanguage = async (code: string) => {
    setSelectedLanguage(code);
    setActiveSetting(null);
    await AsyncStorage.setItem(PREF_LANGUAGE_KEY, code);
  };

  const selectPlatform = async (key: string) => {
    setSelectedPlatform(key);
    setActiveSetting(null);
    await AsyncStorage.setItem(PREF_PLATFORM_KEY, key);
  };

  const selectGenre = async (key: string) => {
    setSelectedGenre(key);
    setActiveSetting(null);
    await AsyncStorage.setItem(PREF_GENRE_KEY, key);
  };

  const selectReleaseWindow = async (months: number) => {
    setReleaseWindowMonths(months);
    setActiveSetting(null);
    await AsyncStorage.setItem(PREF_RELEASE_MONTHS_KEY, String(months));
  };

  const exitApp = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }

    Alert.alert(
      'Exit StreamDrop',
      'Use the Home gesture or app switcher to leave StreamDrop on iOS.'
    );
  };

  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  const sendFeedback = () => {
    const subject = encodeURIComponent('StreamDrop beta feedback');
    const body = encodeURIComponent(
      'What worked?\n\nWhat felt confusing?\n\nAny missing OTT releases?\n\nDevice:\n'
    );

    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
  };

  const languageLabel =
    languages.find((item) => item.code === selectedLanguage)?.label || 'All';
  const platformLabel =
    platforms.find((item) => item.key === selectedPlatform)?.label || 'All';
  const genreLabel =
    genres.find((item) => item.key === selectedGenre)?.label || 'All';
  const releaseWindowLabel =
    releaseWindows.find((item) => item.value === releaseWindowMonths)?.label ||
    '3 Months';

  const settingOptions =
    activeSetting === 'language'
      ? languages.map((item) => ({
          key: item.code,
          label: item.label,
          selected: selectedLanguage === item.code,
          onPress: () => selectLanguage(item.code),
        }))
      : activeSetting === 'platform'
        ? platforms.map((item) => ({
            key: item.key,
            label: item.label,
            selected: selectedPlatform === item.key,
            onPress: () => selectPlatform(item.key),
          }))
        : activeSetting === 'genre'
          ? genres.map((item) => ({
              key: item.key,
              label: item.label,
              selected: selectedGenre === item.key,
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
    value: string,
    setting: Exclude<ActiveSetting, null>
  ) => {
    const selected = activeSetting === setting;

    return (
      <Pressable
        style={[styles.settingCard, selected && styles.settingCardActive]}
        onPress={() => setActiveSetting(selected ? null : setting)}
      >
        <View style={styles.settingCardTopRow}>
          <Text style={styles.settingCardLabel}>{label}</Text>
          <Text
            style={[
              styles.settingChevron,
              selected && styles.settingChevronActive,
            ]}
          >
            {selected ? '⌃' : '⌄'}
          </Text>
        </View>
        <Text
          style={[
            styles.settingCardValue,
            selected && styles.settingCardValueActive,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text style={styles.settingCardHint}>Tap to change</Text>
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {Platform.OS !== 'web' && (
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
      )}

      <Text style={styles.section}>Defaults</Text>
      <View style={styles.defaultsGrid}>
        {renderSettingCard('Default Language', languageLabel, 'language')}
        {renderSettingCard('Default Streaming', platformLabel, 'platform')}
        {renderSettingCard('Default Genre', genreLabel, 'genre')}
        {renderSettingCard('Release Window', releaseWindowLabel, 'window')}
      </View>

      {activeSetting && (
        <View style={styles.settingPanel}>
          <View style={styles.settingPanelHeader}>
            <Text style={styles.settingPanelTitle}>
              {activeSetting === 'platform'
                ? 'Default Streaming'
                : activeSetting === 'window'
                  ? 'Release Window'
                  : `Default ${activeSetting}`}
            </Text>
            <Pressable onPress={() => setActiveSetting(null)}>
              <Text style={styles.settingPanelClose}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.settingOptionGrid}>
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
          </View>
        </View>
      )}

      <Text style={styles.section}>Credits</Text>
      <View style={styles.creditsPanel}>
        <ExpoImage
          source={tmdbLogo}
          style={styles.tmdbLogo}
          contentFit="contain"
        />
        <Text style={styles.notice}>
          This product uses the TMDB API but is not endorsed, certified, or
          otherwise approved by TMDB.
        </Text>
        <Text style={styles.complianceNote}>
          TMDB data and images require attribution. Commercial use requires a
          separate TMDB agreement before launch.
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

      <Text style={styles.section}>App</Text>
      <Pressable style={styles.feedbackButton} onPress={sendFeedback}>
        <Text style={styles.feedbackText}>Send Beta Feedback</Text>
      </Pressable>
      <Text style={styles.feedbackHint}>
        Opens an email draft for release misses, bugs, or quick notes.
      </Text>

      <Pressable style={styles.exitButton} onPress={exitApp}>
        <Text style={styles.exitText}>Exit StreamDrop</Text>
      </Pressable>
      <Text style={styles.exitHint}>
        Closes the app on Android. iOS controls app exit from the system.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
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
  settingCard: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '48%',
  },
  settingCardActive: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  settingCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  settingChevron: {
    color: '#EF233C',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 16,
  },
  settingChevronActive: {
    color: '#FFFFFF',
  },
  settingCardValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  settingCardValueActive: {
    color: '#EF233C',
  },
  settingCardHint: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  settingPanel: {
    backgroundColor: '#12151C',
    borderColor: '#242832',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 22,
    padding: 12,
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
  exitButton: {
    alignItems: 'center',
    borderColor: '#4A1D24',
    borderRadius: 8,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 14,
  },
  exitText: {
    color: '#EF233C',
    fontSize: 15,
    fontWeight: '800',
  },
  exitHint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 16,
    marginTop: 8,
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
