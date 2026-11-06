import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  SUMMARY_INTERVAL_MS,
  useMarketVersion,
  useQuote,
} from '../../../store/marketStore';
import { fmtINR, fmtInt, fmtRelativeTime } from '../../../shared/utils/format';
import type { Quote } from '../../../domain/types';

type StatValue = number | null | undefined;

const STATS: readonly {
  key: keyof Quote;
  label: string;
  getValue: (quote: Quote) => StatValue;
}[] = [
  { key: 'openPaise', label: 'Open', getValue: q => q.openPaise },
  { key: 'highPaise', label: 'High', getValue: q => q.highPaise },
  { key: 'lowPaise', label: 'Low', getValue: q => q.lowPaise },
  { key: 'prevClosePaise', label: 'Prev Close', getValue: q => q.prevClosePaise },
  { key: 'volume', label: 'Volume', getValue: q => q.volume },
  { key: 'updatedAt', label: 'Updated', getValue: q => q.updatedAt },
];

interface StatGridProps {
  symbol: string;
}

export const StatGrid = memo(function StatGrid({ symbol }: StatGridProps) {
  const theme = useTheme();
  const quote = useQuote(symbol);
  const version = useMarketVersion(SUMMARY_INTERVAL_MS);

  const rows = useMemo(() => {
    if (!quote) {
      return STATS.map(s => ({ ...s, formatted: '—' }));
    }
    return STATS.map(stat => {
      const raw = stat.getValue(quote);
      let formatted: string;
      switch (stat.key) {
        case 'openPaise':
        case 'highPaise':
        case 'lowPaise':
        case 'prevClosePaise':
          formatted = raw !== null ? fmtINR(raw) : '—';
          break;
        case 'volume':
          formatted = raw !== null ? fmtInt(raw) : '—';
          break;
        case 'updatedAt':
          formatted = raw ? fmtRelativeTime(raw) : '—';
          break;
        default:
          formatted = '—';
      }
      return { ...stat, formatted };
    });
  }, [quote, version]);

  return (
    <View style={[styles.grid, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {/* Row 1 */}
      <View style={styles.row}>
        {rows.slice(0, 3).map((row, i) => (
          <View key={row.key} style={[styles.cell, i > 0 && styles.borderLeft]}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>{row.label}</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>{row.formatted}</Text>
          </View>
        ))}
      </View>
      {/* Row 2 */}
      <View style={[styles.row, styles.borderTop]}>
        {rows.slice(3, 6).map((row, i) => (
          <View key={row.key} style={[styles.cell, i > 0 && styles.borderLeft]}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>{row.label}</Text>
            <Text style={[styles.value, { color: theme.colors.text }]}>{row.formatted}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  borderTop: {
    borderTopWidth: 1,
  },
  cell: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    minWidth: '33.33%',
  },
  borderLeft: {
    borderLeftWidth: 1,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});