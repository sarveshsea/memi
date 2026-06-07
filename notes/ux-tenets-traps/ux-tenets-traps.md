---
name: UX Tenets and Traps
description: >
  Product-quality critique framework that protects positive UX tenets and detects recurring UX traps.
activateOn: design-review
freedomLevel: read-only
category: craft
tags:
  - ux
  - design-review
  - app-quality
  - critique
---

# UX Tenets and Traps

Tenets are the qualities the product must protect: clarity, feedback, control, consistency, accessibility, error recovery, progressive disclosure, workflow fit, trust, and state continuity.

Traps are recurring UX failure modes: ambiguous affordance, missing state, silent system, choice overload, layout instability, token drift, inaccessible interaction, copy theater, context leak, and destructive default.

## Review Method

1. Start from evidence, not taste: code signals, screenshot artifacts, Figma nodes, user flow notes, or Studio review packets.
2. Name the tenet at risk.
3. Name the trap that caused the risk.
4. Recommend a small tweak that preserves the user's workflow.
5. Verify the tweak with a screenshot, code diff, or receipt.

## Finding Format

```md
- Tenet: Clarity
- Trap: Ambiguous affordance
- Evidence: Secondary action reads visually stronger than the primary action.
- Tweak: Demote secondary styling, strengthen the primary label, and preserve focus-visible styling.
```

Prefer specific tweaks over broad redesign language. Avoid explanatory panels in the UI unless the product already uses them.
