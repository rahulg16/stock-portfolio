import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  SUMMARY_INTERVAL_MS,
  useMarketVersion,
  useQuote,
} from '../../../store/marketStore';
import { calculateHolding } from '../../../domain/calculations';
import { useHolding } from '../../../store/portfolioStore';
import { fmtINR, fmtSignedINR, fmtPct } from '../../../shared/utils/format';

interface PositionCardProps {
  symbol: string;
}

export const PositionCard = memo(function PositionCard({ symbol }: PositionCardProps) {
  const theme = useTheme();
  const holding = useHolding(symbol);
  const quote = useQuote(symbol);
  const version = useMarketVersion(SUMMARY_INTERVAL_MS);

  if (!holding) return null;

  const metrics = useMemo(() => calculateHolding(holding, quote), [holding, quote, version]);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Position</Text>
        <Text style={[styles.symbol, { color: theme.colors.textMuted }]}>{symbol}</Text>
      </View>

      <View style={styles.grid}>
        <StatRow label="Quantity" value={holding.qty.toLocaleString('en-IN')} color={theme.colors.text} />
        <StatRow label="Avg Price" value={fmtINR(holding.avgPricePaise)} color={theme.colors.text} />
        <StatRow label="Invested" value={fmtINR(metrics.investedPaise)} color={theme.colors.text} />
        <StatRow
          label="Current"
          value={metrics.currentValuePaise !== null ? fmtINR(metrics.currentValuePaise) : '—'}
          color={theme.colors.text}
        />
        <StatRow
          label="P&L"
          value={metrics.pnlPaise !== null ? fmtSignedINR(metrics.pnlPaise) : '—'}
          secondary={metrics.pnlPct !== null ? fmtPct(metrics.pnlPct) : undefined}
          color={metrics.pnlPaise === null || metrics.pnlPaise === 0
            ? theme.colors.textMuted
            : metrics.pnlPaise > 0
              ? theme.colors.gain
              : theme.colors.loss}
        />
        <StatRow
          label="Day P&L"
          value={metrics.dayPnlPaise !== null ? fmtSignedINR(metrics.dayPnlPaise) : '—'}
          secondary={metrics.dayPct !== null ? fmtPct(metrics.dayPct) : undefined}
          color={metrics.dayPnlPaise === null || metrics.dayPnlPaise === 0
            ? theme.colors.textMuted
            : metrics.dayPnlPaise > 0
              ? theme.colors.gain
              : theme.colors.loss}
        />
      </View>
    </View>
  );
});

function StatRow({ label, value, secondary, color }: { label: string; value: string; secondary?: string; color: string }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        <Text style={[styles.statLabel, { color: color }]}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      {secondary && <Text style={[styles.statSecondary, { color }]}>{secondary}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  symbol: { fontSize: 13, fontWeight: '600' },
  grid: { gap: 10 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLeft: { gap: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  statValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statSecondary: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});