import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  align?: 'center' | 'flex-start';
}

export function Brand({ size = 'md', align = 'center' }: BrandProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const markWidth = isLg ? 44 : isSm ? 30 : 38;
  const markHeight = isLg ? 48 : isSm ? 34 : 42;
  const iconSize = isLg ? 28 : isSm ? 18 : 24;
  const fontSize = isLg ? 36 : isSm ? 22 : 30;
  const subSize = isLg ? 8.5 : isSm ? 6.5 : 7.5;
  const subLetterSpacing = isLg ? 2.8 : isSm ? 1.8 : 2.3;

  return (
    <View style={[styles.container, { alignItems: align }]}>
      <View style={styles.brandRow}>
        <View
          style={[
            styles.brandMark,
            {
              width: markWidth,
              height: markHeight,
              borderRadius: isSm ? 8 : 12,
            },
          ]}
        >
          <MaterialIcons name="show-chart" size={iconSize} color="#223528" />
        </View>

        <View style={styles.textCol}>
          <Text style={[styles.pulseText, { fontSize }]}>
            pulse<Text style={styles.brandDot}>.</Text>
          </Text>
          <Text
            style={[
              styles.subText,
              {
                fontSize: subSize,
                letterSpacing: subLetterSpacing,
              },
            ]}
          >
            SPORTS CENTER
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: '-6deg' }],
  },
  textCol: {
    justifyContent: 'center',
  },
  pulseText: {
    fontWeight: '800',
    color: '#F3F7F1',
    letterSpacing: -1.5,
    lineHeight: undefined,
    fontFamily: 'BeVietnamPro_800ExtraBold',
  },
  brandDot: {
    color: Colors.primary,
  },
  subText: {
    fontWeight: '600',
    color: '#A1B0A4',
    fontFamily: 'BeVietnamPro_600SemiBold',
    marginTop: 2,
  },
});
