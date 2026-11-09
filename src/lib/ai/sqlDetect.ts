/**
 * Lightweight SQL Intent Detector
 * Detects whether a merchant query begins with standard SQL keywords.
 * Zero-dependency pure regex utility safe for client-side bundles (does not import AlaSQL).
 */
export function detectDirectSql(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  if (/^(SELECT|WITH|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|EXEC)\b/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}
