import { describe, expect, it } from "vitest";
import { buildAppleDesignBrief } from "../apple-design-brief.js";

describe("Apple design brief", () => {
  it("returns a compact, current, verification-first iOS brief", () => {
    const brief = buildAppleDesignBrief({
      projectRoot: "/repo",
      platform: "ios",
      intent: "Build a SwiftUI settings screen with App Intents",
      detail: "compact",
    });

    expect(brief).toMatchObject({
      action: "prepare_apple_design_brief",
      schemaVersion: 1,
      platform: "ios",
      detail: "compact",
      intent: "Build a SwiftUI settings screen with App Intents",
    });
    expect(brief.skillTriggers).toEqual(expect.arrayContaining([
      "swiftui-design-engineering",
      "ios-app-intents",
      "xcode-build-reliability",
    ]));
    expect(brief.preflightCommands).toEqual(expect.arrayContaining([
      "xcodebuild -list -json",
      "xcrun simctl list devices available",
    ]));
    expect(JSON.stringify(brief).length).toBeLessThan(3200);
  });

  it("does not label current SDK additions as iOS 27 without evidence", () => {
    const brief = buildAppleDesignBrief({ projectRoot: "/repo", detail: "full" });
    expect(JSON.stringify(brief)).not.toContain("iOS 27");
    expect(brief.availabilityPolicy).toContain("iOS 26+");
  });
});
