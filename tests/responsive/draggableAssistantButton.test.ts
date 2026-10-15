import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clampPosition, getDefaultPosition } from '@/lib/draggableAssistant';

describe('Draggable Assistant Button Utility & Geometry Engine', () => {
  beforeEach(() => {
    (globalThis as any).window = {
      innerWidth: 1280,
      innerHeight: 800,
    };
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('clamps coordinates strictly inside the viewport boundaries', () => {
    // Attempting to drag beyond left / top edge (negative coords)
    const clampedNeg = clampPosition(-50, -100, 56, 12);
    expect(clampedNeg.x).toBe(12);
    expect(clampedNeg.y).toBe(12);

    // Attempting to drag beyond right / bottom edge
    const clampedExceed = clampPosition(2000, 2000, 56, 12);
    expect(clampedExceed.x).toBe(1280 - 56 - 12); // 1212
    expect(clampedExceed.y).toBe(800 - 56 - 12); // 732
  });

  it('keeps valid within-bounds coordinates unchanged', () => {
    const valid = clampPosition(500, 400, 56, 12);
    expect(valid.x).toBe(500);
    expect(valid.y).toBe(400);
  });

  it('computes correct desktop default position (bottom-right offset)', () => {
    const pos = getDefaultPosition(56, 12);
    // Desktop offset: 24px right, 24px bottom
    expect(pos.x).toBe(1280 - 56 - 24); // 1200
    expect(pos.y).toBe(800 - 56 - 24); // 720
  });

  it('computes correct mobile default position with bottom nav clearance', () => {
    // Set mobile viewport (e.g. iPhone 390 x 844)
    (globalThis as any).window.innerWidth = 390;
    (globalThis as any).window.innerHeight = 844;

    const pos = getDefaultPosition(48, 8);
    // Mobile offset: 16px right, 84px bottom (to clear sticky bottom nav)
    expect(pos.x).toBe(390 - 48 - 16); // 326
    expect(pos.y).toBe(844 - 48 - 84); // 712
  });

  it('safely adapts when window is resized to a smaller viewport', () => {
    // User places icon at x=1100, y=700 on a large screen
    const userPlacedX = 1100;
    const userPlacedY = 700;

    // Window gets shrunk down to 800 x 600
    (globalThis as any).window.innerWidth = 800;
    (globalThis as any).window.innerHeight = 600;

    const reClamped = clampPosition(userPlacedX, userPlacedY, 56, 12);
    expect(reClamped.x).toBe(800 - 56 - 12); // 732
    expect(reClamped.y).toBe(600 - 56 - 12); // 532
    expect(reClamped.x).toBeLessThanOrEqual(800 - 56 - 12);
    expect(reClamped.y).toBeLessThanOrEqual(600 - 56 - 12);
  });

  it('persists and restores custom coordinates correctly via JSON schema', () => {
    const testStorageKey = 'test_assistant_pos';
    const customPos = { x: 250, y: 350 };

    (globalThis as any).localStorage.setItem(testStorageKey, JSON.stringify(customPos));
    const retrieved = JSON.parse((globalThis as any).localStorage.getItem(testStorageKey) || '{}');

    expect(retrieved.x).toBe(250);
    expect(retrieved.y).toBe(350);

    const validated = clampPosition(retrieved.x, retrieved.y, 56, 12);
    expect(validated.x).toBe(250);
    expect(validated.y).toBe(350);

    (globalThis as any).localStorage.removeItem(testStorageKey);
  });
});
