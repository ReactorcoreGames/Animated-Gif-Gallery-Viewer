# Animated GIF Gallery Viewer — maintenance notes

Static, client-side web app. Open a local folder, every animated GIF inside it
plays at once in a responsive grid. Ships to GitHub Pages, itch.io, and as a
downloadable zip.

## Running it

Open `index.html` directly in a browser. No build step, no server, no npm.

Scripts are plain `<script>` tags — deliberately **not** ES modules, because
`type="module"` is blocked by CORS over `file://`, which would break the zip
release for anyone who just double-clicks `index.html`. Keep it that way.

## Layout

```
index.html         markup + header structure
css/app.css        all styling
js/settings.js     localStorage, backdrop swatches       -> AGV.settings
js/gifdecoder.js   GIF89a frame decoder                  -> AGV.gif
js/player.js       canvas playback + decode cache        -> AGV.player
js/zoom.js         zoom overlay, fullscreen, frame step  -> AGV.zoom
js/grid.js         grid build, virtualization, pause     -> AGV.grid
js/main.js         wiring, folder load, header controls
```

Modules attach to a global `AGV` namespace and load in dependency order
(settings → gifdecoder → player → zoom → grid → main). `main.js` owns all DOM
wiring; the other files expose functions and don't reach for header elements
themselves.

## Load-bearing behavior

Don't break these without a measurement to justify it:

- **Virtualization** (`grid.js`, IntersectionObserver with a 600px rootMargin).
  Cells outside the viewport have their `<img src>` cleared, which stops decode
  and animation cost. This is what makes thousands of GIFs viable.
- **Lazy blob URLs.** `URL.createObjectURL` is called on first intersection and
  revoked on exit, never up front for the whole folder. Measured on 2000 GIFs:
  ~36 live URLs at rest instead of 2000.
- **Chunked rendering.** Cells append in slices of `CHUNK` (60) via
  `requestIdleCallback`. Measured worst main-thread block during a 2000-GIF
  load: 70ms.
- **Re-render resets per-item state.** `render()` clears `mounted`, `el`, `img`,
  `canvas` and revokes URLs for every item before rebuilding. Skipping this
  leaves stale `mounted: true` flags and rebuilt cells never load their src.

Measured on 2000 GIFs (5.2 MB): 1.6s load, 10 MB JS heap, 1.2s filter, 1.8s
sort.

## Pause implementation — why there is a GIF decoder

An `<img>` playing a GIF cannot be paused at its current frame. `drawImage()` on
an animated `<img>` returns **frame 0**, not what's on screen — verified
empirically, not assumed. `ImageDecoder` would solve it but requires a secure
context, and this app ships as a zip opened over `file://`. So `gifdecoder.js`
parses GIF89a frames directly (~200 lines, no dependency).

A paused cell swaps its `<img>` for a `<canvas>` driven by `AGV.player` from
decoded frames. The starting frame is estimated from `item.shownAt` — elapsed
time modulo total duration — so the GIF stops where it visually was.

Decoding runs **only** for GIFs the user pauses or zooms. Normal grid playback
stays as a plain `<img>`, which is why the 2000-GIF numbers above are unchanged
by the decoder's existence. `AGV.player` caches decoded frames (60 max; frames
are full-size bitmaps).

Paused state is a `Set` of `item.path`, **in-session only and deliberately not
persisted** — a GIF mysteriously frozen on next launch reads as a bug.

`pauseAll` is a *background default*, not a lock: `item.resumedOverride` lets an
individual GIF play while everything else is paused. Always go through
`toggleOne()` / `applyPauseToggle()`, which handle that interaction — don't
call `togglePause()` directly.

`item.path` (from `webkitRelativePath`) is the identity key everywhere, not
`item.name` — subfolders can contain same-named files.

## Zoom overlay

Plays on a canvas (not an `<img>`) so it can pause and step frames. Two things
are easy to break:

- **`refit()` on `resize` and `fullscreenchange`.** Without it the image keeps
  whatever scale it had when the overlay opened — this was a real bug when
  users hit F11 mid-zoom. `fullscreenchange` needs a deferred refit because the
  viewport size settles a frame after the event.
- **`computeFit()` caps enlargement at 6× normally but lifts the cap in
  fullscreen** — filling the display is the whole point of that mode.

Arrow keys are context-dependent: they step *frames* while paused, and *GIFs*
while playing. PageUp/PageDown always change GIF.

## Decisions already settled

Do not re-propose these; they were considered and rejected:

- **Light mode / theme toggle.** The dark charcoal+amber scheme is the design.
- **Web Worker + OffscreenCanvas thumbnail generation, and its IndexedDB
  cache.** Roughly half the project's complexity, and it solved performance by
  *not animating the GIFs*, which defeats the app's premise. The numbers above
  show it isn't needed.
- **File System Access API / `showDirectoryPicker` / "reopen last folder".**
  `webkitdirectory` only — identical behavior on GitHub Pages, itch.io, and a
  local zip, with no sandbox-permission risk inside itch's iframe. Re-picking
  the folder each session is accepted.
- **Alt-click or bare click to pause.** Click is zoom. Pause is the hover-
  revealed corner button, spacebar on the hovered/focused cell, or the pause
  button in the zoom bar.
- **Canvas-capture pause** (`drawImage` on the `<img>`). It always yields frame
  0; see the pause section above.

## Welcome screen

Three columns (`.empty-grid`): the pulsing tile mark plus the feature-tour
button on the left, the pitch and Open Folder in a wider centre, a controls
reference and "good to know" list on the right. It **must fit without scrolling
at 1280×720** — `scratchpad/narrow.js` asserts this at seven viewport sizes.

Decorative layers here are a scrolling hazard: `#empty::before` (the amber pool)
used a fixed 680px height and overflowed a 675px container by 3px, forcing a
scrollbar. It uses `inset: 0` now — keep decoration sized to its container, not
to a magic number.

The feature modal loads `promo/modal.png`. `.modal-box` is a flex column with
the scroll on an inner `.modal-scroll`, so the action buttons stay pinned and
visible however tall the content gets.

## Folder label

`webkitdirectory` exposes only `webkitRelativePath` — the absolute path on disk
is deliberately withheld by browsers. The tooltip therefore reports the folder
name, GIF count, contributing subfolders, and total size, and says plainly that
the full path isn't available. Don't promise the real path; it cannot be had.

## Colour and contrast

Every text colour in `:root` is chosen to clear **WCAG AA (4.5:1)** against the
surface it sits on, and `scratchpad/contrast.js` measures the rendered page to
prove it. If you change a colour, re-run that audit — `--ink-faint` previously
sat at 2.69:1 and failed.

Amber fills use `--on-amber` (dark text), never light text.

## Constraints

- No server component, no framework, no build step.
- No user data leaves the machine.
- `prefers-reduced-motion` applies to UI chrome only — never to the GIFs.

## Release

`RC prompt to make releases easier.md` covers readme/guide/promo/build_release
packaging. `icon-prompt.md` holds the icon generation prompt; `icon.ico` and
`icon_og.jpg` already exist.
