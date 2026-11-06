import { useCallback, useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuote } from '../store/marketStore';
import { useHolding } from '../store/portfolioStore';
import { useTheme } from '../theme/ThemeProvider';
import { PausedBanner } from '../components/PausedBanner';
import { PriceChart } from './StockDetail/components/PriceChart';
import { PositionCard } from './StockDetail/components/PositionCard';
import { StatGrid } from './StockDetail/components/StatGrid';
import { fmtINR, fmtSignedINR, fmtPct } from '../shared/utils/format';
import { Button } from '../shared/ui/Button';

export function StockDetailScreen({ route, navigation }: { route: { params?: { symbol: string } }; navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const symbol = route.params?.symbol ?? '';
  const quote = useQuote(symbol);
  const holding = useHolding(symbol);

  const ltp = quote ? fmtINR(quote.ltpPaise) : '—';
  const dayChange = quote && quote.prevClosePaise !== null
    ? quote.ltpPaise - quote.prevClosePaise
    : null;
  const dayPct = quote && quote.prevClosePaise !== null
    ? ((quote.ltpPaise - quote.prevClosePaise) / quote.prevClosePaise) * 100
    : null;

  const dayChangeColor = dayChange === null || dayChange === 0
    ? theme.colors.textMuted
    : dayChange > 0
      ? theme.colors.gain
      : theme.colors.loss;

  const handleTrade = useCallback(() => {
    navigation.navigate('BuySellSheet', { symbol });
  }, [navigation, symbol]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{symbol}</Text>
      </View>

      <PausedBanner />

      <View style={styles.content}>
        {/* Hero: LTP + Day Change */}
        <View style={styles.hero}>
          <Text style={[styles.ltp, { color: theme.colors.text }]}>{ltp}</Text>
          <Text style={[styles.dayChange, { color: dayChangeColor }]}>
            {dayChange !== null
              ? `${fmtSignedINR(dayChange)} (${fmtPct(dayPct)})`
              : '—'}
          </Text>
        </View>

        {/* Stats Grid */}
        <StatGrid symbol={symbol} />

        {/* Position Card (conditional) */}
        <PositionCard symbol={symbol} />

        {/* Price Chart */}
        <View style={styles.chartSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Price Chart</Text>
          <PriceChart symbol={symbol} />
        </View>
      </View>

      {/* Buy/Sell Action */}
      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={holding ? 'Buy / Sell' : 'Trade'}
          variant="primary"
          fullWidth
          onPress={handleTrade}
          disabled={!quote}
          accessibilityLabel={`Trade ${symbol}`}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  content: { flex: 1, paddingHorizontal: 16, gap: 16 },
  hero: { alignItems: 'center', paddingTop: 8 },
  ltp: { fontSize: 42, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  dayChange: { fontSize: 16, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  chartSection: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  bottomAction: { position: 'absolute', left: 16, right: 16, bottom: 0 },
});