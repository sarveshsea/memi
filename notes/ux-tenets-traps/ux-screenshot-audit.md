---
name: UX Screenshot Audit
description: >
  Screenshot-based workflow for auditing visible screens against UX tenets and traps.
activateOn: design-review
freedomLevel: read-only
category: craft
tags:
  - ux
  - screenshot
  - audit
  - studio
---

# UX Screenshot Audit

Use this workflow for `ux.audit_screenshot`, Tauri "Critique screen", browser screenshots, and Figma frame captures.

## Steps

1. Attach the screenshot artifact path to the review session.
2. Check the first viewport for hierarchy, primary action, persistent context, and obvious state.
3. Check interaction states: loading, empty, error, disabled, focus, selected, and success.
4. Check traps: ambiguous affordance, missing state, silent system, choice overload, layout instability, token drift, inaccessible interaction, copy theater, context leak, destructive default.
5. Produce prioritized tweaks with evidence and verification steps.

## Output

Return concise findings:

```json
{
  "ux": {
    "score": 76,
    "trapRisks": [{ "trapId": "missing-state", "status": "present" }],
    "recommendedTweaks": ["Add a visible receipt after capture completes."]
  }
}
```

In Studio, surface the screenshot evidence, tenet coverage, trap hits, and next tweaks through the review packet, creation strip, artifact cards, and receipts.
