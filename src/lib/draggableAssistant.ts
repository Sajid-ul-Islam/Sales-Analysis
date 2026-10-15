export interface AssistantPosition {
  x: number;
  y: number;
}

export const DEFAULT_ASSISTANT_STORAGE_KEY = 'deen_assistant_button_pos_v1';
export const DEFAULT_ASSISTANT_BUTTON_SIZE = 56; // 56px (w-13 h-13 / w-14 h-14)
export const DEFAULT_SCREEN_MARGIN = 12; // Minimum padding from window edges

/**
 * Computes boundary-safe coordinates within the current viewport.
 */
export function clampPosition(
  x: number,
  y: number,
  btnSize: number = DEFAULT_ASSISTANT_BUTTON_SIZE,
  margin: number = DEFAULT_SCREEN_MARGIN,
  viewportWidth?: number,
  viewportHeight?: number
): AssistantPosition {
  const width = viewportWidth !== undefined ? viewportWidth : (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const height = viewportHeight !== undefined ? viewportHeight : (typeof window !== 'undefined' ? window.innerHeight : 800);

  const minX = margin;
  const maxX = Math.max(minX, width - btnSize - margin);
  const minY = margin;
  const maxY = Math.max(minY, height - btnSize - margin);

  return {
    x: Math.min(maxX, Math.max(minX, Math.round(x))),
    y: Math.min(maxY, Math.max(minY, Math.round(y))),
  };
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
  const bottomOffset = isMobile ? 84 : 24; // Above mobile bottom navigation bar

  return clampPosition(
    width - btnSize - rightOffset,
    height - btnSize - bottomOffset,
    btnSize,
    margin,
    width,
    height
  );
}
