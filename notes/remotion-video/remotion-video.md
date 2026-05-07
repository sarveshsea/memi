---
name: Remotion Video
description: Current Remotion production guidance for Studio-generated videos
category: generate
activateOn: motion-video
freedomLevel: high
version: 0.1.0
tags:
  - remotion
  - video
  - react
---

# Remotion Video

Use this Note when the output should be a React-coded video project. Prefer a
real Remotion scaffold over static storyboard prose when Studio is asked to
preview, render, or hand off a video.

## Current Workflow

1. Create a project with `package.json`, `remotion.config.ts`, `src/index.ts`,
   `src/Root.tsx`, and a storyboard module.
2. Preview with `npx remotion studio src/index.ts`.
3. Render with `npx remotion render src/index.ts <composition-id> <output>`.
4. For backend rendering, use Remotion's renderer APIs only after the project
   has a stable composition id, width, height, fps, duration, and props schema.

## Scaffold Rules

- Keep the default composition id stable: `MemoireVideo`.
- Store generated projects under `.memoire/videos/<id>`.
- Put the render output under `.memoire/videos/<id>/dist/<id>.mp4`.
- Use React and Remotion primitives for timeline logic; avoid ad hoc DOM timers.
- Include `prefers-reduced-motion` or low-motion alternates when the output will
  also be embedded in the Studio UI.

## Quality Bar

- Every scene has a purpose: hook, proof, product action, result, CTA.
- Use transform and opacity for core motion.
- Reserve camera-like motion for product explanation, not decoration.
- Verify text fits 16:9 and 9:16 crops before rendering social variants.
