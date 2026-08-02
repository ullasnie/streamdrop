import { Image, StyleSheet, View } from 'react-native';

type AmbientBackgroundProps = {
  posterPath?: string | null;
};

export function AmbientBackground({ posterPath }: AmbientBackgroundProps) {
  return (
    <View pointerEvents="none" style={styles.layer}>
      {posterPath ? (
        <Image
          blurRadius={58}
          resizeMode="cover"
          source={{ uri: `https://image.tmdb.org/t/p/w500${posterPath}` }}
          style={styles.poster}
        />
      ) : (
        <>
          <View style={styles.navyGlow} />
          <View style={styles.redGlow} />
        </>
      )}
      <View style={[styles.shade, posterPath ? styles.posterShade : null]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  poster: {
    height: 520,
    left: -55,
    opacity: 0.22,
    position: 'absolute',
    right: -55,
    top: -80,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.34)',
  },
  posterShade: {
    backgroundColor: 'rgba(15, 17, 21, 0.72)',
  },
  navyGlow: {
    backgroundColor: '#24344A',
    borderRadius: 240,
    height: 440,
    left: -120,
    opacity: 0.32,
    position: 'absolute',
    top: -170,
    width: 440,
  },
  redGlow: {
    backgroundColor: '#521821',
    borderRadius: 180,
    height: 330,
    opacity: 0.22,
    position: 'absolute',
    right: -170,
    top: 100,
    width: 330,
  },
});
