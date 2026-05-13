import { DIAMETER_RANGES, IT_VALUES, SHAFT_FD, HOLE_FD, COMMON_FITS } from './isoData';

// Find diameter range index for a given nominal diameter
export function getDiameterRangeIndex(diameter) {
  for (let i = 0; i < DIAMETER_RANGES.length; i++) {
    const r = DIAMETER_RANGES[i];
    if (diameter > r.min && diameter <= r.max) return i;
    if (diameter === 0 && i === 0) return 0;
  }
  return -1; // out of range
}

// Get IT value in μm for a grade string like 'IT7' and diameter range index
export function getITValue(gradeStr, rangeIdx) {
  const key = gradeStr.toUpperCase();
  if (!IT_VALUES[key]) return null;
  return IT_VALUES[key][rangeIdx];
}

// Parse fit designation like 'H7' → { letter: 'H', grade: 'IT7' }
export function parseFitDesignation(designation) {
  const match = designation.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  return { letter: match[1], grade: `IT${match[2]}` };
}

// Calculate hole limits (in μm relative to nominal, then absolute in mm)
// Returns { EI, ES, minDiam, maxDiam }
export function calcHoleLimits(nominal, holeDesig) {
  const rangeIdx = getDiameterRangeIndex(nominal);
  if (rangeIdx < 0) return null;

  const parsed = parseFitDesignation(holeDesig);
  if (!parsed) return null;

  const { letter, grade } = parsed;
  const IT = getITValue(grade, rangeIdx);
  if (IT === null) return null;

  const hfd = HOLE_FD[letter.toUpperCase()];
  if (!hfd) return null;

  let EI, ES;

  if (hfd.type === 'EI') {
    EI = hfd.values[rangeIdx];
    ES = EI + IT;
  } else if (hfd.type === 'ES') {
    ES = -hfd.values[rangeIdx]; // stored as positive, deviation is negative
    EI = ES - IT;
  } else if (hfd.type === 'SYM') {
    EI = -Math.floor(IT / 2);
    ES = EI + IT;
  }

  return {
    EI,
    ES,
    IT,
    rangeIdx,
    minDiam: nominal + EI / 1000,
    maxDiam: nominal + ES / 1000,
    designation: holeDesig,
    nominal,
  };
}

// Calculate shaft limits (in μm relative to nominal, then absolute in mm)
// Returns { ei, es, minDiam, maxDiam }
export function calcShaftLimits(nominal, shaftDesig) {
  const rangeIdx = getDiameterRangeIndex(nominal);
  if (rangeIdx < 0) return null;

  const parsed = parseFitDesignation(shaftDesig);
  if (!parsed) return null;

  const { letter, grade } = parsed;
  const IT = getITValue(grade, rangeIdx);
  if (IT === null) return null;

  const sfd = SHAFT_FD[letter.toLowerCase()];
  if (!sfd) return null;

  let ei, es;

  if (sfd.type === 'es') {
    es = sfd.values[rangeIdx];
    ei = es - IT;
  } else if (sfd.type === 'ei') {
    ei = sfd.values[rangeIdx];
    es = ei + IT;
  } else if (sfd.type === 'SYM') {
    ei = -Math.floor(IT / 2);
    es = ei + IT;
  }

  return {
    ei,
    es,
    IT,
    rangeIdx,
    minDiam: nominal + ei / 1000,
    maxDiam: nominal + es / 1000,
    designation: shaftDesig,
    nominal,
  };
}

// Calculate fit clearance/interference from hole and shaft limits
// Positive = clearance (folga), Negative = interference (interferência)
export function calcFitResult(hole, shaft) {
  const maxClearance = hole.ES - shaft.ei; // max hole - min shaft
  const minClearance = hole.EI - shaft.es; // min hole - max shaft

  const isInterference = minClearance < 0 && maxClearance < 0;
  const isClearance    = minClearance > 0 && maxClearance > 0;
  const isTransition   = !isInterference && !isClearance;

  return {
    maxClearance,   // μm, positive = clearance
    minClearance,   // μm, negative = interference
    maxInterference: -minClearance,
    minInterference: -maxClearance,
    isInterference,
    isClearance,
    isTransition,
    fitType: isInterference ? 'INTERFERÊNCIA' : isClearance ? 'FOLGA' : 'TRANSIÇÃO',
  };
}

// Full fit calculation: hole + shaft designations + nominal diameter
export function calcFit(nominal, holeDesig, shaftDesig) {
  const hole  = calcHoleLimits(nominal, holeDesig);
  const shaft = calcShaftLimits(nominal, shaftDesig);
  if (!hole || !shaft) return null;

  const fit = calcFitResult(hole, shaft);
  return { nominal, hole, shaft, fit };
}

// Verify real dimensions: check if shaft/hole are within ISO limits
export function verifyDimensions({ nominal, holeDesig, shaftDesig, realHoleMin, realHoleMax, realShaftMin, realShaftMax }) {
  const hole  = calcHoleLimits(nominal, holeDesig);
  const shaft = calcShaftLimits(nominal, shaftDesig);
  if (!hole || !shaft) return null;

  const holeOK  = realHoleMin  >= hole.minDiam  && realHoleMax  <= hole.maxDiam;
  const shaftOK = realShaftMin >= shaft.minDiam && realShaftMax <= shaft.maxDiam;

  const actualMaxClearance = realHoleMax - realShaftMin;
  const actualMinClearance = realHoleMin - realShaftMax;

  return {
    hole,
    shaft,
    holeOK,
    shaftOK,
    overallOK: holeOK && shaftOK,
    actualMaxClearance: actualMaxClearance * 1000, // convert to μm
    actualMinClearance: actualMinClearance * 1000,
    fitType: actualMinClearance > 0 ? 'FOLGA' : actualMaxClearance < 0 ? 'INTERFERÊNCIA' : 'TRANSIÇÃO',
  };
}

// Find closest ISO fit to custom interference/clearance range
export function findClosestISOFit(nominal, targetMinClearance, targetMaxClearance) {
  const candidates = [];

  for (const [fitName, fitInfo] of Object.entries(COMMON_FITS)) {
    const [holeDesig, shaftDesig] = fitName.split('/');
    const result = calcFit(nominal, holeDesig, shaftDesig);
    if (!result) continue;

    const { fit } = result;
    const isoMin = fit.minClearance;
    const isoMax = fit.maxClearance;

    const overlapMin = Math.max(isoMin, targetMinClearance);
    const overlapMax = Math.min(isoMax, targetMaxClearance);
    const overlap = Math.max(0, overlapMax - overlapMin);
    const rangeTarget = targetMaxClearance - targetMinClearance;
    const rangeISO    = isoMax - isoMin;
    const compatibility = rangeTarget > 0 ? (overlap / Math.max(rangeTarget, rangeISO)) * 100 : 0;

    candidates.push({
      fitName,
      fitInfo,
      isoMin,
      isoMax,
      overlap,
      compatibility: Math.round(compatibility),
      result,
    });
  }

  candidates.sort((a, b) => b.compatibility - a.compatibility);
  return candidates.slice(0, 5);
}

// Format deviation for display: +0.025 / -0.000
export function formatDeviation(valueUM) {
  const valueMM = valueUM / 1000;
  const sign = valueMM >= 0 ? '+' : '';
  return `${sign}${valueMM.toFixed(3)}`;
}

// Format diameter with deviation
export function formatDiameter(nominal, deviationUM) {
  const value = nominal + deviationUM / 1000;
  return value.toFixed(4);
}

// Get compatibility status string and color
export function getCompatibilityStatus(compatibility) {
  if (compatibility >= 80) return { label: '✔ Compatível',              color: '#2E7D32' };
  if (compatibility >= 40) return { label: '⚠️ Parcialmente compatível', color: '#F57C00' };
  return                          { label: '❌ Não compatível',           color: '#C62828' };
}
