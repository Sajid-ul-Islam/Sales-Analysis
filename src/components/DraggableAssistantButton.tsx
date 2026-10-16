"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, RotateCcw, Move, Check } from 'lucide-react';

import {
  AssistantPosition,
  DEFAULT_ASSISTANT_STORAGE_KEY,
  DEFAULT_ASSISTANT_BUTTON_SIZE,
  DEFAULT_SCREEN_MARGIN,
  HEADER_CLEARANCE_PX,
  MOBILE_BOTTOM_NAV_CLEARANCE_PX,
  clampPosition,
  getDefaultPosition,
  snapToEdge
} from '@/lib/draggableAssistant';

export type { AssistantPosition };

export interface DraggableAssistantButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  storageKey?: string;
}

export function DraggableAssistantButton({
  isOpen,
  onToggle,
  className = '',
  storageKey = DEFAULT_ASSISTANT_STORAGE_KEY,
}: DraggableAssistantButtonProps) {
  const [position, setPosition] = useState<AssistantPosition>({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showResetToast, setShowResetToast] = useState(false);

  const buttonRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const dragContextRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
    pointerId: number | null;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
    pointerId: null,
  });

  // 1. Initialize position from localStorage or default on mount
  useEffect(() => {
    let initialPos = getDefaultPosition();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const isMobile = (typeof window !== 'undefined' ? window.innerWidth : 1280) < 768;
          initialPos = clampPosition(
            parsed.x,
            parsed.y,
            DEFAULT_ASSISTANT_BUTTON_SIZE,
            DEFAULT_SCREEN_MARGIN,
            undefined,
            undefined,
            {
              topClearance: HEADER_CLEARANCE_PX,
              bottomClearance: isMobile ? MOBILE_BOTTOM_NAV_CLEARANCE_PX : 24,
            }
          );
        }
      }
    } catch {}

    setPosition(initialPos);
    setIsInitialized(true);
  }, [storageKey]);

  // 2. Auto-clamp position when viewport is resized, rotated, or visual viewport shifts
  useEffect(() => {
    const handleViewportChange = () => {
      const vp = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport : null;
      const vpWidth = vp ? Math.round(vp.width) : (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const vpHeight = vp ? Math.round(vp.height) : (typeof window !== 'undefined' ? window.innerHeight : 800);
      const isMobile = vpWidth < 768;

      setPosition((prev) =>
        clampPosition(prev.x, prev.y, DEFAULT_ASSISTANT_BUTTON_SIZE, DEFAULT_SCREEN_MARGIN, vpWidth, vpHeight, {
          topClearance: HEADER_CLEARANCE_PX,
          bottomClearance: isMobile ? MOBILE_BOTTOM_NAV_CLEARANCE_PX : 24,
        })
      );
    };

    window.addEventListener('resize', handleViewportChange);
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // 3. Listen for remote reset event dispatched from SettingsTab
  useEffect(() => {
    const handleExternalReset = () => {
      const def = getDefaultPosition();
      setPosition(def);
      setShowResetToast(true);
      setTimeout(() => setShowResetToast(false), 2000);
    };

    window.addEventListener('deen-reset-assistant-pos', handleExternalReset);
    return () => window.removeEventListener('deen-reset-assistant-pos', handleExternalReset);
  }, []);

  // 4. Double click or helper to reset to default position
  const handleResetPosition = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const def = getDefaultPosition();
    setPosition(def);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setShowResetToast(true);
    setTimeout(() => setShowResetToast(false), 2000);
  }, [storageKey]);

  // 5. Pointer drag handlers with pointer capture for zero-slip tracking
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left click or touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    dragContextRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
      pointerId: e.pointerId,
    };

    // Start 600ms long-press timer to reset position
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      if (!dragContextRef.current.hasMoved && dragContextRef.current.pointerId !== null) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch {}
        }
        handleResetPosition();
      }
    }, 600);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragContextRef.current.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - dragContextRef.current.startX;
    const deltaY = e.clientY - dragContextRef.current.startY;

    // 5px threshold to distinguish intentional drag from a normal tap/click
    if (!dragContextRef.current.hasMoved) {
      if (Math.hypot(deltaX, deltaY) >= 5) {
        dragContextRef.current.hasMoved = true;
        setIsDragging(true);
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      } else {
        return;
      }
    }

    const nextX = dragContextRef.current.initialX + deltaX;
    const nextY = dragContextRef.current.initialY + deltaY;

    const vp = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport : null;
    const width = vp ? Math.round(vp.width) : (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = vp ? Math.round(vp.height) : (typeof window !== 'undefined' ? window.innerHeight : 800);
    const isMobile = width < 768;

    setPosition(
      clampPosition(
        nextX,
        nextY,
        DEFAULT_ASSISTANT_BUTTON_SIZE,
        DEFAULT_SCREEN_MARGIN,
        width,
        height,
        {
          topClearance: HEADER_CLEARANCE_PX,
          bottomClearance: isMobile ? MOBILE_BOTTOM_NAV_CLEARANCE_PX : 24,
        }
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragContextRef.current.pointerId !== e.pointerId) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const didMove = dragContextRef.current.hasMoved;
    dragContextRef.current.pointerId = null;
    setIsDragging(false);

    if (didMove) {
      const vp = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport : null;
      const width = vp ? Math.round(vp.width) : (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const height = vp ? Math.round(vp.height) : (typeof window !== 'undefined' ? window.innerHeight : 800);
      const isMobile = width < 768;

      // On mobile or touch drag release, snap FAB to edge to avoid obscuring central tables
      let finalX = position.x;
      if (isMobile || e.pointerType === 'touch') {
        finalX = snapToEdge(position.x, width, DEFAULT_ASSISTANT_BUTTON_SIZE, DEFAULT_SCREEN_MARGIN);
      }

      const finalPos = clampPosition(
        finalX,
        position.y,
        DEFAULT_ASSISTANT_BUTTON_SIZE,
        DEFAULT_SCREEN_MARGIN,
        width,
        height,
        {
          topClearance: HEADER_CLEARANCE_PX,
          bottomClearance: isMobile ? MOBILE_BOTTOM_NAV_CLEARANCE_PX : 24,
        }
      );

      setPosition(finalPos);
      try {
        localStorage.setItem(storageKey, JSON.stringify(finalPos));
      } catch {}
    } else {
      // Touch double-tap detection (< 320ms) to reset
      const now = Date.now();
      if (e.pointerType === 'touch' && now - lastTapTimeRef.current < 320) {
        handleResetPosition();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      // Clean single tap: toggle drawer
      onToggle();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (dragContextRef.current.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      dragContextRef.current.pointerId = null;
      setIsDragging(false);
    }
  };

  // Determine dynamic tooltip placement based on screen position
  const isLeftSide = typeof window !== 'undefined' ? position.x < window.innerWidth / 2 : false;
  const isTopSide = position.y < 90;

  // Render static placement class before client hydration to prevent hydration mismatch
  if (!isInitialized) {
    return (
      <div className={`fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 group ${className}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open DEEN Assistant"
          className="relative flex items-center justify-center w-12 h-12 md:w-13 md:h-13 min-w-[48px] min-h-[48px] rounded-2xl bg-gradient-to-b from-[#f26322] to-[#EB5A19] text-white shadow-lg cursor-pointer"
        >
          <Bot className="w-5 h-5 md:w-6 md:h-6 text-white" />
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleResetPosition}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        transition: isDragging
          ? 'none'
          : 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`fixed ${isDragging ? 'z-50' : 'z-40'} select-none group ${className}`}
      title="DEEN Assistant (Drag to reposition • Long-press or double-tap to reset)"
    >
      {/* Toast Notification on Position Reset */}
      {showResetToast && (
        <div
          className={`absolute ${
            isTopSide ? 'top-full mt-2' : 'bottom-full mb-2'
          } ${
            isLeftSide ? 'left-0' : 'right-0'
          } px-2.5 py-1 rounded-full bg-slate-900/95 dark:bg-[#1A1A1A] text-white text-[10px] font-bold tracking-tight shadow-xl border border-slate-700/80 dark:border-white/10 flex items-center gap-1.5 whitespace-nowrap pointer-events-none transition-all duration-200`}
        >
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Position Reset</span>
        </div>
      )}

      {/* Context-Aware Adaptive Tooltip */}
      <div
        className={`hidden md:flex items-center gap-2 absolute ${
          isLeftSide ? 'left-full ml-3' : 'right-full mr-3'
        } ${isTopSide ? 'top-0' : 'top-1/2 -translate-y-1/2'} px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-[#141414] text-white text-xs font-bold tracking-tight whitespace-nowrap shadow-xl border border-slate-700/60 dark:border-[#262626] transition-all duration-150 ${
          showTooltip && !isDragging
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span>DEEN Assistant</span>
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/80 text-[10px] text-slate-400 font-normal">
          <Move className="w-3 h-3 text-orange-400 shrink-0" />
          <span>Drag to move</span>
        </div>
        <button
          type="button"
          onClick={handleResetPosition}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Reset position to bottom-right corner"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Interactive Trigger Button */}
      <button
        type="button"
        tabIndex={0}
        aria-label="Open DEEN Assistant (Draggable to reposition)"
        aria-expanded={isOpen}
        className={`relative flex items-center justify-center w-12 h-12 md:w-13 md:h-13 min-w-[48px] min-h-[48px] rounded-2xl bg-gradient-to-b from-[#f26322] to-[#EB5A19] hover:from-[#EB5A19] hover:to-[#d44e13] text-white shadow-lg shadow-orange-950/20 dark:shadow-black/60 hover:shadow-xl hover:shadow-orange-950/30 border border-white/20 dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EB5A19] dark:focus-visible:ring-offset-black ${
          isDragging
            ? 'cursor-grabbing scale-110 shadow-2xl ring-4 ring-[#EB5A19]/40 transition-none'
            : 'cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-all duration-150'
        }`}
      >
        {/* Subtle Grip Drag Affordance Pill on hover */}
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-white/40 group-hover:bg-white/80 transition-colors pointer-events-none" />

        {/* Crisp On-Brand Assistant Icon */}
        <Bot className={`w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-xs transition-transform duration-200 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`} />

        {/* Operational Status Dot */}
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 pointer-events-none">
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white dark:ring-[#0A0A0A]" />
        </span>
      </button>
    </div>
  );
}
