import { router } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SUPPORT_EMAIL = 'streamdrop.26@gmail.com';

const topics = [
  {
    title: 'Missing or incorrect releases',
    body: 'Movie dates and streaming availability come from TMDB and may vary by region. Send the movie title, your country, and what appears incorrect.',
  },
  {
    title: 'Friday alerts',
    body: 'Open StreamDrop Settings and turn Friday drop alerts off and on again. Also confirm notifications are enabled for StreamDrop in iPhone Settings.',
  },
  {
    title: 'Watchlist or filters',
    body: 'Watchlist items and filters are stored on your iPhone. Removing the app may erase this local data.',
  },
  {
    title: 'App not loading',
    body: 'Check your internet connection, close and reopen StreamDrop, and try again. If the problem continues, include your iPhone model and iOS version in your email.',
  },
];

const sendSupportEmail = () => {
  const subject = encodeURIComponent('StreamDrop support');
  const body = encodeURIComponent(
    'What happened?\n\nMovie title, if relevant:\n\nCountry:\n\niPhone model:\n\niOS version:\n'
  );

  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
};

export default function SupportScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>StreamDrop Support</Text>
        <Text style={styles.subtitle}>
          Help with releases, alerts, filters, and your watchlist.
        </Text>
      </View>

      <Pressable style={styles.emailButton} onPress={sendSupportEmail}>
        <Text style={styles.emailButtonText}>Email Support</Text>
      </Pressable>
      <Text style={styles.emailAddress}>{SUPPORT_EMAIL}</Text>

      {topics.map((topic) => (
        <View key={topic.title} style={styles.topic}>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <Text style={styles.body}>{topic.body}</Text>
        </View>
      ))}

      <Pressable style={styles.privacyLink} onPress={() => router.push('/privacy')}>
        <Text style={styles.privacyLinkText}>View Privacy Policy</Text>
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
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
  subtitle: {
    color: '#9CA3AF',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  emailButton: {
    alignItems: 'center',
    backgroundColor: '#EF233C',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  emailAddress: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 30,
    marginTop: 10,
    textAlign: 'center',
  },
  topic: {
    borderBottomColor: '#242832',
    borderBottomWidth: 1,
    marginBottom: 22,
    paddingBottom: 22,
  },
  topicTitle: {
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
  privacyLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  privacyLinkText: {
    color: '#EF233C',
    fontSize: 14,
    fontWeight: '800',
  },
});
