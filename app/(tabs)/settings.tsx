import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const PREF_LANGUAGE_KEY = 'preferredLanguage';
const PREF_PLATFORM_KEY = 'preferredPlatform';
const PREF_GENRE_KEY = 'preferredGenre';
const PREF_RELEASE_MONTHS_KEY = 'releaseWindowMonths';
const ALERTS_ENABLED_KEY = 'alertsEnabled';
const FRIDAY_NOTIFICATION_ID_KEY = 'fridayNotificationId';
const FEEDBACK_EMAIL = 'ullasnie@gmail.com';
const tmdbLogo = require('../../assets/images/tmdb-logo.svg');

const languages = [
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

export default function SettingsScreen() {
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [releaseWindowMonths, setReleaseWindowMonths] = useState(3);

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
    await AsyncStorage.setItem(PREF_LANGUAGE_KEY, code);
  };

  const selectPlatform = async (key: string) => {
    setSelectedPlatform(key);
    await AsyncStorage.setItem(PREF_PLATFORM_KEY, key);
  };

  const selectGenre = async (key: string) => {
    setSelectedGenre(key);
    await AsyncStorage.setItem(PREF_GENRE_KEY, key);
  };

  const selectReleaseWindow = async (months: number) => {
    setReleaseWindowMonths(months);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

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

      <Text style={styles.section}>Default Language</Text>
      <FlatList
        horizontal
        data={languages}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.chipListContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              selectedLanguage === item.code && styles.chipSelected,
            ]}
            onPress={() => selectLanguage(item.code)}
          >
            <Text
              style={[
                styles.chipText,
                selectedLanguage === item.code && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.section}>Default Streaming Filter</Text>
      <FlatList
        horizontal
        data={platforms}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chipListContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              selectedPlatform === item.key && styles.chipSelected,
            ]}
            onPress={() => selectPlatform(item.key)}
          >
            <Text
              style={[
                styles.chipText,
                selectedPlatform === item.key && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.section}>Default Genre</Text>
      <FlatList
        horizontal
        data={genres}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chipListContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.chip,
              selectedGenre === item.key && styles.chipSelected,
            ]}
            onPress={() => selectGenre(item.key)}
          >
            <Text
              style={[
                styles.chipText,
                selectedGenre === item.key && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.section}>Recent Releases Window</Text>
      <View style={styles.optionGroup}>
        {releaseWindows.map((item) => (
          <Pressable
            key={item.value}
            style={[
              styles.option,
              releaseWindowMonths === item.value && styles.optionSelected,
            ]}
            onPress={() => selectReleaseWindow(item.value)}
          >
            <Text
              style={[
                styles.optionText,
                releaseWindowMonths === item.value && styles.optionTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
    paddingTop: 70,
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
  chipListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  chip: {
    alignItems: 'center',
    borderColor: '#2A2E36',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: 10,
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
  optionGroup: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
  },
  option: {
    alignItems: 'center',
    borderColor: '#2A2E36',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  optionText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '800',
  },
  optionTextSelected: {
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
