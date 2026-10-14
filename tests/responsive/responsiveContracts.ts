import fs from 'fs';
import path from 'path';

export type ViewportTier = 'mobile' | 'tablet' | 'desktop-standard' | 'desktop-large';

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ResponsiveLayoutState {
  tier: ViewportTier;
  bottomNavVisible: boolean;
  drawerAvailable: boolean;
  tabletRailVisible: boolean;
  desktopSidebarVisible: boolean;
  kpiColumns: number;
  tableContainerClass: string;
  stickyCellClass: string;
  stickyHeaderClass: string;
  minTouchTargetPx: number;
  safeAreaBottomPadding: boolean;
  centralContentMaxWidth: string;
}

/**
 * Breakpoint Specification Constants
 * Based on ORIGINAL_REQUEST §R1-R3, PROJECT.md, and TEST_INFRA.md
 */
export const BREAKPOINTS = {
  MOBILE_MAX: 767,
  TABLET_MIN: 768,
  TABLET_MAX: 1023,
  DESKTOP_MIN: 1024,
  DESKTOP_LARGE_MIN: 1280,
  CONTAINER_MAX_WIDTH: 1920,
} as const;

/**
 * High-frequency tabs for mobile bottom navigation (4 core + 1 more drawer trigger)
 */
export const MOBILE_BOTTOM_NAV_TABS = [
  { id: 'tabExecutive', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'tabOrders', label: 'Orders', icon: 'ListOrdered' },
  { id: 'tabItemReturns', label: 'Returns', icon: 'RotateCcw' },
  { id: 'tabSettings', label: 'Sync', icon: 'RefreshCw' },
] as const;

/**
 * Extended operational modules accessible via mobile slide-over drawer
 */
export const EXTENDED_DRAWER_MODULES = [
  'tabSettings',
  'tabTerritory',
  'tabMarketingAnalytics',
  'tabCustomerRisk',
  'tabOutletDispatch',
  'tabOutletSales',
  'tabCourierMismatch',
  'tabStatus',
  'tabSku',
  'tabExchanges',
  'tabUnitEconomics',
] as const;

/**
 * High-contrast semantic status color tokens per docs/DESIGN.md & AGENTS.md
 */
export const SEMANTIC_STATUS_TOKENS = {
  DELIVERED: {
    hex: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    label: 'Delivered',
  },
  PAID_RETURN: {
    hex: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    label: 'Paid Return',
  },
  NOT_PAID_RETURN: {
    hex: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    label: 'Not Paid Return',
  },
  EXCHANGE: {
    hex: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    label: 'Exchange',
  },
  PARTIAL: {
    hex: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    label: 'Partial',
  },
} as const;

/**
 * Resolves the responsive layout state for any given viewport dimensions.
 */
export function resolveResponsiveLayout(width: number, height: number = 800): ResponsiveLayoutState {
  if (width <= BREAKPOINTS.MOBILE_MAX) {
    return {
      tier: 'mobile',
      bottomNavVisible: true,
      drawerAvailable: true,
      tabletRailVisible: false,
      desktopSidebarVisible: false,
      kpiColumns: 1,
      tableContainerClass: 'w-full overflow-x-auto min-w-0 rounded-xl border border-slate-200',
      stickyCellClass: 'sticky left-0 bg-white z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      stickyHeaderClass: 'sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      minTouchTargetPx: 48,
      safeAreaBottomPadding: true,
      centralContentMaxWidth: '100%',
    };
  }

  if (width >= BREAKPOINTS.TABLET_MIN && width <= BREAKPOINTS.TABLET_MAX) {
    return {
      tier: 'tablet',
      bottomNavVisible: false,
      drawerAvailable: true,
      tabletRailVisible: true,
      desktopSidebarVisible: false,
      kpiColumns: 2,
      tableContainerClass: 'w-full overflow-x-auto min-w-0 rounded-xl border border-slate-200',
      stickyCellClass: 'sticky left-0 bg-white z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      stickyHeaderClass: 'sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      minTouchTargetPx: 44,
      safeAreaBottomPadding: false,
      centralContentMaxWidth: '100%',
    };
  }

  if (width >= BREAKPOINTS.DESKTOP_MIN && width < BREAKPOINTS.DESKTOP_LARGE_MIN) {
    return {
      tier: 'desktop-standard',
      bottomNavVisible: false,
      drawerAvailable: false,
      tabletRailVisible: false,
      desktopSidebarVisible: true,
      kpiColumns: 4,
      tableContainerClass: 'w-full overflow-x-auto min-w-0 rounded-xl border border-slate-200',
      stickyCellClass: 'sticky left-0 bg-white z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      stickyHeaderClass: 'sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
      minTouchTargetPx: 44,
      safeAreaBottomPadding: false,
      centralContentMaxWidth: '1920px',
    };
  }

  // Desktop Large (>= 1280px)
  return {
    tier: 'desktop-large',
    bottomNavVisible: false,
    drawerAvailable: false,
    tabletRailVisible: false,
    desktopSidebarVisible: true,
    kpiColumns: 5,
    tableContainerClass: 'w-full overflow-x-auto min-w-0 rounded-xl border border-slate-200',
    stickyCellClass: 'sticky left-0 bg-white z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
    stickyHeaderClass: 'sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px]',
    minTouchTargetPx: 44,
    safeAreaBottomPadding: false,
    centralContentMaxWidth: '1920px',
  };
}

/**
 * Validates Table Zero-Blowout Container contract classes.
 */
export function validateTableContainerContract(classNames: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const classes = classNames.split(/\s+/);

  if (!classes.includes('overflow-x-auto')) {
    errors.push('Table container must contain overflow-x-auto');
  }
  if (!classes.includes('min-w-0')) {
    errors.push('Table container must contain min-w-0 to prevent flex item blowout');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Frozen Column CSS positioning contract.
 */
export function validateFrozenColumnContract(
  classNames: string,
  isHeader: boolean = false
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const classes = classNames.split(/\s+/);

  if (!classes.includes('sticky')) {
    errors.push('Frozen column must include sticky');
  }
  if (!classes.includes('left-0')) {
    errors.push('Frozen column must specify left-0 coordinate');
  }
  // Check opaque background
  const hasOpaqueBg = classes.some(c => c.startsWith('bg-'));
  if (!hasOpaqueBg) {
    errors.push('Frozen column must specify an opaque background to avoid text bleed-through');
  }
  // Check z-index stacking
  const hasZIndex = classes.some(c => c.startsWith('z-'));
  if (!hasZIndex) {
    errors.push('Frozen column must specify z-index stacking');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Responsive KPI Grid breakpoints contract.
 */
export function validateKpiGridContract(classNames: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const classes = classNames.split(/\s+/);

  if (!classes.includes('grid')) {
    errors.push('KPI container must be a CSS grid');
  }
  if (!classes.includes('grid-cols-1')) {
    errors.push('KPI grid must specify 1 column on mobile (grid-cols-1)');
  }
  if (!classes.some(c => c.includes('sm:grid-cols-2') || c.includes('md:grid-cols-2'))) {
    errors.push('KPI grid must specify 2 columns on tablet (sm:grid-cols-2 or md:grid-cols-2)');
  }
  if (!classes.some(c => c.includes('xl:grid-cols-5') || c.includes('xl:grid-cols-6') || c.includes('lg:grid-cols-4') || c.includes('lg:grid-cols-3'))) {
    errors.push('KPI grid must specify multi-column layout on desktop');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates SVG Micro-Donut and Chart attributes for fluid scaling and zero distortion.
 */
export function validateSvgChartAttributes(attrs: {
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  className?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!attrs.viewBox || attrs.viewBox !== '0 0 36 36') {
    errors.push(`SVG must have viewBox="0 0 36 36", got "${attrs.viewBox}"`);
  }
  if (String(attrs.width) !== '44' && String(attrs.width) !== '48') {
    errors.push(`SVG width must be explicitly integer 44 or 48, got "${attrs.width}"`);
  }
  if (String(attrs.height) !== '44' && String(attrs.height) !== '48') {
    errors.push(`SVG height must be explicitly integer 44 or 48, got "${attrs.height}"`);
  }
  if (!attrs.className?.includes('shrink-0')) {
    errors.push('SVG must include shrink-0 to prevent flex aspect-ratio distortion');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates Touch Target dimensions per WCAG AA (>= 44x44px desktop/tablet, >= 48x48px mobile).
 */
export function validateTouchTarget(
  widthPx: number,
  heightPx: number,
  isMobile: boolean = false
): { isValid: boolean; requiredMin: number; errors: string[] } {
  const requiredMin = isMobile ? 48 : 44;
  const errors: string[] = [];

  if (widthPx < requiredMin) {
    errors.push(`Touch target width ${widthPx}px is below required minimum ${requiredMin}px`);
  }
  if (heightPx < requiredMin) {
    errors.push(`Touch target height ${heightPx}px is below required minimum ${requiredMin}px`);
  }

  return {
    isValid: errors.length === 0,
    requiredMin,
    errors,
  };
}

/**
 * Reads a project file relative to repository root.
 */
export function readProjectFile(relPath: string): string {
  const repoRoot = path.resolve(__dirname, '../../');
  const fullPath = path.join(repoRoot, relPath);
  return fs.readFileSync(fullPath, 'utf-8');
}
