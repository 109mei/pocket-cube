# Verification record

## Automated checks

Environment: Node.js 24.19.0, Linux. Date: 2026-10-02.

- `npm test`: 64 passing tests across 6 files.
- `npm run build`: TypeScript type checking and Vite production build pass.
- Exact move-four-times and inverse checks for all 18 signed axis/layer turns.
- 100 seeded 100-move scrambles, replayed backward, restore the exact state.
- Independent right-handed rotation fixture; coordinate, color and sticker uniqueness invariants; globally rotated solved detection.
- Setup/player counts, undo, timer start/stop, invalid deltas and bounded history.
- Save replay, corrupt JSON/version/moves/timers, storage denial and untrusted payload fields.
- Eight-turn serialized queue, overflow and interrupted animation.
- Short/diagonal swipe rejection, projected direction after camera orbit, middle layers, multiple-pointer gating tapped-face selection and screen-aligned direction arrows.
- Actual Three.js scene-graph verification: all 54 sticker transforms after 80 animated/committed turns, pivot membership and cancellation, plastic-border ray occlusion and empty-background selection.

## Independent review

A separate read-only code review examined state correctness, input, persistence and responsive layout. Findings corrected in this revision include plastic-border hit testing, helper selection on face taps, minimum touch target sizes a condensed short-screen layout, screen-aligned direction feedback and durable WebGL recovery with accurate save-failure warnings.

## Browser and device checks

Pending. The available test environment could not launch a browser for local rendering, so screenshots, actual touch interaction, short-screen visual fit and WebGL performance have not yet been verified. Unit and scene-graph tests do not substitute for those checks.

Physical iPhone / Safari behavior and performance remain unverified. GitHub Actions deployment and the public Pages URL also require confirmation after publication.

Additional independent probes covered all 24 whole-cube orientations, 1,000 mixed-layer moves and 114,688 pick rays. A fake-DOM/CubeView-port integration check exercised controller events and committed-state behavior; this is not evidence of browser rendering or browser event ordering.
