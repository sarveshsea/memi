/**
 * Shared CSS color parsing — hex, rgb()/rgba(), hsl()/hsla(), and oklch().
 *
 * shadcn + Tailwind v4 design systems express tokens as oklch()/hsl(),
 * not hex. Every contrast/audit path must parse these formats or it
 * silently checks nothing on modern token sets.
 */

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/** Parse any supported CSS color to sRGB. Returns null when unparseable. */
export function parseCssColorToRgb(input: string): RgbColor | null {
  const value = input.trim().toLowerCase();
  if (value.startsWith("#")) return parseHexColor(value);
  if (value.startsWith("rgb(") || value.startsWith("rgba(")) return parseRgbFunction(value);
  if (value.startsWith("hsl(") || value.startsWith("hsla(")) return parseHslFunction(value);
  if (value.startsWith("oklch(")) return parseOklchFunction(value);
  if (value === "white") return { r: 255, g: 255, b: 255 };
  if (value === "black") return { r: 0, g: 0, b: 0 };
  return null;
}

function parseHexColor(value: string): RgbColor | null {
  const hex = value.slice(1);
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function functionArgs(value: string): string[] {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  // Drop the alpha component ("/ 0.5") — contrast math uses opaque colors.
  const beforeAlpha = inner.split("/")[0];
  return beforeAlpha.split(/[,\s]+/).filter(Boolean);
}

function parseRgbFunction(value: string): RgbColor | null {
  const parts = functionArgs(value).slice(0, 3);
  if (parts.length < 3) return null;
  const channels = parts.map((p) => {
    const n = parseFloat(p);
    if (Number.isNaN(n)) return null;
    return p.endsWith("%") ? (n / 100) * 255 : n;
  });
  if (channels.some((c) => c === null)) return null;
  const [r, g, b] = channels as number[];
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
}

function parseHslFunction(value: string): RgbColor | null {
  const parts = functionArgs(value).slice(0, 3);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if ([h, s, l].some(Number.isNaN)) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

/** oklch(L C H [/ alpha]) — L as 0-1 or %, C unitless, H in degrees. */
function parseOklchFunction(value: string): RgbColor | null {
  const parts = functionArgs(value).slice(0, 3);
  if (parts.length < 3) return null;
  let L = parseFloat(parts[0]);
  if (parts[0].endsWith("%")) L /= 100;
  const C = parseFloat(parts[1]);
  const H = parseFloat(parts[2]);
  if ([L, C, H].some(Number.isNaN)) return null;

  // OKLCH → OKLab
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → LMS (cube roots undone)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  // LMS → linear sRGB
  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return {
    r: clamp255(srgbGamma(rLin) * 255),
    g: clamp255(srgbGamma(gLin) * 255),
    b: clamp255(srgbGamma(bLin) * 255),
  };
}

function srgbGamma(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp255(n: number): number {
  return Math.round(Math.min(255, Math.max(0, n)));
}
