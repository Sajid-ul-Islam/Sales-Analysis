export interface AssistantPosition {
  x: number;
  y: number;
}

export const DEFAULT_ASSISTANT_STORAGE_KEY = 'deen_assistant_button_pos_v1';
export const DEFAULT_ASSISTANT_BUTTON_SIZE = 56; // 56px (w-13 h-13 / w-14 h-14)
export const DEFAULT_SCREEN_MARGIN = 12; // Minimum padding from window edges
export const HEADER_CLEARANCE_PX = 68; // Minimum top clearance to prevent covering sticky header
export const MOBILE_BOTTOM_NAV_CLEARANCE_PX = 84; // Clearance above mobile bottom navigation bar

export interface ClampOptions {
  btnSize?: number;
  margin?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  topClearance?: number;
  bottomClearance?: number;
}

/**
 * Computes boundary-safe coordinates within the current viewport.
 * Optional topClearance and bottomClearance prevent covering the sticky header or mobile bottom nav.
 */
export function clampPosition(
  x: number,
  y: number,
  btnSize: number = DEFAULT_ASSISTANT_BUTTON_SIZE,
  margin: number = DEFAULT_SCREEN_MARGIN,
  viewportWidth?: number,
  viewportHeight?: number,
  options?: {
    topClearance?: number;
    bottomClearance?: number;
  }
): AssistantPosition {
  const width = viewportWidth !== undefined ? viewportWidth : (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const height = viewportHeight !== undefined ? viewportHeight : (typeof window !== 'undefined' ? window.innerHeight : 800);

  const topOffset = options?.topClearance !== undefined ? options.topClearance : margin;
  const bottomOffset = options?.bottomClearance !== undefined ? options.bottomClearance : margin;

  const minX = margin;
  const maxX = Math.max(minX, width - btnSize - margin);
  const minY = topOffset;
  const maxY = Math.max(minY, height - btnSize - bottomOffset);

  return {
    x: Math.min(maxX, Math.max(minX, Math.round(x))),
    y: Math.min(maxY, Math.max(minY, Math.round(y))),
  };
}

/**
 * Snaps horizontal coordinate to either the left or right margin.
 * Ensures the assistant FAB docks to screen edges and never obstructs central data tables on mobile.
 */
export function snapToEdge(
  x: number,
  viewportWidth?: number,
  btnSize: number = DEFAULT_ASSISTANT_BUTTON_SIZE,
  margin: number = DEFAULT_SCREEN_MARGIN
): number {
  const width = viewportWidth !== undefined ? viewportWidth : (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const middle = width / 2;
  const center = x + btnSize / 2;
  return center < middle ? margin : Math.max(margin, width - btnSize - margin);
}

/**
 * Default floating position: bottom-right corner, adjusted for mobile bottom nav.
 */
export function getDefaultPosition(
  btnSize: number = DEFAULT_ASSISTANT_BUTTON_SIZE,
  margin: number = DEFAULT_SCREEN_MARGIN,
  viewportWidth?: number,
  viewportHeight?: number
): AssistantPosition {
  const width = viewportWidth !== undefined ? viewportWidth : (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const height = viewportHeight !== undefined ? viewportHeight : (typeof window !== 'undefined' ? window.innerHeight : 800);

  const isMobile = width < 768;
  const rightOffset = isMobile ? 16 : 24;
  const bottomOffset = isMobile ? MOBILE_BOTTOM_NAV_CLEARANCE_PX : 24;

  return clampPosition(
    width - btnSize - rightOffset,
    height - btnSize - bottomOffset,
    btnSize,
    margin,
    width,
    height
  );
}

/**
 * Resets the saved assistant button position in localStorage and dispatches a notification event.
 */
export function resetAssistantPosition(storageKey: string = DEFAULT_ASSISTANT_STORAGE_KEY): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    window.dispatchEvent(new CustomEvent('deen-reset-assistant-pos'));
  }
}
