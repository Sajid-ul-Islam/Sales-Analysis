"use client";

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sliders,
  Cloud,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Truck,
  RotateCcw,
  Sparkles,
  Download,
  Trash2,
  Check,
  Settings as SettingsIcon,
  Zap,
  Key,
  Upload,
  History,
  Copy,
  Cookie,
  HardDrive,
  Info,
  Activity,
  Share2
} from 'lucide-react';
import {
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  BackgroundPreset,
  CustomThemeSettings,
  DEFAULT_THEME_SETTINGS,
  loadSavedThemeSettings,
  saveThemeSettings,
  ThemePreset
} from '@/lib/themeManager';
import {
  AppSettings,
  loadAppSettings,
  saveAppSettings,
  logAuditAction
} from '@/lib/settingsStore';
import {
  getCookieDetails,
  deleteCookie,
  clearAllDeenCookies,
  CookieDetail
} from '@/lib/cookieManager';
import {
  getAllCacheEntries,
  removeCacheItem,
  clearAllDeenCache,
  getStorageEstimate,
  exportEntireWorkspaceStorageJSON,
  importWorkspaceStorageJSON,
  CacheEntrySummary,
  StorageEstimateResult
} from '@/lib/cacheManager';
import {
  getSyncCache,
  setSyncCache,
  clearAllSyncCaches
} from '@/lib/apiCache';
import { RawOrderRow } from '@/types';
import { loadBYOKConfig, BYOKConfig } from '@/lib/byok';
import { BYOKModal } from '@/components/ai/BYOKModal';
import { DataProvenanceInfo } from '@/lib/dataAudit';
import { resetAssistantPosition } from '@/lib/draggableAssistant';
import { getClientAuthHeaders } from '@/lib/auth/clientAuth';

interface SettingsTabProps {
  excludeAugust: boolean;
  setExcludeAugust: (val: boolean) => void;
  excludePOS: boolean;
  setExcludePOS: (val: boolean) => void;
  onResetBaseline?: () => void;
  onDataSynced?: (type: 'orders' | 'returns', rows: RawOrderRow[], provenance?: DataProvenanceInfo) => void;
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
  metaAdCost?: number;
  setMetaAdCost?: (val: number) => void;
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
  setExactTolerance: propSetExactTolerance,
  metaAdCost: propMetaAdCost,
  setMetaAdCost: propSetMetaAdCost
}: SettingsTabProps) {
  // Theme state
  const [themeSettings, setThemeSettings] = useState<CustomThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [tempHex, setTempHex] = useState('#EB5A19');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [assistantResetDone, setAssistantResetDone] = useState(false);

  const handleResetAssistant = () => {
    resetAssistantPosition();
    setAssistantResetDone(true);
    setTimeout(() => setAssistantResetDone(false), 2000);
  };

  // Math & Model Parameter States
  const [insideDeliveryFee, setLocalInsideDeliveryFee] = useState<number>(propInsideFee ?? 50);
  const [outsideDeliveryFee, setLocalOutsideDeliveryFee] = useState<number>(propOutsideFee ?? 90);
  const [packagingCost, setLocalPackagingCost] = useState<number>(propPackagingCost ?? 25);
  const [cogsPercent, setLocalCogsPercent] = useState<number>(propCogsPercent ?? 42);
  const [exactTolerance, setLocalExactTolerance] = useState<number>(propExactTolerance ?? 2);
  const [metaAdCost, setLocalMetaAdCost] = useState<number>(propMetaAdCost ?? 150000);

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
  const setMetaAdCost = (val: number) => {
    setLocalMetaAdCost(val);
    propSetMetaAdCost?.(val);
  };

  // Cloud API sync state
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncingWc, setSyncingWc] = useState(false);
  const [syncingPathao, setSyncingPathao] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-10-11');
interface ApiConnectionStatus {
  configured?: boolean;
  connected?: boolean;
  message?: string;
  error?: string;
  propertyId?: string;
  pixelId?: string;
  adAccountId?: string;
  realtimeUsers?: number;
  [key: string]: unknown;
}

  const [orderStatus, setOrderStatus] = useState('any');
  const [pathaoStatus, setPathaoStatus] = useState<ApiConnectionStatus | null>(null);
  const [wcStatus, setWcStatus] = useState<ApiConnectionStatus | null>(null);
  const [ga4Status, setGa4Status] = useState<ApiConnectionStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<ApiConnectionStatus | null>(null);
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

  // Cache & Cookie Operations State
  const [cacheEntries, setCacheEntries] = useState<CacheEntrySummary[]>([]);
  const [cookieDetails, setCookieDetails] = useState<CookieDetail[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult | null>(null);
  const [activeStorageTab, setActiveStorageTab] = useState<'cache' | 'cookies' | 'audit'>('cache');
  const [isRefreshingStorage, setIsRefreshingStorage] = useState(false);

  // BYOK State
  const [byokConfig, setByokConfig] = useState<BYOKConfig>(() => loadBYOKConfig());
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);

  // Listen for BYOK updates
  useEffect(() => {
    const handleBYOKUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BYOKConfig>;
      if (customEvent.detail) {
        setByokConfig(customEvent.detail);
      }
    };
    window.addEventListener('deen_byok_updated', handleBYOKUpdate);
    return () => window.removeEventListener('deen_byok_updated', handleBYOKUpdate);
  }, []);

  const refreshStorageData = React.useCallback(() => {
    setIsRefreshingStorage(true);
    try {
      setCacheEntries(getAllCacheEntries());
      setCookieDetails(getCookieDetails());
      setStorageEstimate(getStorageEstimate());
    } finally {
      setTimeout(() => setIsRefreshingStorage(false), 300);
    }
  }, []);

  // API Status Check
  const checkApiStatus = React.useCallback(async (customCreds?: Record<string, unknown>) => {
    setLoadingStatus(true);
    try {
      const payload: Record<string, unknown> = customCreds ? { ...customCreds } : {};
      if (!customCreds) {
        if (wcConsumerKey) {
          payload.woocommerce = {
            store_url: wcStoreUrl,
            consumer_key: wcConsumerKey,
            consumer_secret: wcConsumerSecret
          };
        }
        if (pathaoClientId) {
          payload.pathao = {
            base_url: 'https://api-hermes.pathao.com',
            client_id: pathaoClientId,
            client_secret: pathaoClientSecret,
            username: pathaoUsername
          };
        }
      }

      const res = Object.keys(payload).length > 0
        ? await fetch('/api/sync/status', {
            method: 'POST',
            headers: getClientAuthHeaders(),
            body: JSON.stringify(payload)
          })
        : await fetch('/api/sync/status', {
            headers: getClientAuthHeaders(),
          });

      const data = await res.json();
      setPathaoStatus(data.pathao);
      setWcStatus(data.woocommerce);
      setGa4Status(data.ga4);
      setMetaStatus(data.meta);
    } catch (e: unknown) {
      console.error('Failed to verify API connectivity:', e);
    } finally {
      setLoadingStatus(false);
    }
  }, [wcConsumerKey, wcStoreUrl, wcConsumerSecret, pathaoClientId, pathaoClientSecret, pathaoUsername]);

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
      if (appSettings.metaAdCost !== undefined) setLocalMetaAdCost(appSettings.metaAdCost);
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

    const credsPayload: Record<string, unknown> = {};
    if (appSettings?.wcConsumerKey) {
      credsPayload.woocommerce = {
        store_url: appSettings.wcStoreUrl || 'https://deencommerce.com',
        consumer_key: appSettings.wcConsumerKey,
        consumer_secret: appSettings.wcConsumerSecret
      };
    }
    if (appSettings?.pathaoClientId) {
      credsPayload.pathao = {
        base_url: 'https://api-hermes.pathao.com',
        client_id: appSettings.pathaoClientId,
        client_secret: appSettings.pathaoClientSecret,
        username: appSettings.pathaoUsername
      };
    }

    checkApiStatus(Object.keys(credsPayload).length > 0 ? credsPayload : undefined);
    refreshStorageData();
  }, [refreshStorageData, checkApiStatus]);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handlePurgeCacheItem = (key: string, name: string) => {
    removeCacheItem(key);
    refreshStorageData();
    logAuditAction('Cache Purged', `Purged cache item: ${name} (${key})`);
    showToast(`Purged "${name}" from local cache.`);
  };

  const handleDeleteCookieItem = (name: string) => {
    deleteCookie(name);
    refreshStorageData();
    logAuditAction('Cookie Deleted', `Deleted cookie: ${name}`);
    showToast(`Deleted cookie "${name}".`);
  };

  const handlePurgeAllCache = () => {
    const cleared = clearAllDeenCache(true);
    refreshStorageData();
    logAuditAction('All Cache Purged', `Purged ${cleared} workspace cache items.`);
    showToast(`Successfully purged ${cleared} cache items.`);
  };

  const handleClearAllCookies = () => {
    const cleared = clearAllDeenCookies();
    refreshStorageData();
    logAuditAction('All Cookies Cleared', `Cleared ${cleared} DEEN session cookies.`);
    showToast(`Cleared ${cleared} DEEN session cookies.`);
  };

  const handleExportFullStorage = () => {
    const jsonStr = exportEntireWorkspaceStorageJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deen_workspace_storage_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logAuditAction('Storage Exported', 'Exported complete workspace storage & cache JSON.');
    showToast('Exported complete storage & cache snapshot.');
  };

  const handleImportStorage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const res = importWorkspaceStorageJSON(text);
        if (res.success) {
          refreshStorageData();
          logAuditAction('Storage Imported', `Restored ${res.importedKeys} items from backup.`);
          showToast(`Successfully restored ${res.importedKeys} storage items.`);
        } else {
          showToast(`Import failed: ${res.error || 'Invalid file format'}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Import failed: ${msg}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
      metaAdCost,
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
      metaAdCost,
      excludeAugust,
      excludePOS
    });
    logAuditAction('Math Model Updated', `Inside: ৳${insideDeliveryFee}, Outside: ৳${outsideDeliveryFee}, COGS: ${cogsPercent}%, Meta Ads: ৳${metaAdCost}`);
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
    checkApiStatus({
      woocommerce: wcConsumerKey ? {
        store_url: wcStoreUrl,
        consumer_key: wcConsumerKey,
        consumer_secret: wcConsumerSecret
      } : undefined,
      pathao: pathaoClientId ? {
        base_url: 'https://api-hermes.pathao.com',
        client_id: pathaoClientId,
        client_secret: pathaoClientSecret,
        username: pathaoUsername
      } : undefined
    });
  };

  // Purge API Sync Caches specifically
  const handlePurgeApiCaches = () => {
    const cleared = clearAllSyncCaches();
    refreshStorageData();
    logAuditAction('API Cache Cleared', `Purged ${cleared} cached API query snapshots.`);
    showToast(`Purged ${cleared} API sync cache entries.`);
  };

  // Sync WooCommerce Orders with Local Storage Caching
  const handleSyncWooCommerce = async () => {
    // 1. Check local storage cache for instant 0ms hit
    const cached = getSyncCache('woocommerce', startDate, endDate, orderStatus);
    if (cached.hit && cached.data && cached.data.length > 0) {
      onDataSynced?.('orders', cached.data);
      setApiMessage(`⚡ Instant 0ms Load: Retrieved ${cached.ordersCount} WooCommerce orders from local cache (${cached.ageFormatted}). 0 API calls.`);
      showToast(`⚡ Loaded ${cached.ordersCount} cached orders (0ms).`);
      logAuditAction('Cache Hit', `Loaded ${cached.ordersCount} WooCommerce orders from local cache (${cached.ageFormatted}).`);
      refreshStorageData();
      return;
    }

    setSyncingWc(true);
    setApiMessage(`Connecting to WooCommerce REST API (${startDate} to ${endDate})...`);
    try {
      const res = await fetch('/api/sync/woocommerce', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          startDate,
          endDate,
          status: orderStatus,
          perPage: 100,
          maxPages: 3,
          credentials: wcConsumerKey ? {
            store_url: wcStoreUrl,
            consumer_key: wcConsumerKey,
            consumer_secret: wcConsumerSecret
          } : undefined
        })
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        setSyncCache('woocommerce', startDate, endDate, orderStatus, data.orders, {
          ordersCount: data.ordersCount || data.orders.length,
          lineItemsCount: data.lineItemsCount,
        });
        onDataSynced?.('orders', data.orders);
        setApiMessage(`Successfully imported ${data.ordersCount} WooCommerce orders & saved to local cache.`);
        showToast(`Synced ${data.ordersCount} orders.`);
        logAuditAction('WooCommerce Synced', `Fetched ${data.ordersCount} orders via live REST API.`);
        refreshStorageData();
      } else {
        setApiMessage(data.message || 'WooCommerce responded with 0 matching orders.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiMessage(`WooCommerce sync error: ${msg}`);
    } finally {
      setSyncingWc(false);
    }
  };

  // Sync Pathao Consignments with Local Storage Caching
  const handleSyncPathao = async () => {
    // 1. Check local storage cache for instant 0ms hit
    const cached = getSyncCache('pathao', startDate, endDate, 'any');
    if (cached.hit && cached.data && cached.data.length > 0) {
      onDataSynced?.('returns', cached.data);
      setApiMessage(`⚡ Instant 0ms Load: Retrieved ${cached.ordersCount} Pathao consignments from local cache (${cached.ageFormatted}). 0 API calls.`);
      showToast(`⚡ Loaded ${cached.ordersCount} cached parcels (0ms).`);
      logAuditAction('Cache Hit', `Loaded ${cached.ordersCount} Pathao parcels from local cache (${cached.ageFormatted}).`);
      refreshStorageData();
      return;
    }

    setSyncingPathao(true);
    setApiMessage(`Querying Pathao Hermes API (${startDate} to ${endDate})...`);
    try {
      const res = await fetch('/api/sync/pathao', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          startDate,
          endDate,
          limit: 35,
          credentials: pathaoClientId ? {
            base_url: 'https://api-hermes.pathao.com',
            client_id: pathaoClientId,
            client_secret: pathaoClientSecret,
            username: pathaoUsername
          } : undefined
        })
      });
      const data = await res.json();
      if (data.success && data.orders && data.orders.length > 0) {
        setSyncCache('pathao', startDate, endDate, 'any', data.orders, {
          ordersCount: data.ordersCount || data.orders.length,
        });
        onDataSynced?.('returns', data.orders, data.provenance);
        setApiMessage(`Retrieved ${data.ordersCount} Pathao return & delivery records & saved to local cache.`);
        showToast(`Synced ${data.ordersCount} courier parcels.`);
        logAuditAction('Pathao Synced', `Fetched ${data.ordersCount} consignments from Pathao Hermes API.`);
        refreshStorageData();
      } else {
        setApiMessage(data.message || 'Pathao sync finished with cached consignments.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiMessage(`Pathao sync notice: ${msg}`);
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
        metaAdCost,
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
          if (parsed.parameters.metaAdCost !== undefined) setMetaAdCost(parsed.parameters.metaAdCost);
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
      } catch {
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
    <div className="space-y-6 sm:space-y-8 max-w-[1920px] mx-auto pb-12">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-left-3 duration-200">
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

              {/* Reset AI Assistant FAB Position */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs font-medium text-slate-800 block">Reset AI Assistant Position</span>
                  <span className="text-[10px] text-slate-400">Restore the floating assistant button to the default corner</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetAssistant}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>{assistantResetDone ? 'Reset!' : 'Reset Position'}</span>
                </button>
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

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Meta Ad Performance Spend (৳)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      value={metaAdCost}
                      onChange={(e) => setMetaAdCost(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Facebook & Instagram campaign ad spend</span>
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
                  onClick={() => { checkApiStatus(); }}
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

              {/* Google Analytics 4 Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Google Analytics 4 (GA4)</h4>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      Property #{ga4Status?.propertyId || '123456789'}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ga4Status?.connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ga4Status?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {ga4Status?.connected ? `Connected (${ga4Status?.realtimeUsers ?? 125} active users)` : 'Checking Connectivity...'}
                      </span>
                      <span className="text-[10px] text-slate-400">OAuth2 Service Account</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { checkApiStatus(); }}
                  disabled={loadingStatus}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                  title="Test GA4 Live Connection"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
                  <span>Test</span>
                </button>
              </div>

              {/* Meta Pixel & Marketing Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-primary shrink-0">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Meta Pixel & Marketing API</h4>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      Pixel #{metaStatus?.pixelId || '1234567890123456'} • Account {metaStatus?.adAccountId || 'act_1234567890123456'}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        metaStatus?.connected
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${metaStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {metaStatus?.connected ? 'Live Connected' : 'Benchmark Mode (Token Expired)'}
                      </span>
                      <span className="text-[10px] text-slate-400">Graph API v19.0</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { checkApiStatus(); }}
                  disabled={loadingStatus}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-primary border border-orange-200 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                  title="Test Meta Connection"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
                  <span>Test</span>
                </button>
              </div>

              {/* DEEN Assistant & Intelligence Engine (BYOK) Status Card */}
              <div className="p-4 rounded-xl border border-orange-200/80 bg-gradient-to-r from-orange-50/40 via-amber-50/20 to-white flex items-start justify-between md:col-span-2 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EB5A19] shrink-0 shadow-2xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 font-headline">
                        DEEN Assistant & Bring Your Own Key (BYOK)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-[#EB5A19]">
                        Multi-Provider Auto-Detect
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Powers DEEN Assistant, After-Sales QA Diagnosis, Courier Dispute Audits, and Customer Risk Profiling
                    </span>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          byokConfig.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            byokConfig.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {byokConfig.isActive
                          ? `Connected: ${byokConfig.provider.toUpperCase()} (${byokConfig.model})`
                          : 'Offline Heuristic Fallback (Connect Free Gemini Key)'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {byokConfig.isActive ? 'Local Browser Vault' : 'No Credit Card Needed'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsBYOKModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#EB5A19] hover:bg-[#d44e13] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{byokConfig.isActive ? 'Manage BYOK' : 'Connect API Key'}</span>
                  </button>
                </div>
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
        {/* SECTION 4: LOCAL CACHE & COOKIE OPERATIONS CENTER        */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 lg:col-span-2">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-primary shadow-2xs">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-headline flex items-center gap-2">
                  <span>Local Cache & Cookie Operations Center</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Offline First
                  </span>
                </h3>
                <span className="text-[11px] text-slate-500 block">
                  Inspect browser quota, manage TTL dataset caches, and control active session cookies
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={refreshStorageData}
                disabled={isRefreshingStorage}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Scan and calculate current browser storage usage"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStorage ? 'animate-spin text-primary' : ''}`} />
                <span>Refresh Metrics</span>
              </button>
            </div>
          </div>

          {/* Real-Time Storage Health & Quota Overview */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Browser Storage Consumption:</span>
                <span className="font-mono text-slate-600 font-semibold">
                  {storageEstimate?.formattedDeenCache || '0 B'} used of ~5.0 MB quota ({storageEstimate?.percentUsed || 0}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  storageEstimate?.health === 'healthy' ? 'bg-emerald-500' : storageEstimate?.health === 'moderate' ? 'bg-amber-500' : 'bg-rose-500'
                }`}></span>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  storageEstimate?.health === 'healthy' ? 'text-emerald-700' : storageEstimate?.health === 'moderate' ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  Storage {storageEstimate?.health || 'healthy'}
                </span>
              </div>
            </div>

            {/* Visual Storage Quota Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex shadow-inner">
              <div
                className={`h-full transition-all duration-500 ${
                  storageEstimate?.health === 'healthy' ? 'bg-emerald-500' : storageEstimate?.health === 'moderate' ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(2, storageEstimate?.percentUsed || 0)}%` }}
              ></div>
            </div>

            {/* Metric Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">LocalStorage Cache</span>
                  <span className="text-sm font-black text-navy-deep font-headline">{storageEstimate?.formattedDeenCache || '0 B'}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-primary border border-orange-200">
                  {cacheEntries.length} items
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Cookie Storage</span>
                  <span className="text-sm font-black text-navy-deep font-headline">{storageEstimate?.formattedCookieBytes || '0 B'}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {cookieDetails.length} cookies
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Available Free Quota</span>
                  <span className="text-sm font-black text-emerald-700 font-headline">
                    ~{(Math.max(0, 5 - ((storageEstimate?.totalStorageBytes || 0) / (1024 * 1024)))).toFixed(2)} MB Free
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Fast IO
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 w-fit flex-wrap">
            <button
              onClick={() => setActiveStorageTab('cache')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeStorageTab === 'cache'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-primary" />
              <span>Local Cache Inventory</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-orange-100 text-primary font-bold">
                {cacheEntries.length}
              </span>
            </button>

            <button
              onClick={() => setActiveStorageTab('cookies')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeStorageTab === 'cookies'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Cookie className="w-3.5 h-3.5 text-blue-600" />
              <span>Cookie Inspector</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700 font-bold">
                {cookieDetails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveStorageTab('audit')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeStorageTab === 'audit'
                  ? 'bg-white text-navy-deep shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <History className="w-3.5 h-3.5 text-slate-600" />
              <span>System Activity Audit Log</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700 font-bold">
                {auditLogs.length}
              </span>
            </button>
          </div>

          {/* TAB 1: LOCAL CACHE INVENTORY */}
          {activeStorageTab === 'cache' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 overflow-x-auto min-w-0 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Cache Entry & Key</th>
                      <th className="py-2.5 px-3">Category Tag</th>
                      <th className="py-2.5 px-3">Payload Size</th>
                      <th className="py-2.5 px-3">Last Modified</th>
                      <th className="py-2.5 px-3">TTL & Expiration</th>
                      <th className="py-2.5 px-3 text-right">Purge Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {cacheEntries && cacheEntries.length > 0 ? (
                      cacheEntries.map((entry) => (
                        <tr key={entry.key} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{entry.name}</div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{entry.key}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              entry.tag === 'dataset' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              entry.tag === 'reconciliation' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              entry.tag === 'api' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {entry.tag}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {entry.formattedSize}
                            {entry.itemCount !== undefined && (
                              <span className="text-[10px] text-slate-400 font-sans font-medium block">
                                {entry.itemCount.toLocaleString()} records
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {entry.formattedAge}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              entry.isExpired
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : entry.ttlMs > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {entry.expiryStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handlePurgeCacheItem(entry.key, entry.name)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-all inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                              title={`Evict ${entry.name} from localStorage`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Purge</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                          No DEEN cache entries found in local storage.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cache Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handlePurgeAllCache}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title="Purge all cached datasets & API payloads (preserves appearance parameters)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Working Cache</span>
                  </button>

                  <button
                    onClick={handlePurgeApiCaches}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title="Purge only cached API sync snapshots (WooCommerce and Pathao)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Purge API Caches</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onResetBaseline) onResetBaseline();
                      logAuditAction('Baseline Reset', 'Reloaded verified master baseline ledger.');
                      showToast('Reloaded verified master baseline ledger.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-primary border border-orange-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reload Clean Baseline</span>
                  </button>

                  <button
                    onClick={handleClearLocalOverrides}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Purge Overrides</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Import Storage JSON</span>
                    <input type="file" accept=".json" onChange={handleImportStorage} className="hidden" />
                  </label>

                  <button
                    onClick={handleExportFullStorage}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    title="Export complete storage, cache, and cookies as backup"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Full Storage JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COOKIE INSPECTOR & MANAGEMENT */}
          {activeStorageTab === 'cookies' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 overflow-x-auto min-w-0 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Cookie Identifier</th>
                      <th className="py-2.5 px-3">Current Value</th>
                      <th className="py-2.5 px-3">Operational Purpose</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {cookieDetails && cookieDetails.length > 0 ? (
                      cookieDetails.map((cookie) => (
                        <tr key={cookie.name} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <Cookie className={`w-3.5 h-3.5 ${cookie.isDeenCookie ? 'text-primary' : 'text-slate-400'}`} />
                              <span className="font-mono font-bold text-slate-900">{cookie.name}</span>
                            </div>
                            {cookie.isDeenCookie && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 mt-1 inline-block">
                                DEEN Managed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 max-w-xs">
                              <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate">
                                {cookie.value}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(cookie.value);
                                  showToast(`Copied value of "${cookie.name}".`);
                                }}
                                className="text-slate-400 hover:text-slate-700 p-1"
                                title="Copy cookie value"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-sm">
                            {cookie.description}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {cookie.sizeBytes} B
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteCookieItem(cookie.name)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-all inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                              title={`Delete cookie "${cookie.name}"`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                          No active cookies found in this browser origin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cookie Action Toolbar */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleClearAllCookies}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                  title="Purge all DEEN application session and preference cookies"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All DEEN Cookies</span>
                </button>

                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>Cookies use SameSite=Lax and are path-scoped to current origin</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM ACTIVITY AUDIT LOG */}
          {activeStorageTab === 'audit' && (
            <div className="space-y-3">
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
                      auditLogs.slice(0, 15).map((log, idx) => (
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
                        <td colSpan={3} className="py-6 text-center text-xs text-slate-400">
                          No activity recorded in this session.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Bring Your Own Key (BYOK) Modal */}
      <BYOKModal
        isOpen={isBYOKModalOpen}
        onClose={() => setIsBYOKModalOpen(false)}
        onSaved={(cfg) => {
          setByokConfig(cfg);
          showToast(`BYOK API key configured: ${cfg.provider.toUpperCase()} (${cfg.model})`);
        }}
      />
    </div>
  );
}
