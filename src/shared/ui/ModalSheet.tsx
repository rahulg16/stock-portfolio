import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface ModalSheetProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  grabber?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export const ModalSheet = memo(function ModalSheet({ title, children, onClose, grabber = true, style, contentStyle }: ModalSheetProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
        style,
      ]}
    >
      <View style={styles.header}>
        {grabber && <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />}
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={16}
        >
          <Text style={[styles.close, { color: theme.colors.textMuted }]}>✕</Text>
        </Pressable>
      </View>
      <View style={[{ flex: 1, paddingHorizontal: 16, paddingBottom: 24 }, contentStyle]}>{children}</View>
    </View>
  );
});

ModalSheet.displayName = 'ModalSheet';

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, marginTop: 4, alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  close: { fontSize: 20, fontWeight: '700', paddingHorizontal: 4 },
});
