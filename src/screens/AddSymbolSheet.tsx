import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { ALLOWED_SYMBOLS } from '../domain/seed';
import { useTheme } from '../theme/ThemeProvider';
import { ModalSheet } from '../shared/ui/ModalSheet';
import { Divider } from '../shared/ui/Divider';
import { fmtINR, fmtPct, fmtSignedINR } from '../shared/utils/format';
import { AddSymbolRow } from './AddSymbolRow';

interface AddSymbolSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => void;
  existingSymbols: ReadonlySet<string>;
}

export function AddSymbolSheet({ visible, onClose, onAdd, existingSymbols }: AddSymbolSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const availableSymbols = useMemo(() => {
    const filtered = ALLOWED_SYMBOLS.filter((s) => !existingSymbols.has(s));
    if (!query.trim()) return filtered;
    const q = query.trim().toUpperCase();
    return filtered.filter((s) => s.includes(q));
  }, [existingSymbols, query]);

  const renderItem = ({ item }: { item: string }) => (
    <AddSymbolRow
      symbol={item}
      isAdded={existingSymbols.has(item)}
      onPress={() => onAdd(item)}
    />
  );

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
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  listContent: { paddingBottom: 24 },
});