export interface AppSettings {
  // Appearance & Theme
  themePresetId: string;
  themeCustomHex: string;
  themeIsCustom: boolean;
  backgroundId?: string;
  darkModeCanvas: boolean;
  compactDensity: boolean;
  showDonutMeters: boolean;

  // Reconciliation & Mathematical Model
  insideDeliveryFee: number;
  outsideDeliveryFee: number;
  packagingCost: number;
  cogsPercent: number;
  exactTolerance: number;
  excludeAugust: boolean;
  excludePOS: boolean;

  // Cloud API Credentials & Defaults
  wcStoreUrl: string;
  wcConsumerKey: string;
  wcConsumerSecret: string;
  pathaoBaseUrl: string;
  pathaoClientId: string;
  pathaoClientSecret: string;
  pathaoUsername: string;

  // Sync Presets
  syncStartDate: string;
  syncEndDate: string;
  syncStatus: string;

  // Audit Log
  auditLogs: { timestamp: string; action: string; details?: string }[];
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themePresetId: 'deen-orange',
  themeCustomHex: '#EB5A19',
  themeIsCustom: false,
  backgroundId: 'super-white',
  darkModeCanvas: false,
  compactDensity: false,
  showDonutMeters: true,

  insideDeliveryFee: 50,
  outsideDeliveryFee: 90,
  packagingCost: 25,
  cogsPercent: 42,
  exactTolerance: 2,
  excludeAugust: true,
  excludePOS: true,

  wcStoreUrl: 'https://deencommerce.com',
  wcConsumerKey: '',
  wcConsumerSecret: '',
  pathaoBaseUrl: 'https://api-hermes.pathao.com',
  pathaoClientId: '',
  pathaoClientSecret: '',
  pathaoUsername: '',

  syncStartDate: '2026-09-01',
  syncEndDate: '2026-10-11',
  syncStatus: 'any',

  auditLogs: [
    {
      timestamp: new Date().toISOString(),
      action: 'System Initialized',
      details: 'DEEN Commerce Reconciliation Engine v2.6 loaded default parameters.'
    }
  ]
};

const STORAGE_KEY = 'deen_app_settings_v2';

export function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Failed to parse app settings from storage:', e);
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save app settings:', e);
  }
}

export function logAuditAction(action: string, details?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadAppSettings();
    const newLogs = [
      {
        timestamp: new Date().toISOString(),
        action,
        details
      },
      ...current.auditLogs.slice(0, 49) // Keep last 50 entries
    ];
    saveAppSettings({ ...current, auditLogs: newLogs });
  } catch (e) {
    console.error('Failed to append audit log:', e);
  }
}
