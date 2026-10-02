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

The published GitHub Pages application loads in the cloud Chrome browser. The real app was embedded without mocks at fixed CSS viewport sizes for layout checks.

- 320×568: primary controls fit; with the helper expanded, app height and scroll height are both568px. Measured button targets are at least44×44px and six face buttons are45×44px.
- 390×844: app shell and persistent WebGL recovery display load. Full playable rendering remains blocked as described below.
- 844×390: the first publication had434px of content in a390px viewport. A narrow landscape-only two-column CSS correction has been added; its post-deployment geometry check is pending.
- Startup failure correctly retains a visible reload panel and disables unavailable game actions.

This cloud browser reports its WebGL renderer as Disabled and cannot create a WebGL context. Therefore the cube's actual rendered appearance, browser swipes/orbit/animation and WebGL performance have not been verified. This is a test-environment limitation; no browser security or GPU settings were changed. The recorded unit, scene-graph and controller-port tests do not substitute for those checks.

Physical iPhone / Safari and another WebGL-enabled browser remain unverified. The source and initial GitHub Pages deployment are published; the landscape correction still needs its deployment check.

Additional independent probes covered all 24 whole-cube orientations, 1,000 mixed-layer moves and 114,688 pick rays. A fake-DOM/CubeView-port integration check exercised controller events and committed-state behavior; this is not evidence of browser rendering or browser event ordering.
