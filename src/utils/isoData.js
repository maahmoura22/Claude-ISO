// ISO 286-1 Tolerance Data
// Diameter ranges: [0-3, 3-6, 6-10, 10-18, 18-30, 30-50, 50-80, 80-120, 120-180, 180-250, 250-315, 315-400, 400-500]

export const DIAMETER_RANGES = [
  { label: '0–3 mm',     min: 0,   max: 3,   dMean: 1.73  },
  { label: '3–6 mm',     min: 3,   max: 6,   dMean: 4.24  },
  { label: '6–10 mm',    min: 6,   max: 10,  dMean: 7.75  },
  { label: '10–18 mm',   min: 10,  max: 18,  dMean: 13.42 },
  { label: '18–30 mm',   min: 18,  max: 30,  dMean: 23.24 },
  { label: '30–50 mm',   min: 30,  max: 50,  dMean: 38.73 },
  { label: '50–80 mm',   min: 50,  max: 80,  dMean: 63.25 },
  { label: '80–120 mm',  min: 80,  max: 120, dMean: 97.98 },
  { label: '120–180 mm', min: 120, max: 180, dMean: 146.97},
  { label: '180–250 mm', min: 180, max: 250, dMean: 212.13},
  { label: '250–315 mm', min: 250, max: 315, dMean: 280.62},
  { label: '315–400 mm', min: 315, max: 400, dMean: 354.96},
  { label: '400–500 mm', min: 400, max: 500, dMean: 447.21},
];

// IT tolerance values in micrometers (μm) per diameter range index
export const IT_VALUES = {
  IT5:  [4,  5,  6,  8,  9,  11, 13, 15, 18, 20, 23, 25, 27],
  IT6:  [6,  8,  9,  11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
  IT7:  [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
  IT8:  [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
  IT9:  [25, 30, 36, 43, 52, 62, 74, 87, 100,115,130,140,155],
  IT10: [40, 48, 58, 70, 84, 100,120,140,160,185,210,230,250],
  IT11: [60, 75, 90, 110,130,160,190,220,250,290,320,360,400],
};

// Fundamental deviations for HOLES (uppercase) - EI (lower deviation) in μm
// H: EI = 0 always (hole basis system)
// JS: symmetric ±IT/2
export const HOLE_FD = {
  H: { type: 'EI', values: [0,0,0,0,0,0,0,0,0,0,0,0,0] },
  JS: { type: 'SYM' },
  G: { type: 'EI', values: [2, 4, 5, 6, 7, 9, 10, 12, 14, 15, 17, 18, 20] },
  F: { type: 'EI', values: [6, 10, 13, 16, 20, 25, 30, 36, 43, 50, 56, 62, 68] },
  E: { type: 'EI', values: [14, 20, 25, 32, 40, 50, 60, 72, 85, 100, 110, 125, 135] },
  D: { type: 'EI', values: [20, 30, 40, 50, 65, 80, 100, 120, 145, 170, 190, 210, 230] },
  N: { type: 'ES', values: [4,  4,  4,  5,  5,  6,  6,   7,   8,   9,   9,  10,  10]  }, // ES negative
  P: { type: 'ES', values: [6,  8,  10, 12, 15, 18, 22,  26,  32,  37,  43,  50,  55]  },
  K: { type: 'ES', values: [0,  3,  5,  6,  6,  7,  7,   9,   9,  10,  12,  13,  14]  }, // varies
};

// Fundamental deviations for SHAFTS (lowercase)
// Clearance shafts: es (upper deviation) is negative
// Interference shafts: ei (lower deviation) is positive
export const SHAFT_FD = {
  // Clearance shafts (es = upper deviation, negative)
  f: { type: 'es', values: [-6,  -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68] },
  g: { type: 'es', values: [-2,  -4,  -5,  -6,  -7,  -9,  -10, -12, -14, -15, -17, -18, -20] },
  h: { type: 'es', values: [0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0  ] },
  // Transition/interference shafts (ei = lower deviation, positive)
  js:{ type: 'SYM' },
  k: { type: 'ei', values: [0,   1,   1,   1,   2,   2,   2,   3,   3,   4,   4,   4,   5  ] },
  m: { type: 'ei', values: [2,   4,   6,   7,   8,   9,   11,  13,  15,  17,  20,  21,  23 ] },
  n: { type: 'ei', values: [4,   8,   10,  12,  15,  17,  20,  23,  27,  31,  34,  37,  40 ] },
  p: { type: 'ei', values: [6,   12,  15,  18,  22,  26,  32,  37,  43,  50,  56,  62,  68 ] },
  r: { type: 'ei', values: [10,  15,  19,  23,  28,  34,  41,  48,  58,  68,  78,  87,  95 ] },
  s: { type: 'ei', values: [14,  19,  23,  28,  35,  43,  53,  59,  71,  79,  92,  100, 108] },
  u: { type: 'ei', values: [18,  23,  28,  33,  41,  48,  60,  70,  87,  102, 120, 140, 165] },
};

// Common fits with descriptions
export const COMMON_FITS = {
  // Clearance fits
  'H7/f7': { type: 'FOLGA',      desc: 'Folga ampla – deslizamento livre',         class: 'clearance' },
  'H7/g6': { type: 'FOLGA',      desc: 'Folga pequena – deslizamento preciso',      class: 'clearance' },
  'H7/h6': { type: 'FOLGA',      desc: 'Folga mínima – ajuste deslizante',          class: 'clearance' },
  // Transition fits
  'H7/js6':{ type: 'TRANSIÇÃO',  desc: 'Transição simétrica',                       class: 'transition'},
  'H7/k6': { type: 'TRANSIÇÃO',  desc: 'Transição leve – raramente interferência',  class: 'transition'},
  'H7/m6': { type: 'TRANSIÇÃO',  desc: 'Transição média',                           class: 'transition'},
  'H7/n6': { type: 'TRANSIÇÃO',  desc: 'Transição firme',                           class: 'transition'},
  // Interference fits
  'H7/p6': { type: 'INTERFERÊNCIA', desc: 'Pressão leve – desmontagem possível',    class: 'interference'},
  'H7/r6': { type: 'INTERFERÊNCIA', desc: 'Pressão média – desmontagem difícil',    class: 'interference'},
  'H7/s6': { type: 'INTERFERÊNCIA', desc: 'Pressão forte – desmontagem destrutiva', class: 'interference'},
  'H7/u6': { type: 'INTERFERÊNCIA', desc: 'Interferência máxima – fixação permanente', class: 'interference'},
};

// Application recommendations database
export const APPLICATION_DB = {
  redutor: {
    name: 'Redutor / Caixa de Engrenagens',
    icon: '⚙️',
    configurations: {
      eixo_engrenagem:  { fits: ['H7/k6','H7/m6'], desc: 'Eixo–engrenagem',       minInt: 10, maxInt: 40 },
      eixo_rolamento:   { fits: ['H7/k6','H7/m6'], desc: 'Eixo–rolamento (anel interno)', minInt: 5, maxInt: 25 },
      caixa_rolamento:  { fits: ['H7/h6','H7/js6'],desc: 'Caixa–rolamento (anel externo)',minInt: -10, maxInt: 10 },
      eixo_chaveta:     { fits: ['H7/p6','H7/r6'], desc: 'Eixo–cubo (fixo)',       minInt: 20, maxInt: 60 },
    }
  },
  bomba: {
    name: 'Bomba Hidráulica / Centrífuga',
    icon: '💧',
    configurations: {
      eixo_selo:        { fits: ['H7/g6','H7/h6'], desc: 'Eixo–selo mecânico',     minInt: -25, maxInt: 0  },
      eixo_impulsor:    { fits: ['H7/k6','H7/p6'], desc: 'Eixo–impulsor',          minInt: 10, maxInt: 50 },
      eixo_rolamento:   { fits: ['H7/k6','H7/m6'], desc: 'Eixo–rolamento',         minInt: 5,  maxInt: 25 },
      carcaca_mancal:   { fits: ['H7/h6','H7/js6'],desc: 'Carcaça–mancal',         minInt: -15, maxInt: 15},
    }
  },
  mancal: {
    name: 'Mancal de Rolamento',
    icon: '🔩',
    configurations: {
      leve_rotativo:    { fits: ['H7/js6','H7/k6'],desc: 'Carga leve, anel interno rotativo',  minInt: 0,  maxInt: 18 },
      medio_rotativo:   { fits: ['H7/k6','H7/m6'], desc: 'Carga média, anel interno rotativo', minInt: 5,  maxInt: 30 },
      pesado_rotativo:  { fits: ['H7/m6','H7/n6'], desc: 'Carga pesada, anel interno rotativo',minInt: 13, maxInt: 45 },
      anel_externo:     { fits: ['H7/h6','H7/js6'],desc: 'Anel externo (carga estacionária)',  minInt: -20, maxInt: 10},
    }
  },
  acoplamento: {
    name: 'Acoplamento / Cubo',
    icon: '🔗',
    configurations: {
      leve:   { fits: ['H7/h6','H7/k6'], desc: 'Acoplamento desmontável leve',   minInt: -15, maxInt: 15 },
      medio:  { fits: ['H7/m6','H7/n6'], desc: 'Acoplamento semipermanente',      minInt: 8,  maxInt: 35 },
      pesado: { fits: ['H7/p6','H7/s6'], desc: 'Acoplamento permanente (prensa)', minInt: 25, maxInt: 80 },
    }
  },
  engrenagem: {
    name: 'Engrenagem / Pinhão',
    icon: '🦷',
    configurations: {
      intercambivel: { fits: ['H7/h6','H7/js6'],desc: 'Montagem intercambiável',   minInt: -20, maxInt: 10},
      fixo_leve:     { fits: ['H7/k6','H7/m6'], desc: 'Fixo, torque leve',        minInt: 5,  maxInt: 25 },
      fixo_pesado:   { fits: ['H7/p6','H7/r6'], desc: 'Fixo, torque elevado',     minInt: 20, maxInt: 60 },
    }
  },
};
