import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrderSide } from '../domain/types';

export type RootStackParamList = {
  Tabs: undefined;
  StockDetail: { symbol: string };
  Trade: { symbol: string; side: OrderSide };
};

export type TabParamList = {
  Portfolio: undefined;
  Watchlist: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Tab screens may also navigate to root-stack routes such as StockDetail. */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type PortfolioScreenProps = TabScreenProps<'Portfolio'>;
export type WatchlistScreenProps = TabScreenProps<'Watchlist'>;
export type StockDetailScreenProps = RootStackScreenProps<'StockDetail'>;
export type TradeScreenProps = RootStackScreenProps<'Trade'>;
