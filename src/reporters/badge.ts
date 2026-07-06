/**
 * Design-health badge — a deterministic SVG (same score in, same bytes out)
 * teams can commit or serve, shields.io-style. No network, no fonts beyond
 * system defaults, no randomness.
 */

export interface BadgeOptions {
  label?: string;
  score: number;
  /** Suffix appended after the score, e.g. "/100". */
  suffix?: string;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#3fb950"; // green
  if (score >= 75) return "#d29922"; // yellow
  if (score >= 60) return "#f0883e"; // orange
  return "#f85149"; // red
}

/** Approximate text width for the default badge font stack (6.1px/char at 11px). */
function textWidth(text: string): number {
  return Math.round(text.length * 6.1) + 10;
}

export function renderBadgeSvg(options: BadgeOptions): string {
  const label = options.label ?? "design health";
  const value = `${options.score}${options.suffix ?? "/100"}`;
  const color = scoreColor(options.score);
  const labelWidth = textWidth(label);
  const valueWidth = textWidth(value);
  const width = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>
`;
}
