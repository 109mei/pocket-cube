# Verification record

## Automated checks

Environment: Node.js 24.19.0, Linux. Date: 2026-10-02.

- `npm test`: 96 passing unit/scene/projection/camera/audio tests across10 files, plus6 controller integration scenarios and108 actual scene/view animation cases.
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

## Device-feedback framing and spacing correction

A real-device screenshot supplied by the tester revealed cube clipping despite the app shell fitting its DOM viewport. The earlier layout checks were insufficient: a fitted canvas does not guarantee its projected 3D content fits. A new regression measured the old geometry bounds as far as1.2986 normalized screen coordinates, outside the visible limit of1.0.

Camera fit now uses a conservative sphere derived from actual mesh bounding-box corners. Because layer pivots rotate around the origin, their radial bounds remain valid at all partial angles. The camera uses the tighter vertical/horizontal field of view with pixel padding and perspective depth. Tests project4,147,200 mesh-bound corners over six viewport shapes,24 orbit poses,all nine layers and five partial angles, checking both frame edges and near/far depth. Near/far planes enclose the same swept sphere closely; an additional16-bit depth-precision regression keeps thin sticker/body surfaces separated in narrow viewports.

The orbit camera now composes normalized screen-relative quaternions, with a full vertical-circle regression crossing both former pole limits, continuity checks at each step, and5,000 mixed movements followed by exact home reset. Body seams were reduced from approximately0.057 to0.018 scene units; larger tiles reduce dark borders while their front surfaces remain slightly above the bodies. Existing exact logical-state and animation checks use the new shared render dimensions.

The mobile layout uses a compact title/status row and one-row primary controls, retaining44px touch targets. It uses visualViewport height when unzoomed and dynamic viewport CSS as fallback. Tests cover viewport-resize cancellation without committing a held layer and preserving layout size during browser zoom.

These geometry/controller checks pass without claiming a WebGL-rendered browser or physical-device retest. Post-deployment responsive layout and the user's Safari interaction/appearance check remain separate acceptance steps. Private tester screenshots are not included in the repository.

## Rotation-motion sound

Original procedural colored noise supplies a single looping friction voice driven by smoothed layer angular speed, with a scheduled fade when the finger stops. A short, soft-envelope material sound accompanies successful alignment, rather than a click on every pointer event. Cancellation, small-drag rollback, camera orbit, rejected moves and failed animations do not emit an alignment sound. Animation progress and drag previews share the same motion feedback adapter.

Audio is lazy: no AudioContext is constructed before interaction. Saved mute and volume are validated separately from cube saves; missing or denied Web Audio/storage remains nonfatal. Hidden-page suspension discards stale tails; pagehide closes audio and releases a held pointer; a subsequent user gesture can safely recreate the context. Resume races and failures are tested. Repeated stationary samples obey the same automation rate cap; an explicit stop still fades immediately. Defaults are deliberately quiet, with master gain capped at0.18. Motion gain is bounded at0.8, friction PCM peak at0.5, automation at90Hz, and alignment creation at12.5Hz with no more than two finite accents. These are software limits, not measured device loudness.

Eighteen unit tests exercise generated PCM bounds/smoothness, lazy unlock, rate limits, stillness fade, mute/volume persistence, hide/close/recreate, resume races, invalid settings and unavailable APIs. Controller-port checks cover motion before release and silence for cancellation/noop paths; actual CubeView animation methods report angular progress. The production build separates the stable Three.js vendor chunk for caching.

No subjective sound-quality or real-device listening claim is made. Safari audio unlock, perceived softness and the user's preferred level require a device audition. No external sound assets, paid services or audio telemetry are used.

## Touch audio activation correction

A tester reported silence while the current sound dialog visibly showed sound enabled at100%. That excludes an old interface or app-mute setting in that supplied screenshot, but does not establish the device's audio route or browser engine state.

Two deterministic regressions reproduced a genuine code failure chain: the initial touch-down attempted audio before the platform's eligible touch-release activation, and a pending resume promise then suppressed every later retry, including a valid sound-settings click. The correction unlocks touch/pen input synchronously on release, retains mouse-down activation, and permits a fresh real-gesture retry while ignoring stale same-context completion/rejection callbacks. Cancellation does not unlock. These behaviors follow the [HTML activation-event model](https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event) and [Web Audio pending-resume rules](https://www.w3.org/TR/webaudio/#dom-audiocontext-resume).

The existing sound dialog now offers an explicit **音を開始・試聴** action and reports idle/waiting/running/paused/muted/unavailable engine state. Its short audition uses the same bounded material voice without requiring WebGL or a cube move. Saved volume, including100%, and the existing low master-gain limit are preserved. No OS audio category, silent-switch behavior or device security setting is changed. Engine-running status is not a claim that speakers produced audible sound.

Five added unit regressions cover pending activation retry, stale same-context rejection, bounded independent audition/status and preserving100% settings and canceling an audition if its dialog closes before audio resume completes. Controller checks cover touch/pen release, canceled gestures and audition with WebGL unavailable. The user-specific silence is not declared resolved until playback is confirmed on that device.


## Ordinary-touch activation and plastic-material revision

The device tester subsequently confirmed that rotation sound was audible after opening the sound settings. This confirms a working audio output on that device but exposes an ordinary-touch activation gap. A direct, trusted native `touchend` handler now retries activation independently of the pointer gesture, which may already have ended and started its settle animation; a trusted canvas tap also retries. The primary native-touch ID is tracked separately, a secondary finger cannot trigger it, and secondary-only cancellation preserves the primary touch. True interruption clears it, while a normal small-drag rollback retains the eligible release. These listeners only unlock audio and cannot create turns or alignment accents. Actual Safari touch-only activation still requires a device retest; synthetic controller ports do not prove native browser policy.

The procedural texture now uses short, irregular filtered-noise contact clusters above a quiet rubbing bed, with a bounded0.55–1.5× loop rate linked to angular speed. Alignment is a75ms pair of damped noise contacts; the previous low pitched carrier is removed. Master gain, user volume, event/voice limits, cancellation silence and hidden-page behavior remain unchanged. Tests check clustered energy, finite/zero-ended samples, shorter alignment duration, and speed-linked bounded rate. An independent scan over24 seeds and8/44.1/48/96kHz found friction peaks at0.5 and detent peaks no higher than0.087853, with zero endpoints; these are PCM properties, not a subjective listening verdict.

Controller regressions cover native touchend without click, pointerup→touchend→click while a settle is busy, primary/secondary touch cancellation, synthetic-event rejection, and stale releases after pointercancel/capture loss/resize/blur/visibility changes. The revised timbre's realism and first ordinary-touch activation remain device acceptance checks.

An additional integration scenario runs the real controller and MotionAudio together, replacing only DOM/view/native-AudioContext boundaries. It deliberately keeps the pointerup resume pending, then allows the following touchend while the settle queue is busy. It verifies that the same context reaches running, generated PCM is nonzero, all four graph connections reach the destination, and the extra click still results in exactly one commit and one alignment. This scenario is included in CI and does not emulate native Safari activation rules.
