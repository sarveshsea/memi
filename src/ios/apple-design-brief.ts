export const APPLE_DESIGN_BRIEF_PLATFORMS = ["ios", "macos"] as const;
export const APPLE_DESIGN_BRIEF_DETAILS = ["compact", "standard", "full"] as const;

export type AppleDesignBriefPlatform = typeof APPLE_DESIGN_BRIEF_PLATFORMS[number];
export type AppleDesignBriefDetail = typeof APPLE_DESIGN_BRIEF_DETAILS[number];

export interface AppleDesignBriefOptions {
  projectRoot: string;
  platform?: AppleDesignBriefPlatform;
  intent?: string;
  detail?: AppleDesignBriefDetail;
}

export interface AppleDesignBrief {
  action: "prepare_apple_design_brief";
  schemaVersion: 1;
  projectRoot: string;
  platform: AppleDesignBriefPlatform;
  detail: AppleDesignBriefDetail;
  intent: string;
  mission: string;
  availabilityPolicy: string;
  skillTriggers: string[];
  preflightCommands: string[];
  designChecks: string[];
  verificationCommands: string[];
  handoff: string[];
}

export function buildAppleDesignBrief(options: AppleDesignBriefOptions): AppleDesignBrief {
  const platform = options.platform ?? "ios";
  const detail = options.detail ?? "standard";
  const intent = options.intent?.trim() || `Build and verify a production ${platform === "ios" ? "SwiftUI iOS" : "SwiftUI macOS"} interface.`;
  const normalizedIntent = intent.toLowerCase();
  const skillTriggers = [
    "swiftui-design-engineering",
    ...(normalizedIntent.includes("glass") ? ["swiftui-liquid-glass"] : []),
    ...(normalizedIntent.includes("intent") || normalizedIntent.includes("shortcut") || normalizedIntent.includes("siri") ? ["ios-app-intents"] : []),
    ...(normalizedIntent.includes("swiftdata") || normalizedIntent.includes("persist") ? ["swiftdata-persistence"] : []),
    ...(normalizedIntent.includes("async") || normalizedIntent.includes("concurr") || normalizedIntent.includes("actor") ? ["swift-concurrency-safety"] : []),
    "swift-testing",
    "xcode-build-reliability",
  ];

  const common: AppleDesignBrief = {
    action: "prepare_apple_design_brief",
    schemaVersion: 1,
    projectRoot: options.projectRoot,
    platform,
    detail,
    intent,
    mission: "Turn product and design intent into native Apple-platform source with explicit availability, accessibility, build, test, and runtime evidence.",
    availabilityPolicy: "Treat Liquid Glass as iOS 26+; verify every newer API against the installed SDK and provide a behaviorally equivalent fallback for the deployment target.",
    skillTriggers: Array.from(new Set(skillTriggers)),
    preflightCommands: [
      "xcodebuild -list -json",
      "xcodebuild -version",
      "xcrun simctl list devices available",
    ],
    designChecks: [
      "Reuse local SwiftUI components, semantic assets, and navigation patterns before creating new primitives.",
      "Define loading, empty, populated, error, Dynamic Type, VoiceOver, reduced-motion, and dark-appearance behavior.",
      "Keep state ownership narrow and isolate persistence, networking, and concurrency from view rendering.",
      "Use current native APIs only when the deployment target and fallback path are explicit.",
    ],
    verificationCommands: [
      "xcodebuild build -scheme <scheme> -destination '<destination>'",
      "xcodebuild test -scheme <scheme> -destination '<destination>' -resultBundlePath .build/TestResults.xcresult",
    ],
    handoff: [
      "List files, deployment target, Swift language mode, and availability branches.",
      "Record exact build/test commands and the simulator flow actually exercised.",
      "Mark preview, device, signing, performance, or system-surface claims unverified when they were not run.",
    ],
  };

  if (detail === "compact") {
    return {
      ...common,
      designChecks: common.designChecks.slice(0, 3),
      handoff: common.handoff.slice(0, 2),
    };
  }
  if (detail === "full") {
    return {
      ...common,
      preflightCommands: [...common.preflightCommands, "xcodebuild -showBuildSettings -scheme <scheme>"],
      designChecks: [
        ...common.designChecks,
        "Verify safe areas, keyboard avoidance, localization, right-to-left layout, focus, and practical 44-point hit regions.",
        "Profile SwiftUI update groups or memory only when the changed flow has a reproducible performance risk.",
      ],
      verificationCommands: [
        ...common.verificationCommands,
        "xcrun simctl launch <device> <bundle-id>",
      ],
    };
  }
  return common;
}
