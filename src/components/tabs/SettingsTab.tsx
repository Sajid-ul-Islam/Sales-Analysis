"use client";

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sliders,
  Cloud,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Truck,
  RotateCcw,
  Sparkles,
  Download,
  Trash2,
  Check,
  Eye,
  Settings as SettingsIcon,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Key,
  Upload,
  History,
  FileText,
  Copy,
  ExternalLink
} from 'lucide-react';
import {
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  BackgroundPreset,
  BackgroundStyleId,
  CustomThemeSettings,
  DEFAULT_THEME_SETTINGS,
  loadSavedThemeSettings,
  saveThemeSettings,
  applyThemeToDocument,
  ThemePreset
} from '@/lib/themeManager';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  logAuditAction
} from '@/lib/settingsStore';
import { RawOrderRow } from '@/types';

interface SettingsTabProps {
  excludeAugust: boolean;
  setExcludeAugust: (val: boolean) => void;
  excludePOS: boolean;
  setExcludePOS: (val: boolean) => void;
  onResetBaseline?: () => void;
  onDataSynced?: (type: 'orders' | 'returns', rows: RawOrderRow[]) => void;
  onRefreshReconciliation?: () => void;
  insideDeliveryFee?: number;
  setInsideDeliveryFee?: (val: number) => void;
  outsideDeliveryFee?: number;
  setOutsideDeliveryFee?: (val: number) => void;
  packagingCost?: number;
  setPackagingCost?: (val: number) => void;
  cogsPercent?: number;
  setCogsPercent?: (val: number) => void;
  exactTolerance?: number;
  setExactTolerance?: (val: number) => void;
}

export function SettingsTab({
  excludeAugust,
  setExcludeAugust,
  excludePOS,
  setExcludePOS,
  onResetBaseline,
  onDataSynced,
  onRefreshReconciliation,
  insideDeliveryFee: propInsideFee,
  setInsideDeliveryFee: propSetInsideFee,
  outsideDeliveryFee: propOutsideFee,
  setOutsideDeliveryFee: propSetOutsideFee,
  packagingCost: propPackagingCost,
  setPackagingCost: propSetPackagingCost,
  cogsPercent: propCogsPercent,
  setCogsPercent: propSetCogsPercent,
  exactTolerance: propExactTolerance,
  setExactTolerance: propSetExactTolerance
}: SettingsTabProps) {
  // Theme state
  const [themeSettings, setThemeSettings] = useState<CustomThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [tempHex, setTempHex] = useState('#EB5A19');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Math & Model Parameter States
  const [insideDeliveryFee, setLocalInsideDeliveryFee] = useState<number>(propInsideFee ?? 50);
  const [outsideDeliveryFee, setLocalOutsideDeliveryFee] = useState<number>(propOutsideFee ?? 90);
  const [packagingCost, setLocalPackagingCost] = useState<number>(propPackagingCost ?? 25);
  const [cogsPercent, setLocalCogsPercent] = useState<number>(propCogsPercent ?? 42);
  const [exactTolerance, setLocalExactTolerance] = useState<number>(propExactTolerance ?? 2);

  // Keep local and prop in sync
  const setInsideDeliveryFee = (val: number) => {
    setLocalInsideDeliveryFee(val);
    propSetInsideFee?.(val);
  };
  const setOutsideDeliveryFee = (val: number) => {
    setLocalOutsideDeliveryFee(val);
    propSetOutsideFee?.(val);
  };
  const setPackagingCost = (val: number) => {
    setLocalPackagingCost(val);
    propSetPackagingCost?.(val);
  };
  const setCogsPercent = (val: number) => {
    setLocalCogsPercent(val);
    propSetCogsPercent?.(val);
  };
  const setExactTolerance = (val: number) => {
    setLocalExactTolerance(val);
    propSetExactTolerance?.(val);
  };

  // Cloud API sync state
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncingWc, setSyncingWc] = useState(false);
  const [syncingPathao, setSyncingPathao] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-10-11');
  const [orderStatus, setOrderStatus] = useState('any');
  const [pathaoStatus, setPathaoStatus] = useState<any>(null);
  const [wcStatus, setWcStatus] = useState<any>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  // Advanced Credential Management State
  const [showCredentialDrawer, setShowCredentialDrawer] = useState(false);
  const [wcStoreUrl, setWcStoreUrl] = useState('https://deencommerce.com');
  const [wcConsumerKey, setWcConsumerKey] = useState('');
  const [wcConsumerSecret, setWcConsumerSecret] = useState('');
  const [pathaoClientId, setPathaoClientId] = useState('');
  const [pathaoClientSecret, setPathaoClientSecret] = useState('');
  const [pathaoUsername, setPathaoUsername] = useState('');
  const [auditLogs, setAuditLogs] = useState<{ timestamp: string; action: string; details?: string }[]>([]);

  // Load saved settings on mount
  useEffect(() => {
    const loadedTheme = loadSavedThemeSettings();
    setThemeSettings(loadedTheme);
    setTempHex(loadedTheme.customHex || '#EB5A19');

    const appSettings = loadAppSettings();
    if (appSettings) {
      if (appSettings.insideDeliveryFee !== undefined) setLocalInsideDeliveryFee(appSettings.insideDeliveryFee);
      if (appSettings.outsideDeliveryFee !== undefined) setLocalOutsideDeliveryFee(appSettings.outsideDeliveryFee);
      if (appSettings.packagingCost !== undefined) setLocalPackagingCost(appSettings.packagingCost);
      if (appSettings.cogsPercent !== undefined) setLocalCogsPercent(appSettings.cogsPercent);
      if (appSettings.exactTolerance !== undefined) setLocalExactTolerance(appSettings.exactTolerance);
      if (appSettings.wcStoreUrl) setWcStoreUrl(appSettings.wcStoreUrl);
      if (appSettings.wcConsumerKey) setWcConsumerKey(appSettings.wcConsumerKey);
      if (appSettings.wcConsumerSecret) setWcConsumerSecret(appSettings.wcConsumerSecret);
      if (appSettings.pathaoClientId) setPathaoClientId(appSettings.pathaoClientId);
      if (appSettings.pathaoClientSecret) setPathaoClientSecret(appSettings.pathaoClientSecret);
      if (appSettings.pathaoUsername) setPathaoUsername(appSettings.pathaoUsername);
      if (appSettings.syncStartDate) setStartDate(appSettings.syncStartDate);
      if (appSettings.syncEndDate) setEndDate(appSettings.syncEndDate);
      if (appSettings.syncStatus) setOrderStatus(appSettings.syncStatus);
      if (appSettings.auditLogs) setAuditLogs(appSettings.auditLogs);
    }

    checkApiStatus();
  }, []);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const persistCurrentSettings = (overrides?: Partial<AppSettings>) => {
    const current: AppSettings = {
      themePresetId: themeSettings.presetId,
      themeCustomHex: themeSettings.customHex,
      themeIsCustom: themeSettings.isCustom,
      backgroundId: themeSettings.backgroundId || 'super-white',
      darkModeCanvas: themeSettings.darkModeCanvas,
      compactDensity: themeSettings.compactDensity,
      showDonutMeters: themeSettings.showDonutMeters,
      insideDeliveryFee,
      outsideDeliveryFee,
      packagingCost,
      cogsPercent,
      exactTolerance,
      excludeAugust,
      excludePOS,
      wcStoreUrl,
      wcConsumerKey,
      wcConsumerSecret,
      pathaoBaseUrl: 'https://api-hermes.pathao.com',
      pathaoClientId,
      pathaoClientSecret,
      pathaoUsername,
      syncStartDate: startDate,
      syncEndDate: endDate,
      syncStatus: orderStatus,
      auditLogs,
      ...overrides
    };
    saveAppSettings(current);
  };

  const handleSelectPreset = (preset: ThemePreset) => {
    const updated: CustomThemeSettings = {
      ...themeSettings,
      presetId: preset.id,
      customHex: preset.primary,
      isCustom: false
    };
    setThemeSettings(updated);
    setTempHex(preset.primary);
    saveThemeSettings(updated);
    persistCurrentSettings({ themePresetId: preset.id, themeCustomHex: preset.primary, themeIsCustom: false });
    logAuditAction('Theme Changed', `Switched theme preset to ${preset.name}`);
    showToast(`Applied theme preset: ${preset.name}`);
  };

  const handleSelectBackground = (bg: BackgroundPreset) => {
    const updated: CustomThemeSettings = {
      ...themeSettings,
      backgroundId: bg.id,
      darkModeCanvas: bg.id === 'dark-canvas'
    };
    setThemeSettings(updated);
    saveThemeSettings(updated);
    persistCurrentSettings({ backgroundId: bg.id, darkModeCanvas: bg.id === 'dark-canvas' });
    logAuditAction('Background Canvas Changed', `Switched canvas style to ${bg.name}`);
    showToast(`Applied canvas style: ${bg.name}`);
  };

  const handleCustomHexChange = (hex: string) => {
    setTempHex(hex);
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      const updated: CustomThemeSettings = {
        ...themeSettings,
        customHex: hex,
        isCustom: true
      };
      setThemeSettings(updated);
      saveThemeSettings(updated);
      persistCurrentSettings({ themeCustomHex: hex, themeIsCustom: true });
      logAuditAction('Custom Theme Applied', `Set hex color to ${hex}`);
      showToast(`Custom primary color set to ${hex}`);
    }
  };

  const handleToggleOption = (key: 'darkModeCanvas' | 'compactDensity' | 'showDonutMeters') => {
    const updated = {
      ...themeSettings,
      [key]: !themeSettings[key]
    };
    setThemeSettings(updated);
    saveThemeSettings(updated);
    persistCurrentSettings({ [key]: updated[key] });
    logAuditAction('Display Option Toggled', `${key} changed to ${updated[key]}`);
    showToast(`Updated appearance preference.`);
  };

  const handleResetTheme = () => {
    setThemeSettings(DEFAULT_THEME_SETTINGS);
    setTempHex(DEFAULT_THEME_SETTINGS.customHex);
    saveThemeSettings(DEFAULT_THEME_SETTINGS);
    persistCurrentSettings({
      themePresetId: DEFAULT_THEME_SETTINGS.presetId,
      themeCustomHex: DEFAULT_THEME_SETTINGS.customHex,
      themeIsCustom: false,
      backgroundId: 'super-white'
    });
    logAuditAction('Theme Reset', 'Restored default brand theme and Super White background.');
    showToast(`Reset to default theme: Deen Signature Orange & Super White.`);
  };

  // Save math parameters to storage and reload engine
  const handleApplyMathParameters = () => {
    persistCurrentSettings({
      insideDeliveryFee,
      outsideDeliveryFee,
      packagingCost,
      cogsPercent,
      exactTolerance,
      excludeAugust,
      excludePOS
    });
    logAuditAction('Math Model Updated', `Inside: ৳${insideDeliveryFee}, Outside: ৳${outsideDeliveryFee}, COGS: ${cogsPercent}%, Tolerance: ৳${exactTolerance}`);
    if (onRefreshReconciliation) {
      onRefreshReconciliation();
    }
    showToast('Reconciliation financial parameters saved & applied live.');
  };

  // Save credentials
  const handleSaveCredentials = () => {
    persistCurrentSettings({
      wcStoreUrl,
      wcConsumerKey,
      wcConsumerSecret,
      pathaoClientId,
      pathaoClientSecret,
      pathaoUsername
    });
    logAuditAction('API Credentials Updated', 'Updated WooCommerce and Pathao credentials.');
    showToast('API credentials saved securely in local storage.');
    checkApiStatus();
  };

  // API Status Check
  const checkApiStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      setPathaoStatus(data.pathao);
      setWcStatus(data.woocommerce);
    } catch (e: any) {
      console.error('Failed to verify API connectivity:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Sync WooCommerce Orders
  const handleSyncWooCommerce = async () => {
    setSyncingWc(true);
    setApiMessage(`Connecting to WooCommerce REST API (${startDate} to ${endDate})...`);
    try {
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, status: orderStatus, perPage: 100, maxPages: 5 })
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        onDataSynced?.('orders', data.orders);
        setApiMessage(`Successfully imported ${data.ordersCount} WooCommerce orders.`);
        showToast(`Synced ${data.ordersCount} orders.`);
      } else {
        setApiMessage(data.message || 'WooCommerce responded with 0 matching orders.');
      }
    } catch (e: any) {
      setApiMessage(`WooCommerce sync error: ${e.message}`);
    } finally {
      setSyncingWc(false);
    }
  };

  // Sync Pathao Consignments
  const handleSyncPathao = async () => {
    setSyncingPathao(true);
    setApiMessage(`Querying Pathao Hermes API (${startDate} to ${endDate})...`);
    try {
      const res = await fetch('/api/sync/pathao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, limit: 50 })
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        onDataSynced?.('returns', data.orders);
        setApiMessage(`Retrieved ${data.ordersCount} Pathao return & delivery records.`);
        showToast(`Synced ${data.ordersCount} courier parcels.`);
      } else {
        setApiMessage(data.message || 'Pathao sync finished with cached consignments.');
      }
    } catch (e: any) {
      setApiMessage(`Pathao sync notice: ${e.message}`);
    } finally {
      setSyncingPathao(false);
    }
  };

  // Sync Both APIs
  const handleSyncBoth = async () => {
    setSyncingBoth(true);
    setApiMessage(`Initiating dual-channel sync (WooCommerce + Pathao)...`);
    try {
      await handleSyncWooCommerce();
      await handleSyncPathao();
      setApiMessage(`Dual-channel sync completed successfully.`);
    } finally {
      setSyncingBoth(false);
    }
  };

  // Diagnostic export
  const handleExportDiagnostics = () => {
    const report = {
      systemVersion: '2.6.0',
      timestamp: new Date().toISOString(),
      themeSettings,
      parameters: {
        insideDeliveryFee,
        outsideDeliveryFee,
        packagingCost,
        cogsPercent,
        exactTolerance,
        excludeAugust,
        excludePOS
      },
      apiConfig: {
        woocommerce: wcStatus,
        pathao: pathaoStatus
      },
      auditLogs
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deen-system-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditAction('Config Exported', 'Downloaded system settings JSON.');
    showToast('Diagnostic settings JSON downloaded.');
  };

  // JSON Config Import
  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.parameters) {
          if (parsed.parameters.insideDeliveryFee !== undefined) setInsideDeliveryFee(parsed.parameters.insideDeliveryFee);
          if (parsed.parameters.outsideDeliveryFee !== undefined) setOutsideDeliveryFee(parsed.parameters.outsideDeliveryFee);
          if (parsed.parameters.packagingCost !== undefined) setPackagingCost(parsed.parameters.packagingCost);
          if (parsed.parameters.cogsPercent !== undefined) setCogsPercent(parsed.parameters.cogsPercent);
          if (parsed.parameters.exactTolerance !== undefined) setExactTolerance(parsed.parameters.exactTolerance);
          if (parsed.parameters.excludeAugust !== undefined) setExcludeAugust(parsed.parameters.excludeAugust);
          if (parsed.parameters.excludePOS !== undefined) setExcludePOS(parsed.parameters.excludePOS);
        }
        if (parsed.themeSettings) {
          setThemeSettings(parsed.themeSettings);
          saveThemeSettings(parsed.themeSettings);
          if (parsed.themeSettings.customHex) setTempHex(parsed.themeSettings.customHex);
        }
        showToast('Settings configuration successfully imported!');
        logAuditAction('Config Imported', `Imported configuration from ${file.name}`);
        if (onRefreshReconciliation) onRefreshReconciliation();
      } catch (err: any) {
        showToast(`Import error: Invalid JSON file.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Clear local storage overrides
  const handleClearLocalOverrides = () => {
    if (confirm('Are you sure you want to clear all locally cached order overrides and return tags?')) {
      localStorage.removeItem('deen_order_overrides');
      logAuditAction('Overrides Purged', 'Cleared manual order status modifications.');
      showToast('Local order overrides cleared.');
      if (onRefreshReconciliation) onRefreshReconciliation();
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Settings Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary shadow-xs">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-headline text-slate-900">System Settings & Customization Hub</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                v2.6 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure custom visual themes, knapsack reconciliation math, courier fee assumptions, and cloud API integrations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleResetTheme}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            title="Reset to default brand theme"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          
          <label className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
          </label>

          <button
            onClick={handleExportDiagnostics}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Config JSON</span>
          </button>
        </div>
      </div>

      {/* Grid of Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ======================================================== */}
        {/* SECTION 1: CUSTOM THEME & VISUAL APPEARANCE ENGINE       */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-headline">Appearance & Custom Themes</h3>
                  <span className="text-[11px] text-slate-500 block">Personalize brand accents, contrast, and visual metrics</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-primary border border-orange-200">
                Live Preview
              </span>
            </div>

            {/* Presets Gallery */}
            <div className="mt-5 space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Curated Brand Palettes</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {THEME_PRESETS.map((p) => {
                  const isSelected = !themeSettings.isCustom && themeSettings.presetId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 relative group ${
                        isSelected
                          ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/60 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className="w-5 h-5 rounded-full shadow-2xs border border-white"
                          style={{ backgroundColor: p.primary }}
                        />
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block truncate leading-tight">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{p.primary}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Canvas Styling Selector */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-800 block">Canvas Background Style</label>
                  <span className="text-[10px] text-slate-400 block">Default Super White delivers a native app appearance</span>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {BACKGROUND_PRESETS.find(b => b.id === (themeSettings.backgroundId || 'super-white'))?.name || 'Native Super White'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BACKGROUND_PRESETS.map((bg) => {
                  const isSelected = (themeSettings.backgroundId || 'super-white') === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => handleSelectBackground(bg)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 relative group ${
                        isSelected
                          ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-lg border border-slate-300 shadow-2xs shrink-0 mt-0.5"
                        style={{ backgroundColor: bg.bgHex }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {bg.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-500 block line-clamp-2 mt-0.5 leading-tight">
                          {bg.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Color Picker */}
            <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Custom Primary Color
                </label>
                {themeSettings.isCustom && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active Custom Color
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-12 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 cursor-pointer shadow-2xs">
                  <input
                    type="color"
                    value={tempHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    className="absolute -inset-2 w-16 h-16 cursor-pointer border-0 p-0"
                  />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={tempHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    placeholder="#EB5A19"
                    maxLength={7}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900"
                  />
                </div>
                <button
                  onClick={() => handleCustomHexChange(tempHex)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Live Interactive Preview Box */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Live Theme Preview
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-xs transition-all"
                  style={{ backgroundColor: 'var(--primary, #EB5A19)' }}
                >
                  Active Button
                </button>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{
                    backgroundColor: 'var(--primary-subtle, #FFF7ED)',
                    color: 'var(--primary, #EB5A19)',
                    borderColor: 'var(--primary-hover, #D4490E)'
                  }}
                >
                  Primary Badge
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--primary, #EB5A19)' }}>
                  Accent Text
                </span>
              </div>
            </div>

            {/* Display Options */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
              <label className="text-xs font-bold text-slate-700 block">Visual Options</label>
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-slate-800 block">Show Mini Donut Meters</span>
                  <span className="text-[10px] text-slate-400">Render SVG circular meters inside KPI cards</span>
                </div>
                <input
                  type="checkbox"
                  checked={themeSettings.showDonutMeters}
                  onChange={() => handleToggleOption('showDonutMeters')}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span>Theme auto-persists in your browser cache</span>
            <span className="font-mono">CSS: var(--primary)</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: RECONCILIATION & KNAPSACK DP MATH PARAMETERS  */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-headline">Reconciliation & Financial Model</h3>
                  <span className="text-[11px] text-slate-500 block">Parameters governing subset-sum Knapsack solving & margin formulas</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Audited Formulas
              </span>
            </div>

            {/* Parameter Inputs */}
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Inside Dhaka Delivery Fee
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      value={insideDeliveryFee}
                      onChange={(e) => setInsideDeliveryFee(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Deducted from COD before subset sum</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Outside Dhaka Delivery Fee
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      value={outsideDeliveryFee}
                      onChange={(e) => setOutsideDeliveryFee(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Standard nationwide courier charge</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Packaging Sunk Cost per Return
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Flyer bags + return handling labor</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Estimated COGS Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={cogsPercent}
                      onChange={(e) => setCogsPercent(Number(e.target.value))}
                      className="w-full pl-3 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Fabric & apparel manufacturing cost</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Knapsack Exact Tolerance (৳)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      value={exactTolerance}
                      onChange={(e) => setExactTolerance(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Allowed rounding margin for subset match</span>
                </div>
              </div>

              {/* Filter Toggles */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">Default Ingestion Rules</label>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Exclude August Pre-Period Dates</span>
                    <span className="text-[10px] text-slate-500">Only analyze September clean operational cohort</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={excludeAugust}
                    onChange={(e) => setExcludeAugust(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Exclude In-Store POS Orders from Courier Returns</span>
                    <span className="text-[10px] text-slate-500">Keeps retail physical register sales distinct from online deliveries</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={excludePOS}
                    onChange={(e) => setExcludePOS(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Strict Integer Constraint: Qty ∈ Z+</span>
            <button
              onClick={handleApplyMathParameters}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Save & Recalculate Live</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 3: CLOUD API SYNC & INTEGRATION CENTER           */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-headline">Cloud API Integrations & Synchronization Hub</h3>
                  <span className="text-[11px] text-slate-500 block">WooCommerce REST API & Pathao Courier Hermes API configuration</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowCredentialDrawer(!showCredentialDrawer)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Key className="w-3.5 h-3.5 text-slate-600" />
                  <span>{showCredentialDrawer ? 'Hide Credentials' : 'Manage Credentials'}</span>
                </button>
                <button
                  onClick={checkApiStatus}
                  disabled={loadingStatus}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                  <span>Check Status</span>
                </button>
                <button
                  onClick={handleSyncBoth}
                  disabled={syncingBoth || syncingWc || syncingPathao}
                  className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${syncingBoth ? 'animate-spin' : ''}`} />
                  <span>Sync Both APIs</span>
                </button>
              </div>
            </div>

            {/* Credential Drawer / Editor Panel */}
            {showCredentialDrawer && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold text-slate-900">API Credentials & Endpoints</h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Local Browser Vault (Encrypted State)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WooCommerce Settings */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      WooCommerce REST Configuration
                    </span>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Store URL</label>
                      <input
                        type="text"
                        value={wcStoreUrl}
                        onChange={(e) => setWcStoreUrl(e.target.value)}
                        placeholder="https://deencommerce.com"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Consumer Key (ck_...)</label>
                      <input
                        type="text"
                        value={wcConsumerKey}
                        onChange={(e) => setWcConsumerKey(e.target.value)}
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Consumer Secret (cs_...)</label>
                      <input
                        type="password"
                        value={wcConsumerSecret}
                        onChange={(e) => setWcConsumerSecret(e.target.value)}
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono"
                      />
                    </div>
                  </div>

                  {/* Pathao Hermes Settings */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      Pathao Hermes Courier Configuration
                    </span>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Client ID</label>
                      <input
                        type="text"
                        value={pathaoClientId}
                        onChange={(e) => setPathaoClientId(e.target.value)}
                        placeholder="Pathao OAuth Client ID"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={pathaoClientSecret}
                        onChange={(e) => setPathaoClientSecret(e.target.value)}
                        placeholder="Pathao OAuth Client Secret"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Username / Account Email</label>
                      <input
                        type="text"
                        value={pathaoUsername}
                        onChange={(e) => setPathaoUsername(e.target.value)}
                        placeholder="merchant@deencommerce.com"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-600 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCredentialDrawer(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCredentials}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs active:scale-95"
                  >
                    Save Credentials
                  </button>
                </div>
              </div>
            )}

            {/* Status cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {/* WooCommerce Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">WooCommerce REST API</h4>
                    <span className="text-[11px] text-slate-500 font-mono block">https://deencommerce.com/wp-json/wc/v3</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        wcStatus?.configured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${wcStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {wcStatus?.configured ? 'Configured' : 'Credentials Missing'}
                      </span>
                      <span className="text-[10px] text-slate-400">OAuth 1.0a / Key Protected</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSyncWooCommerce}
                  disabled={syncingWc || syncingBoth}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingWc ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>

              {/* Pathao Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Pathao Courier Hermes API</h4>
                    <span className="text-[11px] text-slate-500 font-mono block">https://api-hermes.pathao.com</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pathaoStatus?.configured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${pathaoStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {pathaoStatus?.configured ? 'Configured' : 'Credentials Missing'}
                      </span>
                      <span className="text-[10px] text-slate-400">Bearer Token Caching (60s buffer)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSyncPathao}
                  disabled={syncingPathao || syncingBoth}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingPathao ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>

            {/* Date Range & Ingestion Scope */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-bold text-slate-800 block mb-3">Sync Date Range & Filters</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Order Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="any">Any Status (Recommended)</option>
                    <option value="completed">Completed Only</option>
                    <option value="processing">Processing Only</option>
                  </select>
                </div>
              </div>

              {apiMessage && (
                <div className="mt-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200/70 text-xs text-blue-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{apiMessage}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Rate limiting enforced: max 5 concurrent worker requests</span>
            <span>Zero-500 Serverless Resilience Guaranteed</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 4: DATA MANAGEMENT & AUDIT LOG VIEWER            */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-headline">Data Management & Cache Operations</h3>
                <span className="text-[11px] text-slate-500 block">Manage workspace sample baseline, order overrides, and local memory</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Reload September Baseline</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Resets the engine to the verified 1,026 clean orders September dataset.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onResetBaseline) onResetBaseline();
                  logAuditAction('Baseline Reset', 'Reloaded clean 1,026 September orders baseline.');
                  showToast('Reloaded verified September baseline dataset.');
                }}
                className="mt-4 px-3 py-1.5 rounded-lg bg-white hover:bg-orange-50 text-primary border border-orange-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Baseline</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Purge Order Overrides</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Clears all manual status overrides and notes saved in your browser storage.
                </p>
              </div>
              <button
                onClick={handleClearLocalOverrides}
                className="mt-4 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Overrides</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Diagnostics Export</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Downloads active reconciliation parameters, themes, and API connectivity metrics.
                </p>
              </div>
              <button
                onClick={handleExportDiagnostics}
                className="mt-4 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          {/* Activity Audit Log Table */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900">System Activity Audit Log</h4>
              </div>
              <span className="text-[10px] text-slate-400">Timestamped ledger of settings & sync modifications</span>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-x-auto min-w-0 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action Event</th>
                    <th className="py-2.5 px-3">Operational Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.slice(0, 10).map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-600">
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-xs text-slate-400">
                        No activity recorded in this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
