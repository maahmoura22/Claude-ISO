import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import InputField from '../components/InputField';
import ResultCard from '../components/ResultCard';
import { calcHoleLimits, calcShaftLimits, formatDeviation, formatDiameter } from '../utils/calculations';
import { saveHistoryEntry } from '../utils/storage';

export default function VerificationScreen() {
  const [nominal,      setNominal]      = useState('');
  const [holeFit,      setHoleFit]      = useState('H7');
  const [shaftFit,     setShaftFit]     = useState('k6');
  const [realHoleMin,  setRealHoleMin]  = useState('');
  const [realHoleMax,  setRealHoleMax]  = useState('');
  const [realShaftMin, setRealShaftMin] = useState('');
  const [realShaftMax, setRealShaftMax] = useState('');
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState('');

  function handleVerify() {
    setError('');
    setResult(null);

    const d  = parseFloat(nominal);
    const hMin = parseFloat(realHoleMin);
    const hMax = parseFloat(realHoleMax);
    const sMin = parseFloat(realShaftMin);
    const sMax = parseFloat(realShaftMax);

    if ([d, hMin, hMax, sMin, sMax].some(v => isNaN(v))) {
      setError('Preencha todos os campos corretamente');
      return;
    }
    if (hMin > hMax) { setError('Furo: mínimo deve ser ≤ máximo'); return; }
    if (sMin > sMax) { setError('Eixo: mínimo deve ser ≤ máximo'); return; }

    const hole  = calcHoleLimits(d, holeFit);
    const shaft = calcShaftLimits(d, shaftFit);

    if (!hole || !shaft) {
      setError('Designação de ajuste inválida');
      return;
    }

    const holeOK  = hMin >= hole.minDiam  - 0.00001 && hMax <= hole.maxDiam  + 0.00001;
    const shaftOK = sMin >= shaft.minDiam - 0.00001 && sMax <= shaft.maxDiam + 0.00001;

    const actualMaxClearance = (hMax - sMin) * 1000;
    const actualMinClearance = (hMin - sMax) * 1000;

    const holeDev_EI = (hMin - d) * 1000;
    const holeDev_ES = (hMax - d) * 1000;
    const shaftDev_ei = (sMin - d) * 1000;
    const shaftDev_es = (sMax - d) * 1000;

    setResult({
      hole, shaft,
      holeOK, shaftOK,
      overallOK: holeOK && shaftOK,
      actualMaxClearance,
      actualMinClearance,
      holeDev_EI, holeDev_ES,
      shaftDev_ei, shaftDev_es,
      hMin, hMax, sMin, sMax,
      nominal: d,
    });
  }

  async function handleSave() {
    if (!result) return;
    await saveHistoryEntry({
      mode: 'VERIFICAÇÃO',
      nominal: result.nominal,
      fit: `${holeFit}/${shaftFit}`,
      status: result.overallOK ? 'OK' : 'NOK',
      holeOK: result.holeOK,
      shaftOK: result.shaftOK,
      actualMaxClearance: result.actualMaxClearance.toFixed(1),
      actualMinClearance: result.actualMinClearance.toFixed(1),
    });
    Alert.alert('Salvo', 'Resultado salvo no histórico.');
  }

  function StatusBadge({ ok, label }) {
    return (
      <View style={[styles.badge, { backgroundColor: ok ? '#2E7D32' : '#C62828' }]}>
        <Text style={styles.badgeText}>{ok ? '✔ OK' : '✘ NOK'} — {label}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Modo 2 — Verificação</Text>
      <Text style={styles.sub}>Confira se as dimensões reais estão dentro da tolerância</Text>

      <View style={styles.form}>
        <InputField label="Diâmetro Nominal (mm)" value={nominal} onChangeText={setNominal} placeholder="Ex: 50" />

        <View style={styles.fitRow}>
          <InputField
            label="Furo (designação)"
            value={holeFit}
            onChangeText={t => setHoleFit(t.toUpperCase().trim())}
            placeholder="H7"
            keyboardType="default"
            style={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Eixo (designação)"
            value={shaftFit}
            onChangeText={t => setShaftFit(t.toLowerCase().trim())}
            placeholder="k6"
            keyboardType="default"
            style={{ flex: 1 }}
          />
        </View>

        <Text style={styles.sectionLabel}>Dimensões Reais Medidas</Text>

        <View style={styles.fitRow}>
          <InputField
            label="Furo Mín. (mm)"
            value={realHoleMin}
            onChangeText={setRealHoleMin}
            placeholder="50.000"
            style={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Furo Máx. (mm)"
            value={realHoleMax}
            onChangeText={setRealHoleMax}
            placeholder="50.021"
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.fitRow}>
          <InputField
            label="Eixo Mín. (mm)"
            value={realShaftMin}
            onChangeText={setRealShaftMin}
            placeholder="50.002"
            style={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Eixo Máx. (mm)"
            value={realShaftMax}
            onChangeText={setRealShaftMax}
            placeholder="50.018"
            style={{ flex: 1 }}
          />
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={handleVerify}>
          <Text style={styles.calcBtnText}>VERIFICAR</Text>
        </TouchableOpacity>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {result && (
        <View style={styles.results}>
          <ResultCard
            title="Resultado Geral"
            color={result.overallOK ? '#2E7D32' : '#C62828'}
          >
            <View style={[styles.overallBadge, { backgroundColor: result.overallOK ? '#2E7D32' : '#C62828' }]}>
              <Text style={styles.overallText}>
                {result.overallOK ? '✔  APROVADO' : '✘  REPROVADO'}
              </Text>
            </View>
          </ResultCard>

          <ResultCard title="Furo" color={result.holeOK ? '#1565C0' : '#C62828'}>
            <StatusBadge ok={result.holeOK} label="Furo" />
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Limite mínimo (EI)</Text>
                <Text style={styles.dimValue}>{result.hole.minDiam.toFixed(4)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.hole.EI)} mm</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Real medido</Text>
                <Text style={[styles.dimValue, { color: result.holeOK ? '#1565C0' : '#C62828' }]}>
                  {result.hMin.toFixed(4)} → {result.hMax.toFixed(4)}
                </Text>
                <Text style={styles.devSmall}>
                  {formatDeviation(result.holeDev_EI)} / {formatDeviation(result.holeDev_ES)} mm
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Limite máximo (ES)</Text>
                <Text style={styles.dimValue}>{result.hole.maxDiam.toFixed(4)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.hole.ES)} mm</Text>
              </View>
            </View>
          </ResultCard>

          <ResultCard title="Eixo" color={result.shaftOK ? '#6A1B9A' : '#C62828'}>
            <StatusBadge ok={result.shaftOK} label="Eixo" />
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Limite mínimo (ei)</Text>
                <Text style={styles.dimValue}>{result.shaft.minDiam.toFixed(4)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.shaft.ei)} mm</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Real medido</Text>
                <Text style={[styles.dimValue, { color: result.shaftOK ? '#6A1B9A' : '#C62828' }]}>
                  {result.sMin.toFixed(4)} → {result.sMax.toFixed(4)}
                </Text>
                <Text style={styles.devSmall}>
                  {formatDeviation(result.shaftDev_ei)} / {formatDeviation(result.shaftDev_es)} mm
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Limite máximo (es)</Text>
                <Text style={styles.dimValue}>{result.shaft.maxDiam.toFixed(4)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.shaft.es)} mm</Text>
              </View>
            </View>
          </ResultCard>

          <ResultCard title="Folga / Interferência Real">
            <Text style={styles.resultLine}>
              Máx. folga/interferência:{' '}
              <Text style={styles.bold}>
                {result.actualMaxClearance > 0
                  ? `${result.actualMaxClearance.toFixed(1)} μm (folga)`
                  : `${(-result.actualMaxClearance).toFixed(1)} μm (interferência)`}
              </Text>
            </Text>
            <Text style={styles.resultLine}>
              Mín. folga/interferência:{' '}
              <Text style={styles.bold}>
                {result.actualMinClearance > 0
                  ? `${result.actualMinClearance.toFixed(1)} μm (folga)`
                  : `${(-result.actualMinClearance).toFixed(1)} μm (interferência)`}
              </Text>
            </Text>
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
  calcBtn: {
    backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginVertical: 8,
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  errorText: { color: '#C62828', textAlign: 'center', marginTop: 4, fontSize: 13 },
  results: { marginHorizontal: 16, marginTop: 4, paddingBottom: 30 },
  overallBadge: { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  overallText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', marginTop: 4 },
  col: { flex: 1, paddingHorizontal: 2 },
  colLabel: { fontSize: 10, color: '#78909C', marginBottom: 2 },
  dimValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  devSmall: { fontSize: 10, color: '#90A4AE' },
  resultLine: { fontSize: 14, color: '#333', marginBottom: 4 },
  bold: { fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
