import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type AppLogoLinkProps = {
  compact?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function AppLogoLink({ compact = false, onPress, style }: AppLogoLinkProps) {
  const goHome = () => {
    onPress?.();
    router.replace('/');
  };

  return (
    <Pressable
      accessibilityLabel="Go to StreamDrop Home"
      accessibilityRole="link"
      onPress={goHome}
      style={[styles.logo, style]}
    >
      <Text style={[styles.logoStream, compact && styles.compactText]}>
        Stream
      </Text>
      <Text style={[styles.logoDrop, compact && styles.compactText]}>Drop</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  logoStream: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  logoDrop: {
    color: '#EF233C',
    fontSize: 34,
    fontStyle: 'italic',
    fontWeight: '900',
  },
  compactText: {
    fontSize: 24,
  },
});
