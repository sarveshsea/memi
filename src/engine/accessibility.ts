/**
 * AccessibilityChecker — WCAG 2.2 conformance checking from design system data.
 *
 * Computes contrast ratios, validates touch targets, checks focus styles,
 * and audits heading hierarchy — all from tokens and specs without needing
 * a running Figma connection.
 */

import type { DesignToken, DesignSystem } from "./registry.js";
import type { AnySpec, ComponentSpec, PageSpec } from "../specs/types.js";
import { parseCssColorToRgb } from "../utils/color.js";

// ── Types ──────────────────────────────────────────────────

export type WcagLevel = "A" | "AA" | "AAA";

export interface A11yIssue {
  rule: string;
  severity: "critical" | "major" | "minor";
  wcagCriteria: string;
  level: WcagLevel;
  target: string;
  message: string;
  fix?: string;
}

export interface A11yReport {
  passed: number;
  failed: number;
  warnings: number;
  issues: A11yIssue[];
  score: number; // 0-100
  level: WcagLevel;
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  passesAALarge: boolean;
  foreground: string;
  background: string;
}

// ── Color Utilities ────────────────────────────────────────

/** Parse a hex color (#RGB, #RRGGBB, #RRGGBBAA) to {r, g, b} in 0-255 range. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex.startsWith("#")) return null;
  const clean = hex.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null;
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length >= 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

/** Compute relative luminance per WCAG 2.2 (sRGB). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Compute WCAG contrast ratio between two colors (hex, rgb, hsl, or oklch). */
export function contrastRatio(color1: string, color2: string): number {
  const c1 = parseCssColorToRgb(color1);
  const c2 = parseCssColorToRgb(color2);
  if (!c1 || !c2) return 0;

  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Check a foreground/background pair against WCAG criteria. */
export function checkContrast(foreground: string, background: string): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
    passesAALarge: ratio >= 3,
    foreground,
    background,
  };
}

// ── Token Auditing ─────────────────────────────────────────

/** Find color token pairs that fail WCAG contrast requirements. */
export function auditTokenContrast(tokens: DesignToken[]): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const colorTokens = tokens.filter((t) => t.type === "color");

  // Check foreground/background pairs by naming convention
  const fgTokens = colorTokens.filter((t) => /foreground|text|fg|on-/i.test(t.name));
  const bgTokens = colorTokens.filter((t) => /background|surface|bg|card/i.test(t.name));

  for (const fg of fgTokens.slice(0, 50)) {
    for (const bg of bgTokens.slice(0, 50)) {
      // Only check tokens from the same semantic family
      const fgBase = fg.name.replace(/foreground|text|fg|on-/gi, "").replace(/^[-/]|[-/]$/g, "").toLowerCase();
      const bgBase = bg.name.replace(/background|surface|bg|card/gi, "").replace(/^[-/]|[-/]$/g, "").toLowerCase();

      // Match if they share a root (e.g., "primary-foreground" + "primary")
      if (fgBase && bgBase && fgBase !== bgBase) continue;

      for (const mode of Object.keys(fg.values)) {
        const fgVal = String(fg.values[mode]);
        const bgVal = bg.values[mode] !== undefined ? String(bg.values[mode]) : null;
        // Any parseable CSS color counts — oklch/hsl token sets must not be skipped.
        if (!bgVal || !parseCssColorToRgb(fgVal) || !parseCssColorToRgb(bgVal)) continue;

        const result = checkContrast(fgVal, bgVal);
        if (!result.passesAA) {
          issues.push({
            rule: "color-contrast",
            severity: result.ratio < 3 ? "critical" : "major",
            wcagCriteria: "1.4.3",
            level: "AA",
            target: `${fg.name} on ${bg.name} (${mode})`,
            message: `Contrast ratio ${result.ratio}:1 fails WCAG AA (need 4.5:1). ${fgVal} on ${bgVal}`,
            fix: `Darken foreground or lighten background to achieve at least 4.5:1 contrast ratio`,
          });
        }
      }
    }
  }

  return issues;
}

/** Check that essential semantic tokens are defined. */
export function auditTokenCompleteness(tokens: DesignToken[]): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const names = new Set(tokens.map((t) => t.name.toLowerCase()));

  const requiredSemanticTokens = [
    { pattern: /focus|ring/, name: "focus ring", wcag: "2.4.7" },
    { pattern: /error|destructive|danger/, name: "error/destructive", wcag: "1.4.1" },
    { pattern: /disabled/, name: "disabled state", wcag: "1.4.1" },
  ];

  for (const required of requiredSemanticTokens) {
    const found = tokens.some((t) => required.pattern.test(t.name.toLowerCase()));
    if (!found) {
      issues.push({
        rule: "semantic-token-missing",
        severity: "major",
        wcagCriteria: required.wcag,
        level: "AA",
        target: `design-system`,
        message: `No ${required.name} token defined — needed for accessible visual feedback`,
        fix: `Add a ${required.name} color token to the design system`,
      });
    }
  }

  return issues;
}

// ── Spec Auditing ──────────────────────────────────────────

/** Audit a component spec for accessibility requirements. */
export function auditComponentSpec(spec: ComponentSpec): A11yIssue[] {
  const issues: A11yIssue[] = [];

  // Check for aria label
  if (!spec.accessibility?.ariaLabel || spec.accessibility.ariaLabel === "none") {
    issues.push({
      rule: "missing-aria-label",
      severity: "major",
      wcagCriteria: "4.1.2",
      level: "A",
      target: spec.name,
      message: `Component "${spec.name}" has no ariaLabel defined`,
      fix: `Add ariaLabel to the accessibility section of the spec`,
    });
  }

  // Check for keyboard navigation on interactive components
  const interactiveNames = /button|input|select|checkbox|radio|toggle|switch|tab|link|menu|dialog|modal|dropdown/i;
  if (interactiveNames.test(spec.name) && !spec.accessibility?.keyboardNav) {
    issues.push({
      rule: "missing-keyboard-nav",
      severity: "critical",
      wcagCriteria: "2.1.1",
      level: "A",
      target: spec.name,
      message: `Interactive component "${spec.name}" has no keyboard navigation`,
      fix: `Set accessibility.keyboardNav to true and implement keyboard event handlers`,
    });
  }

  // Check WCAG 2.2 fields (from v0.3 schema upgrade)
  const a11y = spec.accessibility as Record<string, unknown> | undefined;
  if (a11y) {
    if (!a11y.focusStyle) {
      issues.push({
        rule: "missing-focus-style",
        severity: "major",
        wcagCriteria: "2.4.7",
        level: "AA",
        target: spec.name,
        message: `No focusStyle defined for "${spec.name}"`,
        fix: `Add focusStyle: "ring" or "outline" to the accessibility section`,
      });
    }

    if (!a11y.touchTarget) {
      issues.push({
        rule: "missing-touch-target",
        severity: "minor",
        wcagCriteria: "2.5.8",
        level: "AAA",
        target: spec.name,
        message: `No touchTarget size defined for "${spec.name}"`,
        fix: `Add touchTarget: "44px" to ensure minimum touch target size per WCAG 2.5.8`,
      });
    }
  }

  return issues;
}

/** Audit a page spec for page-level accessibility requirements. */
export function auditPageSpec(spec: PageSpec): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const a11y = (spec as Record<string, unknown>).accessibility as Record<string, unknown> | undefined;

  if (!a11y?.language) {
    issues.push({
      rule: "missing-language",
      severity: "major",
      wcagCriteria: "3.1.1",
      level: "A",
      target: spec.name,
      message: `Page "${spec.name}" has no language attribute defined`,
      fix: `Add accessibility.language: "en" (or appropriate language code)`,
    });
  }

  if (!a11y?.landmarks) {
    issues.push({
      rule: "missing-landmarks",
      severity: "major",
      wcagCriteria: "1.3.1",
      level: "A",
      target: spec.name,
      message: `Page "${spec.name}" has no landmark regions defined`,
      fix: `Add accessibility.landmarks: true to ensure proper page structure`,
    });
  }

  if (!a11y?.skipLink) {
    issues.push({
      rule: "missing-skip-link",
      severity: "major",
      wcagCriteria: "2.4.1",
      level: "A",
      target: spec.name,
      message: `Page "${spec.name}" has no skip navigation link`,
      fix: `Add accessibility.skipLink: true`,
    });
  }

  if (!a11y?.headingHierarchy) {
    issues.push({
      rule: "missing-heading-hierarchy",
      severity: "minor",
      wcagCriteria: "1.3.1",
      level: "A",
      target: spec.name,
      message: `Page "${spec.name}" has no heading hierarchy defined`,
      fix: `Add accessibility.headingHierarchy: true to enforce h1 > h2 > h3 order`,
    });
  }

  return issues;
}

// ── Full Audit ─────────────────────────────────────────────

/** Run a complete accessibility audit across the design system and all specs. */
export function runFullAudit(designSystem: DesignSystem, specs: AnySpec[]): A11yReport {
  const issues: A11yIssue[] = [];

  // 1. Token contrast audit
  issues.push(...auditTokenContrast(designSystem.tokens));

  // 2. Token completeness audit
  issues.push(...auditTokenCompleteness(designSystem.tokens));

  // 3. Spec audits
  for (const spec of specs) {
    if (spec.type === "component") {
      issues.push(...auditComponentSpec(spec as ComponentSpec));
    } else if (spec.type === "page") {
      issues.push(...auditPageSpec(spec as PageSpec));
    }
  }

  const critical = issues.filter((i) => i.severity === "critical").length;
  const major = issues.filter((i) => i.severity === "major").length;
  const minor = issues.filter((i) => i.severity === "minor").length;

  // Score: start at 100, deduct for issues
  const score = Math.max(0, 100 - (critical * 15) - (major * 5) - (minor * 1));

  // Determine highest achievable level
  const level: WcagLevel = critical === 0 && major === 0 ? "AAA"
    : critical === 0 ? "AA"
    : "A";

  return {
    passed: specs.length - issues.filter((i) => i.severity === "critical" || i.severity === "major").length,
    failed: critical + major,
    warnings: minor,
    issues,
    score,
    level,
  };
}
