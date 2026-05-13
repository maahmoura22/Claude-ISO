import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import ResultCard from '../components/ResultCard';
import InputField from '../components/InputField';
import { APPLICATION_DB, COMMON_FITS } from '../utils/isoData';
import { calcFit, formatDeviation, formatDiameter } from '../utils/calculations';
import { saveHistoryEntry } from '../utils/storage';

export default function ApplicationScreen() {
  const [nominal,     setNominal]     = useState('');
  const [equipment,   setEquipment]   = useState(null);
  const [config,      setConfig]      = useState(null);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');

  function handleSelectEquipment(key) {
    setEquipment(key);
    setConfig(null);
    setResult(null);
  }

  function handleSelectConfig(key) {
    setConfig(key);
    setResult(null);
  }

  function handleCalculate() {
    setError('');
    setResult(null);
    const d = parseFloat(nominal);
    if (isNaN(d) || d <= 0 || d > 500) {
      setError('Diâmetro nominal inválido (0–500 mm)');
      return;
    }
    if (!equipment || !config) {
      setError('Selecione o equipamento e a configuração');
      return;
    }

    const cfg = APPLICATION_DB[equipment].configurations[config];
    const fits = cfg.fits.map(f => {
      const [h, s] = f.split('/');
      const res = calcFit(d, h, s);
      return { fit: f, ...res };
    });

    setResult({ cfg, fits, nominal: d, equipment, config });
  }

  async function handleSave() {
    if (!result) return;
    await saveHistoryEntry({
      mode: 'SELEÇÃO POR APLICAÇÃO',
      nominal: result.nominal,
      equipment: APPLICATION_DB[result.equipment].name,
      config: result.cfg.desc,
      suggestedFits: result.cfg.fits.join(', '),
      recommendedIntMin: result.cfg.minInt,
      recommendedIntMax: result.cfg.maxInt,
    });
    Alert.alert('Salvo', 'Resultado salvo no histórico.');
  }

  const equip = equipment ? APPLICATION_DB[equipment] : null;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Modo 3 — Seleção por Aplicação</Text>
      <Text style={styles.sub}>Escolha o equipamento para receber recomendações de ajuste</Text>

      <InputField
        label="Diâmetro Nominal (mm)"
        value={nominal}
        onChangeText={setNominal}
        placeholder="Ex: 50"
        style={styles.nominalInput}
      />

      <Text style={styles.sectionLabel}>Equipamento</Text>
      <View style={styles.equipGrid}>
        {Object.entries(APPLICATION_DB).map(([key, eq]) => (
          <TouchableOpacity
            key={key}
            style={[styles.equipCard, equipment === key && styles.equipCardSelected]}
            onPress={() => handleSelectEquipment(key)}
          >
            <Text style={styles.equipIcon}>{eq.icon}</Text>
            <Text style={[styles.equipName, equipment === key && styles.equipNameSelected]}>
              {eq.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {equip && (
        <>
          <Text style={styles.sectionLabel}>Configuração / Ponto de Montagem</Text>
          {Object.entries(equip.configurations).map(([key, cfg]) => (
            <TouchableOpacity
              key={key}
              style={[styles.configCard, config === key && styles.configCardSelected]}
              onPress={() => handleSelectConfig(key)}
            >
              <View style={styles.configRow}>
                <View style={[styles.configDot, config === key && styles.configDotSelected]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configDesc, config === key && styles.configDescSelected]}>
                    {cfg.desc}
                  </Text>
                  <Text style={styles.configFits}>Ajustes sugeridos: {cfg.fits.join(', ')}</Text>
                  <Text style={styles.configRange}>
                    Interferência: {cfg.minInt} a {cfg.maxInt} μm
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {equipment && config && (
        <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate}>
          <Text style={styles.calcBtnText}>CALCULAR RECOMENDAÇÃO</Text>
        </TouchableOpacity>
      )}

      {result && (
        <View style={styles.results}>
          <ResultCard title="Recomendação para Aplicação" color="#1565C0">
            <Text style={styles.appName}>{APPLICATION_DB[result.equipment].name}</Text>
            <Text style={styles.appConfig}>{result.cfg.desc}</Text>
            <View style={styles.rangeBox}>
              <Text style={styles.rangeLabel}>Faixa de interferência recomendada</Text>
              <Text style={styles.rangeValue}>
                {result.cfg.minInt} μm a {result.cfg.maxInt} μm
              </Text>
              {result.cfg.minInt < 0 && (
                <Text style={styles.rangeNote}>
                  (valores negativos = folga admissível)
                </Text>
              )}
            </View>
          </ResultCard>

          {result.fits.map(({ fit, hole, shaft, fit: fitCalc }, i) => {
            if (!hole || !shaft) return null;
            const [hd, sd] = fit.split('/');
            const calcResult = calcFit(result.nominal, hd, sd);
            if (!calcResult) return null;
            const fitRes = calcResult.fit;
            const color = fitRes.isClearance ? '#1565C0' : fitRes.isInterference ? '#B71C1C' : '#E65100';

            return (
              <ResultCard key={fit} title={`Ajuste ${fit}`} color={color}>
                <Text style={styles.fitTypeText}>{fitRes.fitType}</Text>
                <Text style={styles.fitDescText}>{COMMON_FITS[fit]?.desc || ''}</Text>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.colLabel}>Furo {hd}</Text>
                    <Text style={styles.dimValue}>{formatDiameter(result.nominal, calcResult.hole.EI)}</Text>
                    <Text style={styles.dimValue}>{formatDiameter(result.nominal, calcResult.hole.ES)}</Text>
                    <Text style={styles.devSmall}>
                      {formatDeviation(calcResult.hole.EI)} / {formatDeviation(calcResult.hole.ES)}
                    </Text>
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.colLabel}>Eixo {sd}</Text>
                    <Text style={styles.dimValue}>{formatDiameter(result.nominal, calcResult.shaft.ei)}</Text>
                    <Text style={styles.dimValue}>{formatDiameter(result.nominal, calcResult.shaft.es)}</Text>
                    <Text style={styles.devSmall}>
                      {formatDeviation(calcResult.shaft.ei)} / {formatDeviation(calcResult.shaft.es)}
                    </Text>
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.colLabel}>Resultado</Text>
                    {fitRes.isClearance ? (
                      <>
                        <Text style={styles.dimValue}>{fitRes.minClearance} μm</Text>
                        <Text style={styles.dimValue}>{fitRes.maxClearance} μm</Text>
                        <Text style={styles.devSmall}>folga mín/máx</Text>
                      </>
                    ) : fitRes.isInterference ? (
                      <>
                        <Text style={styles.dimValue}>{-fitRes.maxClearance} μm</Text>
                        <Text style={styles.dimValue}>{-fitRes.minClearance} μm</Text>
                        <Text style={styles.devSmall}>interf. mín/máx</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.dimValue}>±{fitRes.maxClearance} μm</Text>
                        <Text style={styles.devSmall}>transição</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Check if within recommended range */}
                {(() => {
                  const intMin = fitRes.isInterference ? -fitRes.maxClearance : 0;
                  const withinRange = intMin >= result.cfg.minInt && intMin <= result.cfg.maxInt;
                  return (
                    <View style={[styles.recommendBadge, { backgroundColor: withinRange ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.recommendText, { color: withinRange ? '#2E7D32' : '#E65100' }]}>
                        {withinRange ? '✔ Dentro da faixa recomendada' : '⚠️ Verificar adequação à aplicação'}
                      </Text>
                    </View>
                  );
                })()}
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
  nominalInput: { marginHorizontal: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginHorizontal: 16, marginTop: 8, marginBottom: 6 },
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  equipCard: {
    width: '47%', margin: '1.5%', borderRadius: 10, backgroundColor: '#fff',
    padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#ECEFF1',
    elevation: 1,
  },
  equipCardSelected: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  equipIcon: { fontSize: 28, marginBottom: 4 },
  equipName: { fontSize: 12, textAlign: 'center', color: '#546E7A', fontWeight: '600' },
  equipNameSelected: { color: '#1565C0' },
  configCard: {
    marginHorizontal: 16, marginVertical: 4, padding: 12, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#ECEFF1',
  },
  configCardSelected: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  configRow: { flexDirection: 'row', alignItems: 'flex-start' },
  configDot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2,
    borderColor: '#90A4AE', marginRight: 10, marginTop: 2,
  },
  configDotSelected: { borderColor: '#1565C0', backgroundColor: '#1565C0' },
  configDesc: { fontSize: 14, fontWeight: '600', color: '#333' },
  configDescSelected: { color: '#1565C0' },
  configFits: { fontSize: 12, color: '#78909C', marginTop: 2 },
  configRange: { fontSize: 12, color: '#78909C' },
  calcBtn: {
    backgroundColor: '#1565C0', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', margin: 16, marginTop: 12,
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#C62828', textAlign: 'center', margin: 8, fontSize: 13 },
  results: { marginHorizontal: 16, paddingBottom: 10 },
  appName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  appConfig: { fontSize: 13, color: '#546E7A', marginBottom: 8 },
  rangeBox: { backgroundColor: '#E3F2FD', borderRadius: 6, padding: 10 },
  rangeLabel: { fontSize: 12, color: '#1565C0', fontWeight: '600' },
  rangeValue: { fontSize: 18, fontWeight: '800', color: '#1565C0' },
  rangeNote: { fontSize: 11, color: '#546E7A', marginTop: 2 },
  fitTypeText: { fontSize: 13, fontWeight: '700', color: '#546E7A', marginBottom: 2 },
  fitDescText: { fontSize: 12, color: '#78909C', marginBottom: 8 },
  row: { flexDirection: 'row' },
  col: { flex: 1 },
  colLabel: { fontSize: 11, color: '#78909C', marginBottom: 2, fontWeight: '600' },
  dimValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  devSmall: { fontSize: 10, color: '#90A4AE' },
  recommendBadge: { borderRadius: 6, padding: 8, marginTop: 8 },
  recommendText: { fontSize: 12, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
