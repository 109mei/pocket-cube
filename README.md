# ポケットキューブ · Pocket Cube

An original, portrait-first 3×3 color cube, built with actual Three.js and TypeScript. No accounts, ads, payments, third-party art, or branded puzzle logos.

## Play

- Grab and drag a colored face. Its layer follows your finger immediately; release to settle to the nearest quarter-turn. Small drags return to the previous state.
- Drag empty space to orbit freely through 360°, including over the top and underside. The small cube icon resets the viewpoint.
- Scramble starts a fresh puzzle; the timer begins with the first turn and pauses while the tab is hidden.
- Undo reverses one committed player move. Reset returns all faces to solved.
- Expand **ボタンで回す** for six reference faces and clockwise/counterclockwise controls. Directions are viewed from outside the selected face.
- Rotation produces an original, quiet sliding sound that follows layer speed, followed by a soft alignment sound. Use **♪** for saved volume/mute settings. Audio starts only after interaction and stops in the background.
- Progress stays in this browser's localStorage. Nothing is sent to a server. Google Fonts is an optional typography request; the app has a system-font fallback.

## Develop

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm test
npm run dev
npm run build
```

Dev server: http://127.0.0.1:5174. Production output: `dist/`. Assets use relative paths so GitHub Pages repository subpaths work.

## Architecture

- `model.ts`: exact 54-sticker integer coordinates/normals; right-handed quarter turns; orientation-independent solved detection.
- `session.ts`: game history, undo and active-play elapsed time.
- `storage.ts`: versioned, bounded replay saves, never renderer serialization.
- `queue.ts`: one atomic animation/commit at a time, maximum eight accepted moves. Face gestures are disabled while busy; helper buttons may queue.
- `input.ts`: pointer/tap helpers.
- `drag.ts`: early layer selection, locked-axis finger tracking and transactional release.
- `projection.ts`: camera-aware rotational velocity at the actual grabbed world point.
- `geometry.ts`: shared compact body/tile dimensions.
- `scene.ts`: testable procedural cubies, face tiles, raycasting, layer pivots and conservative visual bounds.
- `view.ts`: WebGL lifecycle, continuous quaternion orbit, geometry-derived camera fit and animated layer turns. Every completed turn snaps back to exact logical state.
- `audio.ts`: original procedural material sound, bounded motion/settling voices, audio preferences and optional Web Audio lifecycle.
- `main.ts`: accessible DOM controls, dialogs, pointer ownership and lifecycle.

## Deployment

The included GitHub Actions workflow tests, builds, and deploys pushes to `main`. Set the new repository's Pages source to **GitHub Actions**. A workflow file alone does not mean the public site has deployed; verify its workflow run and actual Pages URL.

## Limits

No solver, competitive mode or online accounts. Saves accept at most 10,000 setup and 10,000 player turns, and reject corrupt versions. Physical iPhone performance and Safari require separate device verification. See `docs/verification.md` for measured evidence.

Third-party runtime notices are included in `public/third-party-notices.txt` and copied to the deployed site. No license for the original application source has been selected.
