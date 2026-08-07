/* zoom.js — the fullscreen zoom overlay: wheel zoom, arrow-key navigation,
   pause/frame-step, and a true-fullscreen mode. Exposes window.AGV.zoom.

   The zoomed GIF plays on a canvas (via AGV.player) rather than an <img>, so
   it can be paused at its current frame and stepped frame by frame. */

window.AGV = window.AGV || {};

AGV.zoom = (function () {
  'use strict';

  var overlay, stage, canvas, levelEl, nameEl, idxEl, frameEl,
      pauseBtn, fsBtn, hintEl;
  var MIN = 1, MAX = 20, STEP = 1.15;

  var zoom = 1;            /* user zoom, multiplied on top of the fit scale */
  var fitScale = 1;        /* scale that makes the GIF fit the viewport */
  var index = -1;
  var player = null;
  var current = null;
  var paused = false;

  function init(opts) {
    overlay = opts.overlay;
    stage = opts.stage;
    canvas = opts.canvas;
    levelEl = opts.levelEl;
    nameEl = opts.nameEl;
    idxEl = opts.idxEl;
    frameEl = opts.frameEl;
    pauseBtn = opts.pauseBtn;
    fsBtn = opts.fsBtn;
    hintEl = opts.hintEl;

    player = AGV.player.create(canvas);

    overlay.addEventListener('wheel', onWheel, { passive: false });

    overlay.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      close();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.closest('.zoom-bar') || e.target.closest('.zoom-hint')) return;
      close();
    });

    pauseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePause();
    });

    fsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFullscreen();
    });

    document.addEventListener('keydown', onKey);

    /* Refit when the viewport changes — window resize, F11 fullscreen, or the
       browser entering/leaving its own fullscreen. Without this the image keeps
       the scale it was given when the overlay opened. */
    window.addEventListener('resize', refit);
    document.addEventListener('fullscreenchange', function () {
      syncFullscreenButton();
      /* The viewport size settles a frame after the event fires. */
      requestAnimationFrame(refit);
      setTimeout(refit, 120);
    });
  }

  function isOpen() { return overlay.classList.contains('active'); }

  function open(i) {
    var list = AGV.grid.getVisible();
    if (!list.length) return;
    index = Math.max(0, Math.min(list.length - 1, i));
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    show(list[index], list.length);
  }

  function show(item, total) {
    current = item;
    zoom = 1;
    nameEl.textContent = item.name;
    idxEl.textContent = (index + 1) + ' / ' + total;
    levelEl.textContent = '1.0×';
    frameEl.textContent = '';
    stage.classList.add('loading');

    /* Inherit the grid's paused state for this GIF, so opening a paused GIF
       shows it paused rather than silently playing. */
    paused = AGV.grid.pausedState(item);

    AGV.player.decodeFor(item).then(function (decoded) {
      if (current !== item || !isOpen()) return;
      stage.classList.remove('loading');
      player.load(decoded, 0);
      fitScale = computeFit(decoded.width, decoded.height);
      applyScale();
      if (paused) player.pause(); else player.play();
      syncPauseButton();
      updateFrameLabel();
    }).catch(function () {
      if (current !== item) return;
      stage.classList.remove('loading');
      nameEl.textContent = item.name + ' — unreadable';
    });
  }

  /* Scale that fits the GIF comfortably in the viewport. Small GIFs are
     enlarged so they're actually viewable rather than sitting as a stamp in
     the middle of the screen; large ones shrink to fit.

     In fullscreen the cap is lifted — filling the display is the entire point
     of the mode, so a small GIF is allowed to scale all the way up. */
  function computeFit(w, h) {
    if (!w || !h) return 1;
    var fs = !!document.fullscreenElement;
    var maxW = window.innerWidth * (fs ? 1 : 0.9);
    var maxH = window.innerHeight * (fs ? 1 : 0.82);
    var s = Math.min(maxW / w, maxH / h);
    if (s > 1 && !fs) s = Math.min(s, 6);
    return s;
  }

  function applyScale() {
    if (!player.hasFrames()) return;
    var s = fitScale * zoom;
    canvas.style.width = Math.round(canvas.width * s) + 'px';
    canvas.style.height = Math.round(canvas.height * s) + 'px';
    canvas.style.imageRendering = s >= 2 ? 'pixelated' : 'auto';
    levelEl.textContent = zoom.toFixed(1) + '×';
  }

  /* Recomputes the fit for the current viewport, preserving the user's zoom. */
  function refit() {
    if (!isOpen() || !player.hasFrames()) return;
    fitScale = computeFit(canvas.width, canvas.height);
    applyScale();
  }

  function step(delta) {
    var list = AGV.grid.getVisible();
    if (!list.length) return;
    index = (index + delta + list.length) % list.length;
    player.destroy();
    player = AGV.player.create(canvas);
    show(list[index], list.length);
    AGV.grid.focusCell(index);
  }

  function togglePause() {
    if (!player.hasFrames()) return;
    paused = !paused;
    if (paused) player.pause(); else player.play();
    syncPauseButton();
    updateFrameLabel();

    /* Keep the grid cell in sync, so closing the overlay doesn't reveal a
       different state than the one just chosen. */
    if (current && AGV.grid.pausedState(current) !== paused) {
      AGV.grid.applyPauseToggle(current);
    }
  }

  function syncPauseButton() {
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.title = paused ? 'Resume (Space)' : 'Pause (Space)';
    pauseBtn.setAttribute('aria-label', pauseBtn.title);
    overlay.classList.toggle('is-paused', paused);
  }

  function updateFrameLabel() {
    if (!player.hasFrames()) { frameEl.textContent = ''; return; }
    var n = player.frameCount();
    if (n < 2) { frameEl.textContent = 'single frame'; return; }
    frameEl.textContent = paused
      ? 'frame ' + (player.frameIndex() + 1) + ' / ' + n
      : n + ' frames';
  }

  function stepFrame(delta) {
    if (!player.hasFrames() || player.frameCount() < 2) return;
    if (!paused) { paused = true; player.pause(); syncPauseButton(); }
    player.step(delta);
    updateFrameLabel();
  }

  /* True fullscreen — the browser's Fullscreen API on the overlay itself, so
     the GIF fills the whole display with no browser chrome. */
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(function () {
        AGV.toast('Fullscreen was blocked by the browser');
      });
    }
  }

  function syncFullscreenButton() {
    var on = !!document.fullscreenElement;
    fsBtn.textContent = on ? '⤢' : '⛶';
    fsBtn.title = on ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
    fsBtn.setAttribute('aria-label', fsBtn.title);
    overlay.classList.toggle('fullscreen', on);
  }

  function close() {
    if (document.fullscreenElement) document.exitFullscreen();
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    player.destroy();
    player = AGV.player.create(canvas);
    current = null;
    AGV.grid.releaseOverlayUrl();
    if (index >= 0) AGV.grid.focusCell(index);
  }

  function onWheel(e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? STEP : 1 / STEP;
    zoom = Math.min(MAX, Math.max(MIN, zoom * delta));
    applyScale();
  }

  function onKey(e) {
    if (!isOpen()) return;
    switch (e.key) {
      case 'Escape':
        /* In fullscreen the browser handles Escape itself; don't also close. */
        if (!document.fullscreenElement) { e.preventDefault(); close(); }
        break;
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        togglePause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (paused) stepFrame(1); else step(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (paused) stepFrame(-1); else step(-1);
        break;
      case 'PageDown': e.preventDefault(); step(1); break;
      case 'PageUp':   e.preventDefault(); step(-1); break;
      case 'f': case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'Home': e.preventDefault(); index = -1; step(1); break;
      case 'End':
        e.preventDefault();
        index = AGV.grid.getVisible().length - 1;
        step(0);
        break;
    }
  }

  return { init: init, open: open, close: close, isOpen: isOpen, refit: refit };
})();
