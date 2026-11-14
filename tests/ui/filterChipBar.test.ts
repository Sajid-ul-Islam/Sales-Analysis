import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('FilterChipBar & Operational Filter UX Contracts', () => {
  it('exports FilterChipBar and FilterChipItem from components/common index', () => {
    const indexContent = readRepoFile('src/components/common/index.ts');
    expect(indexContent).toContain("export { FilterChipBar } from './FilterChipBar';");
    expect(indexContent).toContain("export type { FilterChipItem, FilterChipBarProps } from './FilterChipBar';");
  });

  it('guarantees FilterChipBar has zero auto-moving animations or timers (WCAG 2.2.2 compliance)', () => {
    const chipBarContent = readRepoFile('src/components/common/FilterChipBar.tsx');

    // Strictly NO auto-scroll tickers or auto-movement loops
    expect(chipBarContent).not.toMatch(/setInterval/);
    expect(chipBarContent).not.toMatch(/requestAnimationFrame/);
    expect(chipBarContent).not.toMatch(/animate-marquee/i);
    expect(chipBarContent).not.toMatch(/animation:\s*marquee/i);

    // Verifies user-controlled drag and manual chevron handlers exist
    expect(chipBarContent).toContain('handleScrollLeft');
    expect(chipBarContent).toContain('handleScrollRight');
    expect(chipBarContent).toContain('handleMouseDown');
    expect(chipBarContent).toContain('handleKeyDown');
  });

  it('enforces Accessibility: role="tablist", role="tab", aria-selected, and keyboard navigation', () => {
    const chipBarContent = readRepoFile('src/components/common/FilterChipBar.tsx');

    expect(chipBarContent).toContain('role="tablist"');
    expect(chipBarContent).toContain('role="tab"');
    expect(chipBarContent).toContain('aria-selected={isSelected}');
    expect(chipBarContent).toContain('ArrowRight');
    expect(chipBarContent).toContain('ArrowLeft');
    expect(chipBarContent).toContain('Home');
    expect(chipBarContent).toContain('End');
  });

  it('enforces Unbreakable UI & SVG Dimension Clamping: Chevrons clamped to w-3.5 h-3.5', () => {
    const chipBarContent = readRepoFile('src/components/common/FilterChipBar.tsx');

    expect(chipBarContent).toContain('<ChevronLeft className="w-3.5 h-3.5" />');
    expect(chipBarContent).toContain('<ChevronRight className="w-3.5 h-3.5" />');
    expect(chipBarContent).toContain('min-w-0 max-w-full overflow-hidden');
  });

  it('verifies SkuPerformanceTab uses FilterChipBar for category filtering', () => {
    const skuTabContent = readRepoFile('src/components/tabs/SkuPerformanceTab.tsx');

    expect(skuTabContent).toContain('FilterChipBar');
    expect(skuTabContent).toContain('categoryChipItems');
    expect(skuTabContent).toContain('selectedId={selectedCategory}');
    expect(skuTabContent).toContain('setSelectedCategory(id)');
  });

  it('verifies ChannelComparisonTab uses FilterChipBar for 5-channel focus filtering', () => {
    const channelTabContent = readRepoFile('src/components/tabs/ChannelComparisonTab.tsx');

    expect(channelTabContent).toContain('FilterChipBar');
    expect(channelTabContent).toContain('channelFilterChips');
    expect(channelTabContent).toContain('selectedId={highlightChannel || \'ALL\'}');
  });

  it('verifies OrdersLedgerTab uses FilterChipBar for delivery status filtering', () => {
    const ordersTabContent = readRepoFile('src/components/tabs/OrdersLedgerTab.tsx');

    expect(ordersTabContent).toContain('FilterChipBar');
    expect(ordersTabContent).toContain('statusFilterChips');
    expect(ordersTabContent).toContain('selectedId={statusFilter}');
  });

  it('verifies CommandPaletteModal provides instant keyboard-driven filter shortcuts', () => {
    const commandContent = readRepoFile('src/components/CommandPaletteModal.tsx');

    expect(commandContent).toContain("'Filters'");
    expect(commandContent).toContain('filter-scope-today');
    expect(commandContent).toContain('filter-scope-7d');
    expect(commandContent).toContain('filter-scope-30d');
    expect(commandContent).toContain('filter-status-delivered');
    expect(commandContent).toContain('filter-status-partial');
    expect(commandContent).toContain('filter-status-returns');
    expect(commandContent).toContain('filter-branch-mirpur');
    expect(commandContent).toContain('filter-branch-cumilla');
  });
});
