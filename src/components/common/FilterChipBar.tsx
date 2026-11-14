"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FilterChipItem {
  id: string;
  label: string;
  count?: number | string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  activeColorClass?: string;
  ariaLabel?: string;
}

export interface FilterChipBarProps {
  items: FilterChipItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
  showScrollControls?: boolean;
}

/**
 * FilterChipBar
 *
 * Implements the 3 Core Operational UI/UX Recommendations:
 * 1. Static, Priority-Ranked Filter Chips (no moving targets, deterministic Fitts's law target acquisition).
 * 2. Ergonomic User-Controlled Horizontal Scroll with Left/Right Fade Edge Gradients and Chevrons.
 * 3. Full Keyboard Accessibility (ArrowLeft, ArrowRight, Home, End) and Touch/Mouse drag scrolling.
 *
 * Strictly NO auto-movement, marquees, or continuous tickers (WCAG 2.2.2 compliance).
 */
export function FilterChipBar({
  items,
  selectedId,
  onSelect,
  ariaLabel = 'Filter options',
  className = '',
  size = 'md',
  showScrollControls = true,
}: FilterChipBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const dragMovedRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, items]);

  // Scroll active chip into view on selection change if needed
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeChip = el.querySelector<HTMLButtonElement>(`[data-chip-id="${selectedId}"]`);
    if (activeChip) {
      const containerRect = el.getBoundingClientRect();
      const chipRect = activeChip.getBoundingClientRect();
      if (chipRect.left < containerRect.left || chipRect.right > containerRect.right) {
        activeChip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
  }, [selectedId]);

  const handleScrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    scrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  };

  // Mouse Drag-to-Scroll handlers (for desktop users without trackpads)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    // Only drag on primary mouse button
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      const x = moveEvent.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startXRef.current) * 1.2;
      if (Math.abs(walk) > 4) {
        dragMovedRef.current = true;
      }
      scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Keyboard navigation for accessible tablist
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = items.findIndex((it) => it.id === selectedId);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      onSelect(items[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      onSelect(items[prevIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelect(items[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelect(items[items.length - 1].id);
    }
  };

  const padClass = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  return (
    <div
      className={`relative flex items-center min-w-0 max-w-full overflow-hidden select-none ${className}`}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {/* Left Scroll Control & Gradient Fade Mask */}
      {showScrollControls && canScrollLeft && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-8 sm:w-10 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-deepBlack-card to-transparent"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={handleScrollLeft}
            className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border shadow-xs flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors cursor-pointer"
            aria-label="Scroll left filter options"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Right Scroll Control & Gradient Fade Mask */}
      {showScrollControls && canScrollRight && (
        <>
          <div
            className="absolute right-0 top-0 bottom-0 w-8 sm:w-10 z-10 pointer-events-none bg-gradient-to-l from-white dark:from-deepBlack-card to-transparent"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={handleScrollRight}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white dark:bg-deepBlack-elevated border border-slate-200 dark:border-deepBlack-border shadow-xs flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-deepBlack-hover transition-colors cursor-pointer"
            aria-label="Scroll right filter options"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Horizontal Scroll Track (User-Controlled Touch / Drag / Wheel Only) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden w-full py-0.5 px-0.5 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const defaultActiveClass = 'bg-primary text-white border-primary shadow-xs';
          const defaultInactiveClass =
            'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80 dark:bg-deepBlack-sidebar dark:hover:bg-deepBlack-hover dark:text-slate-300 dark:border-deepBlack-border';

          const activeClass = item.activeColorClass || defaultActiveClass;

          return (
            <button
              key={item.id}
              type="button"
              data-chip-id={item.id}
              role="tab"
              aria-selected={isSelected}
              aria-label={item.ariaLabel || `${item.label}${item.count !== undefined ? ` (${item.count})` : ''}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                if (dragMovedRef.current) return;
                onSelect(item.id);
              }}
              className={`inline-flex items-center gap-1.5 font-bold rounded-lg border transition-all shrink-0 cursor-pointer ${padClass} ${
                isSelected ? activeClass : defaultInactiveClass
              }`}
            >
              {/* Optional Chip Icon */}
              {item.icon && (
                <span className="shrink-0 flex items-center" aria-hidden="true">
                  {React.isValidElement(item.icon) ? (
                    item.icon
                  ) : (
                    // @ts-expect-error ComponentType invocation
                    React.createElement(item.icon, { className: 'w-3.5 h-3.5' })
                  )}
                </span>
              )}

              {/* Chip Label */}
              <span className="truncate">{item.label}</span>

              {/* Chip Count Badge */}
              {item.count !== undefined && item.count !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-deepBlack-card dark:text-slate-400'
                  }`}
                >
                  {typeof item.count === 'number' ? item.count.toLocaleString() : item.count}
                </span>
              )}

              {/* Optional Custom Badge Text */}
              {item.badge && (
                <span
                  className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
