// Theme and Design Tokens for RECALLA Mobile Application
// Dark graphite/near-black enterprise SRE aesthetic

export const COLORS = {
  // Backgrounds
  background: '#0B0E14',
  backgroundSecondary: '#111620',
  surface: '#161D27',
  surfaceElevated: '#1F2734',
  surfaceBorder: '#283344',
  border: '#30363D',
  borderSubtle: '#21262D',

  // Typography
  textPrimary: '#F0F6FC',
  textSecondary: '#8B949E',
  textMuted: '#6E7681',
  textInverse: '#0B0E14',

  // Brand & Intelligence
  primary: '#58A6FF',
  primaryMuted: 'rgba(88, 166, 255, 0.15)',
  aiPurple: '#BC8CFF',
  aiPurpleMuted: 'rgba(188, 140, 255, 0.15)',
  hindsightCyan: '#39C5CF',
  hindsightCyanMuted: 'rgba(57, 197, 207, 0.15)',

  // Status & Severities
  critical: '#F85149',
  criticalBg: 'rgba(248, 81, 73, 0.15)',
  criticalBorder: 'rgba(248, 81, 73, 0.35)',

  high: '#F0883E',
  highBg: 'rgba(240, 136, 62, 0.15)',
  highBorder: 'rgba(240, 136, 62, 0.35)',

  medium: '#D29922',
  mediumBg: 'rgba(210, 153, 34, 0.15)',
  mediumBorder: 'rgba(210, 153, 34, 0.35)',

  low: '#8B949E',
  lowBg: 'rgba(139, 148, 158, 0.15)',
  lowBorder: 'rgba(139, 148, 158, 0.35)',

  success: '#3FB950',
  successBg: 'rgba(63, 185, 80, 0.15)',
  successBorder: 'rgba(63, 185, 80, 0.35)',

  warning: '#DB6D28',
  warningBg: 'rgba(219, 109, 40, 0.15)',
};

export const SEVERITY_COLORS = {
  'Critical': { color: COLORS.critical, bg: COLORS.criticalBg, border: COLORS.criticalBorder },
  'SEV-1': { color: COLORS.critical, bg: COLORS.criticalBg, border: COLORS.criticalBorder },
  'SEV-2': { color: COLORS.high, bg: COLORS.highBg, border: COLORS.highBorder },
  'High': { color: COLORS.high, bg: COLORS.highBg, border: COLORS.highBorder },
  'Medium': { color: COLORS.medium, bg: COLORS.mediumBg, border: COLORS.mediumBorder },
  'SEV-3': { color: COLORS.medium, bg: COLORS.mediumBg, border: COLORS.mediumBorder },
  'Low': { color: COLORS.low, bg: COLORS.lowBg, border: COLORS.lowBorder },
  'SEV-4': { color: COLORS.low, bg: COLORS.lowBg, border: COLORS.lowBorder },
};

export const STATUS_COLORS = {
  'detected': { color: COLORS.critical, label: 'Detected' },
  'acknowledged': { color: COLORS.warning, label: 'Acknowledged' },
  'investigating': { color: COLORS.primary, label: 'Investigating' },
  'mitigating': { color: COLORS.aiPurple, label: 'Mitigating' },
  'resolved': { color: COLORS.success, label: 'Resolved' },
  'post_mortem': { color: COLORS.hindsightCyan, label: 'Post-Mortem' },
};
