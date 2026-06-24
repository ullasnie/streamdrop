import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="details" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="support" />
      <Stack.Screen name="modal" />
    </Stack>
  );
}
