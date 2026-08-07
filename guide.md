# Animated GIF Gallery Viewer — Guide

Everything the viewer can do, and how to drive it.

---

## 1. What's in this package

```
index.html      The app. Double-click this to run it.
css/            Styling.
js/             The app's code (six small plain-JS files).
icon.ico        Window/tab icon.
promo/          Screenshots, cover and thumbnail art.
readme.md       Overview, license, links.
guide.md        This file.
promo.md        Store copy and marketing notes.
```

There is **no installer and no build step**. The app is a folder of static
files.

## 2. Running it

### Offline (the download)

Unzip anywhere and **double-click `index.html`**. It opens in your default
browser and runs from your disk.

Keep the folder intact — `index.html` needs the `css/` and `js/` folders
sitting next to it.

### Online

Just open the page. Identical behaviour; nothing is uploaded either way.

### Which browsers

**Chrome, Edge, and Firefox** are supported.

**Safari is not** — it doesn't implement the directory-picking API the app
depends on. There's no workaround from this side.

## 3. Opening a folder

Click **Open Folder** and choose a folder. Your browser will ask you to confirm
that you want to let the page read that folder — that's a normal browser
prompt, and the answer stays on your machine.

Every `.gif` file in the folder appears in the grid and starts animating
immediately. Non-GIF files are ignored.

**Subfolders:** tick the *Subfolders* checkbox **before** opening if you want
nested folders included. Changing the tick doesn't re-scan the current folder —
open the folder again for it to take effect.

**To switch folders,** click *Open Folder* again, or press `F5`.

Next to the folder name you'll see how many GIFs are shown. Hover it for a
breakdown: GIF count, contributing subfolders, and total size.

> **Why isn't the full folder path shown?** Browsers deliberately don't tell a
> web page where a folder actually lives on disk. Only the folder's name is
> available. This is a browser security boundary, not a missing feature.

## 4. Browsing the grid

- **Scroll** to move through the collection.
- **Size slider** makes the thumbnails bigger or smaller (100–360px). Bigger
  cells mean fewer GIFs on screen at once.
- **Sort** reorders the grid: name A–Z or Z–A, size small or large first,
  oldest or newest first, or **Shuffle** for a random order.
- **Filter by filename** — type in the search box to show only GIFs whose
  filename contains your text. Press `/` from anywhere to jump into the box,
  and `Esc` to clear it.

Only the GIFs actually on screen are being decoded and animated. That's what
lets the app stay responsive with thousands of files loaded.

## 5. Zooming

**Click any GIF** to open the zoom view.

| Action | Result |
| --- | --- |
| `Scroll` | Scale from 1× up to 20× |
| `Drag` | Pan around when zoomed in |
| `←` `→` | Previous / next GIF |
| `PageUp` / `PageDown` | Previous / next GIF (always, even while paused) |
| `F` | Fullscreen — one GIF fills the whole display |
| `Esc` | Close the zoom view |

The top bar shows the current zoom level, the filename, its position in the
collection, and — while paused — the frame number.

In normal zoom, enlargement is capped at 6× the GIF's natural size so small
GIFs don't turn into unreadable mush. **In fullscreen that cap is lifted**,
because filling the display is the entire point of that mode.

## 6. Pausing and stepping frames

This is the feature the app exists for, and it works properly: a paused GIF
freezes **exactly where it visually was**, not back at frame one.

**To pause one GIF:**
- Hover it and press `Space`, or
- Click the `❚❚` button in the GIF's top-right corner (appears on hover), or
- Press `Space` / click `❚❚` in the zoom bar while zoomed.

**To pause everything:** click **❚❚ Pause all** in the header.

**Stepping frames:** while a GIF is paused *in the zoom view*, `←` and `→` step
one frame backwards and forwards. While it's playing, those same keys move
between GIFs instead. The frame counter in the zoom bar shows where you are.

**Pause all is a default, not a lock.** With everything paused, you can still
un-pause an individual GIF and it will play on its own against the frozen
background. Handy for comparing one animation against a wall of stills.

Paused state is intentionally **not remembered** between sessions — a GIF
mysteriously frozen on next launch just reads as a bug.

## 7. Backdrop colours

The **Backdrop** swatches change the colour drawn behind your GIFs. This only
matters for GIFs with transparency, where it's the fastest way to spot ugly
fringing or leftover matte pixels.

Choose the checkerboard, black, white, or one of the saturated keying colours.
The choice is remembered.

## 8. Favorites

Click the **★** on any GIF (top-right on hover) to star it. Click **★
Favorites** in the header to show only starred GIFs; click it again to show
everything.

Favorites are remembered between sessions, keyed to each file's path within the
folder you opened.

## 9. Every keyboard shortcut

### In the grid

| Key | Does |
| --- | --- |
| `Scroll` | Browse |
| `Click` | Zoom the GIF |
| `Space` | Pause/resume the GIF under the cursor |
| `/` | Jump to the filename filter |
| `Esc` | Clear the filter (when focused) |
| `F5` | Reload, to pick a different folder |

### In the zoom view

| Key | Does |
| --- | --- |
| `Scroll` | Zoom 1–20× |
| `Drag` | Pan |
| `Space` | Pause / resume |
| `←` `→` | Next GIF — or step frames while paused |
| `PageUp` / `PageDown` | Next GIF, always |
| `F` | Fullscreen |
| `F11` | Browser fullscreen |
| `Esc` | Close |

## 10. Performance notes

Tested with **2000 GIFs (5.2 MB total)**: about 1.6 seconds to load, ~10 MB of
JavaScript heap, 1.2s to filter and 1.8s to sort the full set.

If a very large folder does feel sluggish:

- **Drag the size slider down.** Smaller cells are cheaper, but more of them
  are on screen — somewhere in the middle is usually fastest.
- **Use Pause all**, then un-pause just the GIFs you're studying.
- **Filter the list down** rather than scrolling through everything.
- Very large individual GIFs (tens of MB each) are heavier than many small
  ones. The count isn't what costs — the pixels are.

## 11. Troubleshooting

**Nothing happens when I click Open Folder.**
You're most likely in Safari, which doesn't support folder picking. Use Chrome,
Edge, or Firefox.

**The grid is empty after picking a folder.**
The folder has no `.gif` files at the top level. If your GIFs are in nested
folders, tick **Subfolders** and open it again.

**Some files didn't show up.**
Only `.gif` is loaded. Files that are named `.gif` but aren't actually GIFs, or
that are corrupt, are skipped.

**A GIF shows but won't pause.**
Static (single-frame) GIFs have nothing to pause. If an animated one misbehaves
it may use an unusual encoding — please report it with the file if you can.

**Opening `index.html` shows an unstyled page.**
The `css/` and `js/` folders have been moved or left behind. Re-unzip the whole
package and keep it together.

**My favorites disappeared.**
Favorites live in browser local storage. Clearing site data, or using private
browsing, wipes them. They're also per-browser and per-origin, so opening the
app from a different location gives it a different store.

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
