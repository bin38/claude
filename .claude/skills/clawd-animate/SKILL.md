---
name: clawd-animate
description: Make a short hand-painted cartoon video (Clawd, Sprout or any character) with the Claude Animation Lite kit - storyboard, build shot by shot in JS, check contact sheets, render an MP4 on the CPU. Use when the user asks for an animation, animated video, clip, cartoon, GIF or loop, or for new characters, emotions, costumes or props for the kit.
---

# Clawd animation

This kit paints 2D cartoons in code: `src/core.js` (painting, timing, camera, light), `src/clawd.js` and
`src/sprout.js` (the characters), `src/timeline.js` (shots and transitions), and your scenes in `src/scenes/`.
Every frame is a pure function of time. `ANIMATION_GUIDE.md` holds the rules, the workflow and the full API.
It renders in Node on the CPU (about 0.1 s per 1080p frame): no Chrome, no GPU.

## 0. Find or make the project

- If the working directory has `ANIMATION_GUIDE.md` and `src/core.js`, work there (run `npm install` once).
- Otherwise start one from the kit: `node <kit>/new.mjs <folder> --duration=<s>`, then `npm install` in it.
  With no kit on disk, clone it first: `git clone https://github.com/bin38/claude`.
- The user may name a length, a tempo or a song. Put them in `src/config.js` (`duration`, `bpm`, `offset`, `audio`).

## 1. Read the guide

Read `ANIMATION_GUIDE.md` in full before writing any scene code, and look at the model sheets in `docs/`
(`emotions.jpg`, `views.jpg`, `sprout.jpg`, `sprout_emotions.jpg`). The user decides what the video is about; the
guide decides how it's made.

## 2. Storyboard, then build

Write `STORYBOARD.md` in the guide's format (logline, world, motif, arc, shots with reads and timing). If the user is
around, show it and wait for a reaction. Then build one shot at a time in `src/scenes/*.js`, listed in `studio.html`.

## 3. Look at every shot

```bash
node render.mjs --sheet=0.5,1.2,2.0,2.8 --cols=4 --w=480 --out=out/check/sheet.jpg   # the shape of a shot
node render.mjs --strip=2.1:2.6 --cols=6 --w=320 --out=out/check/strip.jpg          # every frame of a move
node render.mjs --sheet=2.3 --crop=760,420,500,400 --w=500 --out=out/check/face.jpg  # detail
node render.mjs --strip=2.1:2.6 --crop-at=960,700,500,400 --out=out/check/hand.jpg   # detail that follows the camera
```

Open each image with the Read tool and check it against the guide's review list (reads, timing, motion, boil,
contacts, transitions, no text, no 3D). Fix and look again.

## 4. Render

- `node render.mjs --clip --out=out/video.mp4` renders in parallel on all cores (12 s of 1080p in about 20 s on
  4 cores). Add `--audio=<file>` for music.
- Sound: if the user wants music or effects, score the scene in code (`window.SOUND`, see "Sound from code" in the
  guide and `src/scenes/overtime.js`); `--clip` synthesises and muxes it. Check it with a spectrogram and levels.
- Tell the user where the video is, and what you checked.

## New characters

Follow `src/sprout.js`: take the same options object as `clawd()` so every helper drives the new character, reuse the
shared face system (`eyes()`, `mouth()`, `blush()`, `emote()`) through a transform, colour the body with
`bodyCols(o, base)`, give it its own key views, and add model-sheet loops to `src/sheets.js`. Design it to contrast
with the cast in silhouette, colour and the way it moves.

## Notes

- `runtime/p5lite.js` stands in for p5 + p5.brush on Canvas2D and covers everything the engine uses. If a scene calls
  another p5 function directly (`ellipse`, `noise`, ...), paint it with `paint()`/`inkLine()` instead, as the guide
  says, or add the function to `p5lite.js`.
- `studio.html` scrubs the video in any browser; `studio.html?brush` swaps in the real p5.brush (wants a GPU).
- `node render.mjs --scene=src/scenes/demo.js --duration=11` renders a scene other than the one studio.html lists.
