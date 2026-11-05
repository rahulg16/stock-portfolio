import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  MarketBootstrapProvider,
  useMarketBootstrap,
} from './src/bootstrap/MarketBootstrap';
import { ErrorView } from './src/components/ErrorView';
import { LoadingView } from './src/components/LoadingView';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { ThemeProvider } from './src/theme/ThemeProvider';

function AppGate() {
  const { status, error, retry } = useMarketBootstrap();

  if (status === 'loading') {
    return <LoadingView />;
  }

  if (status === 'error') {
    return (
      <ErrorView
        title="Couldn't load market prices"
        message={error ?? 'The price service is unavailable. Please try again.'}
        onRetry={retry}
      />
    );
  }

  return <PortfolioScreen />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <MarketBootstrapProvider>
            <StatusBar style="auto" />
            <AppGate />
          </MarketBootstrapProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
