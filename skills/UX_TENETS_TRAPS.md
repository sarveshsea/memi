---
name: ux-tenets-traps
description: Audit UX tenets and traps across code, screenshots, Figma, and Studio review packets
user-invocable: true
model: opus
effort: high
context:
  - skills/FIGMA_AUDIT.md
---

# UX Tenets and Traps

Use this skill whenever a design or app screen needs critique, triage, or a fix plan.

Tenets are the qualities to protect:

| Tenet | Protects |
|-------|----------|
| Clarity | Hierarchy, labels, visible next action |
| Feedback | Loading, success, failure, progress, receipts |
| Control | Undo, cancel, confirmation, manual override |
| Consistency | Tokens, variants, layout rhythm, copy patterns |
| Accessibility | Keyboard, screen reader, contrast, labels, motion |
| Error Recovery | Specific errors, retry paths, preserved work |
| Progressive Disclosure | Complexity appears after intent |
| Workflow Fit | Density, grouping, cadence, responsive behavior |
| Trust | Evidence, permissions, consequences, audit trail |
| State Continuity | Context, drafts, navigation, background progress |

Traps are the recurring failure modes to detect:

| Trap | Typical fix |
|------|-------------|
| Ambiguous affordance | Clarify action hierarchy, states, labels, and focus behavior |
| Missing state | Add loading, empty, error, disabled, focus, selected, and success states |
| Silent system | Add progress, status copy, receipts, and failure reasons |
| Choice overload | Group choices and reveal advanced controls after intent |
| Layout instability | Add responsive constraints, stable dimensions, and overflow rules |
| Token drift | Promote one-off values into semantic tokens and component variants |
| Inaccessible interaction | Patch semantics, focus, labels, alternatives, contrast, and motion |
| Copy theater | Replace vague or decorative copy with task-specific language |
| Context leak | Preserve project, selection, permission, and history context |
| Destructive default | Guard risky actions and make consequence/recovery explicit |

## Workflow

1. Gather evidence from code, screenshot, Figma frame, review packet, or Studio artifact.
2. Score tenet coverage before proposing visual polish.
3. Map every finding to at least one tenet and one trap.
4. Recommend the smallest tweak that protects the tenet and removes the trap.
5. Verify with screenshot or code evidence after the tweak.

## Output Shape

Return findings in this structure when possible:

```json
{
  "ux": {
    "score": 82,
    "tenetCoverage": [],
    "trapRisks": [],
    "findings": [],
    "recommendedTweaks": []
  }
}
```

Use `memi ux audit --json` for a focused JSON report, or inspect the `ux` field in `memi diagnose --json` and `memi fix plan --json`.
