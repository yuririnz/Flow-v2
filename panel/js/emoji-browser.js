(function () {
  'use strict';

  var MANIFEST_PATH = 'files/emoji/ios-26.4/emoji-manifest.js';
  var HOST_SCRIPT_PATH = 'jsx/emoji-browser.jsx';
  var TILE_HEIGHT = 34;
  var TILE_GAP = 4;
  var MIN_TILE_WIDTH = 36;
  var GRID_VERTICAL_PADDING = 6;
  var BUFFER_ROWS = 3;
  var SEARCH_DELAY = 110;
  var state = {
    active: false,
    data: null,
    filtered: [],
    category: 'all',
    query: '',
    columns: 0,
    startIndex: -1,
    endIndex: -1,
    renderFrame: null,
    searchTimer: null,
    manifestLoading: false,
    hostLoaded: false,
    hostLoading: false,
    hostCallbacks: [],
    statusTimer: null
  };
  var els = {};

  function init() {
    els.panel = document.getElementById('emojiBrowserPanel');
    els.search = document.getElementById('emojiSearchInput');
    els.clear = document.getElementById('emojiSearchClear');
    els.categories = document.getElementById('emojiCategoryRow');
    els.count = document.getElementById('emojiResultCount');
    els.status = document.getElementById('emojiStatus');
    els.viewport = document.getElementById('emojiViewport');
    els.spacer = document.getElementById('emojiVirtualSpacer');
    els.grid = document.getElementById('emojiGrid');
    els.empty = document.getElementById('emojiEmptyState');

    if (!els.panel || !els.viewport || !els.grid) {
      return;
    }

    document.addEventListener('flow:emoji-browser-mode', onModeChange);
    els.search.addEventListener('input', onSearchInput);
    els.search.addEventListener('keydown', onSearchKeydown);
    els.clear.addEventListener('click', clearSearch);
    els.categories.addEventListener('click', onCategoryClick);
    els.viewport.addEventListener('scroll', scheduleRender);
    els.grid.addEventListener('click', onEmojiClick);
    window.addEventListener('resize', function () {
      state.columns = 0;
      scheduleRender();
    });
  }

  function onModeChange(event) {
    state.active = !!(event.detail && event.detail.active);

    if (!state.active) {
      return;
    }

    loadManifest(function (ok) {
      if (!ok) {
        return;
      }

      if (!els.categories.children.length) {
        renderCategories();
      }

      applyFilter();
    });
  }

  function loadManifest(callback) {
    if (state.data) {
      callback(true);
      return;
    }

    if (window.FlowEmojiData) {
      state.data = window.FlowEmojiData;
      callback(true);
      return;
    }

    if (state.manifestLoading) {
      window.setTimeout(function () {
        loadManifest(callback);
      }, 40);
      return;
    }

    state.manifestLoading = true;
    setStatus('Loading emoji…', true);
    var script = document.createElement('script');
    script.src = MANIFEST_PATH;
    script.onload = function () {
      state.manifestLoading = false;
      state.data = window.FlowEmojiData || null;

      if (!state.data) {
        showLoadError();
        callback(false);
        return;
      }

      setStatus('', true);
      callback(true);
    };
    script.onerror = function () {
      state.manifestLoading = false;
      showLoadError();
      callback(false);
    };
    document.head.appendChild(script);
  }

  function showLoadError() {
    els.count.textContent = 'Emoji unavailable';
    setStatus('Reinstall Flow to restore the emoji library.', true);
  }

  function renderCategories() {
    var fragment = document.createDocumentFragment();
    var categories = [{ id: 'all', label: 'All' }].concat(state.data.categories || []);

    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'emoji-browser__category' + (category.id === state.category ? ' is-active' : '');
      button.textContent = category.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', category.id === state.category ? 'true' : 'false');
      button.setAttribute('data-category', category.id);
      fragment.appendChild(button);
    }

    els.categories.appendChild(fragment);
  }

  function onCategoryClick(event) {
    var button = closestByAttribute(event.target, 'data-category');

    if (!button) {
      return;
    }

    state.category = button.getAttribute('data-category') || 'all';
    var buttons = els.categories.querySelectorAll('[data-category]');

    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i] === button;
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }

    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    applyFilter();
  }

  function onSearchInput() {
    els.clear.hidden = !els.search.value;
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(function () {
      state.query = normalizeSearch(els.search.value);
      applyFilter();
    }, SEARCH_DELAY);
  }

  function onSearchKeydown(event) {
    if (event.key === 'Escape' && els.search.value) {
      event.preventDefault();
      clearSearch();
    }
  }

  function clearSearch() {
    els.search.value = '';
    els.clear.hidden = true;
    state.query = '';
    window.clearTimeout(state.searchTimer);
    applyFilter();
    els.search.focus();
  }

  function applyFilter() {
    if (!state.data) {
      return;
    }

    var entries = state.data.emoji || [];
    var category = state.category;
    var query = state.query;
    var filtered = [];

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];

      if (category !== 'all' && entry[2] !== category) {
        continue;
      }

      if (query && String(entry[1] + ' ' + entry[3]).toLowerCase().indexOf(query) === -1) {
        continue;
      }

      filtered.push(entry);
    }

    state.filtered = filtered;
    state.startIndex = -1;
    state.endIndex = -1;
    els.viewport.scrollTop = 0;
    els.count.textContent = filtered.length.toLocaleString() + (filtered.length === 1 ? ' emoji' : ' emoji');
    els.empty.hidden = filtered.length !== 0;
    els.spacer.hidden = filtered.length === 0;
    updateSpacer();
    renderVisible(true);
  }

  function updateSpacer() {
    var columns = getColumnCount();
    var rows = Math.ceil(state.filtered.length / columns);
    els.spacer.style.height = Math.max(0, rows * (TILE_HEIGHT + TILE_GAP) - TILE_GAP + GRID_VERTICAL_PADDING * 2) + 'px';
  }

  function getColumnCount() {
    var width = Math.max(1, els.viewport.clientWidth - 16);
    return Math.max(3, Math.floor((width + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP)));
  }

  function scheduleRender() {
    if (!state.active || !state.data || state.renderFrame !== null) {
      return;
    }

    state.renderFrame = window.requestAnimationFrame(function () {
      state.renderFrame = null;
      renderVisible(false);
    });
  }

  function renderVisible(force) {
    if (!state.data || !state.filtered.length) {
      els.grid.innerHTML = '';
      return;
    }

    var columns = getColumnCount();

    if (columns !== state.columns) {
      state.columns = columns;
      updateSpacer();
      force = true;
    }

    var rowStride = TILE_HEIGHT + TILE_GAP;
    var firstRow = Math.max(0, Math.floor(els.viewport.scrollTop / rowStride) - BUFFER_ROWS);
    var visibleRows = Math.ceil(els.viewport.clientHeight / rowStride) + BUFFER_ROWS * 2;
    var startIndex = firstRow * columns;
    var endIndex = Math.min(state.filtered.length, (firstRow + visibleRows) * columns);

    if (!force && startIndex === state.startIndex && endIndex === state.endIndex) {
      return;
    }

    state.startIndex = startIndex;
    state.endIndex = endIndex;
    els.grid.style.top = (GRID_VERTICAL_PADDING + firstRow * rowStride) + 'px';
    els.grid.style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, 1fr))';
    var fragment = document.createDocumentFragment();

    for (var i = startIndex; i < endIndex; i++) {
      fragment.appendChild(createEmojiButton(state.filtered[i], i));
    }

    els.grid.innerHTML = '';
    els.grid.appendChild(fragment);
  }

  function createEmojiButton(entry, index) {
    var button = document.createElement('button');
    var image = document.createElement('img');
    button.type = 'button';
    button.className = 'emoji-browser__item';
    button.setAttribute('role', 'listitem');
    button.setAttribute('data-emoji-index', index);
    button.setAttribute('aria-label', 'Add ' + entry[1]);
    button.title = entry[1];
    image.src = getAssetUrl(entry);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    button.appendChild(image);
    return button;
  }

  function getAssetUrl(entry) {
    return 'files/emoji/ios-26.4/' + (entry[4] ? 'extras/' : 'all/') + encodeURIComponent(entry[0]);
  }

  function getAssetPath(entry) {
    return getPanelPath() + '/files/emoji/ios-26.4/' + (entry[4] ? 'extras/' : 'all/') + entry[0];
  }

  function onEmojiClick(event) {
    var button = closestByAttribute(event.target, 'data-emoji-index');

    if (!button || button.disabled) {
      return;
    }

    var index = parseInt(button.getAttribute('data-emoji-index'), 10);
    var entry = state.filtered[index];

    if (!entry) {
      return;
    }

    button.disabled = true;
    button.classList.add('is-adding');
    setStatus('Adding ' + entry[1] + '…', true);
    addEmoji(entry, function (response) {
      button.disabled = false;
      button.classList.remove('is-adding');

      if (response.ok) {
        button.classList.add('is-added');
        setStatus('Added ' + entry[1] + '.', false);
        window.setTimeout(function () {
          button.classList.remove('is-added');
        }, 700);
      } else {
        button.classList.add('is-error');
        setStatus(response.message || 'Could not add that emoji.', true);
        window.setTimeout(function () {
          button.classList.remove('is-error');
        }, 900);
      }
    });
  }

  function addEmoji(entry, callback) {
    loadHostScript(function (ok) {
      if (!ok) {
        callback({ ok: false, message: 'Emoji import is available inside After Effects.' });
        return;
      }

      var script = 'FlowEmojiBrowser.add(' + quoteExtendScriptString(getAssetPath(entry)) + ', ' + quoteExtendScriptString(entry[1]) + ');';
      evalScript(script, function (result) {
        callback(parseHostResult(result));
      });
    });
  }

  function loadHostScript(callback) {
    if (state.hostLoaded) {
      callback(true);
      return;
    }

    state.hostCallbacks.push(callback);

    if (state.hostLoading) {
      return;
    }

    state.hostLoading = true;
    var path = getPanelPath() + '/' + HOST_SCRIPT_PATH;
    evalScript('$.evalFile(new File(' + quoteExtendScriptString(path) + ')); "ok";', function (result) {
      var ok = result === 'ok';
      state.hostLoaded = ok;
      state.hostLoading = false;

      while (state.hostCallbacks.length) {
        state.hostCallbacks.shift()(ok);
      }
    });
  }

  function getPanelPath() {
    var anchor = document.createElement('a');
    anchor.href = window.location.href;
    var pathname = decodeURIComponent(anchor.pathname);

    if (/^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }

    return pathname.replace(/[\/\\][^\/\\]*$/, '');
  }

  function quoteExtendScriptString(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function evalScript(script, callback) {
    var bridge = window.__adobe_cep__;

    if (!bridge || typeof bridge.evalScript !== 'function') {
      callback('{"ok":false,"message":"CEP bridge is not available."}');
      return;
    }

    bridge.evalScript(script, callback);
  }

  function parseHostResult(result) {
    try {
      return JSON.parse(result);
    } catch (error) {
      return { ok: false, message: result || 'Unknown After Effects response.' };
    }
  }

  function setStatus(message, persistent) {
    window.clearTimeout(state.statusTimer);
    els.status.textContent = message || '';

    if (message && !persistent) {
      state.statusTimer = window.setTimeout(function () {
        els.status.textContent = '';
      }, 2200);
    }
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().replace(/^\s+|\s+$/g, '').replace(/[\s_-]+/g, ' ');
  }

  function closestByAttribute(node, attribute) {
    while (node && node !== document) {
      if (node.getAttribute && node.hasAttribute(attribute)) {
        return node;
      }

      node = node.parentNode;
    }

    return null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
