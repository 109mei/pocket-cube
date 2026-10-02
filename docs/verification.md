# Verification record

## Automated checks

Environment: Node.js 24.19.0, Linux. Date: 2026-10-02.

- `npm test`: 73 passing unit/scene/projection tests across8 files, plus5 controller integration scenarios and108 actual scene/view animation cases.
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
- 844×390: the first publication had434px of content in a390px viewport. The narrow landscape-only two-column correction was then verified in the published app: app height and scroll height are both390px, with controls collapsed or expanded.
- Startup failure correctly retains a visible reload panel and disables unavailable game actions.

This cloud browser reports its WebGL renderer as Disabled and cannot create a WebGL context. Therefore the cube's actual rendered appearance, browser swipes/orbit/animation and WebGL performance have not been verified. This is a test-environment limitation; no browser security or GPU settings were changed. The recorded unit, scene-graph and controller-port tests do not substitute for those checks.

Physical iPhone / Safari and another WebGL-enabled browser remain unverified. The source and GitHub Pages deployment are published. The landscape fix was checked on the deployed stylesheet.

Additional independent probes covered all 24 whole-cube orientations, 1,000 mixed-layer moves and 114,688 pick rays. A fake-DOM/CubeView-port integration check exercised controller events and committed-state behavior; this is not evidence of browser rendering or browser event ordering.

## Direct-manipulation revision

Finger tracking now acquires a layer after4px of movement, locks the selected axis, previews a proportional partial rotation before release, and settles from the held angle, with duration proportional to the remaining angle and no extra wait when the target is already reached. Small/canceled drags do not change history or saved logical state. The play surface suppresses selection and callouts; the direction/angle overlay has been removed.

New unit tests cover early acquisition, diagonal intent inference, proportional/reversed drags, stable axes, camera-dependent scale, release/cancel thresholds and no-jump settling. An independent mathematical audit covered168 camera poses,18,144 actual grab points,72,496 signed direction checks and500 preview/commit cycles. The projected derivative's maximum relative error against a central-difference oracle was0.00002546.56 near-collinear projection cases were excluded from the chosen-axis oracle as inherently ambiguous.

The revised actual finger-following appearance and iPhone long-press behavior still require a WebGL-enabled device; the cloud browser's WebGL limitation remains.

The committed portable controller suite runs through `npm test` and CI. It checks continuous preview before release, axis reversal, small drags, all cancellation paths, secondary-pointer isolation, control gating, queue capacity, undo, committed-only saves, background timer, context loss while holding/settling, recovery, move limits and unavailable/denied storage. It uses explicitly fake DOM and renderer ports and does not claim rendered browser validation.

`tests/view-animation.mjs` additionally checks actual CubeView animation methods across54 signed layer/held-angle combinations and54 canceled settles. It verifies exact world transforms, no zero-pose jump on release, zero animation frames for an already-reached target, and reduced-motion behavior using a controlled frame clock without a WebGL context.

Independent revision review found and closed three transaction/input edges: rejected moves now clear held previews at the history limit; already-reached snap targets incur no extra animation delay; context loss immediately clears pointer capture and prevents stale input from restoring a preview. Helper expansion is gated during manipulation, and playfield resizing cancels a held drag before the camera projection changes. Final independent review reports no unresolved material code/transaction finding; real device interaction remains the acceptance limitation above.
