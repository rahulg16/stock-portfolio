import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuote } from '../store/hooks';
import { ALLOWED_SYMBOLS } from '../domain/seed';
import { useTheme } from '../theme/ThemeProvider';
import { ModalSheet } from '../shared/ui/ModalSheet';
import { ListRow } from '../shared/ui/ListRow';
import { Chip } from '../shared/ui/Chip';
import { Divider } from '../shared/ui/Divider';
import { fmtINR, fmtPct, fmtSignedINR } from '../shared/utils/format';

interface AddSymbolSheetProps {
  visible: boolean;
  onClose: () => void;
  existingSymbols: ReadonlySet<string>;
}

export function AddSymbolSheet({ visible, onClose, existingSymbols }: AddSymbolSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const availableSymbols = useMemo(() => {
    const filtered = ALLOWED_SYMBOLS.filter((s) => !existingSymbols.has(s));
    if (!query.trim()) return filtered;
    const q = query.trim().toUpperCase();
    return filtered.filter((s) => s.includes(q));
  }, [existingSymbols, query]);

  const renderItem = ({ item }: { item: string }) => {
    const isAdded = existingSymbols.has(item);
    const quote = useQuote(item);

    return (
      <ListRow
        onPress={isAdded ? undefined : () => { onClose(); }}
        disabled={isAdded}
        leading={<Text style={[styles.symbol, { color: isAdded ? theme.colors.textMuted : theme.colors.text }]}>{item}</Text>}
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
  };

  if (!visible) return null;

  return (
    <ModalSheet
      title="Add Symbol"
      onClose={onClose}
      contentStyle={styles.sheetContent}
    >
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search symbols"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Search symbols to add"
        />
      </View>
      <Divider inset={16} />
      <FlatList
        data={availableSymbols}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        maxToRenderPerBatch={10}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {query.trim() ? 'No matching symbols' : 'All symbols already added'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: { paddingTop: 8 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  trailing: { alignItems: 'flex-end', minWidth: 120, gap: 4 },
  price: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  symbol: { fontSize: 16, fontWeight: '700' },
  addedChip: { marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  listContent: { paddingBottom: 24 },
});