import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarketBootstrap } from '../bootstrap/MarketBootstrap';
import { EmptyView } from '../components/EmptyView';
import { InlineErrorBanner } from '../components/ErrorView';
import { HOLDING_ROW_HEIGHT, HoldingRow } from '../components/HoldingRow';
import { PausedBanner } from '../components/PausedBanner';
import { SummaryCard } from '../components/SummaryCard';
import { filterHoldings, sortHoldings } from '../domain/calculations';
import type { Holding, HoldingSortKey } from '../domain/types';
import {
  SORT_INTERVAL_MS,
  useHoldings,
  useMarketVersion,
} from '../store/hooks';
import { marketStore } from '../store/marketStore';
import { useTheme } from '../theme/ThemeProvider';

const SORT_OPTIONS: readonly { key: HoldingSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
];

/**
 * Portfolio home.
 *
 * Only the SummaryCard and individual rows subscribe to live quotes.
 * This screen re-renders at most once per second (sort order) or on user input,
 * which keeps the list smooth while ~20 ticks/second arrive.
 */
export function PortfolioScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh, refreshing, refreshError } = useMarketBootstrap();
  const holdings = useHoldings();

  const liveSortVersion = useMarketVersion(SORT_INTERVAL_MS);
  const [frozenSortVersion, setFrozenSortVersion] = useState<number | null>(null);
  const sortVersion = frozenSortVersion ?? liveSortVersion;

  const [sortKey, setSortKey] = useState<HoldingSortKey>('name');
  const [query, setQuery] = useState('');

  const data = useMemo(() => {
    const filtered = filterHoldings(holdings, query);
    return sortHoldings(filtered, marketStore.getQuotes(), sortKey);
  }, [holdings, query, sortKey, sortVersion]);

  const handleScrollBegin = useCallback(() => {
    setFrozenSortVersion(liveSortVersion);
  }, [liveSortVersion]);
  const handleScrollSettled = useCallback(() => {
    setFrozenSortVersion(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Holding }) => <HoldingRow holding={item} />,
    [],
  );
  const keyExtractor = useCallback((item: Holding) => item.symbol, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<Holding> | null | undefined, index: number) => ({
      length: HOLDING_ROW_HEIGHT,
      offset: HOLDING_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const hasHoldings = holdings.length > 0;
  const trimmedQuery = query.trim();
  const emptyTitle = hasHoldings ? 'No matching holdings' : 'No holdings yet';
  const emptyMessage = hasHoldings
    ? `No symbols match “${trimmedQuery}”.`
    : 'Your portfolio is empty.';
  const clearFilter = useCallback(() => setQuery(''), []);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 6,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Portfolio
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {hasHoldings
            ? `${holdings.length} holdings · live prices`
            : 'Live prices'}
        </Text>
      </View>

      <View style={styles.padded}>
        <PausedBanner />
        <SummaryCard holdings={holdings} />
        {refreshError ? (
          <InlineErrorBanner
            message={refreshError}
            onRetry={() => {
              void refresh();
            }}
          />
        ) : null}

        <View
          style={[
            styles.segmented,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {SORT_OPTIONS.map((option) => {
            const selected = option.key === sortKey;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Sort by ${option.label}`}
                onPress={() => setSortKey(option.key)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: theme.colors.accentMuted },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: selected
                        ? theme.colors.accent
                        : theme.colors.textMuted,
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <TextInput
            accessibilityLabel="Filter holdings by symbol"
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by symbol"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear filter"
              hitSlop={10}
              onPress={clearFilter}
            >
              <Text style={[styles.clear, { color: theme.colors.textMuted }]}>
                ✕
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollSettled}
        onMomentumScrollEnd={handleScrollSettled}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          data.length === 0 && styles.listEmptyContent,
        ]}
        ListEmptyComponent={
          <EmptyView
            title={emptyTitle}
            message={emptyMessage}
            actionLabel={hasHoldings && trimmedQuery.length > 0 ? 'Clear filter' : undefined}
            onAction={clearFilter}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  padded: {
    paddingHorizontal: 16,
    gap: 10,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  clear: {
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 8,
  },
  listContent: {
    paddingTop: 6,
  },
  listEmptyContent: {
    flexGrow: 1,
  },
});
