import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SEVERITY_COLORS, STATUS_COLORS } from '../theme/colors';

export function SeverityBadge({ severity, size = 'medium' }) {
  const config = SEVERITY_COLORS[severity] || {
    color: COLORS.low,
    bg: COLORS.lowBg,
    border: COLORS.lowBorder,
  };

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 8,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color, fontSize: isSmall ? 11 : 12 }]}>
        {severity}
      </Text>
    </View>
  );
}

export function StatusBadge({ status, size = 'medium' }) {
  const config = STATUS_COLORS[status] || {
    color: COLORS.textMuted,
    label: status,
  };

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${config.color}20`,
          borderColor: `${config.color}40`,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 8,
        },
      ]}
    >
      <Text style={[styles.text, { color: config.color, fontSize: isSmall ? 11 : 12 }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
