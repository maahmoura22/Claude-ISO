import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadHistory, clearHistory, deleteHistoryEntry } from '../utils/storage';

const MODE_COLORS = {
  'CÁLCULO ISO':           '#1565C0',
  'VERIFICAÇÃO':           '#2E7D32',
  'SELEÇÃO POR APLICAÇÃO': '#E65100',
  'NORMA ISO — COMPARAÇÃO':'#6A1B9A',
};

function HistoryItem({ item, onDelete }) {
  const color = MODE_COLORS[item.mode] || '#546E7A';
  const date = new Date(item.timestamp);
  const dateStr = `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <View style={[styles.item, { borderLeftColor: color }]}>
      <View style={styles.itemHeader}>
        <View style={[styles.modeBadge, { backgroundColor: color }]}>
          <Text style={styles.modeText}>{item.mode}</Text>
        </View>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      <View style={styles.itemBody}>
        {item.nominal != null && (
          <Text style={styles.detail}>Ø Nominal: <Text style={styles.bold}>{item.nominal} mm</Text></Text>
        )}
        {item.fit && (
          <Text style={styles.detail}>Ajuste: <Text style={styles.bold}>{item.fit}</Text></Text>
        )}
        {item.fitType && (
          <Text style={styles.detail}>Tipo: <Text style={styles.bold}>{item.fitType}</Text></Text>
        )}
        {item.status && (
          <Text style={[styles.detail, { color: item.status === 'OK' ? '#2E7D32' : '#C62828' }]}>
            Status: <Text style={styles.bold}>{item.status}</Text>
          </Text>
        )}
        {item.equipment && (
          <Text style={styles.detail}>Equipamento: <Text style={styles.bold}>{item.equipment}</Text></Text>
        )}
        {item.config && (
          <Text style={styles.detail}>Config: <Text style={styles.bold}>{item.config}</Text></Text>
        )}
        {item.suggestedFits && (
          <Text style={styles.detail}>Ajustes sugeridos: <Text style={styles.bold}>{item.suggestedFits}</Text></Text>
        )}
        {item.bestISOFit && (
          <Text style={styles.detail}>Melhor ISO: <Text style={styles.bold}>{item.bestISOFit}</Text></Text>
        )}
        {item.bestCompatibility && (
          <Text style={styles.detail}>Compatibilidade: <Text style={styles.bold}>{item.bestCompatibility}</Text></Text>
        )}
        {item.maxClearance != null && (
          <Text style={styles.detail}>
            Folga/Interf.: <Text style={styles.bold}>{item.minClearance} a {item.maxClearance} μm</Text>
          </Text>
        )}
        {item.holeMin && (
          <Text style={styles.detail}>
            Furo: <Text style={styles.bold}>{item.holeMin} / {item.holeMax}</Text>
          </Text>
        )}
        {item.shaftMin && (
          <Text style={styles.detail}>
            Eixo: <Text style={styles.bold}>{item.shaftMin} / {item.shaftMax}</Text>
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
        <Text style={styles.deleteText}>Excluir</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(h => { setHistory(h); setLoading(false); });
    }, [])
  );

  async function handleDelete(id) {
    await deleteHistoryEntry(id);
    setHistory(prev => prev.filter(e => e.id !== id));
  }

  async function handleClearAll() {
    Alert.alert(
      'Limpar histórico',
      'Tem certeza? Todos os registros serão apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar tudo',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setHistory([]);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Carregando...</Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>Histórico vazio</Text>
        <Text style={styles.emptySub}>Os cálculos salvos aparecerão aqui</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.header}>Histórico</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearBtn}>Limpar tudo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>{history.length} registro{history.length !== 1 ? 's' : ''}</Text>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <HistoryItem item={item} onDelete={handleDelete} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, marginBottom: 4 },
  header: { fontSize: 20, fontWeight: '800', color: '#1565C0' },
  sub: { fontSize: 13, color: '#546E7A', marginHorizontal: 16, marginBottom: 8 },
  clearBtn: { fontSize: 13, color: '#C62828', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  item: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginVertical: 5,
    borderLeftWidth: 4, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  modeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dateText: { fontSize: 11, color: '#90A4AE' },
  itemBody: { marginBottom: 8 },
  detail: { fontSize: 13, color: '#546E7A', marginBottom: 2 },
  bold: { fontWeight: '700', color: '#1A1A1A' },
  deleteBtn: { alignSelf: 'flex-end' },
  deleteText: { fontSize: 12, color: '#EF5350', fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#546E7A' },
  emptySub: { fontSize: 13, color: '#90A4AE', marginTop: 4 },
});
