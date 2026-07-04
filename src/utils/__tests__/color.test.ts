import { describe, expect, it } from "vitest";
import { parseCssColorToRgb } from "../color.js";
import { contrastRatio } from "../../engine/accessibility.js";

describe("parseCssColorToRgb", () => {
  it("parses hex forms", () => {
    expect(parseCssColorToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColorToRgb("#3B82F6")).toEqual({ r: 59, g: 130, b: 246 });
    expect(parseCssColorToRgb("#3B82F680")).toEqual({ r: 59, g: 130, b: 246 });
  });

  it("parses rgb()/rgba()", () => {
    expect(parseCssColorToRgb("rgb(59, 130, 246)")).toEqual({ r: 59, g: 130, b: 246 });
    expect(parseCssColorToRgb("rgba(59 130 246 / 0.5)")).toEqual({ r: 59, g: 130, b: 246 });
  });

  it("parses hsl()", () => {
    expect(parseCssColorToRgb("hsl(0 100% 50%)")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseCssColorToRgb("hsl(120, 100%, 25%)")).toEqual({ r: 0, g: 128, b: 0 });
  });

  it("parses oklch() — white, black, and a Tailwind v4 blue", () => {
    expect(parseCssColorToRgb("oklch(1 0 0)")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColorToRgb("oklch(0 0 0)")).toEqual({ r: 0, g: 0, b: 0 });

    // Tailwind v4 blue-500 is oklch(0.623 0.214 259.815) ≈ #3b82f6.
    // The value sits slightly outside sRGB gamut, so per-channel clipping
    // shifts it a little — close enough for WCAG contrast math.
    const blue = parseCssColorToRgb("oklch(0.623 0.214 259.815)");
    expect(blue).not.toBeNull();
    expect(Math.abs(blue!.r - 59)).toBeLessThanOrEqual(20);
    expect(Math.abs(blue!.g - 130)).toBeLessThanOrEqual(20);
    expect(Math.abs(blue!.b - 246)).toBeLessThanOrEqual(20);
  });

  it("accepts percent lightness and alpha in oklch", () => {
    expect(parseCssColorToRgb("oklch(100% 0 0)")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColorToRgb("oklch(62.3% 0.214 259.815 / 0.8)")).not.toBeNull();
  });

  it("returns null on garbage", () => {
    expect(parseCssColorToRgb("var(--primary)")).toBeNull();
    expect(parseCssColorToRgb("oklch(nope)")).toBeNull();
    expect(parseCssColorToRgb("")).toBeNull();
  });
});

describe("contrastRatio with modern color formats", () => {
  it("computes 21:1 for oklch white on black", () => {
    expect(contrastRatio("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 0);
  });

  it("works across mixed formats", () => {
    const ratio = contrastRatio("#ffffff", "oklch(0.623 0.214 259.815)");
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(5);
  });
});
