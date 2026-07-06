import { describe, expect, it } from "vitest";
import type { DesignToken } from "../../engine/registry.js";
import { fromDtcg, toDtcg, isDtcgDocument, normalizeTokenPath } from "../dtcg.js";

const SAMPLE_DTCG = {
  colors: {
    $type: "color",
    primary: { $value: "#3366ff", $description: "Brand primary" },
    accent: { $value: "{colors.primary}" },
  },
  spacing: {
    $type: "dimension",
    xs: { $value: "4px" },
    radius: {
      card: { $value: "8px" },
    },
  },
  typography: {
    heading: {
      $type: "typography",
      $value: { fontFamily: "Inter", fontSize: "24px", fontWeight: 700 },
    },
  },
};

describe("isDtcgDocument", () => {
  it("detects documents with nested $value members", () => {
    expect(isDtcgDocument(SAMPLE_DTCG)).toBe(true);
    expect(isDtcgDocument({ tokens: [{ name: "x" }] })).toBe(false);
    expect(isDtcgDocument("nope")).toBe(false);
    expect(isDtcgDocument(null)).toBe(false);
  });
});

describe("normalizeTokenPath", () => {
  it("makes DTCG dot-paths and memi slash-names comparable", () => {
    expect(normalizeTokenPath("colors.primary")).toBe(normalizeTokenPath("Colors/Primary"));
    expect(normalizeTokenPath("Spacing / XS")).toBe("spacing/xs");
  });
});

describe("fromDtcg", () => {
  it("parses groups with inherited $type into memi tokens", () => {
    const { tokens, warnings } = fromDtcg(SAMPLE_DTCG);
    expect(warnings).toEqual([]);

    const primary = tokens.find((token) => token.name === "colors/primary");
    expect(primary).toMatchObject({ type: "color", collection: "colors", cssVariable: "--colors-primary" });
    expect(primary?.values).toEqual({ default: "#3366ff" });

    const xs = tokens.find((token) => token.name === "spacing/xs");
    expect(xs?.type).toBe("spacing");

    // dimension under a "radius" path maps to memi's radius type
    const card = tokens.find((token) => token.name === "spacing/radius/card");
    expect(card?.type).toBe("radius");

    // composite typography value flattens to canonical JSON
    const heading = tokens.find((token) => token.name === "typography/heading");
    expect(heading?.type).toBe("typography");
    expect(String(heading?.values.default)).toContain("Inter");
  });

  it("resolves aliases and warns on unresolved ones", () => {
    const { tokens } = fromDtcg(SAMPLE_DTCG);
    const accent = tokens.find((token) => token.name === "colors/accent");
    expect(accent?.values.default).toBe("#3366ff");

    const broken = fromDtcg({ a: { $type: "color", x: { $value: "{does.not.exist}" } } });
    expect(broken.tokens[0]?.values.default).toBe("{does.not.exist}");
    expect(broken.warnings.some((warning) => warning.includes("Unresolved alias"))).toBe(true);
  });

  it("keeps alias cycles as literals instead of looping", () => {
    const { tokens, warnings } = fromDtcg({
      a: { $type: "color", one: { $value: "{a.two}" }, two: { $value: "{a.one}" } },
    });
    expect(tokens).toHaveLength(2);
    expect(warnings.some((warning) => warning.includes("cycle"))).toBe(true);
  });

  it("rejects non-documents loudly", () => {
    expect(fromDtcg([1, 2]).warnings[0]).toContain("Not a DTCG document");
    expect(fromDtcg({}).warnings[0]).toContain("No tokens found");
  });
});

describe("toDtcg round-trip", () => {
  it("is lossless through $extensions, including multi-mode values", () => {
    const original: DesignToken[] = [
      {
        name: "Colors/Primary",
        collection: "Brand",
        type: "color",
        values: { Light: "#3366ff", Dark: "#88aaff" },
        cssVariable: "--color-primary",
      },
      {
        name: "Radius/Card",
        collection: "Layout",
        type: "radius",
        values: { default: "8px" },
        cssVariable: "--radius-card",
      },
    ];

    const document = toDtcg(original);
    // Spec-compliant surface for other DTCG tooling
    const primary = (document as any).Colors.Primary;
    expect(primary.$type).toBe("color");
    expect(primary.$value).toBe("#3366ff"); // first mode when no "default"
    expect((document as any).Radius.Card.$type).toBe("dimension");

    const { tokens, warnings } = fromDtcg(document);
    expect(warnings).toEqual([]);
    expect(tokens).toHaveLength(2);
    const roundTripped = tokens.find((token) => normalizeTokenPath(token.name) === "colors/primary");
    expect(roundTripped).toEqual(original[0]);
  });
});
