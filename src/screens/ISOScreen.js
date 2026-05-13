import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import InputField from '../components/InputField';
import ResultCard from '../components/ResultCard';
import {
  calcFit, findClosestISOFit, getCompatibilityStatus, formatDeviation, formatDiameter
} from '../utils/calculations';
import { COMMON_FITS } from '../utils/isoData';
import { saveHistoryEntry } from '../utils/storage';

export default function ISOScreen() {
  const [nominal,       setNominal]       = useState('');
  const [customIntMin,  setCustomIntMin]  = useState('');
  const [customIntMax,  setCustomIntMax]  = useState('');
  const [selectedFit,   setSelectedFit]   = useState('H7/k6');
  const [mode,          setMode]          = useState('compare'); // 'compare' | 'find'
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState('');

  function handleCompare() {
    setError('');
    setResult(null);
    const d = parseFloat(nominal);
    if (isNaN(d) || d <= 0 || d > 500) {
      setError('Diâmetro nominal inválido (0–500 mm)');
      return;
    }
    const min = parseFloat(customIntMin);
    const max = parseFloat(customIntMax);
    if (isNaN(min) || isNaN(max)) {
      setError('Preencha a faixa de interferência/folga interna (em μm)');
      return;
    }
    if (min > max) {
      setError('Mínimo deve ser ≤ máximo');
      return;
    }

    const [hd, sd] = selectedFit.split('/');
    const isoResult = calcFit(d, hd, sd);
    if (!isoResult) {
      setError('Ajuste ISO inválido');
      return;
    }

    const isoMin = isoResult.fit.minClearance;
    const isoMax = isoResult.fit.maxClearance;

    const overlapMin = Math.max(isoMin, min);
    const overlapMax = Math.min(isoMax, max);
    const overlap = Math.max(0, overlapMax - overlapMin);
    const rangeCustom = max - min;
    const rangeISO    = isoMax - isoMin;
    const compat = rangeCustom > 0 ? Math.round((overlap / Math.max(rangeCustom, rangeISO)) * 100) : 0;

    const alternatives = findClosestISOFit(d, min, max);

    setResult({ d, isoResult, isoMin, isoMax, min, max, compat, alternatives, selectedFit });
  }

  function handleFind() {
    setError('');
    setResult(null);
    const d = parseFloat(nominal);
    if (isNaN(d) || d <= 0 || d > 500) {
      setError('Diâmetro nominal inválido (0–500 mm)');
      return;
    }
    const min = parseFloat(customIntMin);
    const max = parseFloat(customIntMax);
    if (isNaN(min) || isNaN(max)) {
      setError('Preencha a faixa de interferência/folga interna (em μm)');
      return;
    }

    const alternatives = findClosestISOFit(d, min, max);
    setResult({ d, min, max, alternatives, mode: 'find' });
  }

  async function handleSave() {
    if (!result) return;
    const best = result.alternatives?.[0];
    await saveHistoryEntry({
      mode: 'NORMA ISO — COMPARAÇÃO',
      nominal: result.d,
      customRange: `${result.min} a ${result.max} μm`,
      isoFitCompared: result.selectedFit || '-',
      isoCompatibility: result.compat !== undefined ? `${result.compat}%` : '-',
      bestISOFit: best?.fitName || '-',
      bestCompatibility: best ? `${best.compatibility}%` : '-',
    });
    Alert.alert('Salvo', 'Resultado salvo no histórico.');
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Modo 4 — Norma ISO</Text>
      <Text style={styles.sub}>Comparar padrão interno com norma ISO 286</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'compare' && styles.modeBtnActive]}
          onPress={() => { setMode('compare'); setResult(null); }}
        >
          <Text style={[styles.modeBtnText, mode === 'compare' && styles.modeBtnTextActive]}>
            Comparar com ISO
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'find' && styles.modeBtnActive]}
          onPress={() => { setMode('find'); setResult(null); }}
        >
          <Text style={[styles.modeBtnText, mode === 'find' && styles.modeBtnTextActive]}>
            Encontrar ISO equivalente
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <InputField label="Diâmetro Nominal (mm)" value={nominal} onChangeText={setNominal} placeholder="Ex: 50" />

        <Text style={styles.sectionLabel}>Padrão interno — Faixa de Folga/Interferência (μm)</Text>
        <Text style={styles.hint}>Positivo = folga | Negativo = interferência</Text>
        <View style={styles.row}>
          <InputField
            label="Mínimo (μm)"
            value={customIntMin}
            onChangeText={setCustomIntMin}
            placeholder="Ex: -40"
            style={{ flex: 1, marginRight: 8 }}
          />
          <InputField
            label="Máximo (μm)"
            value={customIntMax}
            onChangeText={setCustomIntMax}
            placeholder="Ex: -5"
            style={{ flex: 1 }}
          />
        </View>

        {mode === 'compare' && (
          <>
            <Text style={styles.sectionLabel}>Ajuste ISO para comparar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fitScroll}>
              {Object.keys(COMMON_FITS).map(fit => (
                <TouchableOpacity
                  key={fit}
                  style={[styles.fitChip, selectedFit === fit && styles.fitChipSelected]}
                  onPress={() => setSelectedFit(fit)}
                >
                  <Text style={[styles.fitChipText, selectedFit === fit && styles.fitChipTextSelected]}>
                    {fit}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.calcBtn} onPress={handleCompare}>
              <Text style={styles.calcBtnText}>COMPARAR</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'find' && (
          <TouchableOpacity style={styles.calcBtn} onPress={handleFind}>
            <Text style={styles.calcBtnText}>ENCONTRAR AJUSTE ISO</Text>
          </TouchableOpacity>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {result && mode === 'compare' && result.isoResult && (
        <View style={styles.results}>
          <ResultCard title="Padrão Interno vs ISO" color="#1565C0">
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareLabel}>Padrão interno</Text>
                <Text style={styles.compareValue}>{result.min} μm</Text>
                <Text style={styles.compareValue}>{result.max} μm</Text>
                <Text style={styles.compareSubLabel}>mín / máx</Text>
              </View>
              <View style={styles.compareArrow}>
                <Text style={styles.arrowText}>VS</Text>
              </View>
              <View style={styles.compareCol}>
                <Text style={styles.compareLabel}>ISO {result.selectedFit}</Text>
                <Text style={styles.compareValue}>{result.isoMin.toFixed(0)} μm</Text>
                <Text style={styles.compareValue}>{result.isoMax.toFixed(0)} μm</Text>
                <Text style={styles.compareSubLabel}>mín / máx</Text>
              </View>
            </View>

            {(() => {
              const status = getCompatibilityStatus(result.compat);
              return (
                <View style={[styles.compatBadge, { backgroundColor: status.color + '22' }]}>
                  <Text style={[styles.compatText, { color: status.color }]}>
                    {status.label} — {result.compat}% de sobreposição
                  </Text>
                </View>
              );
            })()}
          </ResultCard>

          {/* ISO fit details */}
          <ResultCard title={`Detalhes — ${result.selectedFit}`} color="#6A1B9A">
            <Text style={styles.fitDescText}>{COMMON_FITS[result.selectedFit]?.desc || ''}</Text>
            <Text style={styles.fitTypeText}>{result.isoResult.fit.fitType}</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Furo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.d, result.isoResult.hole.EI)}</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.d, result.isoResult.hole.ES)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.isoResult.hole.EI)} / {formatDeviation(result.isoResult.hole.ES)}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.colLabel}>Eixo</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.d, result.isoResult.shaft.ei)}</Text>
                <Text style={styles.dimValue}>{formatDiameter(result.d, result.isoResult.shaft.es)}</Text>
                <Text style={styles.devSmall}>{formatDeviation(result.isoResult.shaft.ei)} / {formatDeviation(result.isoResult.shaft.es)}</Text>
              </View>
            </View>
          </ResultCard>

          <Text style={styles.sectionLabel}>Melhores equivalentes ISO</Text>
          {result.alternatives.map((alt, i) => {
            const status = getCompatibilityStatus(alt.compatibility);
            return (
              <ResultCard key={alt.fitName} color={status.color}>
                <View style={styles.altRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.altFitName}>
                      {i + 1}. {alt.fitName}
                    </Text>
                    <Text style={styles.altDesc}>{COMMON_FITS[alt.fitName]?.desc || ''}</Text>
                    <Text style={styles.altRange}>
                      ISO: {alt.isoMin.toFixed(0)} a {alt.isoMax.toFixed(0)} μm
                    </Text>
                  </View>
                  <View style={[styles.compatCircle, { backgroundColor: status.color }]}>
                    <Text style={styles.compatPct}>{alt.compatibility}%</Text>
                  </View>
                </View>
                <Text style={[styles.compatLabel, { color: status.color }]}>{status.label}</Text>
              </ResultCard>
            );
          })}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>💾 SALVAR NO HISTÓRICO</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && mode === 'find' && (
        <View style={styles.results}>
          <ResultCard title="Melhores ajustes ISO equivalentes" color="#1565C0">
            <Text style={styles.hint}>Para Ø{result.d} mm | Faixa: {result.min} a {result.max} μm</Text>
          </ResultCard>

          {result.alternatives.map((alt, i) => {
            const status = getCompatibilityStatus(alt.compatibility);
            const isoBest = calcFit(result.d, ...alt.fitName.split('/'));
            return (
              <ResultCard key={alt.fitName} color={status.color}>
                <View style={styles.altRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.altFitName}>{i + 1}. {alt.fitName}</Text>
                    <Text style={styles.altDesc}>{COMMON_FITS[alt.fitName]?.desc || ''}</Text>
                    <Text style={styles.altRange}>
                      ISO: {alt.isoMin.toFixed(0)} a {alt.isoMax.toFixed(0)} μm
                    </Text>
                    {isoBest && (
                      <Text style={styles.altDims}>
                        Furo: {formatDiameter(result.d, isoBest.hole.EI)} / {formatDiameter(result.d, isoBest.hole.ES)} mm{'\n'}
                        Eixo: {formatDiameter(result.d, isoBest.shaft.ei)} / {formatDiameter(result.d, isoBest.shaft.es)} mm
                      </Text>
                    )}
                  </View>
                  <View style={[styles.compatCircle, { backgroundColor: status.color }]}>
                    <Text style={styles.compatPct}>{alt.compatibility}%</Text>
                  </View>
                </View>
                <Text style={[styles.compatLabel, { color: status.color }]}>{status.label}</Text>
              </ResultCard>
            );
          })}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>💾 SALVAR NO HISTÓRICO</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { fontSize: 20, fontWeight: '800', color: '#1565C0', margin: 16, marginBottom: 4 },
  sub: { fontSize: 13, color: '#546E7A', marginHorizontal: 16, marginBottom: 8 },
  modeRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#ECEFF1', borderRadius: 8, padding: 4 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1565C0' },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: '#546E7A', textAlign: 'center' },
  modeBtnTextActive: { color: '#fff' },
  form: { marginHorizontal: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginTop: 4, marginBottom: 4 },
  hint: { fontSize: 11, color: '#78909C', marginBottom: 6 },
  row: { flexDirection: 'row' },
  col: { flex: 1, paddingHorizontal: 2 },
  fitScroll: { marginBottom: 10 },
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
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#C62828', textAlign: 'center', marginTop: 4, fontSize: 13 },
  results: { marginHorizontal: 16, paddingBottom: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  compareCol: { flex: 1, alignItems: 'center' },
  compareLabel: { fontSize: 11, color: '#78909C', marginBottom: 4 },
  compareValue: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  compareSubLabel: { fontSize: 10, color: '#90A4AE' },
  compareArrow: { paddingHorizontal: 10 },
  arrowText: { fontSize: 14, fontWeight: '800', color: '#546E7A' },
  compatBadge: { borderRadius: 6, padding: 10 },
  compatText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  fitDescText: { fontSize: 12, color: '#78909C', marginBottom: 4 },
  fitTypeText: { fontSize: 13, fontWeight: '700', color: '#546E7A', marginBottom: 8 },
  colLabel: { fontSize: 11, color: '#78909C', marginBottom: 2, fontWeight: '600' },
  dimValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  devSmall: { fontSize: 10, color: '#90A4AE' },
  altRow: { flexDirection: 'row', alignItems: 'flex-start' },
  altFitName: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  altDesc: { fontSize: 12, color: '#78909C', marginTop: 2 },
  altRange: { fontSize: 12, color: '#546E7A', marginTop: 2 },
  altDims: { fontSize: 11, color: '#78909C', marginTop: 4 },
  compatCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  compatPct: { color: '#fff', fontSize: 14, fontWeight: '800' },
  compatLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  saveBtn: {
    backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
