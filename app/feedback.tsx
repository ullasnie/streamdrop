import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  FeedbackEvent,
  submitFeedbackEvent,
} from '../constants/analytics';
import { AppLogoLink } from '../components/app-logo-link';

const SUPPORT_EMAIL = 'streamdrop.26@gmail.com';
const FEEDBACK_STORAGE_KEY = 'feedbackAnswersV1';

type Answers = Record<string, string>;

const questions: {
  key: string;
  prompt: string;
  options: { label: string; event: FeedbackEvent }[];
}[] = [
  {
    key: 'usefulness',
    prompt: 'How useful is StreamDrop?',
    options: [
      { label: 'Useful', event: 'feedback_useful' },
      { label: 'Okay', event: 'feedback_useful_okay' },
      { label: 'Not yet', event: 'feedback_useful_not_yet' },
    ],
  },
  {
    key: 'discovery',
    prompt: 'Was it easy to find something to watch?',
    options: [
      { label: 'Easy', event: 'feedback_discovery_easy' },
      { label: 'Somewhat', event: 'feedback_discovery_somewhat' },
      { label: 'Hard', event: 'feedback_discovery_hard' },
    ],
  },
  {
    key: 'accuracy',
    prompt: 'How accurate was the release information?',
    options: [
      { label: 'Accurate', event: 'feedback_accuracy_good' },
      { label: 'Mostly', event: 'feedback_accuracy_mostly' },
      { label: 'Needs work', event: 'feedback_accuracy_needs_work' },
    ],
  },
];

const emailSupport = () => {
  const subject = encodeURIComponent('StreamDrop feedback');
  const body = encodeURIComponent(
    'What happened?\n\nMovie title, if relevant:\n\nCountry:\n\niPhone model:\n\niOS version:\n'
  );

  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
};

export default function FeedbackScreen() {
  const [answers, setAnswers] = useState<Answers>({});
  const [sendingKey, setSendingKey] = useState('');
  const [errorKey, setErrorKey] = useState('');

  useEffect(() => {
    const loadAnswers = async () => {
      const stored = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (stored) setAnswers(JSON.parse(stored));
    };

    loadAnswers().catch(() => {});
  }, []);

  const answerQuestion = async (
    questionKey: string,
    label: string,
    event: FeedbackEvent
  ) => {
    if (answers[questionKey] || sendingKey) return;

    setSendingKey(questionKey);
    setErrorKey('');

    const accepted = await submitFeedbackEvent(event);
    if (!accepted) {
      setErrorKey(questionKey);
      setSendingKey('');
      return;
    }

    const next = { ...answers, [questionKey]: label };
    setAnswers(next);
    setSendingKey('');
    await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <AppLogoLink compact />
      </View>

      <Text style={styles.title}>Share Feedback</Text>
      <Text style={styles.intro}>
        Three quick answers help improve StreamDrop. Each tap is saved
        immediately as an anonymous count—no text or personal details.
      </Text>

      {questions.map((question) => {
        const answer = answers[question.key];

        return (
          <View key={question.key} style={styles.questionCard}>
            <Text style={styles.question}>{question.prompt}</Text>

            {answer ? (
              <View style={styles.thanks}>
                <Text style={styles.thanksText}>Thanks — {answer}</Text>
              </View>
            ) : (
              <View style={styles.options}>
                {question.options.map((option) => (
                  <Pressable
                    key={option.event}
                    style={styles.option}
                    disabled={sendingKey === question.key}
                    onPress={() =>
                      answerQuestion(question.key, option.label, option.event)
                    }
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {sendingKey === question.key && (
              <Text style={styles.status}>Saving…</Text>
            )}
            {errorKey === question.key && (
              <Text style={styles.error}>Couldn’t save. Tap an answer to retry.</Text>
            )}
          </View>
        );
      })}

      <View style={styles.supportCard}>
        <Text style={styles.supportTitle}>Have a specific issue?</Text>
        <Text style={styles.supportBody}>
          Email us for missing releases, incorrect information, or app problems.
        </Text>
        <Pressable style={styles.emailButton} onPress={emailSupport}>
          <Text style={styles.emailButtonText}>Email {SUPPORT_EMAIL}</Text>
        </Pressable>
      </View>
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
  intro: {
    color: '#9CA3AF',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 28,
    marginTop: 10,
  },
  questionCard: {
    borderColor: '#242832',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  question: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  option: {
    borderColor: '#3A3F49',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  thanks: {
    backgroundColor: '#3A1118',
    borderRadius: 8,
    marginTop: 14,
    padding: 12,
  },
  thanksText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  status: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 10,
  },
  error: {
    color: '#EF7A8A',
    fontSize: 12,
    marginTop: 10,
  },
  supportCard: {
    backgroundColor: '#12151C',
    borderRadius: 10,
    marginTop: 8,
    padding: 18,
  },
  supportTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  supportBody: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  emailButton: {
    alignItems: 'center',
    backgroundColor: '#EF233C',
    borderRadius: 8,
    marginTop: 16,
    padding: 13,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
