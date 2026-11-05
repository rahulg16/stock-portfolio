import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Chip = memo(function Chip({ label, onPress, selected = false, disabled = false, style }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: theme.colors.accentMuted },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: selected ? theme.colors.accent : disabled ? theme.colors.textMuted : theme.colors.text,
            fontWeight: selected ? '600' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

Chip.displayName = 'Chip';

const styles = StyleSheet.create({
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  chipText: { fontSize: 13 },
});
