export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  hover: string;
  subtle: string;
  dark: string;
  description: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'deen-orange',
    name: 'Deen Signature Orange',
    primary: '#EB5A19',
    hover: '#D4490E',
    subtle: '#FFF7ED',
    dark: '#C8430E',
    description: 'Authoritative DEEN Commerce brand flagship color'
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo & Navy',
    primary: '#4F46E5',
    hover: '#4338CA',
    subtle: '#EEF2FF',
    dark: '#3730A3',
    description: 'Corporate executive enterprise aesthetic'
  },
  {
    id: 'emerald-growth',
    name: 'Emerald Growth',
    primary: '#059669',
    hover: '#047857',
    subtle: '#ECFDF5',
    dark: '#065F46',
    description: 'Clean financial audit & positive cashflow vibe'
  },
  {
    id: 'electric-violet',
    name: 'Electric Violet',
    primary: '#7C3AED',
    hover: '#6D28D9',
    subtle: '#F5F3FF',
    dark: '#5B21B6',
    description: 'Modern high-tech data visualization accent'
  },
  {
    id: 'crimson-rose',
    name: 'Crimson Velvet',
    primary: '#E11D48',
    hover: '#BE123C',
    subtle: '#FFF1F2',
    dark: '#9F1239',
    description: 'High-contrast vibrant operational monitor'
  },
  {
    id: 'ocean-cyan',
    name: 'Ocean Sky',
    primary: '#0284C7',
    hover: '#0369A1',
    subtle: '#F0F9FF',
    dark: '#075985',
    description: 'Cool logistics & maritime freight theme'
  },
  {
    id: 'amber-gold',
    name: 'Amber Harvest',
    primary: '#D97706',
    hover: '#B45309',
    subtle: '#FFFBEB',
    dark: '#92400E',
    description: 'Warm retail boutique commercial palette'
  },
  {
    id: 'slate-graphite',
    name: 'Deep Graphite',
    primary: '#334155',
    hover: '#1E293B',
    subtle: '#F8FAFC',
    dark: '#0F172A',
    description: 'Monochrome minimalist terminal theme'
  }
];

export type BackgroundStyleId = 'super-white' | 'slate-subtle' | 'zinc-cool' | 'cream-warm' | 'dark-canvas';

export interface BackgroundPreset {
  id: BackgroundStyleId;
  name: string;
  bgHex: string;
  sidebarHex: string;
  cardHex: string;
  borderHex: string;
  textHex: string;
  description: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'super-white',
    name: 'Native Super White',
    bgHex: '#FFFFFF',
    sidebarHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    borderHex: '#E2E8F0',
    textHex: '#0F172A',
    description: 'Pristine pure white canvas for a clean, modern native app feel'
  },
  {
    id: 'slate-subtle',
    name: 'Modern Slate',
    bgHex: '#F8FAFC',
    sidebarHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    borderHex: '#E2E8F0',
    textHex: '#0F172A',
    description: 'Subtle slate gray contrast separating cards from the background'
  },
  {
    id: 'zinc-cool',
    name: 'Cool Metallic Zinc',
    bgHex: '#F4F4F5',
    sidebarHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    borderHex: '#E4E4E7',
    textHex: '#18181B',
    description: 'Crisp industrial neutral canvas with sharp elevation'
  },
  {
    id: 'cream-warm',
    name: 'Warm Paper Ivory',
    bgHex: '#FAFAF9',
    sidebarHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    borderHex: '#E7E5E4',
    textHex: '#1C1917',
    description: 'Soothing warm ivory tones that reduce eye fatigue'
  },
  {
    id: 'dark-canvas',
    name: 'Deep Midnight Canvas',
    bgHex: '#0B0F19',
    sidebarHex: '#111827',
    cardHex: '#1F2937',
    borderHex: '#374151',
    textHex: '#F9FAFB',
    description: 'Executive dark canvas with high contrast glowing metrics'
  }
];

export interface CustomThemeSettings {
  presetId: string;
  customHex: string;
  isCustom: boolean;
  backgroundId: BackgroundStyleId;
  darkModeCanvas: boolean;
  compactDensity: boolean;
  showDonutMeters: boolean;
}

export const DEFAULT_THEME_SETTINGS: CustomThemeSettings = {
  presetId: 'deen-orange',
  customHex: '#EB5A19',
  isCustom: false,
  backgroundId: 'super-white',
  darkModeCanvas: false,
  compactDensity: false,
  showDonutMeters: true
};

const STORAGE_KEY = 'deen_reconcile_theme_settings_v1';

// Convert hex to rgb
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16)
    };
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }
  return null;
}

// Adjust brightness of a hex color
function adjustColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, rgb.r + amt));
  const g = Math.min(255, Math.max(0, rgb.g + amt));
  const b = Math.min(255, Math.max(0, rgb.b + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function applyThemeToDocument(settings: CustomThemeSettings) {
  if (typeof window === 'undefined') return;

  let primary = '#EB5A19';
  let hover = '#D4490E';
  let subtle = '#FFF7ED';
  let dark = '#C8430E';

  if (settings.isCustom && settings.customHex) {
    primary = settings.customHex;
    hover = adjustColor(primary, -12);
    dark = adjustColor(primary, -20);
    subtle = adjustColor(primary, 92);
  } else {
    const preset = THEME_PRESETS.find(p => p.id === settings.presetId) || THEME_PRESETS[0];
    primary = preset.primary;
    hover = preset.hover;
    subtle = preset.subtle;
    dark = preset.dark;
  }

  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', hover);
  root.style.setProperty('--primary-subtle', subtle);
  root.style.setProperty('--primary-dark', dark);

  // Apply subtle glow
  const rgb = hexToRgb(primary);
  if (rgb) {
    root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  // Update Tailwind in-browser config if present
  if ((window as any).tailwind?.config?.theme?.extend?.colors?.primary) {
    (window as any).tailwind.config.theme.extend.colors.primary.DEFAULT = primary;
    (window as any).tailwind.config.theme.extend.colors.primary[500] = primary;
    (window as any).tailwind.config.theme.extend.colors.primary.hover = hover;
    (window as any).tailwind.config.theme.extend.colors.primary.subtle = subtle;
  }

  // Apply Background Style
  const bgPreset = BACKGROUND_PRESETS.find(b => b.id === settings.backgroundId) || BACKGROUND_PRESETS[0];
  root.style.setProperty('--bg-surface', bgPreset.bgHex);
  root.style.setProperty('--sidebar-surface', bgPreset.sidebarHex);
  root.style.setProperty('--card-surface', bgPreset.cardHex);
  root.style.setProperty('--border-surface', bgPreset.borderHex);
  root.style.setProperty('--text-surface', bgPreset.textHex);

  document.body.style.backgroundColor = bgPreset.bgHex;

  // Handle Dark Canvas option
  if (settings.backgroundId === 'dark-canvas' || settings.darkModeCanvas) {
    document.body.classList.add('dark-canvas');
    document.documentElement.classList.add('dark');
  } else {
    document.body.classList.remove('dark-canvas');
    document.documentElement.classList.remove('dark');
  }
}

export function loadSavedThemeSettings(): CustomThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_SETTINGS;
    return { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function saveThemeSettings(settings: CustomThemeSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyThemeToDocument(settings);
  } catch (err) {
    console.error('Failed to save theme settings:', err);
  }
}
