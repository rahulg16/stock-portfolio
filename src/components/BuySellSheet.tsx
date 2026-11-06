import { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SegmentedControl } from '../shared/ui/SegmentedControl';
import { NumericInput } from '../shared/ui/NumericInput';
import { Button } from '../shared/ui/Button';
import { Divider } from '../shared/ui/Divider';
import { fmtINR } from '../shared/utils/format';
import { validateQty } from '../shared/utils/validation';
import { useNavigation, useRoute } from '@react-navigation/native';

interface BuySellSheetProps {
  symbol: string;
  onClose: () => void;
}

export function BuySellSheet({ symbol, onClose }: BuySellSheetProps) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const symbolFromRoute = route.params?.symbol ?? symbol;
  const theme = useTheme();
  const quote = useQuote(symbolFromRoute);
  const holding = useHolding(symbolFromRoute);

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('');
  const [qtyError, setQtyError] = useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset qty when side changes
  useEffect(() => {
    setQty('');
    setQtyError(undefined);
    setConfirmError(undefined);
  }, [side]);

  // Validate quantity on change
  const handleQtyChange = useCallback((text: string) => {
    setQty(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const max = side === 'SELL' ? holding?.qty : undefined;
      const error = validateQty(text, max);
      setQtyError(error ?? undefined);
    }, 150);
  }, [side, holding?.qty]);

  const estimatedValue = qty && quote
    ? fmtINR(Math.round(Number(qty) * quote.ltpPaise))
    : '—';

  const canConfirm = !qtyError && qty.length > 0 && quote && !loading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    setConfirmError(undefined);

    const currentQuote = marketStore.getState().quotes.get(symbolFromRoute);
    if (!currentQuote) {
      setConfirmError('Price unavailable, try again');
      setLoading(false);
      return;
    }

    try {
      portfolioStore
        .getState()
        .applyOrder(symbolFromRoute, side, Number(qty), currentQuote.ltpPaise);
      onClose();
      navigation.goBack();
    } catch (e: any) {
      setConfirmError(e.message ?? 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const availableText = side === 'SELL' && holding
    ? `Available: ${holding.qty.toLocaleString('en-IN')}`
    : '';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Grabber */}
      <View style={styles.grabberContainer}>
        <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {side} {symbolFromRoute}
        </Text>
        <Button
          title="✕"
          variant="ghost"
          onPress={() => { onClose(); navigation.goBack(); }}
          accessibilityLabel="Close"
          style={{ minWidth: 40, minHeight: 40, padding: 0 }}
        />
      </View>

      <Divider inset={16} />

      {/* Scrollable content */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.content}>
        {/* Buy/Sell Toggle */}
        <SegmentedControl
          options={[
            { key: 'BUY', label: 'Buy' },
            { key: 'SELL', label: 'Sell' },
          ]}
          value={side}
          onChange={(key) => setSide(key as 'BUY' | 'SELL')}
          accessibilityLabel="Order side"
        />

        {/* Quantity Input */}
        <NumericInput
          label="Quantity"
          value={qty}
          onChangeText={handleQtyChange}
          placeholder="Enter quantity"
          max={side === 'SELL' ? holding?.qty : undefined}
          error={qtyError}
          accessibilityLabel={`${side.toLowerCase()} quantity`}
          disabled={loading}
        />
        {availableText && (
          <Text style={[styles.available, { color: theme.colors.textMuted }]}>{availableText}</Text>
        )}

        {/* Estimated Value */}
        <View style={styles.estimate}>
          <Text style={[styles.estimateLabel, { color: theme.colors.textMuted }]}>Estimated Value</Text>
          <Text style={[styles.estimateValue, { color: theme.colors.accent }]}>{estimatedValue}</Text>
        </View>

        {/* Confirm Error */}
        {confirmError && (
          <Text style={[styles.confirmError, { color: theme.colors.danger }]}>{confirmError}</Text>
        )}
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={styles.bottomAction}>
        <Button
          title={loading ? 'Processing...' : `Confirm ${side}`}
          variant="primary"
          fullWidth
          onPress={handleConfirm}
          disabled={!canConfirm}
          loading={loading}
          accessibilityLabel={`${side.toLowerCase()} ${qty} shares of ${symbolFromRoute}`}
        />
      </View>
    </SafeAreaView>
  );
}

import { marketStore, useQuote } from '../store/marketStore';
import { portfolioStore, useHolding } from '../store/portfolioStore';

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grabberContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100, // space for fixed button
    gap: 16,
  },
  available: { fontSize: 13 },
  estimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
  },
  estimateLabel: { fontSize: 14, fontWeight: '600' },
  estimateValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirmError: { fontSize: 13, textAlign: 'center' },
  bottomAction: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingBottom: 16,
  },
});