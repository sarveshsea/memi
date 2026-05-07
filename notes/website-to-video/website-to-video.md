---
name: Website To Video
description: Convert product pages and browser flows into video-ready scenes
category: generate
activateOn: motion-video
freedomLevel: high
version: 0.1.0
tags:
  - website-capture
  - product-demo
  - video
---

# Website To Video

Use this Note when Studio needs to turn a website, app route, or browser flow
into a video. The output should be a storyboard plus a runnable Remotion or
Hyperframes project, not a pile of screenshots.

## Workflow

1. Capture the target route state, dimensions, and critical interactions.
2. Choose Hyperframes for static/HTML explainers and Remotion for timeline-heavy
   React composition.
3. Create scene beats: first impression, interaction proof, outcome, CTA.
4. Store source URLs and captured assets in the video project folder.
5. Prepare preview/render commands and a download path for the rendered artifact.

## Capture Rules

- Record the exact URL, viewport, and feature state used for every scene.
- Avoid dark blurred atmospheric captures when the product UI needs inspection.
- Crop only after preserving an uncropped source artifact.
- Use local screenshots/assets for render determinism when possible.
