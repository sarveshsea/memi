import { describe, it, expect } from "vitest";
import { checkSkillCompliance, getReferenceCoverage } from "../skill-compliance.js";

describe("checkSkillCompliance — atomic rules", () => {
  it("flags useState in a components/ui/ atom", () => {
    const report = checkSkillCompliance([{
      path: "src/components/ui/Toggle.tsx",
      content: `export function Toggle() { const [on, setOn] = useState(false); return null; }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings.some((f) => f.rule === "atomic-no-state-in-atoms")).toBe(true);
  });

  it("does not flag useState outside components/ui/", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/SearchBar.tsx",
      content: `export function SearchBar() { const [q, setQ] = useState(""); return null; }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings.some((f) => f.rule === "atomic-no-state-in-atoms")).toBe(false);
  });

  it("flags data fetching in an atom or template", () => {
    const report = checkSkillCompliance([{
      path: "src/components/templates/PageShell.tsx",
      content: `export function PageShell() { fetch("/api/data"); return null; }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings.some((f) => f.rule === "atomic-no-data-fetching-in-atoms-or-templates")).toBe(true);
  });

  it("flags non-PascalCase exported components", () => {
    const report = checkSkillCompliance([{
      path: "src/components/ui/button.tsx",
      content: `export function button() { return null; }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings.some((f) => f.rule === "atomic-component-naming")).toBe(true);
  });

  it("does not flag hook exports as bad naming", () => {
    const report = checkSkillCompliance([{
      path: "src/components/ui/Button.tsx",
      content: `export function useButtonState() { return null; }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings.some((f) => f.rule === "atomic-component-naming")).toBe(false);
  });

  it("ignores files outside atomic-design folders entirely", () => {
    const report = checkSkillCompliance([{
      path: "src/utils/helpers.ts",
      content: `export function useState_helper() { const [x] = useState(1); fetch("/x"); }`,
    }], { rulesets: ["atomic"] });
    expect(report.findings).toHaveLength(0);
  });
});

describe("checkSkillCompliance — motion rules", () => {
  it("flags a hardcoded duration with no motion token reference", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Toast.tsx",
      content: `const style = { transition: "opacity 250ms ease" }; export function Toast() { return <div style={style} className="animate-in" />; }`,
    }], { rulesets: ["motion"] });
    expect(report.findings.some((f) => f.rule === "motion-hardcoded-duration")).toBe(true);
  });

  it("does not flag a duration referencing a motion token", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Toast.tsx",
      content: `export function Toast() { return <div className="transition-opacity" style={{ transitionDuration: "var(--motion-duration-fast)" }} />; }`,
    }], { rulesets: ["motion"] });
    expect(report.findings.some((f) => f.rule === "motion-hardcoded-duration")).toBe(false);
  });

  it("flags a missing prefers-reduced-motion accommodation", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Marquee.css",
      content: `.marquee { animation: scroll 10s linear infinite; }`,
    }], { rulesets: ["motion"] });
    expect(report.findings.some((f) => f.rule === "motion-missing-reduced-motion")).toBe(true);
  });

  it("does not flag when prefers-reduced-motion is present in the same file", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Marquee.css",
      content: `.marquee { animation: scroll 10s linear infinite; } @media (prefers-reduced-motion: reduce) { .marquee { animation: none; } }`,
    }], { rulesets: ["motion"] });
    expect(report.findings.some((f) => f.rule === "motion-missing-reduced-motion")).toBe(false);
  });

  it("flags animating a layout-triggering property instead of transform/opacity", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Drawer.css",
      content: `.drawer { transition: width 300ms; } @media (prefers-reduced-motion: reduce) { .drawer { transition: none; } }`,
    }], { rulesets: ["motion"] });
    expect(report.findings.some((f) => f.rule === "motion-non-gpu-property")).toBe(true);
  });

  it("skips files with no animation-related content entirely", () => {
    const report = checkSkillCompliance([{
      path: "src/components/organisms/Static.tsx",
      content: `export function Static() { return <div className="p-4">hi</div>; }`,
    }], { rulesets: ["motion"] });
    expect(report.findings).toHaveLength(0);
  });
});

describe("checkSkillCompliance — report shape and severity", () => {
  it("defaults every finding to warning severity", () => {
    const report = checkSkillCompliance([{
      path: "src/components/ui/button.tsx",
      content: `export function button() { const [x, setX] = useState(0); return null; }`,
    }]);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every((f) => f.severity === "warning")).toBe(true);
    expect(report.summary.critical).toBe(0);
    expect(report.summary.warning).toBe(report.findings.length);
  });

  it("skips non-source file extensions", () => {
    const report = checkSkillCompliance([{ path: "src/components/ui/logo.svg", content: "useState(1)" }]);
    expect(report.findings).toHaveLength(0);
    expect(report.summary.filesChecked).toBe(1);
  });

  it("every finding cites a docRef", () => {
    const report = checkSkillCompliance([{
      path: "src/components/ui/button.tsx",
      content: `export function button() { const [x, setX] = useState(0); return null; }`,
    }]);
    expect(report.findings.every((f) => f.docRef.length > 0)).toBe(true);
  });
});

describe("getReferenceCoverage", () => {
  it("returns a catalogued count for a known component, marked informational-only", () => {
    const notes = getReferenceCoverage("Button");
    expect(notes[0].systemsCatalogued).toBeGreaterThan(0);
    expect(notes[0].note).toContain("informational only");
  });

  it("returns zero coverage for an uncatalogued component without throwing", () => {
    const notes = getReferenceCoverage("SomeObscureWidgetType");
    expect(notes[0].systemsCatalogued).toBe(0);
  });
});
