---
name: Hyperframes Video
description: HTML-first Hyperframes production guidance for Studio video projects
category: generate
activateOn: motion-video
freedomLevel: high
version: 0.1.0
tags:
  - hyperframes
  - html-video
  - rendering
---

# Hyperframes Video

Use this Note when the video can be expressed as a deterministic HTML scene.
Hyperframes is the lighter path for product cards, marketing loops, website
captures, and simple composited explainers.

## Current Workflow

1. Generate `index.html` and `hyperframes.json` in `.memoire/videos/<id>`.
2. Preview with `npx hyperframes preview .` from the project folder, or pass the
   folder explicitly from Studio.
3. Lint with `npx hyperframes lint .` before rendering when the command is
   available.
4. Render with `npx hyperframes render . --output dist/<id>.mp4`.

## Scaffold Rules

- Keep all external assets local to the project folder or explicit URLs.
- Prefer CSS keyframes and deterministic layout over runtime mutation.
- Store render outputs in `dist/` and keep `hyperframes.json` as the command
  contract Studio can inspect.
- Use `@hyperframes/core` or `@hyperframes/producer` for programmatic validation
  and rendering once the sidecar grows beyond command preparation.

## Quality Bar

- Use fixed dimensions, fps, and duration in config.
- Avoid layout shifts between preview and render.
- Keep colors/tokens aligned with the source product rather than inventing a
  separate video theme.
