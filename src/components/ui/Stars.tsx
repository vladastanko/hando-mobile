import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface Props {
  value: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}

export function Stars({ value, max = 5, size = 16, interactive = false, onChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <Pressable key={i} onPress={() => interactive && onChange?.(i + 1)} disabled={!interactive}>
          <Ionicons
            name={value > i ? 'star' : 'star-outline'}
            size={size}
            color={value > i ? '#f59e0b' : colors.tx3}
          />
        </Pressable>
      ))}
    </View>
  );
}
