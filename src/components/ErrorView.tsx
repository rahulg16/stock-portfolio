import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export interface ErrorViewProps {
  title: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

/** Full-screen blocking error used when the first price fetch fails. */
export function ErrorView({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorViewProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.dangerBackground }]}>
        <Text style={[styles.iconText, { color: theme.colors.danger }]}>!</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.colors.accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: theme.colors.textInverse }]}>
          {retryLabel}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

export interface InlineErrorBannerProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

/** Non-blocking error strip; existing prices and ticks stay visible. */
export function InlineErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
}: InlineErrorBannerProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.inline,
        {
          backgroundColor: theme.colors.dangerBackground,
          borderColor: theme.colors.danger,
        },
      ]}
    >
      <Text style={[styles.inlineText, { color: theme.colors.danger }]}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        onPress={onRetry}
        hitSlop={8}
      >
        <Text style={[styles.inlineAction, { color: theme.colors.danger }]}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  button: {
    minWidth: 132,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  inlineAction: {
    fontSize: 13,
    fontWeight: '700',
  },
});
