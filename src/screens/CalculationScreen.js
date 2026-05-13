import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import InputField from '../components/InputField';
import ResultCard from '../components/ResultCard';
import { calcFit, formatDeviation, formatDiameter } from '../utils/calculations';
import { DIAMETER_RANGES, COMMON_FITS } from '../utils/isoData';
import { saveHistoryEntry } from '../utils/storage';

const FIT_OPTIONS = Object.keys(COMMON_FITS);

export default function CalculationScreen() {
  const [nominal, setNominal]       = useState('');
  const [holeFit, setHoleFit]       = useState('H7');
  const [shaftFit, setShaftFit]     = useState('k6');
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');

  function handleCalculate() {
    setError('');
    setResult(null);
    const d = parseFloat(nominal);
    if (isNaN(d) || d <= 0 || d > 500) {
      setError('Diâmetro nominal inválido (0–500 mm)');
      return;
    }
    const rangeOK = DIAMETER_RANGES.some(r => d > r.min && d <= r.max);
    if (!rangeOK && d !== 0) {
      setError('Diâmetro fora da faixa ISO (até 500 mm)');
      return;
    }

    const res = calcFit(d, holeFit, shaftFit);
    if (!res) {
      setError('Designação de ajuste inválida. Ex: H7, k6');
      return;
    }
    setResult(res);
  }

  async function handleSave() {
    if (!result) return;
    await saveHistoryEntry({
      mode: 'CÁLCULO ISO',
      nominal: result.nominal,
      fit: `${holeFit}/${shaftFit}`,
      fitType: result.fit.fitType,
      holeMin: result.hole.minDiam.toFixed(4),
      holeMax: result.hole.maxDiam.toFixed(4),
      shaftMin: result.shaft.minDiam.toFixed(4),
      shaftMax: result.shaft.maxDiam.toFixed(4),
      maxClearance: result.fit.maxClearance,
      minClearance: result.fit.minClearance,
    });
    Alert.alert('Salvo', 'Resultado salvo no histórico.');
  }

  const fitTypeColor = result
    ? result.fit.isClearance ? '#1565C0' : result.fit.isInterference ? '#B71C1C' : '#E65100'
    : '#333';

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Modo 1 — Cálculo ISO</Text>
      <Text style={styles.sub}>Insira o diâmetro nominal e o ajuste desejado</Text>

      <View style={styles.form}>
        <InputField
          label="Diâmetro Nominal (mm)"
          value={nominal}
          onChangeText={setNominal}
          placeholder="Ex: 50"
          hint="Faixa: 0–500 mm"
        />

        <Text style={styles.sectionLabel}>Ajuste (Furo / Eixo)</Text>
        <View style={styles.fitRow}>
          <InputField
            label="Furo"
            value={holeFit}
            onChangeText={t => setHoleFit(t.toUpperCase().trim())}
            placeholder="H7"
            keyboardType="default"
            style={{ flex: 1, marginRight: 8 }}
            hint="Ex: H7, G6"
          />
          <InputField
            label="Eixo"
            value={shaftFit}
            onChangeText={t => setShaftFit(t.toLowerCase().trim())}
            placeholder="k6"
            keyboardType="default"
            style={{ flex: 1 }}
            hint="Ex: k6, p6, h6"
          />
        </View>

        <Text style={styles.sectionLabel}>Ajustes rápidos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFits}>
          {FIT_OPTIONS.map(fit => {
            const [h, s] = fit.split('/');
            const selected = holeFit === h && shaftFit === s;
            return (
              <TouchableOpacity
                key={fit}
                style={[styles.fitChip, selected && styles.fitChipSelected]}
                onPress={() => { setHoleFit(h); setShaftFit(s); }}
              >
                <Text style={[styles.fitChipText, selected && styles.fitChipTextSelected]}>
                  {fit}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate}>
          <Text style={styles.calcBtnText}>CALCULAR</Text>
        </TouchableOpacity>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {result && (
        <View style={styles.results}>
          <ResultCard title={`Ajuste ${holeFit}/${shaftFit}`} color={fitTypeColor}>
            <Text style={[styles.fitTypeBadge, { backgroundColor: fitTypeColor }]}>
              {result.fit.fitType}
            </Text>
            <Text style={styles.fitDesc}>{COMMON_FITS[`${holeFit}/${shaftFit}`]?.desc || ''}</Text>
          </ResultCard>

          <ResultCard title="Furo" color="#1565C0">
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Desvio Inferior (EI)</Text>
                <Text style={styles.devValue}>{formatDeviation(result.hole.EI)} mm</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Desvio Superior (ES)</Text>
                <Text style={styles.devValue}>{formatDeviation(result.hole.ES)} mm</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Ø Mínimo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.nominal, result.hole.EI)}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Ø Máximo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.nominal, result.hole.ES)}</Text>
              </View>
            </View>
            <Text style={styles.itLabel}>Tolerância IT: {result.hole.IT} μm</Text>
          </ResultCard>

          <ResultCard title="Eixo" color="#6A1B9A">
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Desvio Inferior (ei)</Text>
                <Text style={styles.devValue}>{formatDeviation(result.shaft.ei)} mm</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Desvio Superior (es)</Text>
                <Text style={styles.devValue}>{formatDeviation(result.shaft.es)} mm</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Ø Mínimo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.nominal, result.shaft.ei)}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Ø Máximo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.nominal, result.shaft.es)}</Text>
              </View>
            </View>
            <Text style={styles.itLabel}>Tolerância IT: {result.shaft.IT} μm</Text>
          </ResultCard>

          <ResultCard
            title="Folga / Interferência"
            color={result.fit.isClearance ? '#1565C0' : result.fit.isInterference ? '#B71C1C' : '#E65100'}
          >
            {result.fit.isClearance && (
              <>
                <Text style={styles.resultLine}>
                  Folga mínima: <Text style={styles.bold}>{result.fit.minClearance} μm</Text>
                </Text>
                <Text style={styles.resultLine}>
                  Folga máxima: <Text style={styles.bold}>{result.fit.maxClearance} μm</Text>
                </Text>
                {result.fit.minClearance < 5 && (
                  <Text style={styles.warn}>⚠️ Folga muito pequena — risco de gripagem</Text>
                )}
              </>
            )}
            {result.fit.isInterference && (
              <>
                <Text style={styles.resultLine}>
                  Interferência mín: <Text style={styles.bold}>{-result.fit.maxClearance} μm</Text>
                </Text>
                <Text style={styles.resultLine}>
                  Interferência máx: <Text style={styles.bold}>{-result.fit.minClearance} μm</Text>
                </Text>
                {-result.fit.maxClearance < 5 && (
                  <Text style={styles.warn}>⚠️ Interferência mínima insuficiente</Text>
                )}
              </>
            )}
            {result.fit.isTransition && (
              <>
                <Text style={styles.resultLine}>
                  Pode ser folga (máx): <Text style={styles.bold}>{result.fit.maxClearance} μm</Text>
                </Text>
                <Text style={styles.resultLine}>
                  Pode ser interferência (máx): <Text style={styles.bold}>{result.fit.maxInterference} μm</Text>
                </Text>
              </>
            )}
          </ResultCard>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>💾 SALVAR NO HISTÓRICO</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { fontSize: 20, fontWeight: '800', color: '#1565C0', margin: 16, marginBottom: 4 },
  sub: { fontSize: 13, color: '#546E7A', marginHorizontal: 16, marginBottom: 12 },
  form: { marginHorizontal: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4, marginBottom: 6 },
  fitRow: { flexDirection: 'row' },
  quickFits: { marginBottom: 12 },
  fitChip: {
    borderWidth: 1, borderColor: '#90A4AE', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff',
  },
  fitChipSelected: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  fitChipText: { fontSize: 13, color: '#546E7A', fontWeight: '600' },
  fitChipTextSelected: { color: '#fff' },
  calcBtn: {
    backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginVertical: 8,
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  errorText: { color: '#C62828', textAlign: 'center', marginTop: 4, fontSize: 13 },
  results: { marginHorizontal: 16, marginTop: 4, paddingBottom: 30 },
  fitTypeBadge: {
    color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4,
  },
  fitDesc: { fontSize: 13, color: '#546E7A', marginTop: 2 },
  row: { flexDirection: 'row', marginBottom: 8 },
  col: { flex: 1 },
  colLabel: { fontSize: 11, color: '#78909C', marginBottom: 2 },
  devValue: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  dimValue: { fontSize: 16, fontWeight: '700', color: '#1565C0' },
  divider: { height: 1, backgroundColor: '#ECEFF1', marginVertical: 8 },
  itLabel: { fontSize: 11, color: '#90A4AE', marginTop: 4 },
  resultLine: { fontSize: 14, color: '#333', marginBottom: 4 },
  bold: { fontWeight: '700' },
  warn: { fontSize: 12, color: '#E65100', marginTop: 6, backgroundColor: '#FFF3E0', padding: 6, borderRadius: 4 },
  saveBtn: {
    backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
