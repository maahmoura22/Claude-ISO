import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ResultCard({ title, children, color = '#1565C0', style }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }, style]}>
      {title && <Text style={[styles.title, { color }]}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginVertical: 6,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
