import { useQuote } from '../store/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { StyleSheet, Text, View } from 'react-native';
import { ListRow } from '../shared/ui/ListRow';
import { Chip } from '../shared/ui/Chip';
import { fmtINR, fmtPct, fmtSignedINR } from '../shared/utils/format';

interface AddSymbolRowProps {
  symbol: string;
  isAdded: boolean;
  onPress: () => void;
}

export function AddSymbolRow({ symbol, isAdded, onPress }: AddSymbolRowProps) {
  const theme = useTheme();
  const quote = useQuote(symbol);

  return (
    <ListRow
      onPress={isAdded ? undefined : onPress}
      disabled={isAdded}
      leading={<Text style={[styles.symbol, { color: isAdded ? theme.colors.textMuted : theme.colors.text }]}>{symbol}</Text>}
      trailing={
        <View style={styles.trailing}>
          {quote ? (
            <>
              <Text style={[styles.price, { color: theme.colors.text }]}>{fmtINR(quote.ltpPaise)}</Text>
              {quote.prevClosePaise !== null && (
                <Text style={[styles.change, { color: quote.ltpPaise >= quote.prevClosePaise! ? theme.colors.gain : theme.colors.loss }]}>
                  {fmtSignedINR(quote.ltpPaise - quote.prevClosePaise!)} ({fmtPct(((quote.ltpPaise - quote.prevClosePaise!) / quote.prevClosePaise!) * 100)})
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.price, { color: theme.colors.textMuted }]}>—</Text>
          )}
          {isAdded && <Chip label="Added" selected disabled style={styles.addedChip} />}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: { alignItems: 'flex-end', minWidth: 120, gap: 4 },
  price: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  symbol: { fontSize: 16, fontWeight: '700' },
  addedChip: { marginTop: 4 },
});