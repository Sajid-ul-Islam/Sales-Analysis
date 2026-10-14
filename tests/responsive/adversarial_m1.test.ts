import { describe, it, expect } from 'vitest';
import { readProjectFile, BREAKPOINTS } from './responsiveContracts';
import { DEEN_COOKIE_KEYS } from '@/lib/cookieManager';

describe('Adversarial & Empirical Challenge: Milestone M1 (Multi-Device Navigation)', () => {
  const mobileNavCode = readProjectFile('src/components/MobileBottomNav.tsx');
  const sidebarCode = readProjectFile('src/components/Sidebar.tsx');
  const headerCode = readProjectFile('src/components/Header.tsx');
  const pageCode = readProjectFile('src/app/page.tsx');

  // =========================================================================
  // SECTION 1: BREAKPOINT TRANSITIONS & VIEWPORT MUTUAL EXCLUSIVITY
  // =========================================================================
  describe('1. Breakpoint Transitions (< 768px, 768px - 1023px, >= 1024px)', () => {
    it('1.1 Mobile Viewport (< 768px): MobileBottomNav is rendered and visible (md:hidden); Desktop and Tablet sidebars are hidden', () => {
      // MobileBottomNav container has md:hidden, fixed bottom-0, left-0, right-0, z-40
      expect(mobileNavCode).toMatch(/<nav[\s\S]*?className="[^"]*md:hidden[^"]*fixed[^"]*bottom-0[^"]*z-40/);

      // In CSS, @media (min-width: 768px) triggers md:hidden (display: none).
      // Therefore, at < 768px, MobileBottomNav is visible.
      // Tablet rail in Sidebar has 'hidden md:flex lg:hidden'
      expect(sidebarCode).toContain('hidden md:flex lg:hidden w-16');

      // Desktop sidebar in Sidebar has 'hidden lg:flex w-64'
      expect(sidebarCode).toContain('hidden lg:flex w-64');

      // Therefore, at < 768px, tablet rail is display:none (hidden) and desktop sidebar is display:none (hidden).
    });

    it('1.2 Tablet Viewport (768px - 1023px): Tablet rail (w-16) is flex visible; MobileBottomNav is hidden; Desktop sidebar is hidden', () => {
      // Tablet rail specifies 'hidden md:flex lg:hidden w-16'
      // At md (768px), md:flex overrides hidden -> display: flex, width 64px (w-16)
      // At lg (1024px), lg:hidden overrides md:flex -> display: none
      // Therefore, between 768px and 1023px, tablet rail is flex and visible.
      expect(sidebarCode).toContain('hidden md:flex lg:hidden w-16');

      // Desktop sidebar specifies 'hidden lg:flex w-64'
      // At 768px - 1023px, lg:flex does not apply -> hidden (display: none).
      expect(sidebarCode).toContain('hidden lg:flex w-64');

      // MobileBottomNav specifies 'md:hidden'
      // At 768px - 1023px, md:hidden applies -> display: none (hidden).
      expect(mobileNavCode).toContain('md:hidden');
    });

    it('1.3 Desktop Viewport (>= 1024px): Desktop sidebar (w-64) is flex visible; Tablet rail is hidden; MobileBottomNav is hidden', () => {
      // Desktop sidebar specifies 'hidden lg:flex w-64'
      // At >= 1024px, lg:flex applies -> display: flex, width 256px (w-64).
      expect(sidebarCode).toContain('hidden lg:flex w-64');

      // Tablet rail specifies 'hidden md:flex lg:hidden'
      // At >= 1024px, lg:hidden applies -> display: none (hidden).
      expect(sidebarCode).toContain('hidden md:flex lg:hidden');

      // MobileBottomNav specifies 'md:hidden'
      // At >= 1024px, md:hidden applies -> display: none (hidden).
      expect(mobileNavCode).toContain('md:hidden');
    });

    it('1.4 Mobile Slide-Over Drawer: Toggles on mobileOpen, isolated to mobile with md:hidden', () => {
      // Drawer is guarded by mobileOpen prop
      expect(sidebarCode).toContain('{mobileOpen && (');
      // Drawer container specifies md:hidden to prevent any desktop/tablet leak
      expect(sidebarCode).toContain('fixed inset-0 z-50 md:hidden flex');
      // Backdrop has click handler onCloseMobile
      expect(sidebarCode).toContain('onClick={onCloseMobile}');
      // Close button has click handler onCloseMobile
      expect(sidebarCode).toContain('aria-label="Close menu"');
      // Escape key listener is registered on mobileOpen
      expect(sidebarCode).toContain("e.key === 'Escape'");
      // Body scroll lock is toggled when mobileOpen is true
      expect(sidebarCode).toContain("document.body.style.overflow = 'hidden'");
    });

    it('1.5 Page Layout Content Clearance: Main content specifies pb-20 md:pb-6', () => {
      // pb-20 (80px) on mobile clears the 64px (h-16) bottom nav + safe area
      // md:pb-6 restores standard desktop/tablet padding when bottom nav is hidden
      expect(pageCode).toContain('pb-20 md:pb-6');
    });

    it('1.6 Header Hamburger Trigger: Header includes accessible hamburger button for mobile (< 768px)', () => {
      expect(headerCode).toContain('md:hidden');
      expect(headerCode).toContain('aria-label="Toggle navigation menu"');
      expect(headerCode).toContain('onToggleMobileMenu');
      expect(headerCode).toContain('aria-expanded={mobileOpen}');
    });
  });

  // =========================================================================
  // SECTION 2: FLOATING TOOLTIP LOGIC & OVERFLOW CLIPPING VERIFICATION
  // =========================================================================
  describe('2. Floating Tooltip Logic & Overflow Clipping on Tablet Icon Rail', () => {
    it('2.1 Tooltip avoids overflow clipping by avoiding inline absolute positioning within scrollable container', () => {
      // Icon list container inside tablet rail has overflow-x-hidden
      expect(sidebarCode).toContain('overflow-y-auto overflow-x-hidden');

      // If tooltips were styled inline with `absolute left-full`, any tooltip wider than 0px
      // would be clipped by overflow-x: hidden on the parent nav element.
      // Verify that activeTooltip is rendered as a portal at the aside root with position: fixed
      expect(sidebarCode).toMatch(/\{activeTooltip && \([\s\S]*?<div[\s\S]*?role="tooltip"[\s\S]*?className="fixed z-50/);
      expect(sidebarCode).toContain("left: '4.5rem'"); // 72px (64px rail width + 8px gap)
    });

    it('2.2 Tooltip tethering calculation uses getBoundingClientRect to calculate screen Y coordinates', () => {
      expect(sidebarCode).toContain('const rect = target.getBoundingClientRect();');
      expect(sidebarCode).toContain('top: rect.top + rect.height / 2');
      expect(sidebarCode).toContain("transform: 'translateY(-50%)'");
    });

    it('2.3 Tooltip renders on both mouseEnter and keyboard focus, and hides on mouseLeave and blur', () => {
      expect(sidebarCode).toContain('onMouseEnter={(e) => showTooltip(');
      expect(sidebarCode).toContain('onMouseLeave={hideTooltip}');
      expect(sidebarCode).toContain('onFocus={(e) => showTooltip(');
      expect(sidebarCode).toContain('onBlur={hideTooltip}');
    });

    it('2.4 Tooltip arrow points left towards the rail button', () => {
      expect(sidebarCode).toContain('border-r-slate-900');
      expect(sidebarCode).toContain('right-full top-1/2 -translate-y-1/2');
    });

    it('2.5 Tooltip displays count badge when countBadge > 0', () => {
      expect(sidebarCode).toContain('activeTooltip.count !== undefined && activeTooltip.count > 0');
    });
  });

  // =========================================================================
  // SECTION 3: ACTIVE TAB HIGHLIGHTING & STATE / COOKIE SYNCHRONIZATION
  // =========================================================================
  describe('3. Active Tab Highlighting & State/Cookie Synchronization', () => {
    it('3.1 MobileBottomNav: Exactly defines 4 primary tabs (Overview, Territory, Ad Analytics, Status Matrix) + More trigger', () => {
      expect(mobileNavCode).toContain("activeTab === 'tabExecutive'");
      expect(mobileNavCode).toContain("activeTab === 'tabTerritory'");
      expect(mobileNavCode).toContain("activeTab === 'tabMarketingAnalytics'");
      expect(mobileNavCode).toContain("activeTab === 'tabStatus'");
      expect(mobileNavCode).toContain("const primaryTabIds = ['tabExecutive', 'tabTerritory', 'tabMarketingAnalytics', 'tabStatus'];");
      expect(mobileNavCode).toContain("const isExtendedModuleActive = !primaryTabIds.includes(activeTab);");
    });

    it('3.2 MobileBottomNav: "More" trigger highlights whenever an extended module is active', () => {
      // When an extended module is active, More button gets text-[#EB5A19] font-bold,
      // top orange indicator bar, and indicator pip dot
      expect(mobileNavCode).toContain("isExtendedModuleActive");
      expect(mobileNavCode).toContain("absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#EB5A19]");
      expect(mobileNavCode).toContain("bg-[#EB5A19] rounded-b-full shadow-[0_1px_4px_rgba(235,90,25,0.4)]");
    });

    it('3.3 Sidebar: Active tab highlighting across Tablet rail, Desktop sidebar, and Mobile drawer', () => {
      // Tablet rail active styling
      expect(sidebarCode).toContain("isActive\n                          ? 'bg-orange-50 text-primary font-bold shadow-2xs dark:bg-orange-950/40 dark:text-orange-400'");
      expect(sidebarCode).toContain("w-1 h-6 bg-primary rounded-r-full");

      // Desktop sidebar active styling
      expect(sidebarCode).toContain("w-1 h-5 bg-primary rounded-full");

      // Mobile drawer active styling with left border
      expect(sidebarCode).toContain("border-l-4 border-primary");
    });

    it('3.4 Cookie Synchronization: Page component stores and restores active tab via DEEN_COOKIE_KEYS.ACTIVE_TAB', () => {
      expect(pageCode).toContain('setCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB, target, { days: 30 })');
      expect(pageCode).toContain('getCookie(DEEN_COOKIE_KEYS.ACTIVE_TAB)');
      expect(DEEN_COOKIE_KEYS.ACTIVE_TAB).toBe('deen_active_tab');
    });

    it('3.5 Mobile Drawer selection closes drawer and updates active tab state', () => {
      expect(sidebarCode).toContain('const handleItemClick = (id: string) => {');
      expect(sidebarCode).toContain('setActiveTab(id);');
      expect(sidebarCode).toContain('if (onCloseMobile) {');
      expect(sidebarCode).toContain('onCloseMobile();');
    });
  });

  // =========================================================================
  // SECTION 4: WCAG AA TOUCH TARGETS & ACCESSIBILITY ATTRIBUTES
  // =========================================================================
  describe('4. WCAG AA Touch Targets (>= 48px Mobile, >= 44px Tablet/Desktop)', () => {
    it('4.1 MobileBottomNav: All 5 buttons satisfy >= 48px touch targets (min-h-[48px] min-w-[48px])', () => {
      const matches = mobileNavCode.match(/min-h-\[48px\] min-w-\[48px\]/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(5);
    });

    it('4.2 Mobile Slide-Over Drawer: Close button satisfies >= 48px touch targets', () => {
      expect(sidebarCode).toContain('min-h-[48px] min-w-[48px] p-3 rounded-xl text-slate-500');
    });

    it('4.3 Mobile Slide-Over Drawer: All navigation links satisfy >= 48px touch targets', () => {
      expect(sidebarCode).toContain('w-full min-h-[48px] flex items-center justify-between px-3.5 py-3');
    });

    it('4.4 Tablet Icon Rail: All buttons satisfy >= 44px touch targets (min-h-[44px])', () => {
      expect(sidebarCode).toContain('w-full min-h-[44px] h-11 rounded-xl flex items-center justify-center');
    });

    it('4.5 Desktop Sidebar: All buttons satisfy >= 44px touch targets (min-h-[44px])', () => {
      expect(sidebarCode).toContain('w-full min-h-[44px] flex items-center justify-between px-3 py-2.5');
    });

    it('4.6 Accessibility Roles & ARIA properties are complete', () => {
      expect(mobileNavCode).toContain('aria-label="Mobile Navigation"');
      expect(mobileNavCode).toContain('role="navigation"');
      expect(mobileNavCode).toContain('aria-haspopup="dialog"');

      expect(sidebarCode).toContain('role="dialog"');
      expect(sidebarCode).toContain('aria-modal="true"');
      expect(sidebarCode).toContain('aria-label="Tablet navigation rail"');
      expect(sidebarCode).toContain('aria-label="Desktop sidebar navigation"');
    });
  });

  // =========================================================================
  // SECTION 5: ADVERSARIAL STRESS TESTING & FAILURE MODE DISCOVERY
  // =========================================================================
  describe('5. Adversarial Stress Testing & Edge Cases', () => {
    it('5.1 Badge counter clamping: formats 100+ as 99+ without layout explosion', () => {
      expect(mobileNavCode).toContain("orderCount > 99 ? '99+' : orderCount");
      expect(mobileNavCode).toContain("returnCount > 99 ? '99+' : returnCount");
      expect(sidebarCode).toContain("item.countBadge > 99 ? '99+' : item.countBadge");
    });

    it('5.2 Cloud Sync status indicators: pulses when isSyncing=true and renders Cloud icon for API mode', () => {
      expect(mobileNavCode).toContain("activeSourceMode === 'API'");
      expect(mobileNavCode).toContain("isSyncing ? 'animate-pulse' : ''");
      expect(mobileNavCode).toContain("isSyncing ? 'animate-spin' : ''");
    });

    it('5.3 Drawer Escape key listener and body scroll lock lifecycle is present in Sidebar', () => {
      expect(sidebarCode).toContain("e.key === 'Escape'");
      expect(sidebarCode).toContain("document.body.style.overflow = 'hidden'");
      expect(sidebarCode).toContain("document.body.style.overflow = originalOverflow");
    });

    it('5.4 Safe Area bottom padding on mobile bottom nav and drawer footer', () => {
      expect(mobileNavCode).toContain('pb-[env(safe-area-inset-bottom,0px)]');
      expect(sidebarCode).toContain('pb-[max(0.875rem,env(safe-area-inset-bottom,0px))]');
    });
  });
});
