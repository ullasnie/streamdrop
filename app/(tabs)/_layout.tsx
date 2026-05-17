import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { listenForWatchlistUpdates } from '../../constants/watchlist-events';

export default function TabLayout() {
  const [watchlistCount, setWatchlistCount] = useState(0);

  const loadWatchlistCount = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('watchlist');
      const parsed = data ? JSON.parse(data) : [];
      setWatchlistCount(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setWatchlistCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWatchlistCount();
    }, [loadWatchlistCount])
  );

  useEffect(() => listenForWatchlistUpdates(loadWatchlistCount), [
    loadWatchlistCount,
  ]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F1115',
          borderTopColor: '#1A1D23',
          borderTopWidth: 1,
          height: 76,
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 14,
        },
        tabBarItemStyle: {
          borderRadius: 22,
          marginHorizontal: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarActiveBackgroundColor: '#3A1118',
        tabBarActiveTintColor: '#EF233C',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarBadge: watchlistCount || undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF233C',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'bookmark' : 'bookmark-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
