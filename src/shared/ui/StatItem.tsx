import { memo } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface StatItemProps {
  label: string;
  value: string;
  secondary?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: ViewStyle;
}

export const StatItem = memo(function StatItem({ label, value, secondary, color, align = 'left', style }: StatItemProps) {
  const theme = useTheme();

  const textAlign: ViewStyle['alignItems'] = align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';
  const valueColor = color ?? theme.colors.text;
  const secondaryColor = color ?? theme.colors.textMuted;

  return (
    <View
      style={[
        styles.container,
        { alignItems: textAlign },
        style,
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {secondary && <Text style={[styles.secondary, { color: secondaryColor }]}>{secondary}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 2 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  value: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  secondary: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
