import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface ListRowProps {
  leading: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  swipeActions?: readonly { label: string; color: string; onPress: () => void }[];
  chevron?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export const ListRow = memo(function ListRow({ leading, trailing, onPress, swipeActions, chevron = false, style, contentStyle }: ListRowProps) {
  const theme = useTheme();

  const Content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }, contentStyle]}>
      <View style={{ flex: 1, minWidth: 0 }}>{leading}</View>
      {trailing && <View style={{ flexShrink: 0, marginLeft: 12 }}>{trailing}</View>}
      {chevron && (
        <Text style={{ color: theme.colors.textMuted, fontSize: 18, fontWeight: '300' }}>›</Text>
      )}
    </View>
  );

  if (!onPress && !swipeActions) {
    return <View style={[{ backgroundColor: theme.colors.background }, style]}>{Content}</View>;
  }

  if (onPress && !swipeActions) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chevron ? 'Navigate' : undefined}
        onPress={onPress}
        style={({ pressed }) => [{ backgroundColor: theme.colors.background, opacity: pressed ? 0.65 : 1 }, style]}
      >
        {Content}
      </Pressable>
    );
  }

  return <View style={[{ backgroundColor: theme.colors.background }, style]}>{Content}</View>;
});

ListRow.displayName = 'ListRow';
