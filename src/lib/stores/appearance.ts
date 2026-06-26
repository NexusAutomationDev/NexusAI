import { load } from '@tauri-apps/plugin-store';
import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type FontScale = 'sm' | 'md' | 'lg';
// D-08: exactly 5 predefined accent colors
export type AccentColor = 'violet' | 'blue' | 'green' | 'orange' | 'red';

// UI-SPEC §Color — accent palette (exact HSL values for display in the picker UI)
export const ACCENT_COLORS: Array<{ value: AccentColor; label: string; hsl: string }> = [
  { value: 'violet', label: 'Violeta',  hsl: 'hsl(263.4 70% 50.4%)' },
  { value: 'blue',   label: 'Azul',    hsl: 'hsl(221.2 83.2% 53.3%)' },
  { value: 'green',  label: 'Verde',   hsl: 'hsl(142.1 76.2% 36.3%)' },
  { value: 'orange', label: 'Laranja', hsl: 'hsl(24.6 95% 53.1%)' },
  { value: 'red',    label: 'Vermelho', hsl: 'hsl(0 72.2% 50.6%)' },
];

// UI-SPEC §Typography — font scale values
const FONT_SCALE_MAP: Record<FontScale, string> = {
  sm: '0.875',
  md: '1',
  lg: '1.125',
};

interface AppearanceStore {
  theme: Theme;
  fontScale: FontScale;
  accentColor: AccentColor;
  setTheme: (t: Theme) => Promise<void>;
  setFontScale: (s: FontScale) => Promise<void>;
  setAccentColor: (c: AccentColor) => Promise<void>;
  load: () => Promise<void>;
}

let _store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!_store) _store = await load('appearance.json', { autoSave: true });
  return _store;
}

function applyTheme(theme: Theme): void {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // shadcn/ui requires .dark on <html> — NEVER on <body>
  document.documentElement.classList.toggle('dark', isDark);
}

export const useAppearance = create<AppearanceStore>((set) => ({
  theme: 'dark',
  fontScale: 'md',
  accentColor: 'violet',

  setTheme: async (theme) => {
    const s = await getStore();
    await s.set('theme', theme);
    applyTheme(theme);
    set({ theme });
  },

  setFontScale: async (fontScale) => {
    const s = await getStore();
    await s.set('fontScale', fontScale);
    // D-07: font scale via CSS variable on <html>
    document.documentElement.style.setProperty('--font-scale', FONT_SCALE_MAP[fontScale]);
    set({ fontScale });
  },

  setAccentColor: async (accentColor) => {
    const s = await getStore();
    await s.set('accentColor', accentColor);
    // D-08: accent via data-accent attribute on <html>
    document.documentElement.setAttribute('data-accent', accentColor);
    set({ accentColor });
  },

  load: async () => {
    const s = await getStore();
    const theme = (await s.get<Theme>('theme')) ?? 'dark';
    const fontScale = (await s.get<FontScale>('fontScale')) ?? 'md';
    const accentColor = (await s.get<AccentColor>('accentColor')) ?? 'violet';
    applyTheme(theme);
    document.documentElement.style.setProperty('--font-scale', FONT_SCALE_MAP[fontScale]);
    document.documentElement.setAttribute('data-accent', accentColor);
    set({ theme, fontScale, accentColor });
  },
}));
