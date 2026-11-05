import { StyleSheet, Text, View } from 'react-native';
import { useFeedStatus } from '../store/hooks';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Distinguishes a known short silence ("paused") from a feed that has been
 * silent long enough to be considered broken ("stale"). Live/connecting render
 * nothing; the component only re-renders on status transitions.
 */
export function PausedBanner() {
  const status = useFeedStatus();
  const theme = useTheme();

  if (status === 'live' || status === 'connecting') {
    return null;
  }

  const isStale = status === 'stale';
  const foreground = isStale ? theme.colors.danger : theme.colors.warning;
  const background = isStale
    ? theme.colors.dangerBackground
    : theme.colors.warningBackground;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: background }]}
    >
      <View style={[styles.dot, { backgroundColor: foreground }]} />
      <Text style={[styles.text, { color: foreground }]}>
        {isStale
          ? 'Prices stale — no ticks received for a while'
          : 'Prices paused — waiting for the feed to resume'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
});
