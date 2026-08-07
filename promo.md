# Animated GIF Gallery Viewer — Promo Kit

Store copy, taglines, tags, and launch strategy. Copy-paste ready.

---

## Positioning

**One line:** Open a folder, watch every animated GIF in it play at once.

**The problem it solves:** Windows and macOS have no good way to view a folder
of animated GIFs. Thumbnails are static, viewers show one file at a time, and
finding a specific GIF in a folder of hundreds means clicking through them all.

**Who wants this:** game developers and pixel artists reviewing sprite exports,
animators checking a batch of renders, VFX and motion people, meme and reaction
GIF collectors, archivists, and anyone who has ever kept a folder of a thousand
GIFs and been unable to actually look at it.

**The hook that lands hardest:** *"Everything plays at once."* Lead with that
everywhere. The pause-at-exact-frame feature is the strongest second beat,
because every competing option gets it wrong.

---

## Taglines

Pick per channel; the first is the default.

- See all your animated GIFs at once.
- Your whole GIF folder, playing at once.
- The GIF folder viewer that actually animates.
- Stop clicking through GIFs one at a time.
- A contact sheet, except everything's moving.
- Open a folder. Everything plays.
- Thousands of GIFs. One grid. No waiting.

---

## Short descriptions

**itch.io short description (max ~140 chars):**
Open a folder and every animated GIF inside plays at once in a grid. Zoom,
pause at any frame, handle thousands. Runs locally.

**One-sentence (blurb/newsletter):**
Animated GIF Gallery Viewer is a free, private, browser-based tool that opens
a folder of animated GIFs and plays every one of them at once in a scrollable
grid — with true frame-by-frame pausing and 20× zoom.

**Twitter/X bio-length (under 200 chars):**
Open a folder → every animated GIF plays at once. Zoom, pause at any exact
frame, thousands of files stay smooth. Free, local, no upload.

---

## Long store description (itch.io / GitHub)

## See all your animated GIFs at once

Viewing a folder full of animated GIFs on Windows or macOS is genuinely
miserable. Thumbnails don't move. Viewers show you one file at a time.
Finding the right GIF in a folder of hundreds means opening every one of
them.

**Animated GIF Gallery Viewer fixes that.** Point it at a folder and the
entire collection animates together in one scrollable grid.

## Features

- **Everything animates at once** — the whole folder plays together, no
  clicking through files
- **Built for big folders** — thousands of GIFs stay smooth, because only
  what's on screen is decoded
- **True pause** — freeze any GIF exactly where it is, then step through it
  one frame at a time
- **Zoom and fullscreen** — click to zoom, scroll to scale 1–20×, or let a
  single GIF fill your whole display
- **Transparency backdrops** — swap the colour behind your GIFs to check
  transparent edges
- **Find things fast** — filter by filename, sort by name, size or date,
  shuffle, and star favorites
- **Completely private** — files never leave your machine; no server, no
  upload, no account, no telemetry
- **Runs anywhere** — a folder of static files that works online or straight
  off your disk

## Pausing animation at will

Most tools can't pause an animated GIF at the frame you're actually looking
at — they snap back to frame one, because that's what the browser hands them.
This one decodes GIF frames itself so pausing stops the animation *exactly
where it visually was*, and the arrow keys walk you through it frame by
frame.

## No installation

Unzip and double-click `index.html`, or use the online version. There's no
installer, no runtime, no dependencies, and no account. Works in Chrome,
Edge, and Firefox.


---

## Feature bullets (short form, for graphics and listings)

- Everything plays at once
- Thousands of GIFs, still smooth
- Pause at any exact frame
- Step frame by frame
- Zoom 1–20× and fullscreen
- Transparency backdrops
- Filter, sort, shuffle, favorite
- 100% local, nothing uploaded
- No install, no account
- Free and open source

---

## Tags

**itch.io** (max 10, ordered by value):
```
tool, gif, animation, viewer, gallery, pixel-art, spritesheet, utility,
gamedev, browser
```

**GitHub topics:**
```
gif, gif-viewer, animated-gif, gallery, image-viewer, web-app, javascript,
no-build, client-side, pixel-art, gamedev-tools, vanilla-js
```

**General/other stores:**
```
gif viewer, animated gif, gif gallery, folder viewer, sprite viewer,
animation review, contact sheet, local-first, privacy, offline tool
```

---

## Hashtags

**Primary (gamedev/art crowd — highest signal):**
`#gamedev` `#indiedev` `#pixelart` `#animation` `#gamedevtools` `#spriteart`

**Secondary (tooling/web):**
`#webdev` `#opensource` `#javascript` `#freetools` `#localfirst` `#privacy`

**Community-specific, use where they're actually active:**
`#screenshotsaturday` (Saturdays, gamedev) · `#pixelartsunday` ·
`#MadeWithClaude` if relevant · `#itchio`

Keep it to 3–5 per post. Ten hashtags reads as spam on every platform that
matters.

---

## Where to post

Ordered by expected return.

**Tier 1 — the actual audience**

- **itch.io** (tools section) — the primary home. Free tools get steady organic
  traffic there and it feeds your existing profile.
- **r/gamedev** and **r/IndieDev** — post it as a free tool with a GIF of the
  grid in motion. Read each subreddit's self-promo rules first; both allow it
  with an actual writeup.
- **r/PixelArt** and **r/spritestudio** — frame it around reviewing sprite
  exports.
- **Twitter/X + Bluesky + Mastodon** with a screen recording. Post on
  **#screenshotsaturday**.

**Tier 2 — tool and dev communities**

- **Hacker News** ("Show HN"). The privacy/local-first angle and the
  "no build step, no dependencies" angle both play well there. Post Tue–Thu
  morning US Eastern.
- **Lobste.rs** if you have an account.
- **r/webdev** and **r/javascript** — lead with the technical story (see
  below), not the product pitch.
- **Product Hunt** — worth a launch given it's free and visual.

**Tier 3 — long tail**

- **GitHub** with good topics; the repo is discoverable indefinitely.
- **AlternativeTo** — list it against Windows Photo Viewer and IrfanView.
- **Discord communities** for gamedev, pixel art, and animation. Your own
  Discord first.
- Animation and VFX forums where people review render batches.

---

## Angles that work

Different crowds bite on different framings. Same tool, different lede.

1. **"Windows still can't do this in 2026."** Relatable-annoyance angle.
   Broadest reach, best for Reddit and social.
2. **"You can't pause a GIF in a browser — so I wrote a GIF decoder."** The
   technical war story. This is your Hacker News and r/javascript post.
   `drawImage()` on an animated `<img>` returns frame 0, not what's on screen,
   so a real pause required parsing GIF89a frames directly. That's a genuinely
   interesting detail and developers love that kind of post.
3. **"2000 GIFs, 1.6 seconds."** The performance angle, with numbers. Good for
   dev audiences who assume a page like this would die.
4. **"Nothing is uploaded."** The privacy angle. Increasingly the reason people
   pick a local tool over a web service, and it's fully true here.
5. **"No build step. Six files. Open the HTML."** The anti-framework angle.
   Reliably popular with a certain slice of developers.

---

## Contact

mailto:reactorcoregames@gmail.com

---

Check out everything else I do: ✨🚀

https://linktr.ee/reactorcore

https://reactorcore.itch.io/

-Reactorcore

---

My other links:
Home/Links: https://linktr.ee/reactorcore
Releases: https://reactorcore.itch.io
Blog: https://www.patreon.com/ReactorcoreGames
Discord: https://discord.gg/UdRavGhj47
Catalog: https://reactorcoregames.github.io/

---

Made by Reactorcore — https://linktr.ee/reactorcore
