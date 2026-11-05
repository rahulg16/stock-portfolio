import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SegmentedControlProps {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export const SegmentedControl = memo(function SegmentedControl({ options, value, onChange, disabled = false, accessibilityLabel, style, ...rest }: SegmentedControlProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      {...rest}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${option.label}${selected ? ', selected' : ''}`}
            onPress={() => !disabled && onChange(option.key)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: theme.colors.accentMuted },
              pressed && !selected && { backgroundColor: theme.colors.border },
            ]}
            hitSlop={4}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: selected ? theme.colors.accent : theme.colors.textMuted,
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
  );
});

SegmentedControl.displayName = 'SegmentedControl';

const styles = StyleSheet.create({
  container: {
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
  segmentText: { fontSize: 13 },
});
