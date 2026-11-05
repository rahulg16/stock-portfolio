export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentMuted: string;
  gain: string;
  gainBackground: string;
  loss: string;
  lossBackground: string;
  warning: string;
  warningBackground: string;
  danger: string;
  dangerBackground: string;
  inputBackground: string;
  tabBar: string;
  tabInactive: string;
  overlay: string;
}

export interface AppTheme {
  mode: ThemeMode;
  colors: ThemeColors;
}
