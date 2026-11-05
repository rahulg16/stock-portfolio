import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import {
  MarketBootstrapProvider,
  useMarketBootstrap,
} from './src/bootstrap/MarketBootstrap';
import { ErrorView } from './src/components/ErrorView';
import { LoadingView } from './src/components/LoadingView';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

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

  return <RootNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <MarketBootstrapProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <AppGate />
          </NavigationContainer>
        </MarketBootstrapProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});