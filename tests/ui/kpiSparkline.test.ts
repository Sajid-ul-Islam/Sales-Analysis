import { describe, it, expect } from 'vitest';
import {
  computeSparklineGeometry,
  getNearestSparklinePoint,
} from '@/lib/sparklineMath';

describe('KPI Card Sparkline Geometry Engine (Mathematical & Visual Invariants)', () => {
  it('returns clean zero geometry when data array is empty', () => {
    const geom = computeSparklineGeometry([], 160, 36);
    expect(geom.points).toHaveLength(0);
    expect(geom.pathD).toBe('');
    expect(geom.areaD).toBe('');
    expect(geom.avgY).toBe(18);
    expect(geom.firstPt).toBeNull();
    expect(geom.lastPt).toBeNull();
  });

  it('generates points with correct bounds and valid coordinates for standard dataset', () => {
    const mockData = [10, 20, 15, 30, 25, 40, 35];
    const width = 160;
    const height = 36;
    const padX = 6;
    const padY = 5;

    const geom = computeSparklineGeometry(mockData, width, height, padX, padY, [
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
    ]);

    expect(geom.points).toHaveLength(7);
    expect(geom.firstPt?.x).toBe(padX);
    expect(geom.lastPt?.x).toBe(width - padX);

    // Minimum point should be at bottom pad
    const minPoint = geom.points.find((p) => p.val === 10);
    expect(minPoint?.y).toBe(height - padY);

    // Maximum point should be at top pad
    const maxPoint = geom.points.find((p) => p.val === 40);
    expect(maxPoint?.y).toBe(padY);

    // Check SVG paths
    expect(geom.pathD).toContain('M ');
    expect(geom.pathD).toContain(' C ');
    expect(geom.areaD).toContain(' Z');

    // Should not contain NaN or Infinity
    expect(geom.pathD).not.toContain('NaN');
    expect(geom.pathD).not.toContain('Infinity');
    expect(geom.areaD).not.toContain('NaN');
  });

  it('handles flat datasets without division by zero by centering points vertically', () => {
    const flatData = [100, 100, 100, 100];
    const height = 36;
    const geom = computeSparklineGeometry(flatData, 160, height);

    expect(geom.range).toBe(0);
    expect(geom.avg).toBe(100);
    expect(geom.avgY).toBe(height / 2);

    for (const pt of geom.points) {
      expect(pt.y).toBe(height / 2);
    }

    expect(geom.pathD).not.toContain('NaN');
  });

  it('handles single-point dataset by replicating it for a smooth horizontal line', () => {
    const singleData = [55];
    const height = 36;
    const geom = computeSparklineGeometry(singleData, 160, height);

    expect(geom.points).toHaveLength(2);
    expect(geom.firstPt?.val).toBe(55);
    expect(geom.lastPt?.val).toBe(55);
    expect(geom.pathD).not.toContain('NaN');
  });

  it('computes nearest point hit target accurately based on mouse X ratio', () => {
    const mockData = [10, 20, 30, 40, 50];
    const geom = computeSparklineGeometry(mockData, 100, 40);

    // Far left (0%) -> Point 0 (value 10)
    const hit0 = getNearestSparklinePoint(geom.points, 0);
    expect(hit0?.index).toBe(0);
    expect(hit0?.point.val).toBe(10);

    // Exact middle (50%) -> Point 2 (value 30)
    const hit2 = getNearestSparklinePoint(geom.points, 0.5);
    expect(hit2?.index).toBe(2);
    expect(hit2?.point.val).toBe(30);

    // Far right (100%) -> Point 4 (value 50)
    const hit4 = getNearestSparklinePoint(geom.points, 1.0);
    expect(hit4?.index).toBe(4);
    expect(hit4?.point.val).toBe(50);

    // Out of bounds clamping (negative or > 1)
    const hitNegative = getNearestSparklinePoint(geom.points, -0.25);
    expect(hitNegative?.index).toBe(0);

    const hitOver = getNearestSparklinePoint(geom.points, 1.5);
    expect(hitOver?.index).toBe(4);
  });
});
