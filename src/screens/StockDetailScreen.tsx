import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { PausedBanner } from '../components/PausedBanner';

export function StockDetailScreen({ route }: { route: { params?: { symbol: string } } }) {
  const theme = useTheme();
  const symbol = route.params?.symbol ?? '—';

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <PausedBanner />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{symbol}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Stock Detail — coming in Milestone 9
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center' },
});