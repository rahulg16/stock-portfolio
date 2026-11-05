import { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Modal } from 'react-native';
import { useQuote } from '../store/hooks';
import { portfolioStore } from '../store/portfolioStore';
import { marketStore } from '../store/marketStore';
import { useTheme } from '../theme/ThemeProvider';
import { SegmentedControl } from '../shared/ui/SegmentedControl';
import { NumericInput } from '../shared/ui/NumericInput';
import { Button } from '../shared/ui/Button';
import { Divider } from '../shared/ui/Divider';
import { fmtINR } from '../shared/utils/format';
import { validateQty } from '../shared/utils/validation';

interface BuySellSheetProps {
  symbol: string;
  onClose: () => void;
}

export function BuySellSheet({ symbol, onClose }: BuySellSheetProps) {
  const theme = useTheme();
  const quote = useQuote(symbol);
  const holding = portfolioStore.getHolding(symbol);

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

    const currentQuote = marketStore.getQuote(symbol);
    if (!currentQuote) {
      setConfirmError('Price unavailable, try again');
      setLoading(false);
      return;
    }

    try {
      portfolioStore.applyOrder(symbol, side, Number(qty), currentQuote.ltpPaise);
      onClose();
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
    <Modal
      visible={true}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={true}
    >
      <View style={styles.overlay} onTouchStart={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
        <View style={styles.grabberContainer}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
        </View>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {side} {symbol}
          </Text>
          <Button
            title="✕"
            variant="ghost"
            onPress={onClose}
            accessibilityLabel="Close"
            style={{ minWidth: 40, minHeight: 40, padding: 0 }}
          />
        </View>

        <Divider inset={16} />

        <View style={styles.content}>
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
        </View>

        <Divider inset={16} />

        <Button
          title={loading ? 'Processing...' : `Confirm ${side}`}
          variant="primary"
          fullWidth
          onPress={handleConfirm}
          disabled={!canConfirm}
          loading={loading}
          accessibilityLabel={`${side.toLowerCase()} ${qty} shares of ${symbol}`}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  grabberContainer: {
    alignItems: 'center',
    paddingTop: 12,
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
});