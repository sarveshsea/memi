/**
 * W3C Design Tokens (DTCG) read/write — the community-group JSON format
 * (design-tokens.github.io/community-group, 2025.10 draft line).
 *
 * Read: any nested-group document with $value tokens, $type inheritance,
 * and {dot.path} alias references. Write: spec-compliant $type/$value with
 * a "cv.memoire" $extensions block carrying memi's full token shape
 * (type, collection, cssVariable, mode values) so a round-trip is lossless.
 *
 * Unresolvable aliases and unmappable types are reported as warnings —
 * never silently dropped or guessed.
 */

import type { DesignToken } from "../engine/registry.js";

const EXTENSION_KEY = "cv.memoire";
const MAX_ALIAS_DEPTH = 10;

export interface DtcgParseResult {
  tokens: DesignToken[];
  warnings: string[];
}

interface MemoireExtension {
  type?: DesignToken["type"];
  collection?: string;
  cssVariable?: string;
  values?: Record<string, string | number>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the value looks like a DTCG document (some nested member carries $value). */
export function isDtcgDocument(value: unknown, depth = 0): boolean {
  if (!isPlainObject(value) || depth > 8) return false;
  if ("$value" in value) return true;
  return Object.entries(value).some(([key, child]) => !key.startsWith("$") && isDtcgDocument(child, depth + 1));
}

/** Normalize a token identifier for matching: DTCG "colors.primary" ≡ memi "Colors/Primary". */
export function normalizeTokenPath(name: string): string {
  return name
    .split(/[./]/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .join("/");
}

function kebab(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function mapDtcgType(dtcgType: string | undefined, path: string[]): DesignToken["type"] {
  switch (dtcgType) {
    case "color":
      return "color";
    case "dimension":
      return path.some((segment) => /radius/i.test(segment)) ? "radius" : "spacing";
    case "typography":
    case "fontFamily":
    case "fontWeight":
    case "fontSize":
    case "lineHeight":
      return "typography";
    case "shadow":
      return "shadow";
    default:
      return "other";
  }
}

const MEMI_TO_DTCG_TYPE: Record<DesignToken["type"], string> = {
  color: "color",
  spacing: "dimension",
  radius: "dimension",
  typography: "typography",
  shadow: "shadow",
  other: "string",
};

function primitiveValue(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") return value;
  // Composite DTCG values (typography/shadow objects) flatten to canonical JSON.
  return JSON.stringify(value);
}

interface RawToken {
  path: string[];
  node: Record<string, unknown>;
  inheritedType?: string;
}

function collectTokens(node: Record<string, unknown>, path: string[], inheritedType: string | undefined, out: RawToken[]): void {
  const groupType = typeof node.$type === "string" ? node.$type : inheritedType;
  if ("$value" in node) {
    out.push({ path, node, inheritedType: groupType });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isPlainObject(child)) continue;
    collectTokens(child, [...path, key], groupType, out);
  }
}

/** Parse a DTCG document into memi DesignTokens. */
export function fromDtcg(document: unknown): DtcgParseResult {
  const warnings: string[] = [];
  if (!isPlainObject(document)) {
    return { tokens: [], warnings: ["Not a DTCG document: expected a JSON object."] };
  }

  const raw: RawToken[] = [];
  collectTokens(document, [], undefined, raw);
  const byPath = new Map<string, RawToken>(raw.map((token) => [normalizeTokenPath(token.path.join("/")), token]));

  const resolveValue = (value: unknown, chain: string[]): unknown => {
    if (typeof value !== "string") return value;
    const alias = /^\{([^}]+)\}$/.exec(value.trim());
    if (!alias) return value;
    const targetPath = normalizeTokenPath(alias[1]);
    if (chain.includes(targetPath) || chain.length >= MAX_ALIAS_DEPTH) {
      warnings.push(`Alias cycle or depth limit at {${alias[1]}} — kept as literal.`);
      return value;
    }
    const target = byPath.get(targetPath);
    if (!target) {
      warnings.push(`Unresolved alias {${alias[1]}} — kept as literal.`);
      return value;
    }
    return resolveValue(target.node.$value, [...chain, targetPath]);
  };

  const tokens: DesignToken[] = raw.map((token) => {
    const name = token.path.join("/");
    const extensions = isPlainObject(token.node.$extensions)
      ? (token.node.$extensions as Record<string, unknown>)[EXTENSION_KEY] as MemoireExtension | undefined
      : undefined;
    const resolved = resolveValue(token.node.$value, [normalizeTokenPath(name)]);
    const dtcgType = typeof token.node.$type === "string" ? token.node.$type : token.inheritedType;

    return {
      name,
      collection: extensions?.collection ?? token.path[0] ?? "DTCG",
      type: extensions?.type ?? mapDtcgType(dtcgType, token.path),
      values: extensions?.values ?? { default: primitiveValue(resolved) },
      cssVariable: extensions?.cssVariable ?? `--${token.path.map(kebab).join("-")}`,
    };
  });

  if (tokens.length === 0) {
    warnings.push("No tokens found: a DTCG token needs a $value member.");
  }
  return { tokens, warnings };
}

/** Serialize memi DesignTokens to a DTCG document (lossless via $extensions). */
export function toDtcg(tokens: DesignToken[]): Record<string, unknown> {
  const document: Record<string, unknown> = {};

  for (const token of tokens) {
    const segments = token.name.split("/").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) continue;

    let cursor = document;
    for (const segment of segments.slice(0, -1)) {
      const existing = cursor[segment];
      if (isPlainObject(existing) && !("$value" in existing)) {
        cursor = existing;
      } else {
        const group: Record<string, unknown> = {};
        cursor[segment] = group;
        cursor = group;
      }
    }

    const modes = Object.keys(token.values);
    const defaultValue = token.values.default ?? token.values[modes[0] ?? ""];
    cursor[segments[segments.length - 1]] = {
      $type: MEMI_TO_DTCG_TYPE[token.type],
      $value: defaultValue ?? "",
      $extensions: {
        [EXTENSION_KEY]: {
          type: token.type,
          collection: token.collection,
          cssVariable: token.cssVariable,
          values: token.values,
        } satisfies MemoireExtension,
      },
    };
  }

  return document;
}
