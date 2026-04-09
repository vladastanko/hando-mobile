import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Toast, ToastType } from '../../hooks/useToast';
import { colors, radius, spacing, fontSize } from '../../theme';

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const bgMap: Record<ToastType, string> = {
  success: colors.ok,
  error:   colors.err,
  info:    colors.brand,
};

export function ToastArea({ toasts, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View style={[styles.container, { top: insets.top + 60 }]}>
      {toasts.map(t => (
        <Pressable key={t.id} onPress={() => onDismiss(t.id)} style={[styles.toast, { backgroundColor: bgMap[t.type] }]}>
          <Text style={styles.text}>{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    zIndex: 999,
    gap: spacing[2],
  },
  toast: {
    borderRadius: radius.md,
    padding: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
});
