import { describe, it, expect } from 'vitest';
import { binarySearchOffset } from '@/lib/useTableVirtualizer';

describe('Table Virtualization Engine (Unit & Invariant Suite)', () => {
  describe('binarySearchOffset', () => {
    const offsets = [0, 50, 100, 150, 200, 250, 300];

    it('finds exact offset match', () => {
      expect(binarySearchOffset(offsets, 0)).toBe(0);
      expect(binarySearchOffset(offsets, 100)).toBe(2);
      expect(binarySearchOffset(offsets, 300)).toBe(6);
    });

    it('finds closest lower index when offset is between boundaries', () => {
      expect(binarySearchOffset(offsets, 25)).toBe(0);
      expect(binarySearchOffset(offsets, 75)).toBe(1);
      expect(binarySearchOffset(offsets, 149)).toBe(2);
      expect(binarySearchOffset(offsets, 151)).toBe(3);
    });

    it('clamps gracefully when target is beyond boundaries', () => {
      expect(binarySearchOffset(offsets, -50)).toBe(0);
      expect(binarySearchOffset(offsets, 5000)).toBe(6);
    });

    it('handles empty offsets array safely', () => {
      expect(binarySearchOffset([], 100)).toBe(0);
    });
  });

  describe('Prefix Sum & Spacing Invariants', () => {
    it('verifies uniform height prefix sums and total height', () => {
      const itemsCount = 2000;
      const rowHeight = 48;
      const offsets: number[] = new Array(itemsCount);
      let running = 0;
      for (let i = 0; i < itemsCount; i++) {
        offsets[i] = running;
        running += rowHeight;
      }
      const totalHeight = running;

      expect(totalHeight).toBe(2000 * 48); // 96,000px
      expect(offsets[0]).toBe(0);
      expect(offsets[100]).toBe(4800);
      expect(offsets[1999]).toBe(95952);

      // Scroll to 5,000px
      const scrollTop = 5000;
      const viewportHeight = 600;
      const startIndex = binarySearchOffset(offsets, scrollTop);
      expect(startIndex).toBe(104); // 104 * 48 = 4992 <= 5000

      let endIndex = startIndex;
      while (endIndex < itemsCount && offsets[endIndex] < scrollTop + viewportHeight) {
        endIndex++;
      }
      expect(endIndex).toBe(117); // 117 * 48 = 5616 > 5600

      // Overscan of 10 rows
      const overscan = 10;
      const clampedStart = Math.max(0, startIndex - overscan);
      const clampedEnd = Math.min(itemsCount, endIndex + overscan);

      expect(clampedStart).toBe(94);
      expect(clampedEnd).toBe(127);

      const paddingTop = offsets[clampedStart];
      const lastBottom = offsets[clampedEnd - 1] + rowHeight;
      const paddingBottom = totalHeight - lastBottom;

      const renderedHeight = (clampedEnd - clampedStart) * rowHeight;
      expect(paddingTop + renderedHeight + paddingBottom).toBe(totalHeight);
    });

    it('verifies variable height estimation for expanded accordion rows', () => {
      interface MockOrder {
        id: string;
        itemCount: number;
        isExpanded: boolean;
      }

      const orders: MockOrder[] = [
        { id: '101', itemCount: 1, isExpanded: false },
        { id: '102', itemCount: 4, isExpanded: true }, // Expanded with 4 items: 48 + 4*36 = 192px
        { id: '103', itemCount: 2, isExpanded: false },
      ];

      const estimateHeight = (o: MockOrder) => (o.isExpanded ? 48 + o.itemCount * 36 : 48);

      const h0 = estimateHeight(orders[0]); // 48
      const h1 = estimateHeight(orders[1]); // 192
      const h2 = estimateHeight(orders[2]); // 48

      expect(h0).toBe(48);
      expect(h1).toBe(192);
      expect(h2).toBe(48);

      const total = h0 + h1 + h2;
      expect(total).toBe(288);
    });
  });
});
