import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useQuote } from "../store/hooks";
import { watchlistStore } from "../store/watchlistStore";
import { ALLOWED_SYMBOLS } from "../domain/seed";
import { useTheme } from "../theme/ThemeProvider";
import { PausedBanner } from "../components/PausedBanner";
import { EmptyView } from "../components/EmptyView";
import { LoadingView } from "../components/LoadingView";
import { AddSymbolSheet } from "./AddSymbolSheet";
import { ListRow } from "../shared/ui/ListRow";
import { Divider } from "../shared/ui/Divider";
import { fmtINR, fmtPct, fmtSignedINR } from "../shared/utils/format";
import { Button } from "../shared/ui/Button";

const ROW_HEIGHT = 72;

interface WatchlistRowProps {
  symbol: string;
  onPress: () => void;
  onDelete: () => void;
}

function WatchlistRow({ symbol, onPress, onDelete }: WatchlistRowProps) {
  const theme = useTheme();
  const quote = useQuote(symbol);

  const ltp = quote ? fmtINR(quote.ltpPaise) : "—";
  const dayChange =
    quote && quote.prevClosePaise !== null
      ? quote.ltpPaise - quote.prevClosePaise
      : null;
  const dayPct =
    quote && quote.prevClosePaise !== null
      ? ((quote.ltpPaise - quote.prevClosePaise) / quote.prevClosePaise) * 100
      : null;

  const dayChangeColor =
    dayChange === null || dayChange === 0
      ? theme.colors.textMuted
      : dayChange > 0
        ? theme.colors.gain
        : theme.colors.loss;

  const renderRightActions = useCallback(
    () => (
      <View style={rowStyles.swipeAction}>
        <Button
          title="Delete"
          variant="danger"
          fullWidth
          onPress={onDelete}
          accessibilityLabel={`Delete ${symbol} from watchlist`}
        />
      </View>
    ),
    [onDelete, symbol],
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      leftThreshold={80}
      rightThreshold={80}
      overshootFriction={3}
    >
      <ListRow
        onPress={onPress}
        chevron
        leading={
          <Text style={[rowStyles.symbol, { color: theme.colors.text }]}>
            {symbol}
          </Text>
        }
        trailing={
          <View style={rowStyles.trailing}>
            <Text style={[rowStyles.price, { color: theme.colors.text }]}>
              {ltp}
            </Text>
            <Text style={[rowStyles.change, { color: dayChangeColor }]}>
              {dayChange !== null
                ? `${fmtSignedINR(dayChange)} (${fmtPct(dayPct)})`
                : "—"}
            </Text>
          </View>
        }
      />
    </Swipeable>
  );
}

const rowStyles = StyleSheet.create({
  trailing: { alignItems: "flex-end", minWidth: 140 },
  price: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  change: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  symbol: { fontSize: 16, fontWeight: "700" },
  swipeAction: { flex: 1, justifyContent: "center", paddingRight: 16 },
});

export function WatchlistScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const symbols = watchlistStore.getSymbols();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const data = useMemo(() => symbols, [symbols.length]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <WatchlistRow
        symbol={item}
        onPress={() => navigation.navigate("StockDetail", { symbol: item })}
        onDelete={() => watchlistStore.remove(item)}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: string) => item, []);
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <SafeAreaView
      style={[
        screenStyles.screen,
        { backgroundColor: theme.colors.background },
      ]}
      edges={["top", "right", "bottom", "left"]}
    >
      <View style={screenStyles.header}>
        <Text style={[screenStyles.title, { color: theme.colors.text }]}>
          Watchlist
        </Text>
        <Button
          title="+"
          variant="ghost"
          onPress={() => setShowAddSheet(true)}
          accessibilityLabel="Add symbol"
          style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8 }}
        />
      </View>

      <PausedBanner />

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
        ListEmptyComponent={
          <EmptyView
            title="No symbols yet"
            message="Add symbols to track their prices live."
            actionLabel="Add symbol"
            onAction={() => setShowAddSheet(true)}
          />
        }
        contentContainerStyle={screenStyles.listContent}
      />

      <AddSymbolSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdd={(symbol) => {
          watchlistStore.add(symbol);
          setShowAddSheet(false);
        }}
        existingSymbols={new Set(symbols)}
      />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  listContent: { paddingTop: 8, paddingBottom: 24 },
});
