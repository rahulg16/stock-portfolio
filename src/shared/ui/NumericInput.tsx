import { memo, useState, useCallback, forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface NumericInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  max?: number;
  error?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  onBlur?: () => void;
  style?: ViewStyle;
}

export const NumericInput = memo(forwardRef<TextInput, NumericInputProps>(
  ({ value, onChangeText, label, placeholder, max, error, disabled = false, accessibilityLabel, onBlur, style, ...rest }, ref) => {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);

    const hasError = Boolean(error);
    const borderColor = hasError
      ? theme.colors.danger
      : focused
        ? theme.colors.accent
        : theme.colors.border;

    const handleChange = useCallback(
      (text: string) => {
        const numeric = text.replace(/[^0-9]/g, '');
        onChangeText(numeric);
      },
      [onChangeText]
    );

    return (
      <View style={[{ ...styles.container }, style]}>
        {label && <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={ref as any}
            accessibilityLabel={accessibilityLabel ?? label}
            value={value}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); onBlur?.(); }}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            
            editable={!disabled}
            returnKeyType="done"
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor,
              },
            ]}
            {...rest}
          />
          {value.length > 0 && !disabled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear"
              onPress={() => onChangeText('')}
              hitSlop={10}
            >
              <Text style={[styles.clear, { color: theme.colors.textMuted }]}>✕</Text>
            </Pressable>
          )}
        </View>
        {hasError && <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>}
      </View>
    );
  }
));

NumericInput.displayName = 'NumericInput';

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    minHeight: 52,
  },
  clear: { fontSize: 16, fontWeight: '700', paddingLeft: 8, paddingRight: 4 },
  error: { fontSize: 12, marginTop: 2 },
});
