import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');
}

describe('Draggable Expandable Sidebar Architecture & Accessibility', () => {
  const sidebarCode = readProjectFile('src/components/Sidebar.tsx');

  it('1. Verifies resizer separator handle is integrated with accessibility attributes', () => {
    expect(sidebarCode).toContain('role="separator"');
    expect(sidebarCode).toContain('tabIndex={0}');
    expect(sidebarCode).toContain('aria-orientation="vertical"');
    expect(sidebarCode).toContain('cursor-col-resize');
  });

  it('2. Enforces sidebar width boundaries and clamp constants', () => {
    expect(sidebarCode).toContain('DEFAULT_SIDEBAR_WIDTH = 256');
    expect(sidebarCode).toContain('MIN_SIDEBAR_WIDTH = 200');
    expect(sidebarCode).toContain('MAX_SIDEBAR_WIDTH = 460');
    expect(sidebarCode).toContain('COLLAPSE_THRESHOLD = 140');
  });

  it('3. Enforces persistent localStorage key for custom sidebar width', () => {
    expect(sidebarCode).toContain("STORAGE_KEY_WIDTH = 'deen_sidebar_width'");
    expect(sidebarCode).toContain('localStorage.setItem(STORAGE_KEY_WIDTH');
  });

  it('4. Supports double-click reset to default width (256px)', () => {
    expect(sidebarCode).toContain('onDoubleClick={handleResetWidth}');
    expect(sidebarCode).toContain('updateWidth(DEFAULT_SIDEBAR_WIDTH)');
  });

  it('5. Supports keyboard accessibility for resizing (ArrowRight, ArrowLeft, Enter)', () => {
    expect(sidebarCode).toContain("e.key === 'ArrowRight'");
    expect(sidebarCode).toContain("e.key === 'ArrowLeft'");
    expect(sidebarCode).toContain("e.key === 'Enter'");
  });

  it('6. Adheres to SVG dimension clamping contracts for drag handles', () => {
    expect(sidebarCode).toContain('GripVertical');
    expect(sidebarCode).toContain('w-3 h-3');
  });

  it('7. Disables CSS transition during drag for 60fps instant response', () => {
    expect(sidebarCode).toContain("transition: isDragging ? 'none' : undefined");
    expect(sidebarCode).toContain("isDragging ? '' : 'transition-all duration-200'");
  });
});
