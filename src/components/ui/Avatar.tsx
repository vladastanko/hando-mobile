import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme';

interface Props {
  url?: string | null;
  name?: string;
  size?: number;
}

export function Avatar({ url, name, size = 40 }: Props) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const r = size / 2;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: colors.bgSub }}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.brand,
    fontWeight: '700',
  },
});
