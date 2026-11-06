import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, SafeAreaView, Pressable } from 'react-native';
import { ALLOWED_SYMBOLS } from '../domain/seed';
import { useTheme } from '../theme/ThemeProvider';
import { useQuote } from '../store/marketStore';
import { watchlistStore } from '../store/watchlistStore';
import { ListRow } from '../shared/ui/ListRow';
import { Chip } from '../shared/ui/Chip';
import { Divider } from '../shared/ui/Divider';
import { fmtINR, fmtPct, fmtSignedINR } from '../shared/utils/format';
import { useNavigation, useRoute } from '@react-navigation/native';

interface AddSymbolRowProps {
  symbol: string;
  isAdded: boolean;
  onPress: () => void;
}

const AddSymbolRow = memo(function AddSymbolRow({ symbol, isAdded, onPress }: AddSymbolRowProps) {
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
});

AddSymbolRow.displayName = 'AddSymbolRow';

export function AddSymbolScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const existingSymbols = new Set(route.params?.existingSymbols ?? []);
  const [query, setQuery] = useState('');

  const availableSymbols = useMemo(() => {
    if (!query.trim()) return ALLOWED_SYMBOLS;
    const q = query.trim().toUpperCase();
    return ALLOWED_SYMBOLS.filter((s) => s.includes(q));
  }, [query]);

  const handleAdd = useCallback((symbol: string) => {
    if (!existingSymbols.has(symbol)) {
      watchlistStore.getState().add(symbol);
    }
    navigation.goBack();
  }, [existingSymbols, navigation]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <AddSymbolRow
        symbol={item}
        isAdded={existingSymbols.has(item)}
        onPress={() => handleAdd(item)}
      />
    ),
    [existingSymbols, handleAdd],
  );

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Grabber */}
      <View style={styles.grabberContainer}>
        <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Add Symbol</Text>
        <Pressable onPress={handleClose} hitSlop={16} accessibilityLabel="Close">
          <Text style={[styles.closeButton, { color: theme.colors.text }]}>✕</Text>
        </Pressable>
      </View>

      <Divider inset={16} />

      {/* Search input */}
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

      {/* List */}
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
    </SafeAreaView>
  );
}

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
  closeButton: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 32,
  },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  searchInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  trailing: { alignItems: 'flex-end', minWidth: 120, gap: 4 },
  price: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  symbol: { fontSize: 16, fontWeight: '700' },
  addedChip: { marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  listContent: { paddingBottom: 24, paddingHorizontal: 16 },
});