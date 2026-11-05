import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatINR,
  formatPercent,
  formatSignedINR,
} from '../../../domain/money';
import type { Holding } from '../../../domain/types';
import { useSummary } from '../../../store/hooks';
import { useTheme } from '../../../theme/ThemeProvider';

interface SummaryCardProps {
  holdings: readonly Holding[];
}

function unpricedCaption(symbols: readonly string[]): string {
  if (symbols.length === 1) {
    return `Excludes 1 unpriced holding (${symbols[0] ?? ''}).`;
  }
  return `Excludes ${symbols.length} unpriced holdings (${symbols.join(', ')}).`;
}

/**
 * Subscribes to the coalesced summary cadence (250 ms), so the rest of the
 * screen is not re-rendered on every tick. Totals are the sums of the same
 * integer paise values the rows display.
 */
export const SummaryCard = memo(function SummaryCard({
  holdings,
}: SummaryCardProps) {
  const theme = useTheme();
  const summary = useSummary(holdings);

  const totalPnlColor =
    summary.pnlPaise > 0
      ? theme.colors.gain
      : summary.pnlPaise < 0
        ? theme.colors.loss
        : theme.colors.textMuted;
  const dayPnlColor =
    summary.dayPnlPaise === null || summary.dayPnlPaise === 0
      ? theme.colors.textMuted
      : summary.dayPnlPaise > 0
        ? theme.colors.gain
        : theme.colors.loss;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        Current value
      </Text>
      <Text
        style={[styles.heroValue, { color: theme.colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatINR(summary.currentValuePaise)}
      </Text>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <MetricLine
        label="Invested"
        value={formatINR(summary.investedPaise)}
        color={theme.colors.text}
      />
      <MetricLine
        label="Total P&L"
        value={formatSignedINR(summary.pnlPaise)}
        secondary={formatPercent(summary.pnlPct)}
        color={totalPnlColor}
      />
      <MetricLine
        label="Today's P&L"
        value={
          summary.dayPnlPaise === null
            ? '—'
            : formatSignedINR(summary.dayPnlPaise)
        }
        secondary={formatPercent(summary.dayPct)}
        color={dayPnlColor}
      />

      {summary.unpricedSymbols.length > 0 ? (
        <Text style={[styles.caption, { color: theme.colors.textMuted }]}>
          {unpricedCaption(summary.unpricedSymbols)}
        </Text>
      ) : null}
      {summary.missingPrevCloseSymbols.length > 0 ? (
        <Text style={[styles.caption, { color: theme.colors.textMuted }]}>
          {`Today's P&L excludes ${summary.missingPrevCloseSymbols.length} holding${
            summary.missingPrevCloseSymbols.length === 1 ? '' : 's'
          } without a previous close (${summary.missingPrevCloseSymbols.join(', ')}).`}
        </Text>
      ) : null}
    </View>
  );
});

function MetricLine({
  label,
  value,
  secondary,
  color,
}: {
  label: string;
  value: string;
  secondary?: string;
  color: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.metricLine}>
      <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.metricValues}>
        <Text
          style={[styles.metricValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {secondary ? (
          <Text style={[styles.metricSecondary, { color }]}>{secondary}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  metricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
    gap: 12,
  },
  metricLabel: {
    fontSize: 13,
  },
  metricValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metricSecondary: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    marginTop: 10,
    fontSize: 11.5,
    lineHeight: 16,
  },
});
