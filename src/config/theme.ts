export const theme = {
  colors: {
    primary: '#006e2f',
    primaryDark: '#004b1e',
    primaryLight: '#e7eeff',
    primaryContainer: '#22c55e',
    surface: '#f9f9ff',
    background: '#f9f9ff',
    border: '#111c2d',
    textPrimary: '#111c2d',
    textSecondary: '#3d4a3d',
    textInverse: '#ffffff',
    accent: '#22c55e',
    secondary: '#735c00',
    secondaryContainer: '#fed01b',
    tertiary: '#005ac2',
    tertiaryContainer: '#82abff',
    surfaceContainer: '#e7eeff',
    surfaceContainerLow: '#f0f3ff',
    surfaceContainerLowest: '#ffffff',
    onSurfaceVariant: '#3d4a3d',
    severity: {
      high: '#ba1a1a',
      highBg: '#ffdad6',
      medium: '#735c00',
      mediumBg: '#fed01b',
      low: '#006e2f',
      lowBg: '#6bff8f',
    },
    status: {
      new: '#3d4a3d',
      active: '#005ac2',
      warning: '#735c00',
      success: '#006e2f',
      danger: '#ba1a1a',
    },
  },
  typography: {
    fonts: {
      sans: 'Inter, sans-serif',
      display: '"Quicksand", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
  },
};

/** Single source of truth — sets CSS variables consumed by Tailwind @theme in index.css */
export function applyTheme(): void {
  const r = document.documentElement.style;
  const c = theme.colors;
  r.setProperty('--cp-primary', c.primary);
  r.setProperty('--cp-primary-dark', c.primaryDark);
  r.setProperty('--cp-primary-light', c.primaryLight);
  r.setProperty('--cp-primary-container', c.primaryContainer);
  r.setProperty('--cp-surface', c.surface);
  r.setProperty('--cp-background', c.background);
  r.setProperty('--cp-border', c.border);
  r.setProperty('--cp-text-primary', c.textPrimary);
  r.setProperty('--cp-text-secondary', c.textSecondary);
  r.setProperty('--cp-text-inverse', c.textInverse);
  r.setProperty('--cp-accent', c.accent);
  r.setProperty('--cp-secondary', c.secondary);
  r.setProperty('--cp-secondary-container', c.secondaryContainer);
  r.setProperty('--cp-tertiary', c.tertiary);
  r.setProperty('--cp-tertiary-container', c.tertiaryContainer);
  r.setProperty('--cp-surface-container', c.surfaceContainer);
  r.setProperty('--cp-surface-container-low', c.surfaceContainerLow);
  r.setProperty('--cp-surface-container-lowest', c.surfaceContainerLowest);
  r.setProperty('--cp-on-surface-variant', c.onSurfaceVariant);
  r.setProperty('--cp-severity-high', c.severity.high);
  r.setProperty('--cp-severity-high-bg', c.severity.highBg);
  r.setProperty('--cp-severity-medium', c.severity.medium);
  r.setProperty('--cp-severity-medium-bg', c.severity.mediumBg);
  r.setProperty('--cp-severity-low', c.severity.low);
  r.setProperty('--cp-severity-low-bg', c.severity.lowBg);
  r.setProperty('--cp-status-new', c.status.new);
  r.setProperty('--cp-status-active', c.status.active);
  r.setProperty('--cp-status-warning', c.status.warning);
  r.setProperty('--cp-status-success', c.status.success);
  r.setProperty('--cp-status-danger', c.status.danger);
  r.setProperty('--cp-font-sans', theme.typography.fonts.sans);
  r.setProperty('--cp-font-display', theme.typography.fonts.display);
  r.setProperty('--cp-font-mono', theme.typography.fonts.mono);
}
