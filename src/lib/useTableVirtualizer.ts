/**
 * Zero-Dependency High-Performance Table Virtualization Engine
 * 
 * Computes visible index ranges, dynamic offsets, and spacer heights
 * for large-scale tables (1,000+ to 10,000+ rows) with variable height support,
 * 60 FPS scrolling, and zero DOM layout blowouts.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface VirtualItem<T> {
  index: number;
  item: T;
  offsetTop: number;
  height: number;
}

export interface UseTableVirtualizerOptions<T> {
  items: T[];
  estimateItemHeight: (item: T, index: number) => number;
  overscan?: number;
  initialCount?: number;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export interface UseTableVirtualizerResult<T> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  paddingTop: number;
  paddingBottom: number;
  startIndex: number;
  endIndex: number;
  totalCount: number;
  isVirtualizing: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollToIndex: (index: number) => void;
}

/**
 * Binary search to find the highest item index whose offset is <= targetOffset.
 */
export function binarySearchOffset(offsets: number[], targetOffset: number): number {
  if (offsets.length === 0) return 0;
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= targetOffset) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export function useTableVirtualizer<T>({
  items,
  estimateItemHeight,
  overscan = 12,
  initialCount = 30,
  scrollContainerRef,
}: UseTableVirtualizerOptions<T>): UseTableVirtualizerResult<T> {
  const localContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = (scrollContainerRef as React.RefObject<HTMLDivElement>) || localContainerRef;

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [isClient, setIsClient] = useState(false);

  // 1. Mark client hydration
  useEffect(() => {
    setIsClient(true);
    const container = containerRef.current;
    if (container) {
      setViewportHeight(container.clientHeight || 600);
      setScrollTop(container.scrollTop || 0);
    }
  }, [containerRef]);

  // 2. Pre-calculate prefix sum offsets for O(log N) lookup
  const { offsets, heights, totalHeight } = useMemo(() => {
    const n = items.length;
    const offsetsArr: number[] = new Array(n);
    const heightsArr: number[] = new Array(n);
    let running = 0;

    for (let i = 0; i < n; i++) {
      offsetsArr[i] = running;
      const h = estimateItemHeight(items[i], i);
      heightsArr[i] = h;
      running += h;
    }

    return {
      offsets: offsetsArr,
      heights: heightsArr,
      totalHeight: running,
    };
  }, [items, estimateItemHeight]);

  // 3. Scroll and Resize listener with requestAnimationFrame throttling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (container) {
            setScrollTop(container.scrollTop);
            if (container.clientHeight !== viewportHeight && container.clientHeight > 0) {
              setViewportHeight(container.clientHeight);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      if (container) {
        setViewportHeight(container.clientHeight || 600);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, viewportHeight]);

  // 4. Calculate visible slice
  const { virtualItems, paddingTop, paddingBottom, startIndex, endIndex } = useMemo(() => {
    const n = items.length;
    if (n === 0) {
      return {
        virtualItems: [],
        paddingTop: 0,
        paddingBottom: 0,
        startIndex: 0,
        endIndex: 0,
      };
    }

    // SSR fallback before hydration to ensure zero hydration mismatch
    if (!isClient) {
      const initialEnd = Math.min(n, initialCount);
      const initialSlice: VirtualItem<T>[] = [];
      for (let i = 0; i < initialEnd; i++) {
        initialSlice.push({
          index: i,
          item: items[i],
          offsetTop: offsets[i] || 0,
          height: heights[i] || 48,
        });
      }
      return {
        virtualItems: initialSlice,
        paddingTop: 0,
        paddingBottom: Math.max(0, totalHeight - (offsets[initialEnd - 1] || 0) - (heights[initialEnd - 1] || 0)),
        startIndex: 0,
        endIndex: initialEnd,
      };
    }

    // Find first visible item
    const rawStart = binarySearchOffset(offsets, scrollTop);
    const visibleStart = Math.max(0, rawStart);

    // Find last visible item
    const targetBottom = scrollTop + viewportHeight;
    let visibleEnd = visibleStart;
    while (visibleEnd < n && offsets[visibleEnd] < targetBottom) {
      visibleEnd++;
    }

    // Apply overscan padding
    const clampedStart = Math.max(0, visibleStart - overscan);
    const clampedEnd = Math.min(n, visibleEnd + overscan);

    const slice: VirtualItem<T>[] = [];
    for (let i = clampedStart; i < clampedEnd; i++) {
      slice.push({
        index: i,
        item: items[i],
        offsetTop: offsets[i],
        height: heights[i],
      });
    }

    const padTop = clampedStart > 0 ? offsets[clampedStart] : 0;
    const lastRenderedBottom = clampedEnd > 0 ? offsets[clampedEnd - 1] + heights[clampedEnd - 1] : 0;
    const padBottom = Math.max(0, totalHeight - lastRenderedBottom);

    return {
      virtualItems: slice,
      paddingTop: padTop,
      paddingBottom: padBottom,
      startIndex: clampedStart,
      endIndex: clampedEnd,
    };
  }, [items, isClient, initialCount, offsets, heights, totalHeight, scrollTop, viewportHeight, overscan]);

  // 5. Scroll to arbitrary item index
  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= items.length) return;
      const targetOffset = offsets[index] || 0;
      container.scrollTo({ top: targetOffset, behavior: 'smooth' });
    },
    [containerRef, items.length, offsets]
  );

  return {
    virtualItems,
    totalHeight,
    paddingTop,
    paddingBottom,
    startIndex,
    endIndex,
    totalCount: items.length,
    isVirtualizing: items.length > 50,
    containerRef: localContainerRef,
    scrollToIndex,
  };
}
