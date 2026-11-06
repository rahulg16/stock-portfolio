import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';
import { AddSymbolScreen } from '../screens/AddSymbolScreen';
import { useTheme } from '../theme/ThemeProvider';
import { BuySellSheet } from '../components/BuySellSheet';
import { useNavigation, useRoute } from '@react-navigation/native';

function BuySellSheetWrapper() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const symbol = route.params?.symbol ?? '';

  return <BuySellSheet symbol={symbol} onClose={() => navigation.goBack()} />;
}

type RootStackParamList = {
  Root: undefined;
  StockDetail: { symbol: string };
  BuySellSheet: { symbol: string };
  AddSymbol: { existingSymbols: string[] };
};

type TabParamList = {
  Portfolio: undefined;
  Watchlist: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

type PortfolioTabProps = BottomTabScreenProps<TabParamList, 'Portfolio'>;
type WatchlistTabProps = BottomTabScreenProps<TabParamList, 'Watchlist'>;

function PortfolioTab({ navigation }: PortfolioTabProps) {
  return <PortfolioScreen navigation={navigation} />;
}

function WatchlistTab({ navigation }: WatchlistTabProps) {
  return <WatchlistScreen navigation={navigation} />;
}

function StockDetailStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTitleAlign: 'center',
        headerTintColor: 'inherit',
      }}
    >
      <Stack.Screen
        name="StockDetail"
        component={StockDetailScreen}
        options={({ route }) => ({
          title: route.params.symbol ?? 'Detail',
        })}
      />
      <Stack.Screen
        name="BuySellSheet"
        component={BuySellSheetWrapper}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="AddSymbol"
        component={AddSymbolScreen}
        options={{
          title: 'Add Symbol',
          headerTitleAlign: 'center',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarStyle: { backgroundColor: theme.colors.tabBar, borderTopWidth: 0, elevation: 0 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icon = route.name === 'Portfolio' ? '📊' : '⭐';
          return (
            <View style={{ width: 24, height: 24 }}>
              <Text style={{ fontSize: 22, textAlign: 'center', color }}>{icon}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Portfolio" component={PortfolioTab} options={{ tabBarLabel: 'Portfolio' }} />
      <Tab.Screen name="Watchlist" component={WatchlistTab} options={{ tabBarLabel: 'Watchlist' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator({ children }: { children?: ReactNode }) {
  return (
    <SafeAreaProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Root" component={TabNavigator} />
        <Stack.Screen name="StockDetail" component={StockDetailStack} />
      </Stack.Navigator>
    </SafeAreaProvider>
  );
}