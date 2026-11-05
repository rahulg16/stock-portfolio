import { memo, forwardRef, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const VARIANTS = ['primary', 'secondary', 'danger', 'ghost'] as const;

export const Button = memo(forwardRef<Pressable, ButtonProps>(
  ({ title, onPress, variant = 'primary', disabled = false, loading = false, fullWidth = false, accessibilityLabel, style, ...rest }, ref) => {
    const theme = useTheme();

    const baseStyle: ViewStyle = {
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      ...(fullWidth ? { width: '100%' } : { minWidth: 132 }),
    };

    const variantStyles: Record<string, ViewStyle> = {
      primary: { backgroundColor: theme.colors.accent },
      secondary: { backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
      danger: { backgroundColor: theme.colors.dangerBackground, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.danger },
      ghost: { backgroundColor: 'transparent' },
    };

    const textStyles: Record<string, TextStyle> = {
      primary: { color: theme.colors.textInverse },
      secondary: { color: theme.colors.text },
      danger: { color: theme.colors.danger },
      ghost: { color: theme.colors.accent },
    };

    const v = VARIANTS.includes(variant) ? variant : 'primary';
    const pressedOpacity = v === 'ghost' ? 0.5 : 0.8;
    const opacity = disabled || loading ? 0.5 : 1;

    return (
      <Pressable
        ref={ref as any}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: disabled || loading }}
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          variantStyles[v],
          style,
          { opacity: pressed ? pressedOpacity : opacity },
        ]}
        disabled={disabled || loading}
        hitSlop={8}
        {...rest}
      >
        {loading ? (
          <Text style={[styles.loadingText, textStyles[v]]}>{title}</Text>
        ) : (
          <Text style={[styles.buttonText, textStyles[v]]}>{title}</Text>
        )}
      </Pressable>
    );
  }
));

Button.displayName = 'Button';

const styles = StyleSheet.create({
  buttonText: { fontSize: 16, fontWeight: '600' },
  loadingText: { fontSize: 16, fontWeight: '600', opacity: 0.7 },
});
