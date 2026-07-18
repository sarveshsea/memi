import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SWIFTUI_SCAFFOLD_KINDS = ["component", "screen"] as const;
export const SWIFTUI_ATOMIC_LEVELS = ["atom", "molecule", "organism", "template"] as const;

export type SwiftUiScaffoldKind = typeof SWIFTUI_SCAFFOLD_KINDS[number];
export type SwiftUiAtomicLevel = typeof SWIFTUI_ATOMIC_LEVELS[number];
export type SwiftUiScaffoldStatus = "planned" | "approved" | "written";

export interface SwiftUiScaffoldOptions {
  projectRoot: string;
  name: string;
  kind: SwiftUiScaffoldKind;
  moduleName: string;
  atomicLevel?: SwiftUiAtomicLevel;
  intent?: string;
  deploymentTarget?: string;
  outputRoot?: string;
  testsRoot?: string;
  liquidGlass?: boolean;
  dryRun?: boolean;
  approved?: boolean;
}

export interface SwiftUiScaffoldFile {
  path: string;
  role: "spec" | "model" | "view" | "test";
  content: string;
}

export interface SwiftUiScaffoldPlan {
  action: "scaffold_swiftui_files";
  schemaVersion: 1;
  status: SwiftUiScaffoldStatus;
  dryRun: boolean;
  approved: boolean;
  projectRoot: string;
  platform: "ios";
  framework: "SwiftUI";
  name: string;
  kind: SwiftUiScaffoldKind;
  moduleName: string;
  atomicLevel: SwiftUiAtomicLevel | "page";
  deploymentTarget: string;
  liquidGlass: boolean;
  files: SwiftUiScaffoldFile[];
  verificationCommands: string[];
  guardrails: string[];
}

const SWIFT_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FEATURE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;
const DEPLOYMENT_TARGET = /^\d{1,2}\.\d$/;

export function buildSwiftUiScaffoldPlan(options: SwiftUiScaffoldOptions): SwiftUiScaffoldPlan {
  const name = options.name.trim();
  const moduleName = options.moduleName.trim();
  if (!FEATURE_NAME.test(name)) throw new Error("SwiftUI scaffold name must be a PascalCase Swift type name containing only letters and numbers.");
  if (!SWIFT_IDENTIFIER.test(moduleName)) throw new Error("Swift module name must be a valid Swift identifier.");
  const outputRoot = normalizeRelativeRoot(options.outputRoot ?? "Sources");
  const testsRoot = normalizeRelativeRoot(options.testsRoot ?? "Tests");
  const deploymentTarget = options.deploymentTarget ?? "17.0";
  if (!DEPLOYMENT_TARGET.test(deploymentTarget)) throw new Error("Deployment target must use major.minor form, for example 17.0.");

  const dryRun = options.dryRun ?? true;
  const approved = options.approved ?? false;
  const atomicLevel = options.kind === "screen" ? "page" : (options.atomicLevel ?? "molecule");
  const liquidGlass = options.liquidGlass ?? false;
  const featureRoot = `${outputRoot}/${name}`;
  const filePaths = [
    `.memoire/specs/ios/${name}.json`,
    ...(options.kind === "screen" ? [`${featureRoot}/${name}Model.swift`] : []),
    `${featureRoot}/${name}View.swift`,
    `${testsRoot}/${name}Tests.swift`,
  ];
  const spec = {
    schemaVersion: 1,
    platform: "ios",
    framework: "SwiftUI",
    name,
    kind: options.kind,
    atomicLevel,
    moduleName,
    deploymentTarget,
    liquidGlass,
    intent: options.intent?.trim() || `Create a production ${name} ${options.kind} from explicit Apple-platform design evidence.`,
    files: filePaths.slice(1),
    accessibility: {
      dynamicType: true,
      voiceOver: true,
      reduceMotion: true,
      minimumPracticalHitRegionPoints: 44,
    },
    verification: {
      build: "required",
      tests: "required",
      simulatorFlow: "required-for-user-facing-claims",
    },
  };

  const files: SwiftUiScaffoldFile[] = [
    { path: filePaths[0], role: "spec", content: `${JSON.stringify(spec, null, 2)}\n` },
    ...(options.kind === "screen" ? [{
      path: `${featureRoot}/${name}Model.swift`,
      role: "model" as const,
      content: screenModelSource(name),
    }] : []),
    { path: `${featureRoot}/${name}View.swift`, role: "view", content: viewSource(name, options.kind, liquidGlass) },
    { path: `${testsRoot}/${name}Tests.swift`, role: "test", content: testSource(name, options.kind, moduleName) },
  ];

  return {
    action: "scaffold_swiftui_files",
    schemaVersion: 1,
    status: dryRun || !approved ? "planned" : "approved",
    dryRun,
    approved,
    projectRoot: path.resolve(options.projectRoot),
    platform: "ios",
    framework: "SwiftUI",
    name,
    kind: options.kind,
    moduleName,
    atomicLevel,
    deploymentTarget,
    liquidGlass,
    files,
    verificationCommands: [
      "xcodebuild -list -json",
      "xcodebuild build -scheme <scheme> -destination '<destination>'",
      "xcodebuild test -scheme <scheme> -destination '<destination>' -resultBundlePath .build/TestResults.xcresult",
    ],
    guardrails: [
      "No .xcodeproj or .xcworkspace file is mutated; add generated source through the repository's existing project workflow.",
      "Dry-run JSON exposes every path and byte before an approved write.",
      "Existing files are never overwritten silently.",
      "Semantic system styling, Dynamic Type, VoiceOver, reduced motion, and 44-point practical hit regions are part of the spec.",
      "Liquid Glass is availability-gated to iOS 26+ with a native material fallback.",
    ],
  };
}

export async function writeSwiftUiScaffold(plan: SwiftUiScaffoldPlan): Promise<SwiftUiScaffoldPlan> {
  if (!plan.approved || plan.dryRun || plan.status !== "approved") {
    throw new Error("SwiftUI scaffold writes require approved=true and dryRun=false.");
  }

  const resolvedFiles = plan.files.map((file) => ({ file, absolutePath: resolveInside(plan.projectRoot, file.path) }));
  for (const { file, absolutePath } of resolvedFiles) {
    if (await exists(absolutePath)) throw new Error(`Refusing to overwrite file that already exists: ${file.path}`);
  }
  for (const { file, absolutePath } of resolvedFiles) {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, { encoding: "utf8", flag: "wx" });
  }
  return { ...plan, status: "written", dryRun: false, approved: true };
}

function normalizeRelativeRoot(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Output root must be a workspace-relative path without traversal: ${value}`);
  }
  return normalized;
}

function resolveInside(projectRoot: string, relativePath: string): string {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Generated path escapes the project root: ${relativePath}`);
  }
  return resolved;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function screenModelSource(name: string): string {
  return `import Foundation\nimport Observation\n\n@MainActor\n@Observable\nfinal class ${name}Model {\n    enum LoadState: Equatable {\n        case idle\n        case loading\n        case loaded\n        case failed(String)\n    }\n\n    private(set) var state: LoadState = .idle\n\n    func load() async {\n        state = .loading\n        await Task.yield()\n        state = .loaded\n    }\n}\n`;
}

function viewSource(name: string, kind: SwiftUiScaffoldKind, liquidGlass: boolean): string {
  const title = humanize(name);
  const model = kind === "screen" ? `    @State private var model = ${name}Model()\n\n` : "";
  const content = kind === "screen"
    ? `NavigationStack {\n            surface\n                .navigationTitle("${title}")\n        }\n        .task { await model.load() }`
    : "surface";
  const surfaceBody = `VStack(alignment: .leading, spacing: 12) {\n            Text("${title}")\n                .font(.headline)\n            Text("Ready for product-specific content.")\n                .font(.body)\n                .foregroundStyle(.secondary)\n        }\n        .padding()\n        .frame(maxWidth: .infinity, alignment: .leading)\n        .contentShape(Rectangle())\n        .accessibilityElement(children: .combine)`;
  const surface = liquidGlass
    ? `    @ViewBuilder\n    private var surface: some View {\n        if #available(iOS 26.0, *) {\n            content\n                .glassEffect(.regular, in: .rect(cornerRadius: 16))\n        } else {\n            content\n                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))\n        }\n    }\n\n    private var content: some View {\n        ${surfaceBody.replaceAll("\n", "\n        ")}\n    }`
    : `    private var surface: some View {\n        ${surfaceBody.replaceAll("\n", "\n        ")}\n        .background(.background, in: RoundedRectangle(cornerRadius: 16))\n    }`;

  return `import SwiftUI\n\nstruct ${name}View: View {\n${model}    var body: some View {\n        ${content.replaceAll("\n", "\n        ")}\n    }\n\n${surface}\n}\n\n#Preview {\n    ${name}View()\n}\n`;
}

function testSource(name: string, kind: SwiftUiScaffoldKind, moduleName: string): string {
  if (kind === "screen") {
    return `import Testing\n@testable import ${moduleName}\n\n@MainActor\nstruct ${name}ModelTests {\n    @Test\n    func loadsDeterministically() async {\n        let model = ${name}Model()\n        #expect(model.state == .idle)\n        await model.load()\n        #expect(model.state == .loaded)\n    }\n}\n`;
  }
  return `import Testing\n@testable import ${moduleName}\n\n@MainActor\nstruct ${name}ViewTests {\n    @Test\n    func createsTheComponent() {\n        _ = ${name}View()\n    }\n}\n`;
}

function humanize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}
