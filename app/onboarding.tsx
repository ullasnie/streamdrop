import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  loadStreamingProviders,
  providerKey,
  ProviderRegion,
  StreamingProvider,
} from '../constants/streaming-providers';

const ONBOARDING_COMPLETE_KEY = 'onboardingCompletedV1';
const PREF_HOME_LANGUAGES_KEY = 'homeSelectedLanguagesV2';
const PREF_HOME_PLATFORMS_KEY = 'homeSelectedPlatformsV1';
const PREF_HOME_GENRES_KEY = 'homeSelectedGenresV1';
const PREF_CONTENT_TYPES_KEY = 'preferredContentTypesV1';
const PREF_PROVIDER_LABELS_KEY = 'streamingProviderNamesV1';
const HOME_TOUR_AUDIENCE_KEY = 'homeTourAudienceV2';
const HOME_TOUR_SEEN_KEY = 'homeTourSeenV2';
const HOME_TOUR_ACTIVE_STEP_KEY = 'homeTourActiveStepV2';

const steps = [
  {
    eyebrow: 'YOUR ENTERTAINMENT',
    title: 'What do you want to discover?',
    description: 'Choose movies, series, or both. You can change this anytime in Settings.',
    options: [
      { key: 'movie', label: 'Movies', icon: 'film-outline' },
      { key: 'tv', label: 'Series', icon: 'tv-outline' },
    ],
  },
  {
    eyebrow: 'YOUR STREAMING',
    title: 'Where do you watch?',
    description: 'Choose every service you subscribe to. We’ll prioritize movies you can stream.',
    options: [
      { key: 'netflix', label: 'Netflix', icon: 'play-circle-outline' },
      { key: 'prime', label: 'Prime Video', icon: 'play-circle-outline' },
      { key: 'disney', label: 'Disney+', icon: 'sparkles-outline' },
      { key: 'hulu', label: 'Hulu', icon: 'tv-outline' },
      { key: 'hotstar', label: 'JioHotstar', icon: 'star-outline' },
      { key: 'apple-tv', label: 'Apple TV+', icon: 'tv-outline' },
      { key: 'hbo-max', label: 'HBO Max', icon: 'film-outline' },
    ],
  },
  {
    eyebrow: 'YOUR LANGUAGES',
    title: 'What do you enjoy watching?',
    description: 'Pick all the languages you want represented in your personalized feed.',
    options: [
      { key: 'en', label: 'English', icon: 'language-outline' },
      { key: 'hi', label: 'Hindi', icon: 'language-outline' },
      { key: 'ta', label: 'Tamil', icon: 'language-outline' },
      { key: 'te', label: 'Telugu', icon: 'language-outline' },
      { key: 'ml', label: 'Malayalam', icon: 'language-outline' },
      { key: 'kn', label: 'Kannada', icon: 'language-outline' },
      { key: 'ko', label: 'Korean', icon: 'language-outline' },
      { key: 'es', label: 'Spanish', icon: 'language-outline' },
      { key: 'ja', label: 'Japanese', icon: 'language-outline' },
      { key: 'fr', label: 'French', icon: 'language-outline' },
      { key: 'de', label: 'German', icon: 'language-outline' },
      { key: 'it', label: 'Italian', icon: 'language-outline' },
      { key: 'pt', label: 'Portuguese', icon: 'language-outline' },
      { key: 'zh', label: 'Chinese', icon: 'language-outline' },
      { key: 'ar', label: 'Arabic', icon: 'language-outline' },
      { key: 'tr', label: 'Turkish', icon: 'language-outline' },
      { key: 'th', label: 'Thai', icon: 'language-outline' },
      { key: 'id', label: 'Indonesian', icon: 'language-outline' },
    ],
  },
  {
    eyebrow: 'YOUR TASTE',
    title: 'Choose your favorite genres',
    description: 'We’ll use these for your home feed, recommendations, and searches.',
    options: [
      { key: 'action', label: 'Action', icon: 'flash-outline' },
      { key: 'comedy', label: 'Comedy', icon: 'happy-outline' },
      { key: 'drama', label: 'Drama', icon: 'people-outline' },
      { key: 'romance', label: 'Romance', icon: 'heart-outline' },
      { key: 'thriller', label: 'Thriller', icon: 'pulse-outline' },
      { key: 'family', label: 'Family', icon: 'home-outline' },
      { key: 'adventure', label: 'Adventure', icon: 'compass-outline' },
      { key: 'animation', label: 'Animation', icon: 'color-palette-outline' },
      { key: 'crime', label: 'Crime', icon: 'finger-print-outline' },
      { key: 'documentary', label: 'Documentary', icon: 'videocam-outline' },
      { key: 'fantasy', label: 'Fantasy', icon: 'sparkles-outline' },
      { key: 'history', label: 'History', icon: 'library-outline' },
      { key: 'horror', label: 'Horror', icon: 'skull-outline' },
      { key: 'music', label: 'Music', icon: 'musical-notes-outline' },
      { key: 'mystery', label: 'Mystery', icon: 'help-circle-outline' },
      { key: 'science-fiction', label: 'Science Fiction', icon: 'planet-outline' },
      { key: 'tv-movie', label: 'TV Movie', icon: 'tv-outline' },
      { key: 'war', label: 'War', icon: 'shield-outline' },
      { key: 'western', label: 'Western', icon: 'sunny-outline' },
    ],
  },
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [contentTypes, setContentTypes] = useState<string[]>(['movie', 'tv']);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [providerPickerVisible, setProviderPickerVisible] = useState(false);
  const [providerRegion, setProviderRegion] = useState<ProviderRegion>('IN');
  const [availableProviders, setAvailableProviders] = useState<StreamingProvider[]>([]);
  const [selectedProviderNames, setSelectedProviderNames] = useState<Record<string, string>>({});
  const [providersLoading, setProvidersLoading] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);

  const selections = [contentTypes, platforms, languages, genres];
  const setSelections = [setContentTypes, setPlatforms, setLanguages, setGenres];
  const current = steps[step];
  const selected = selections[step];
  const canContinue =
    (step === 3 || selected.length > 0) && !saving;
  const visibleOptions =
    step === 2 && !showAllLanguages
      ? current.options.slice(0, 6)
      : step === 3 && !showAllGenres
        ? current.options.slice(0, 6)
        : current.options;

  const toggle = (key: string) => {
    setSelections[step]((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  };

  const loadMoreProviders = async (region: ProviderRegion) => {
    setProviderRegion(region);
    setProvidersLoading(true);

    setAvailableProviders(await loadStreamingProviders(region));
    setProvidersLoading(false);
  };

  const openProviderPicker = () => {
    setProviderPickerVisible(true);
    if (!availableProviders.length) void loadMoreProviders(providerRegion);
  };

  const toggleCustomProvider = (provider: StreamingProvider) => {
    const key = providerKey(provider.provider_id, providerRegion);
    setSelectedProviderNames((previous) => ({
      ...previous,
      [key]: provider.provider_name,
    }));
    setPlatforms((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  };

  const continueOnboarding = async () => {
    if (!canContinue) return;
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }

    setSaving(true);
    await AsyncStorage.multiSet([
      [PREF_HOME_PLATFORMS_KEY, platforms.join(',')],
      [PREF_HOME_LANGUAGES_KEY, languages.join(',')],
      [PREF_HOME_GENRES_KEY, genres.length ? genres.join(',') : 'all'],
      [PREF_CONTENT_TYPES_KEY, contentTypes.join(',')],
      [PREF_PROVIDER_LABELS_KEY, JSON.stringify(selectedProviderNames)],
      [ONBOARDING_COMPLETE_KEY, 'true'],
      [HOME_TOUR_AUDIENCE_KEY, 'new'],
      [HOME_TOUR_SEEN_KEY, 'false'],
      [HOME_TOUR_ACTIVE_STEP_KEY, '0'],
    ]);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable style={styles.backButton} onPress={() => setStep((value) => value - 1)}>
            <Ionicons name="arrow-back" color="#FFFFFF" size={22} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.brand}>STREAMDROP</Text>
        <Text style={styles.stepCount}>{step + 1} / {steps.length}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{current.eyebrow}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <View style={styles.optionGrid}>
          {visibleOptions.map((option) => {
            const isSelected = selected.includes(option.key);
            return (
              <Pressable
                key={option.key}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggle(option.key)}
              >
                <Ionicons
                  name={option.icon}
                  color={isSelected ? '#FFFFFF' : '#9CA3AF'}
                  size={24}
                />
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                  color={isSelected ? '#EF233C' : '#4B5563'}
                  size={22}
                />
              </Pressable>
            );
          })}
          {step === 2 && !showAllLanguages ? (
            <Pressable
              style={styles.moreChoicesButton}
              onPress={() => setShowAllLanguages(true)}
            >
              <Text style={styles.moreChoicesText}>More languages</Text>
              <Ionicons name="chevron-down" color="#EF233C" size={18} />
            </Pressable>
          ) : null}
          {step === 3 && !showAllGenres ? (
            <Pressable
              style={styles.moreChoicesButton}
              onPress={() => setShowAllGenres(true)}
            >
              <Text style={styles.moreChoicesText}>More genres</Text>
              <Ionicons name="chevron-down" color="#EF233C" size={18} />
            </Pressable>
          ) : null}
          {step === 1 ? (
            <Pressable style={styles.moreProvidersButton} onPress={openProviderPicker}>
              <Ionicons name="add" color="#EF233C" size={22} />
              <View style={styles.moreProvidersCopy}>
                <Text style={styles.moreProvidersTitle}>More streaming services</Text>
                <Text style={styles.moreProvidersSubtitle}>
                  Browse popular services by region
                </Text>
              </View>
              <Ionicons name="chevron-forward" color="#9CA3AF" size={20} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.selectionHint}>
          {selected.length
            ? `${selected.length} selected`
            : step === 3
              ? 'Optional — skip to see every genre'
              : 'Select at least one'}
        </Text>
        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => void continueOnboarding()}
        >
          <Text style={styles.continueText}>
            {saving ? 'Personalizing…' : step === steps.length - 1 ? 'See my Home' : 'Continue'}
          </Text>
          {!saving ? <Ionicons name="arrow-forward" color="#FFFFFF" size={20} /> : null}
        </Pressable>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setProviderPickerVisible(false)}
        presentationStyle="pageSheet"
        visible={providerPickerVisible}
      >
        <SafeAreaView style={styles.providerModal}>
          <View style={styles.providerModalHeader}>
            <View>
              <Text style={styles.providerModalTitle}>More services</Text>
              <Text style={styles.providerModalSubtitle}>Choose all that you use</Text>
            </View>
            <Pressable onPress={() => setProviderPickerVisible(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.regionRow}>
            {(['IN', 'US'] as const).map((region) => (
              <Pressable
                key={region}
                style={[styles.regionChip, providerRegion === region && styles.regionChipSelected]}
                onPress={() => void loadMoreProviders(region)}
              >
                <Text style={[styles.regionText, providerRegion === region && styles.regionTextSelected]}>
                  {region === 'IN' ? 'India' : 'United States'}
                </Text>
              </Pressable>
            ))}
          </View>

          {providersLoading ? (
            <ActivityIndicator color="#EF233C" style={styles.providerLoader} />
          ) : (
            <ScrollView contentContainerStyle={styles.providerList} keyboardShouldPersistTaps="handled">
              {availableProviders.map((provider) => {
                const key = providerKey(provider.provider_id, providerRegion);
                const isSelected = platforms.includes(key);
                return (
                  <Pressable
                    key={provider.provider_id}
                    style={[styles.providerRow, isSelected && styles.providerRowSelected]}
                    onPress={() => toggleCustomProvider(provider)}
                  >
                    {provider.logo_path ? (
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w92${provider.logo_path}` }}
                        style={styles.providerLogo}
                      />
                    ) : (
                      <View style={styles.providerLogo} />
                    )}
                    <Text style={styles.providerName}>{provider.provider_name}</Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      color={isSelected ? '#EF233C' : '#6B7280'}
                      size={24}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#0F1115', flex: 1 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  brand: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },
  stepCount: { color: '#9CA3AF', fontSize: 13, fontWeight: '800', textAlign: 'right', width: 40 },
  progressTrack: { backgroundColor: '#242832', height: 3, marginHorizontal: 20, marginTop: 8 },
  progressFill: { backgroundColor: '#EF233C', height: 3 },
  content: { paddingBottom: 28, paddingHorizontal: 20, paddingTop: 42 },
  eyebrow: { color: '#EF233C', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.7, lineHeight: 38 },
  description: { color: '#9CA3AF', fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 520 },
  optionGrid: { gap: 10, marginTop: 30 },
  featureList: { gap: 10, marginTop: 26 },
  featureRow: { alignItems: 'center', backgroundColor: '#12151C', borderColor: '#242832', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 76, padding: 13 },
  featureIcon: { alignItems: 'center', backgroundColor: '#291318', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  featureCopy: { flex: 1, marginLeft: 13 },
  featureTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  featureBody: { color: '#9CA3AF', fontSize: 12, lineHeight: 17, marginTop: 3 },
  option: { alignItems: 'center', backgroundColor: '#12151C', borderColor: '#242832', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 16 },
  optionSelected: { backgroundColor: '#291318', borderColor: '#EF233C' },
  optionLabel: { color: '#D1D5DB', flex: 1, fontSize: 16, fontWeight: '800' },
  optionLabelSelected: { color: '#FFFFFF' },
  moreProvidersButton: { alignItems: 'center', borderColor: '#3A2025', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', minHeight: 64, paddingHorizontal: 16 },
  moreProvidersCopy: { flex: 1, marginLeft: 12 },
  moreProvidersTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  moreProvidersSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 3 },
  moreChoicesButton: { alignItems: 'center', borderColor: '#3A2025', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 50 },
  moreChoicesText: { color: '#EF233C', fontSize: 14, fontWeight: '900', marginRight: 6 },
  footer: { backgroundColor: '#0F1115', borderTopColor: '#1F232B', borderTopWidth: 1, paddingBottom: 18, paddingHorizontal: 20, paddingTop: 14 },
  selectionHint: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  continueButton: { alignItems: 'center', backgroundColor: '#EF233C', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 54 },
  continueButtonDisabled: { opacity: 0.4 },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  providerModal: { backgroundColor: '#0F1115', flex: 1 },
  providerModalHeader: { alignItems: 'center', borderBottomColor: '#242832', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  providerModalTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  providerModalSubtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 3 },
  doneText: { color: '#EF233C', fontSize: 16, fontWeight: '900' },
  regionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  regionChip: { backgroundColor: '#12151C', borderColor: '#2A2E36', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  regionChipSelected: { backgroundColor: '#291318', borderColor: '#EF233C' },
  regionText: { color: '#9CA3AF', fontSize: 13, fontWeight: '800' },
  regionTextSelected: { color: '#FFFFFF' },
  providerLoader: { marginTop: 40 },
  providerList: { gap: 8, padding: 20 },
  providerRow: { alignItems: 'center', backgroundColor: '#12151C', borderColor: '#242832', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 60, padding: 10 },
  providerRowSelected: { backgroundColor: '#291318', borderColor: '#EF233C' },
  providerLogo: { backgroundColor: '#242832', borderRadius: 8, height: 40, width: 40 },
  providerName: { color: '#FFFFFF', flex: 1, fontSize: 15, fontWeight: '800' },
});
