import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calculateHolding } from '../domain/calculations';
import {
  formatINR,
  formatIndianInteger,
  formatPercent,
  formatSignedINR,
} from '../domain/money';
import type { Holding } from '../domain/types';
import { useQuote } from '../store/hooks';
import { useTheme } from '../theme/ThemeProvider';

export const HOLDING_ROW_HEIGHT = 78;

interface HoldingRowProps {
  holding: Holding;
  onPress?: (symbol: string) => void;
}

/**
 * The only component that subscribes to this holding's live quote. A RELIANCE
 * tick commits this row and nothing else.
 */
export const HoldingRow = memo(function HoldingRow({
  holding,
  onPress,
}: HoldingRowProps) {
  const theme = useTheme();
  const quote = useQuote(holding.symbol);
  const metrics = useMemo(
    () => calculateHolding(holding, quote),
    [holding, quote],
  );

  const pnlColor =
    metrics.pnlPaise === null || metrics.pnlPaise === 0
      ? theme.colors.textMuted
      : metrics.pnlPaise > 0
        ? theme.colors.gain
        : theme.colors.loss;

  const lastPrice = quote ? formatINR(quote.ltpPaise) : '—';
  const pnlValue =
    metrics.pnlPaise === null ? '—' : formatSignedINR(metrics.pnlPaise);
  const pnlPercent =
    metrics.pnlPct === null ? '—' : formatPercent(metrics.pnlPct);

  const accessibilityLabel = [
    holding.symbol,
    `${holding.qty} shares`,
    `average price ${formatINR(holding.avgPricePaise)}`,
    quote ? `last price ${lastPrice}` : 'price unavailable',
    metrics.pnlPaise === null
      ? 'profit and loss unavailable'
      : `profit and loss ${pnlValue}, ${pnlPercent}`,
  ].join(', ');

  const content = (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={styles.identity}>
        <Text style={[styles.symbol, { color: theme.colors.text }]} numberOfLines={1}>
          {holding.symbol}
        </Text>
        <Text
          style={[styles.subline, { color: theme.colors.textMuted }]}
          numberOfLines={1}
        >
          {`${formatIndianInteger(holding.qty)} @ ${formatINR(holding.avgPricePaise)}`}
        </Text>
      </View>

      <View style={styles.priceBlock}>
        <Text
          style={[styles.price, { color: theme.colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {lastPrice}
        </Text>
        <Text style={[styles.blockLabel, { color: theme.colors.textMuted }]}>
          LTP
        </Text>
      </View>

      <View style={styles.pnlBlock}>
        <Text
          style={[styles.pnl, { color: pnlColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {pnlValue}
        </Text>
        <Text style={[styles.pnlPercent, { color: pnlColor }]} numberOfLines={1}>
          {pnlPercent}
        </Text>
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(holding.symbol)}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: HOLDING_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
  },
  subline: {
    marginTop: 3,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  priceBlock: {
    width: 100,
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  blockLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  pnlBlock: {
    width: 108,
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pnlPercent: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.65,
  },
});
