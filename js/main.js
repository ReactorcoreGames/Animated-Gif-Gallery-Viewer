/* main.js — wiring: folder loading, header controls, and app state. */

window.AGV = window.AGV || {};

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var pickBtn = $('pickBtn');
  var pickBtnBig = $('pickBtnBig');
  var folderInput = $('folderInput');
  var subfoldersCheck = $('subfoldersCheck');
  var emptyEl = $('empty');
  var gridWrap = $('grid-wrap');
  var gridEl = $('grid');
  var statsEl = $('stats');
  var folderInfo = $('folderInfo');
  var folderName = $('folderName');
  var searchInput = $('searchInput');
  var sortSelect = $('sortSelect');
  var sizeSlider = $('sizeSlider');
  var swatchesEl = $('swatches');
  var favFilterBtn = $('favFilterBtn');
  var pauseAllBtn = $('pauseAllBtn');
  var toastEl = $('toast');
  var closeFolderBtn = $('closeFolderBtn');
  var tourBtn = $('tourBtn');
  var tourModal = $('tourModal');
  var tourClose = $('tourClose');
  var tourDismiss = $('tourDismiss');

  var favoritesOnly = false;
  var loadedCount = 0;
  var searchTimer = null;

  /* ---------- toast ---------- */

  var toastTimer = null;
  AGV.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2200);
  };

  /* ---------- settings restore ---------- */

  var s = AGV.settings;

  document.documentElement.style.setProperty('--cellsize', s.get('cellSize') + 'px');
  sizeSlider.value = s.get('cellSize');
  subfoldersCheck.checked = !!s.get('subfolders');
  sortSelect.value = s.get('sort');
  s.applyBackdrop(s.get('backdrop'));
  s.buildSwatches(swatchesEl);

  /* ---------- init modules ---------- */

  AGV.grid.init({
    gridEl: gridEl,
    wrapEl: gridWrap,
    onOpenZoom: function (i) { AGV.zoom.open(i); }
  });

  AGV.zoom.init({
    overlay: $('overlay'),
    stage: $('zoomStage'),
    canvas: $('zoomCanvas'),
    levelEl: $('zoomLevel'),
    nameEl: $('zoomName'),
    idxEl: $('zoomIdx'),
    frameEl: $('zoomFrame'),
    pauseBtn: $('zoomPauseBtn'),
    fsBtn: $('zoomFsBtn'),
    hintEl: $('zoomHint')
  });

  /* ---------- folder loading ---------- */

  function openPicker() { folderInput.click(); }
  pickBtn.addEventListener('click', openPicker);
  pickBtnBig.addEventListener('click', openPicker);
  closeFolderBtn.addEventListener('click', closeFolder);

  /* ---------- feature tour modal ---------- */

  function openTour() {
    tourModal.hidden = false;
    tourClose.focus();
  }

  function closeTour() {
    tourModal.hidden = true;
    tourBtn.focus();
  }

  tourBtn.addEventListener('click', openTour);
  tourClose.addEventListener('click', closeTour);
  tourDismiss.addEventListener('click', closeTour);

  tourModal.addEventListener('click', function (e) {
    if (e.target === tourModal) closeTour();      /* click the backdrop */
  });

  subfoldersCheck.addEventListener('change', function () {
    s.set('subfolders', subfoldersCheck.checked);
    if (loadedCount) {
      AGV.toast('Applies on the next folder you open');
    }
  });

  folderInput.addEventListener('change', function (e) {
    var all = Array.from(e.target.files);
    var includeSub = subfoldersCheck.checked;

    var gifs = all.filter(function (f) {
      if (!/\.gif$/i.test(f.name)) return false;
      if (includeSub) return true;
      /* webkitRelativePath is "<folder>/<file>" for top-level entries; any
         additional separator means the file sits in a subdirectory. */
      var rel = f.webkitRelativePath || '';
      return rel.split('/').length <= 2;
    });

    /* Let the same folder be re-picked back to back. */
    folderInput.value = '';

    if (!gifs.length) {
      AGV.toast(all.length
        ? (includeSub ? 'No .gif files in that folder.' : 'No .gif files at the top level — try Subfolders.')
        : 'That folder is empty.');
      return;
    }

    /* The folder name is the first segment of any file's relative path. */
    var rel = gifs[0].webkitRelativePath || '';
    var folder = rel ? rel.split('/')[0] : '';
    setFolderLabel(folder, gifs, includeSub);

    loadedCount = AGV.grid.setFiles(gifs);
    AGV.player.clear();
    showGrid();
    applyView();
  });

  /* Browsers only expose webkitRelativePath (paths relative to the picked
     folder) — the absolute location on disk is deliberately withheld for
     privacy, so the tooltip reports everything the API actually gives us. */
  function setFolderLabel(folder, gifs, includeSub) {
    if (!folder) { folderInfo.hidden = true; return; }
    folderInfo.hidden = false;
    folderName.textContent = folder;

    var count = gifs.length;
    var lines = [
      'Folder: ' + folder,
      count + ' GIF' + (count === 1 ? '' : 's') + ' loaded' +
        (includeSub ? ', including subfolders' : ' from the top level only')
    ];

    if (includeSub) {
      /* List the subfolders actually contributing files. */
      var subs = {};
      gifs.forEach(function (f) {
        var parts = (f.webkitRelativePath || '').split('/');
        if (parts.length > 2) {
          var sub = parts.slice(1, -1).join('/');
          subs[sub] = (subs[sub] || 0) + 1;
        }
      });
      var names = Object.keys(subs).sort();
      if (names.length) {
        lines.push('');
        lines.push('Subfolders (' + names.length + '):');
        names.slice(0, 8).forEach(function (n) {
          lines.push('  ' + folder + '/' + n + '  (' + subs[n] + ')');
        });
        if (names.length > 8) lines.push('  …and ' + (names.length - 8) + ' more');
      }
    }

    var bytes = gifs.reduce(function (a, f) { return a + f.size; }, 0);
    lines.push('');
    lines.push('Total size: ' + formatBytes(bytes));
    lines.push('');
    lines.push('Your browser only reveals the folder name, not its full path on disk.');
    lines.push('Click ✕ to close this folder, or Open Folder to pick another.');

    folderName.title = lines.join('\n');
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  /* Returns to the welcome screen without a page reload. */
  function closeFolder() {
    AGV.grid.teardown();
    AGV.player.clear();
    loadedCount = 0;
    favoritesOnly = false;
    favFilterBtn.classList.remove('toggle-on');
    searchInput.value = '';
    if (AGV.grid.isPauseAll()) {
      AGV.grid.setPauseAll(false);
      pauseAllBtn.classList.remove('toggle-on');
      pauseAllBtn.innerHTML = '❚❚ Pause all';
    }
    folderInfo.hidden = true;
    emptyEl.style.display = '';
    gridWrap.style.display = 'none';
    Array.prototype.forEach.call(document.querySelectorAll('[data-controls]'), function (el) {
      el.hidden = true;
    });
    AGV.toast('Folder closed');
  }

  function showGrid() {
    emptyEl.style.display = 'none';
    gridWrap.style.display = 'block';
    Array.prototype.forEach.call(document.querySelectorAll('[data-controls]'), function (el) {
      el.hidden = false;
    });
  }

  /* ---------- view state ---------- */

  function applyView() {
    AGV.grid.render({
      query: searchInput.value,
      sort: sortSelect.value,
      favoritesOnly: favoritesOnly,
      onDone: function (shown) {
        var parts = ['<b>' + shown + '</b> shown'];
        if (shown !== loadedCount) parts.push('of <b>' + loadedCount + '</b>');
        else parts.push('gifs');
        statsEl.innerHTML = parts.join(' ');
        if (!shown) {
          statsEl.innerHTML = 'No matches — <b>' + loadedCount + '</b> loaded';
        }
      }
    });
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyView, 160);
  });

  sortSelect.addEventListener('change', function () {
    s.set('sort', sortSelect.value);
    applyView();
  });

  sizeSlider.addEventListener('input', function () {
    document.documentElement.style.setProperty('--cellsize', sizeSlider.value + 'px');
  });
  sizeSlider.addEventListener('change', function () {
    s.set('cellSize', parseInt(sizeSlider.value, 10));
  });

  favFilterBtn.addEventListener('click', function () {
    favoritesOnly = !favoritesOnly;
    favFilterBtn.classList.toggle('toggle-on', favoritesOnly);
    favFilterBtn.title = favoritesOnly ? 'Show all GIFs' : 'Show favorites only';
    if (favoritesOnly && !s.favoriteCount()) {
      AGV.toast('No favorites yet — click ★ on a GIF');
    }
    applyView();
  });

  pauseAllBtn.addEventListener('click', function () {
    var on = AGV.grid.setPauseAll(!AGV.grid.isPauseAll());
    pauseAllBtn.classList.toggle('toggle-on', on);
    pauseAllBtn.innerHTML = on ? '▶ Resume all' : '❚❚ Pause all';
    pauseAllBtn.title = on ? 'Resume every GIF' : 'Pause every GIF';
  });

  /* ---------- global shortcuts ---------- */

  document.addEventListener('keydown', function (e) {
    /* The modal is on top of everything, so it claims Escape first. */
    if (!tourModal.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeTour(); }
      return;
    }
    if (AGV.zoom.isOpen()) return;    /* the overlay owns keys while it's open */

    var tag = document.activeElement && document.activeElement.tagName;
    var typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape' && typing && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.blur();
      applyView();
    } else if ((e.key === ' ' || e.key === 'Spacebar') && !typing) {
      /* Spacebar acts on the GIF under the mouse, else the focused cell. */
      var item = AGV.grid.targetCell();
      if (item) {
        e.preventDefault();
        AGV.grid.applyPauseToggle(item);
      }
    } else if (!typing && (e.key === ',' || e.key === '.')) {
      /* Frame-step the hovered/focused GIF while it's paused. */
      var t = AGV.grid.targetCell();
      if (t && AGV.grid.stepFrame(t, e.key === '.' ? 1 : -1)) e.preventDefault();
    }
  });

  /* Release object URLs on unload so a long session doesn't leak. */
  window.addEventListener('pagehide', function () { AGV.grid.teardown(); });
})();
