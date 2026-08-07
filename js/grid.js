/* grid.js — grid construction, chunked rendering, viewport virtualization,
   lazy blob URLs, and per-GIF pause. Exposes window.AGV.grid. */

window.AGV = window.AGV || {};

AGV.grid = (function () {
  'use strict';

  var gridEl, wrapEl;

  /* Every loaded file, in load order. Each entry:
     { file, name, path, size, mtime, url, cell, img, canvas, el } */
  var items = [];
  /* The subset currently rendered, in display order. */
  var visible = [];

  var pausedNames = new Set();   /* in-session only, deliberately not persisted */
  var pauseAll = false;
  var hovered = null;            /* cell under the mouse, for spacebar targeting */
  var io = null;
  var renderToken = 0;           /* invalidates in-flight chunked renders */
  var onOpenZoom = null;

  var CHUNK = 60;                /* cells appended per idle slice */

  var idle = window.requestIdleCallback || function (cb) {
    return setTimeout(function () { cb({ timeRemaining: function () { return 8; } }); }, 16);
  };

  function init(opts) {
    gridEl = opts.gridEl;
    wrapEl = opts.wrapEl;
    onOpenZoom = opts.onOpenZoom;
    buildObserver();
  }

  /* ---------- virtualization ----------
     Cells outside the viewport (plus a preload margin) get their <img src>
     cleared, which stops decode and animation cost. Blob URLs are created on
     first entry and revoked on exit, so a huge folder never holds thousands of
     live object URLs at once. */

  function buildObserver() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var item = entry.target.__agvItem;
        if (!item) return;
        if (entry.isIntersecting) mount(item);
        else unmount(item);
      });
    }, {
      root: wrapEl,
      rootMargin: '600px 0px 600px 0px',
      threshold: 0.01
    });
  }

  function mount(item) {
    if (item.mounted) return;
    item.mounted = true;

    /* A paused cell re-entering the viewport is restored straight from decoded
       frames — no <img> load needed, and it keeps the frame it was paused on. */
    if (pausedState(item)) {
      item.el.classList.remove('pending');
      if (item.canvas && item.player && item.player.hasFrames()) {
        item.canvas.style.display = 'block';
        item.img.style.display = 'none';
        return;
      }
      freeze(item);
      return;
    }

    if (!item.url) {
      try {
        item.url = URL.createObjectURL(item.file);
      } catch (e) {
        markBroken(item);
        return;
      }
    }
    item.img.src = item.url;
    item.shownAt = performance.now();
    item.el.classList.remove('pending');
  }

  function unmount(item) {
    if (!item.mounted) return;
    item.mounted = false;

    if (pausedState(item)) return;   /* keep the frozen frame as-is */

    if (item.img.getAttribute('src')) item.img.removeAttribute('src');
    if (item.url) {
      URL.revokeObjectURL(item.url);
      item.url = null;
    }
    if (!item.broken) item.el.classList.add('pending');
  }

  function markBroken(item) {
    item.broken = true;
    if (!item.el) return;
    item.el.classList.remove('pending');
    item.el.classList.add('broken');
    item.img.style.display = 'none';
    if (item.canvas) item.canvas.style.display = 'none';
  }

  /* ---------- pause ----------
     A plain <img> can't be paused at its current frame, so a paused cell swaps
     to a canvas driven by AGV.player from decoded frames. The canvas is seeded
     at the frame the <img> had reached (estimated from elapsed time), so the
     GIF appears to stop where it was rather than snapping back to frame 0. */

  function isPaused(item) { return pauseAll || pausedNames.has(item.path); }

  /* Freezes a cell. Async because the GIF may need decoding first. */
  function freeze(item) {
    if (!item.el || item.broken) return Promise.resolve(false);

    /* Estimate which frame the <img> is showing: GIFs loop, so elapsed time
       since the src was set, modulo the total duration, lands on a frame. */
    var elapsed = item.shownAt ? (performance.now() - item.shownAt) : 0;

    return AGV.player.decodeFor(item).then(function (decoded) {
      if (!pausedNames.has(item.path) && !pauseAll) return false;   /* resumed meanwhile */
      if (!item.el) return false;

      var total = 0, i;
      for (i = 0; i < decoded.frames.length; i++) total += decoded.frames[i].delay;
      var into = total ? (elapsed % total) : 0;
      var at = 0, acc = 0;
      for (i = 0; i < decoded.frames.length; i++) {
        acc += decoded.frames[i].delay;
        if (into < acc) { at = i; break; }
      }

      var c = item.canvas;
      if (!c) {
        c = document.createElement('canvas');
        item.canvas = c;
      }
      if (!c.parentNode) item.el.insertBefore(c, item.img);

      if (!item.player) item.player = AGV.player.create(c);
      item.player.load(decoded, at);
      item.player.pause();

      item.img.style.display = 'none';
      c.style.display = 'block';

      /* Stop the <img> decoding now that the canvas is showing the frame. */
      item.img.removeAttribute('src');
      if (item.url) { URL.revokeObjectURL(item.url); item.url = null; }
      return true;
    }).catch(function () {
      /* Undecodable — fall back to leaving it playing rather than blanking. */
      pausedNames.delete(item.path);
      if (item.el) item.el.classList.remove('paused');
      return false;
    });
  }

  function thaw(item) {
    if (!item.el) return;
    if (item.player) { item.player.pause(); }
    if (item.canvas) item.canvas.style.display = 'none';
    if (item.broken) return;
    item.img.style.display = 'block';
    if (item.mounted) {
      if (!item.url) {
        try { item.url = URL.createObjectURL(item.file); }
        catch (e) { markBroken(item); return; }
      }
      item.img.src = item.url;
      item.shownAt = performance.now();
    }
  }

  /* Steps a paused cell one frame. No-op if it isn't paused. */
  function stepFrame(item, delta) {
    if (!item.player || !item.player.hasFrames()) return false;
    if (!isPaused(item)) return false;
    item.player.step(delta);
    return true;
  }

  function togglePause(item) {
    if (pausedNames.has(item.path)) {
      pausedNames.delete(item.path);
      item.el.classList.remove('paused');
      thaw(item);
      return false;
    }
    pausedNames.add(item.path);
    item.el.classList.add('paused');
    freeze(item);
    return true;
  }

  /* Pause-all is a background default: a per-GIF choice overrides it, so
     pausing or resuming one GIF always works regardless of the global state. */
  function setPauseAll(on) {
    pauseAll = on;
    if (on) {
      /* Anything individually resumed while pause-all is on stays playing. */
      visible.forEach(function (item) {
        if (item.resumedOverride) return;
        item.el.classList.add('paused');
        if (item.mounted) freeze(item);
      });
    } else {
      visible.forEach(function (item) {
        item.resumedOverride = false;
        var still = pausedNames.has(item.path);
        item.el.classList.toggle('paused', still);
        if (!still) thaw(item);
      });
    }
    return pauseAll;
  }

  /* The single entry point for "toggle this GIF", used by the button, the
     spacebar, and the zoom overlay. Handles the pause-all interaction so
     callers don't have to. */
  function toggleOne(item) {
    if (pauseAll) {
      /* Individually resume/re-pause against the global default. */
      item.resumedOverride = !item.resumedOverride;
      if (item.resumedOverride) {
        pausedNames.delete(item.path);
        item.el.classList.remove('paused');
        thaw(item);
        return false;
      }
      item.el.classList.add('paused');
      freeze(item);
      return true;
    }
    return togglePause(item);
  }

  function isPauseAll() { return pauseAll; }

  function pausedState(item) {
    if (pauseAll) return !item.resumedOverride;
    return pausedNames.has(item.path);
  }

  /* ---------- loading ---------- */

  function setFiles(files) {
    teardown();
    items = files.map(function (f) {
      return {
        file: f,
        name: f.name,
        /* webkitRelativePath disambiguates same-named files across subfolders. */
        path: f.webkitRelativePath || f.name,
        size: f.size,
        mtime: f.lastModified || 0,
        url: null,
        el: null,
        img: null,
        canvas: null,
        mounted: false,
        broken: false
      };
    });
    return items.length;
  }

  function teardown() {
    renderToken++;
    if (io) io.disconnect();
    releaseOverlayUrl();
    items.forEach(function (item) {
      if (item.url) { URL.revokeObjectURL(item.url); item.url = null; }
    });
    items = [];
    visible = [];
    pausedNames.clear();
    pauseAll = false;
    gridEl.innerHTML = '';
    buildObserver();
  }

  /* ---------- sorting / filtering ---------- */

  function sortItems(list, mode) {
    var out = list.slice();
    var byName = function (a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    };
    switch (mode) {
      case 'name-desc': out.sort(function (a, b) { return byName(b, a); }); break;
      case 'size':      out.sort(function (a, b) { return a.size - b.size; }); break;
      case 'size-desc': out.sort(function (a, b) { return b.size - a.size; }); break;
      case 'date':      out.sort(function (a, b) { return a.mtime - b.mtime; }); break;
      case 'date-desc': out.sort(function (a, b) { return b.mtime - a.mtime; }); break;
      case 'random':
        for (var i = out.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = out[i]; out[i] = out[j]; out[j] = t;
        }
        break;
      default: out.sort(byName);
    }
    return out;
  }

  /* Rebuilds the grid for the current sort/filter. Cells are appended in idle
     slices so a folder with thousands of GIFs doesn't jank the tab. */
  function render(opts) {
    var query = (opts.query || '').trim().toLowerCase();
    var favesOnly = !!opts.favoritesOnly;

    var list = items.filter(function (item) {
      if (favesOnly && !AGV.settings.isFavorite(item.path)) return false;
      if (query && item.name.toLowerCase().indexOf(query) === -1) return false;
      return true;
    });

    visible = sortItems(list, opts.sort);

    renderToken++;
    var token = renderToken;

    /* A re-render throws away every existing cell, so all per-cell state has to
       be reset too — otherwise a stale `mounted: true` makes mount() bail out
       and the rebuilt cell never gets its src back. Blob URLs are released here
       as well, since the old cells will never be unmounted by the observer. */
    io.disconnect();
    items.forEach(function (item) {
      item.mounted = false;
      item.el = null;
      item.img = null;
      item.canvas = null;
      if (item.player) { item.player.destroy(); item.player = null; }
      if (item.url) { URL.revokeObjectURL(item.url); item.url = null; }
    });
    gridEl.innerHTML = '';

    var index = 0;

    function step() {
      if (token !== renderToken) return;   /* superseded by a newer render */
      var frag = document.createDocumentFragment();
      var start = index;
      var end = Math.min(index + CHUNK, visible.length);

      for (; index < end; index++) {
        frag.appendChild(buildCell(visible[index], index));
      }
      gridEl.appendChild(frag);

      /* Observe only the cells this slice added. */
      for (var i = start; i < end; i++) {
        if (visible[i].img) io.observe(visible[i].img);
      }

      if (index < visible.length) idle(step);
      else if (opts.onDone) opts.onDone(visible.length);
    }

    if (!visible.length) {
      if (opts.onDone) opts.onDone(0);
      return 0;
    }
    idle(step);
    return visible.length;
  }

  function buildCell(item, index) {
    var cell = document.createElement('div');
    cell.className = 'cell pending';
    cell.tabIndex = 0;
    cell.setAttribute('role', 'listitem');
    cell.setAttribute('aria-label', item.name);

    var img = document.createElement('img');
    img.alt = item.name;
    img.draggable = false;
    img.loading = 'lazy';
    img.__agvItem = item;
    img.addEventListener('error', function () {
      /* Only a real decode failure counts — clearing src also fires error. */
      if (img.getAttribute('src')) markBroken(item);
    });
    img.addEventListener('load', function () {
      item.shownAt = performance.now();
    });

    var actions = document.createElement('div');
    actions.className = 'cell-actions';

    var pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'cell-btn pause';
    pauseBtn.title = 'Pause this GIF';
    pauseBtn.setAttribute('aria-label', 'Pause ' + item.name);
    pauseBtn.textContent = '❚❚';

    var favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'cell-btn fav';
    favBtn.title = 'Favorite';
    favBtn.setAttribute('aria-label', 'Favorite ' + item.name);
    favBtn.textContent = '★';

    actions.appendChild(pauseBtn);
    actions.appendChild(favBtn);

    var label = document.createElement('div');
    label.className = 'name';
    label.textContent = item.name;

    cell.appendChild(img);
    cell.appendChild(actions);
    cell.appendChild(label);

    item.el = cell;
    item.img = img;
    item.mounted = false;
    item.canvas = null;
    if (AGV.settings.isFavorite(item.path)) cell.classList.add('faved');

    /* Carry paused styling and button state across a re-render. */
    if (pausedState(item)) {
      cell.classList.add('paused');
      pauseBtn.textContent = '▶';
      pauseBtn.title = 'Resume this GIF (Space)';
    }

    /* Click zooms; the corner buttons stopPropagation so they don't. */
    cell.addEventListener('click', function () {
      if (onOpenZoom) onOpenZoom(index);
    });

    pauseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      applyPauseToggle(item);
    });

    favBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var on = AGV.settings.toggleFavorite(item.path);
      cell.classList.toggle('faved', on);
    });

    /* Tracks which cell the spacebar should act on when nothing is focused. */
    cell.addEventListener('mouseenter', function () { hovered = item; });
    cell.addEventListener('mouseleave', function () {
      if (hovered === item) hovered = null;
    });

    cell.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (onOpenZoom) onOpenZoom(index);
      } else if (e.key === 'f' || e.key === 'F') {
        var on = AGV.settings.toggleFavorite(item.path);
        cell.classList.toggle('faved', on);
      }
    });

    return cell;
  }

  /* Toggles pause and syncs the cell's button. Safe to call from the button,
     the spacebar, or the zoom overlay. */
  function applyPauseToggle(item) {
    var nowPaused = toggleOne(item);
    syncPauseButton(item);
    return nowPaused;
  }

  function syncPauseButton(item) {
    if (!item.el) return;
    var btn = item.el.querySelector('.cell-btn.pause');
    if (!btn) return;
    var paused = pausedState(item);
    btn.textContent = paused ? '▶' : '❚❚';
    btn.title = paused ? 'Resume this GIF (Space)' : 'Pause this GIF (Space)';
  }

  /* The cell the spacebar should act on: whatever the mouse is over, else the
     focused cell. */
  function targetCell() {
    if (hovered && hovered.el) return hovered;
    var el = document.activeElement;
    if (el && el.classList && el.classList.contains('cell')) {
      for (var i = 0; i < visible.length; i++) {
        if (visible[i].el === el) return visible[i];
      }
    }
    return null;
  }

  /* ---------- accessors used by the zoom overlay ---------- */

  function getVisible() { return visible; }
  function count() { return items.length; }

  /* The overlay needs a URL even when the cell is unmounted or frozen, but it
     must not borrow item.url — a paused or scrolled-away cell never unmounts
     that URL, so it would leak. The overlay gets one dedicated URL that is
     recycled on each open. */
  var overlayUrl = null;

  function urlFor(item) {
    if (overlayUrl) { URL.revokeObjectURL(overlayUrl); overlayUrl = null; }
    if (item.url) return item.url;      /* cell is live; reuse its URL */
    try {
      overlayUrl = URL.createObjectURL(item.file);
    } catch (e) {
      return null;
    }
    return overlayUrl;
  }

  function releaseOverlayUrl() {
    if (overlayUrl) { URL.revokeObjectURL(overlayUrl); overlayUrl = null; }
  }

  function focusCell(index) {
    var item = visible[index];
    if (item && item.el) {
      item.el.focus({ preventScroll: true });
      item.el.scrollIntoView({ block: 'nearest' });
    }
  }

  return {
    init: init,
    setFiles: setFiles,
    render: render,
    teardown: teardown,
    getVisible: getVisible,
    count: count,
    urlFor: urlFor,
    releaseOverlayUrl: releaseOverlayUrl,
    focusCell: focusCell,
    setPauseAll: setPauseAll,
    isPauseAll: isPauseAll,
    applyPauseToggle: applyPauseToggle,
    syncPauseButton: syncPauseButton,
    pausedState: pausedState,
    stepFrame: stepFrame,
    targetCell: targetCell,
    itemAt: function (i) { return visible[i]; }
  };
})();
