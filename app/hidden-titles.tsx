import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type HiddenTitle = {
  key: string;
  title: string;
  mediaType: 'movie' | 'tv';
};

type Filter = 'all' | 'movie' | 'tv';

const PREF_HIDDEN_TITLES_KEY = 'hiddenHomeTitlesV1';
const PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY = 'permanentlyHiddenHomeTitleKeysV1';
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'Series' },
];

const parseHiddenTitles = (value: string | null): HiddenTitle[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HiddenTitle =>
        typeof item?.key === 'string' &&
        typeof item?.title === 'string' &&
        (item?.mediaType === 'movie' || item?.mediaType === 'tv')
    );
  } catch {
    return [];
  }
};

export default function HiddenTitlesScreen() {
  const [hiddenTitles, setHiddenTitles] = useState<HiddenTitle[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.getItem(PREF_HIDDEN_TITLES_KEY).then((value) =>
        setHiddenTitles(parseHiddenTitles(value))
      );
    }, [])
  );

  const visibleTitles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return hiddenTitles.filter(
      (item) =>
        (filter === 'all' || item.mediaType === filter) &&
        (!normalizedQuery ||
          item.title.toLocaleLowerCase().includes(normalizedQuery))
    );
  }, [filter, hiddenTitles, query]);

  const saveHiddenTitles = async (next: HiddenTitle[]) => {
    setHiddenTitles(next);
    await AsyncStorage.setItem(PREF_HIDDEN_TITLES_KEY, JSON.stringify(next));
  };

  const restoreTitle = (key: string) =>
    saveHiddenTitles(hiddenTitles.filter((item) => item.key !== key));

  const permanentlyDeleteTitles = async (titles: HiddenTitle[]) => {
    const stored = await AsyncStorage.getItem(PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY);
    let existingKeys: string[] = [];
    try {
      const parsed = JSON.parse(stored || '[]');
      existingKeys = Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === 'string')
        : [];
    } catch {
      existingKeys = [];
    }

    const deletedKeys = new Set(titles.map((item) => item.key));
    const permanentKeys = [...new Set([...existingKeys, ...deletedKeys])];
    const remainingTitles = hiddenTitles.filter((item) => !deletedKeys.has(item.key));

    setHiddenTitles(remainingTitles);
    await AsyncStorage.multiSet([
      [PREF_HIDDEN_TITLES_KEY, JSON.stringify(remainingTitles)],
      [PREF_PERMANENTLY_HIDDEN_TITLE_KEYS_KEY, JSON.stringify(permanentKeys)],
    ]);
  };

  const deleteTitlePermanently = (item: HiddenTitle) => {
    const confirmDelete = () => void permanentlyDeleteTitles([item]);
    const message = `${item.title} will stay blocked from Home and be removed from this list.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) confirmDelete();
      return;
    }
    Alert.alert('Delete permanently?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const deleteAllPermanently = () => {
    const confirmDelete = () => void permanentlyDeleteTitles(hiddenTitles);
    const message =
      'All titles will stay blocked from Home and be removed from this list.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) confirmDelete();
      return;
    }
    Alert.alert('Delete all permanently?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const restoreAll = () => {
    const confirmRestore = () => void saveHiddenTitles([]);
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Restore all hidden titles to Home?')) {
        confirmRestore();
      }
      return;
    }
    Alert.alert(
      'Restore all titles?',
      'Every hidden movie and series can appear on Home again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore all', style: 'destructive', onPress: confirmRestore },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Settings" onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Settings</Text>
        </Pressable>
        {hiddenTitles.length > 0 && (
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="Restore all hidden titles" onPress={restoreAll}>
              <Text style={styles.restoreAllText}>Restore all</Text>
            </Pressable>
            <Pressable accessibilityLabel="Delete all hidden titles permanently" onPress={deleteAllPermanently}>
              <Text style={styles.deleteAllText}>Delete all</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.title}>Hidden titles</Text>
      <Text style={styles.subtitle}>
        These titles stay out of Home recommendations. You can still find them in Search.
      </Text>
      <Text style={styles.deleteHint}>
        Delete removes a title from this list while keeping it permanently blocked from Home.
      </Text>

      {hiddenTitles.length > 0 && (
        <>
          <TextInput
            accessibilityLabel="Search hidden titles"
            onChangeText={setQuery}
            placeholder="Search hidden titles"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
            value={query}
          />

          <View style={styles.filterRow}>
            {filters.map((item) => (
              <Pressable
                accessibilityLabel={`Show ${item.label.toLowerCase()}`}
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, filter === item.key && styles.filterChipSelected]}
              >
                <Text style={[styles.filterText, filter === item.key && styles.filterTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {hiddenTitles.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No hidden titles</Text>
          <Text style={styles.emptyText}>
            Movies and series you hide from Home will appear here.
          </Text>
        </View>
      ) : visibleTitles.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyText}>Try another title or content filter.</Text>
        </View>
      ) : (
        <View style={styles.listPanel}>
          {visibleTitles.map((item, index) => (
            <View
              key={item.key}
              style={[styles.titleRow, index > 0 && styles.titleRowDivider]}
            >
              <View style={styles.titleCopy}>
                <Text style={styles.titleName} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.titleType}>
                  {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Pressable
                  accessibilityLabel={`Restore ${item.title} to Home`}
                  onPress={() => void restoreTitle(item.key)}
                  style={styles.restoreButton}
                >
                  <Text style={styles.restoreButtonText}>Restore</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${item.title} permanently`}
                  onPress={() => deleteTitlePermanently(item)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1115',
    flex: 1,
  },
  content: {
    paddingBottom: 80,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 34 : 70,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  backText: {
    color: '#EF233C',
    fontSize: 14,
    fontWeight: '800',
  },
  restoreAllText: {
    color: '#EF233C',
    fontSize: 12,
    fontWeight: '900',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  deleteAllText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 18,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  deleteHint: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 12,
  },
  filterChip: {
    borderColor: '#2A2E36',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: '#3A1118',
    borderColor: '#EF233C',
  },
  filterText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterTextSelected: {
    color: '#FFFFFF',
  },
  listPanel: {
    backgroundColor: '#12151C',
    borderColor: '#2A2E36',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  titleRowDivider: {
    borderTopColor: '#242832',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  titleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  titleName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  titleType: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 3,
  },
  restoreButton: {
    borderColor: '#3A414D',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  restoreButtonText: {
    color: '#EF233C',
    fontSize: 11,
    fontWeight: '900',
  },
  itemActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyPanel: {
    alignItems: 'center',
    borderColor: '#242832',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 22,
    padding: 26,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
});
