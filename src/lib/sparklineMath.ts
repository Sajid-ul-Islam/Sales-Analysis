/**
 * Sparkline Mathematical Geometry & Coordinate Engine
 * Computes smooth cubic Bezier paths, area polygons, baseline guides,
 * and nearest-point hit targets for KPI Sparklines.
 */

export interface SparklinePoint {
  x: number;
  y: number;
  val: number;
  label?: string;
}

export interface SparklineGeometry {
  points: SparklinePoint[];
  pathD: string;
  areaD: string;
  avgY: number;
  min: number;
  max: number;
  range: number;
  avg: number;
  firstPt: SparklinePoint | null;
  lastPt: SparklinePoint | null;
}

export function computeSparklineGeometry(
  data: number[],
  width = 160,
  height = 36,
  padX = 6,
  padY = 5,
  labels?: string[]
): SparklineGeometry {
  if (!data || data.length === 0) {
    return {
      points: [],
      pathD: '',
      areaD: '',
      avgY: height / 2,
      min: 0,
      max: 0,
      range: 0,
      avg: 0,
      firstPt: null,
      lastPt: null,
    };
  }

  // Handle single-point data by replicating it for a smooth horizontal line
  const effectiveData = data.length === 1 ? [data[0], data[0]] : data;

  const min = Math.min(...effectiveData);
  const max = Math.max(...effectiveData);
  const range = max - min;
  const avg = effectiveData.reduce((sum, v) => sum + v, 0) / (effectiveData.length || 1);

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // Generate coordinate points with fallback for zero range (flat data)
  const points: SparklinePoint[] = effectiveData.map((val, idx) => {
    const x = padX + (idx / Math.max(1, effectiveData.length - 1)) * innerW;
    const y = range === 0
      ? height / 2
      : height - padY - ((val - min) / range) * innerH;
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      val,
      label: labels?.[idx],
    };
  });

  // Build smooth cubic bezier curve
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = Number((p1.x + (p2.x - p0.x) / 6).toFixed(2));
    const cp1y = Number((p1.y + (p2.y - p0.y) / 6).toFixed(2));
    const cp2x = Number((p2.x - (p3.x - p1.x) / 6).toFixed(2));
    const cp2y = Number((p2.y - (p3.y - p1.y) / 6).toFixed(2));

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const areaD = `${pathD} L ${lastPt.x} ${height} L ${firstPt.x} ${height} Z`;

  // Compute 7-day average baseline position
  const avgY = range === 0
    ? height / 2
    : Number((height - padY - ((avg - min) / range) * innerH).toFixed(2));

  return {
    points,
    pathD,
    areaD,
    avgY,
    min,
    max,
    range,
    avg,
    firstPt,
    lastPt,
  };
}

export function getNearestSparklinePoint(
  points: SparklinePoint[],
  ratio: number
): { point: SparklinePoint; index: number } | null {
  if (!points || points.length === 0) return null;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const targetIdx = Math.round(clampedRatio * (points.length - 1));
  return {
    point: points[targetIdx],
    index: targetIdx,
  };
}
