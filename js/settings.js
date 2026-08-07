/* settings.js — localStorage persistence and the GIF backdrop swatches.
   Exposes window.AGV.settings. Plain script (no ES modules) so the app also
   runs from file:// when unzipped locally. */

window.AGV = window.AGV || {};

AGV.settings = (function () {
  'use strict';

  var KEY = 'agv.settings.v1';

  var DEFAULTS = {
    cellSize: 200,
    subfolders: false,
    sort: 'name',
    backdrop: 'checker',
    favorites: []
  };

  /* Backdrop options. `checker` is the classic transparency checkerboard;
     the bright keying colors sit next to the muted comfortable tones. */
  var BACKDROPS = [
    { id: 'checker', label: 'Checkerboard', checker: true },
    { id: 'black',   label: 'Black',   color: '#000000' },
    { id: 'white',   label: 'White',   color: '#ffffff' },
    { id: 'magenta', label: 'Magenta', color: '#ff00ff' },
    { id: 'green',   label: 'Green',   color: '#00ff00' },
    { id: 'orange',  label: 'Orange',  color: '#a8642f' },
    { id: 'violet',  label: 'Violet',  color: '#6b4a86' },
    { id: 'navy',    label: 'Navy',    color: '#1f3352' },
    { id: 'teal',    label: 'Teal',    color: '#1f5a56' }
  ];

  var CHECKER_IMAGE =
    'linear-gradient(45deg, #7a7a7a 25%, transparent 25%, transparent 75%, #7a7a7a 75%),' +
    'linear-gradient(45deg, #7a7a7a 25%, #cfcfcf 25%, #cfcfcf 75%, #7a7a7a 75%)';

  var state = load();

  function load() {
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var key in DEFAULTS) {
          if (Object.prototype.hasOwnProperty.call(saved, key)) out[key] = saved[key];
        }
      }
    } catch (e) {
      /* Private mode, disabled storage, or corrupt JSON — defaults are fine. */
    }
    if (!Array.isArray(out.favorites)) out.favorites = [];
    return out;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* non-fatal: settings just won't persist */ }
  }

  function get(key) { return state[key]; }

  function set(key, value) {
    state[key] = value;
    save();
  }

  /* ---- favorites ---- */

  var favSet = new Set(state.favorites);

  function isFavorite(name) { return favSet.has(name); }

  function toggleFavorite(name) {
    if (favSet.has(name)) favSet.delete(name);
    else favSet.add(name);
    state.favorites = Array.from(favSet);
    save();
    return favSet.has(name);
  }

  function favoriteCount() { return favSet.size; }

  /* ---- backdrop ---- */

  function applyBackdrop(id) {
    var opt = null;
    for (var i = 0; i < BACKDROPS.length; i++) {
      if (BACKDROPS[i].id === id) { opt = BACKDROPS[i]; break; }
    }
    if (!opt) opt = BACKDROPS[0];

    var root = document.documentElement.style;
    if (opt.checker) {
      root.setProperty('--gif-bg', '#cfcfcf');
      root.setProperty('--gif-bg-image', CHECKER_IMAGE);
    } else {
      root.setProperty('--gif-bg', opt.color);
      root.setProperty('--gif-bg-image', 'none');
    }
    set('backdrop', opt.id);
    return opt.id;
  }

  /* Builds the swatch row and wires selection. */
  function buildSwatches(container, onChange) {
    container.innerHTML = '';
    BACKDROPS.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (opt.checker ? ' checker' : '');
      b.dataset.id = opt.id;
      b.title = opt.label;
      b.setAttribute('aria-label', 'Backdrop: ' + opt.label);
      if (!opt.checker) b.style.background = opt.color;
      if (opt.id === state.backdrop) b.classList.add('selected');

      b.addEventListener('click', function () {
        applyBackdrop(opt.id);
        Array.prototype.forEach.call(container.children, function (el) {
          el.classList.toggle('selected', el.dataset.id === opt.id);
        });
        if (onChange) onChange(opt.id);
      });

      container.appendChild(b);
    });
  }

  return {
    get: get,
    set: set,
    applyBackdrop: applyBackdrop,
    buildSwatches: buildSwatches,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    favoriteCount: favoriteCount
  };
})();
