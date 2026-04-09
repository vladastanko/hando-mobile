// ── Hando Design Tokens (mirrors web CSS variables 1:1) ──────────────────

export const colors = {
  brand:      '#7C3AFF',
  brandHover: '#6B2FEE',
  brandSoft:  'rgba(124,58,255,0.10)',
  brandGlow:  'rgba(124,58,255,0.22)',

  bg:    '#F4F2FF',
  bgEl:  '#FFFFFF',
  bgOv:  '#F0EEFF',
  bgSub: '#EAE6FF',
  bgMut: '#E4DFFF',

  border:   'rgba(124,58,255,0.10)',
  borderHi: 'rgba(124,58,255,0.18)',

  tx:  '#1A1035',
  tx2: '#6B6890',
  tx3: '#A8A4C4',

  ok:      '#22c55e',
  okSoft:  'rgba(34,197,94,0.12)',
  warn:    '#f59e0b',
  warnSoft:'rgba(245,158,11,0.12)',
  err:     '#ef4444',
  errSoft: 'rgba(239,68,68,0.12)',
  info:    '#6366f1',
  infoSoft:'rgba(99,102,241,0.12)',

  white: '#FFFFFF',
  black: '#000000',
};

export const radius = {
  xs:   6,
  sm:   12,
  md:   16,
  lg:   20,
  xl:   24,
  full: 999,
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};

export const fontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl':30,
};

export const fontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  extrabold:'800' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#7C3AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#7C3AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#7C3AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 8,
  },
};
