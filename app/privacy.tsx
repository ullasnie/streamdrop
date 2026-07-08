import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppLogoLink } from '../components/app-logo-link';

const sections = [
  {
    title: 'Information stored on your device',
    body: 'StreamDrop stores your selected languages, streaming services, genres, release window, notification preference, and watchlist on your device. StreamDrop does not currently require an account.',
  },
  {
    title: 'Movie data and network requests',
    body: 'StreamDrop retrieves movie metadata, images, ratings, release dates, and streaming-provider information from TMDB through a StreamDrop server hosted by Vercel. TMDB and Vercel may process standard network information, such as your IP address and request details, to provide and secure their services.',
  },
  {
    title: 'Anonymous usage counts',
    body: 'If enabled in Settings, StreamDrop sends count-only events such as a screen view, filter change, movie open, search use, refresh, alert change, or watchlist action. These events use one shared aggregate identifier and do not include your name, email, search text, movie title, location, advertising identifier, or device identifier. GeoIP processing is disabled. You can turn these counts off in Settings.',
  },
  {
    title: 'Notifications',
    body: 'If you enable Friday drop alerts, StreamDrop requests notification permission and schedules a weekly reminder. You can turn alerts off in Settings or your device settings.',
  },
  {
    title: 'Feedback',
    body: 'The in-app feedback questions send only the selected answer as an aggregate count. No written response or personal information is attached. If you choose to email support, your email provider and the recipient will receive your email address and anything you include in the message.',
  },
  {
    title: 'Data we do not request',
    body: 'StreamDrop does not currently ask for your name, password, payment information, contacts, photos, microphone, camera, or precise location.',
  },
  {
    title: 'Contact',
    body: 'For privacy questions, email streamdrop.26@gmail.com.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <AppLogoLink compact />
        </View>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated June 24, 2026</Text>
      </View>

      <Text style={styles.intro}>
        StreamDrop helps you discover streaming movie releases and save titles
        to a local watchlist. This policy explains how the app handles data.
      </Text>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      <Text style={styles.tmdbNotice}>
        This product uses the TMDB API but is not endorsed or certified by
        TMDB.
      </Text>

      <Pressable style={styles.supportLink} onPress={() => router.push('/support')}>
        <Text style={styles.supportLinkText}>Contact StreamDrop Support</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1115',
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 760,
    paddingBottom: 80,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 36 : 64,
    width: '100%',
  },
  header: {
    borderBottomColor: '#242832',
    borderBottomWidth: 1,
    marginBottom: 24,
    paddingBottom: 20,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: '#EF233C',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  updated: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 8,
  },
  intro: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 26,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  body: {
    color: '#AEB4BE',
    fontSize: 15,
    lineHeight: 24,
  },
  tmdbNotice: {
    borderTopColor: '#242832',
    borderTopWidth: 1,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    paddingTop: 20,
  },
  supportLink: {
    alignSelf: 'flex-start',
    paddingVertical: 18,
  },
  supportLinkText: {
    color: '#EF233C',
    fontSize: 14,
    fontWeight: '800',
  },
});
