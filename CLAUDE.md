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

- **Virtualization** (`grid.js`, IntersectionObserver with a preload margin).
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
- **Grid `<img>` elements must not carry `loading="lazy"`.** The observer
  already does strictly more than the browser's lazy-load, and in Chromium the
  two interact badly: an image whose `src` is removed and later re-set — which
  is exactly what unmount/mount does when you scroll past a cell and back —
  can stay stuck in a deferred state and never load. Symptom was "scroll down
  fine, scroll back up and the cells stay blank until something forces a full
  re-render." Chromium only; Firefox was unaffected.
- **`mount()` removes the `src` attribute before assigning the new blob URL**,
  for the same family of reason — the slot still holds an already-revoked URL.
- **The IntersectionObserver observes the `.cell`, never the `<img>`, and uses
  `threshold: 0`.** Both halves matter and both are about zero-area targets: an
  `<img>` whose `src` was cleared can collapse to a zero-size box, and a
  fractional threshold asks whether a percentage of the target's *area* is
  visible — unanswerable for a zero-area element, so it never fires again and
  the cell stays striped in `pending` forever. `.cell` has `aspect-ratio` so it
  always has a real box, and `threshold: 0` means "any overlap", which is
  area-independent. `content-visibility: auto` on `.cell` makes the zero-area
  case easier to hit by skipping layout for off-screen cells, so if blank
  striped rows ever come back under fast scrolling, drop `content-visibility`
  first to confirm before touching the observer.
- **Image `load`/`error` handlers are generation-guarded (`item.loadGen` vs
  `img.__agvGen`).** `unmount()` revokes the blob URL, so every load still in
  flight fails — an error that says nothing about the file. Without the guard
  those failures reach `markBroken()`, and hard scrolling turns the whole grid
  into red "unreadable" cells (seen in Firefox). `mount()` bumps the generation
  and stamps the img; a mismatched event is discarded outright.
- **`mount()` is idempotent and must not early-return on `item.mounted`.** The
  IntersectionObserver batches and coalesces: scroll fast enough and a cell
  enters, leaves and re-enters between two callbacks, so the observer reports
  only the net state. A flag-guarded `mount()` then bails while the `<img>` has
  no src, and the row stays blank until a re-render. It reconciles against the
  DOM instead — cheap, because the "already correct" case returns immediately.
  Symptom was blank rows that appeared only under fast/jerky scrolling.
- **A failed image load gets one retry before `markBroken()`.** `broken` does
  not only mean "bad GIF" — a blob URL revoked while its load is still in
  flight produces "Image corrupt or truncated" too, and a backgrounded tab
  resuming a pile of stalled loads triggers it in bulk. Without the retry, one
  tab switch permanently blanks good thumbnails (clicking still worked, since
  the zoom overlay mints its own URL via `urlFor()` and ignores `broken`).
  `render()` also clears `broken`/`retriedLoad` so a rebuild is a clean slate.

Measured on 2000 GIFs (5.2 MB): 1.6s load, 10 MB JS heap, 1.2s filter, 1.8s
sort.

## Playback cost is pixels per second, not file count

The intuition that "more GIFs = slower" is wrong and misleads bug reports. The
browser's per-frame cost is roughly *area × frame rate × how much of each frame
actually changes*, so one unoptimised 1000×1000 GIF with full-frame disposal at
20fps can cost more than a hundred optimised 400×300 ones. A user reporting
stutter on 70 GIFs while a 1393-GIF folder runs smooth here is not a
contradiction — their GIFs are doing more work each. Ask for dimensions, frame
rate and whether the files went through an optimiser before assuming hardware.

Two mechanisms bound that cost:

- **`content-visibility: auto` + `contain-intrinsic-size` on `.cell`** — lets
  the engine skip rendering for off-screen cells. Complements the observer
  (which stops *decode*) rather than duplicating it. Safe only because cells
  have an intrinsic size, so skipped cells still reserve correct space.
- **Preload margin scales with cell size** (`preloadMargin()`). The old fixed
  600px was ~3 rows at the default 200px cell but far fewer at 360px; scaling
  keeps the number of preloaded rows, and so the animation cost, constant.
  `render()` rebuilds the observer rather than just disconnecting it, so a size
  change actually takes effect.

Beyond these, some stutter when fully zoomed out on a large monitor is expected
and is not a bug to engineer around — the zoom slider is the user's control for
how much animation is on screen at once.

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
- **A "max GIFs animating at once" cap.** Built and reverted. It fails twice
  over. Conceptually it solves stutter by *not animating the GIFs*, which is
  the same objection that killed the thumbnail worker — seeing everything move
  at once is the product. Mechanically it was worse: driving the cap from
  scroll meant `freeze()` ran on dozens of cells at once, and `freeze()`
  decodes a whole GIF to full-size bitmaps. With a large folder that exhausts
  memory and kills the tab (reproduced in Firefox). The decoder is for one GIF
  at a time, on deliberate user action. Some stutter when fully zoomed out on a
  large monitor is expected and acceptable; the zoom slider is already the
  user's control for it.

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
