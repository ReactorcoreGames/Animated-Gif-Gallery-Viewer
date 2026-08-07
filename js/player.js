/* player.js — canvas-driven GIF playback, used only where true pause matters.

   A plain <img> cannot be paused at its current frame (drawImage returns
   frame 0). So when a GIF needs real pause control, we decode it once and
   drive playback ourselves on a <canvas>: pausing then simply stops advancing,
   leaving the exact frame on screen.

   Decoded frames are cached per item so repeated pause/zoom is instant.
   Exposes window.AGV.player. */

window.AGV = window.AGV || {};

AGV.player = (function () {
  'use strict';

  var cache = new Map();          /* path -> decoded gif */
  var CACHE_LIMIT = 60;           /* decoded frames are large; keep it bounded */

  function decodeFor(item) {
    if (cache.has(item.path)) return Promise.resolve(cache.get(item.path));

    return item.file.arrayBuffer().then(function (buf) {
      var g = AGV.gif.decode(buf);
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(item.path, g);
      return g;
    });
  }

  function forget(path) { cache.delete(path); }
  function clear() { cache.clear(); }

  /* A Player owns one canvas and animates it from decoded frames. */
  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var gif = null;
    var frame = 0;
    var timer = null;
    var playing = false;

    function draw() {
      if (!gif) return;
      ctx.putImageData(gif.frames[frame].bitmap, 0, 0);
    }

    function tick() {
      if (!playing || !gif) return;
      frame = (frame + 1) % gif.frames.length;
      draw();
      timer = setTimeout(tick, gif.frames[frame].delay);
    }

    return {
      /* Loads decoded frames, sizing the canvas to the GIF. */
      load: function (decoded, startFrame) {
        gif = decoded;
        canvas.width = gif.width;
        canvas.height = gif.height;
        frame = Math.min(startFrame || 0, gif.frames.length - 1);
        draw();
      },
      play: function () {
        if (!gif || playing || gif.frames.length < 2) return;
        playing = true;
        timer = setTimeout(tick, gif.frames[frame].delay);
      },
      pause: function () {
        playing = false;
        clearTimeout(timer);
        timer = null;
      },
      /* Frame stepping, only meaningful while paused. */
      step: function (delta) {
        if (!gif) return;
        var n = gif.frames.length;
        frame = (frame + delta + n) % n;
        draw();
      },
      destroy: function () {
        playing = false;
        clearTimeout(timer);
        timer = null;
        gif = null;
      },
      isPlaying: function () { return playing; },
      frameIndex: function () { return frame; },
      frameCount: function () { return gif ? gif.frames.length : 0; },
      hasFrames: function () { return !!gif; }
    };
  }

  return {
    create: create,
    decodeFor: decodeFor,
    forget: forget,
    clear: clear
  };
})();
