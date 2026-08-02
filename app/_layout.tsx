import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const ONBOARDING_COMPLETE_KEY = 'onboardingCompletedV1';

export default function RootLayout() {
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((completed) => {
        if (!active) return;
        if (completed !== 'true' && segments[0] !== 'onboarding') {
          router.replace('/onboarding');
        }
      })
      .finally(() => {
        if (active) setOnboardingChecked(true);
      });

    return () => {
      active = false;
    };
  }, [segments]);

  if (!onboardingChecked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#EF233C" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="details" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="support" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#0F1115',
    flex: 1,
    justifyContent: 'center',
  },
});
