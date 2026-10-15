(function () {
  'use strict';

  var ORDER_STORAGE_KEY = 'flow.presetManager.order.v1';
  var FAVORITES_STORAGE_KEY = 'flow.presetManager.favorites.v1';
  var library = null;
  var libraryDropdown = null;
  var status = null;
  var statusTimer = null;
  var refreshTimer = null;
  var draggedPreset = null;
  var dragChanged = false;
  var suppressClickUntil = 0;
  var reorderMotion = window.FlowReorderMotion;
  var orderByLibrary = readObject(ORDER_STORAGE_KEY);
  var favorites = readArray(FAVORITES_STORAGE_KEY);

  function readObject(key) {
    try {
      var value = JSON.parse(window.localStorage.getItem(key) || '{}');
      return Object.prototype.toString.call(value) === '[object Object]' ? value : {};
    } catch (error) {
      return {};
    }
  }

  function readArray(key) {
    try {
      var value = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeValue(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function matches(element, selector) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    var fn = element.matches || element.msMatchesSelector || element.webkitMatchesSelector;
    return fn ? fn.call(element, selector) : false;
  }

  function closest(element, selector) {
    while (element && element !== document) {
      if (matches(element, selector)) {
        return element;
      }
      element = element.parentNode;
    }
    return null;
  }

  function getLibraryKey() {
    if (!libraryDropdown) {
      return 'library:default';
    }

    var option = libraryDropdown.options && libraryDropdown.options[libraryDropdown.selectedIndex];
    var value = libraryDropdown.value || (option ? option.value : '');
    var label = option ? option.textContent : '';
    return 'library:' + (value && label && value !== label ? value + '::' + label : value || label || 'default');
  }

  function hash(value) {
    var result = 2166136261;
    value = String(value || '');

    for (var i = 0; i < value.length; i += 1) {
      result ^= value.charCodeAt(i);
      result += (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
    }

    return (result >>> 0).toString(36);
  }

  function getPresetKey(item) {
    var libraryKey = getLibraryKey();
    var cachedLibrary = item.getAttribute('data-flow-preset-library');
    var cachedKey = item.getAttribute('data-flow-preset-key');

    if (cachedKey && cachedLibrary === libraryKey) {
      return cachedKey;
    }

    var customId = item.getAttribute('data-curve-preset-id');
    var labelNode = item.querySelector('.preset-name-label') || item.querySelector('span:not(.preset-favorite-indicator)');
    var label = labelNode ? labelNode.textContent : item.textContent;
    var paths = item.querySelectorAll('path');
    var pathData = '';

    for (var p = 0; p < paths.length; p += 1) {
      if (!closest(paths[p], '.preset-favorite-indicator')) {
        pathData += '|' + (paths[p].getAttribute('d') || '');
      }
    }

    var key = customId ?
      libraryKey + '|curve|' + customId :
      libraryKey + '|preset|' + hash(String(label || '').replace(/^\s+|\s+$/g, '') + pathData);

    item.setAttribute('data-flow-preset-library', libraryKey);
    item.setAttribute('data-flow-preset-key', key);
    return key;
  }

  function getPresets() {
    var nodes = library.querySelectorAll('.preset');
    var result = [];

    for (var i = 0; i < nodes.length; i += 1) {
      result.push(nodes[i]);
    }

    return result;
  }

  function indexOfKey(values, key) {
    for (var i = 0; i < values.length; i += 1) {
      if (values[i] === key) {
        return i;
      }
    }
    return -1;
  }

  function sortBySavedOrder(items, order) {
    if (!order || !order.length) {
      return items.slice(0);
    }

    return items.slice(0).sort(function (a, b) {
      var aIndex = indexOfKey(order, getPresetKey(a));
      var bIndex = indexOfKey(order, getPresetKey(b));
      aIndex = aIndex < 0 ? order.length + items.indexOf(a) : aIndex;
      bIndex = bIndex < 0 ? order.length + items.indexOf(b) : bIndex;
      return aIndex - bIndex;
    });
  }

  function sortFavoritesFirst(items) {
    var favoriteItems = [];
    var otherItems = [];

    for (var i = 0; i < items.length; i += 1) {
      if (indexOfKey(favorites, getPresetKey(items[i])) >= 0) {
        favoriteItems.push(items[i]);
      } else {
        otherItems.push(items[i]);
      }
    }

    return favoriteItems.concat(otherItems);
  }

  function moveInOrder(items) {
    var current = getPresets();
    var changed = current.length !== items.length;

    if (!changed) {
      for (var i = 0; i < items.length; i += 1) {
        if (current[i] !== items[i]) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return;
    }

    for (var p = 0; p < items.length; p += 1) {
      library.appendChild(items[p]);
    }
  }

  function createFavoriteIndicator() {
    var indicator = document.createElement('span');
    indicator.className = 'preset-favorite-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 2.8l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.68l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.8z"></path></svg>';
    return indicator;
  }

  function decoratePreset(item) {
    var key = getPresetKey(item);
    var isFavorite = indexOfKey(favorites, key) >= 0;
    var indicator = item.querySelector('.preset-favorite-indicator');

    item.setAttribute('draggable', 'true');
    item.setAttribute('role', item.getAttribute('role') || 'button');
    item.setAttribute('tabindex', item.getAttribute('tabindex') || '0');
    item.classList.toggle('is-favorite', isFavorite);
    item.setAttribute('title', 'Drag to reorder. Middle-click to ' + (isFavorite ? 'remove from Favorites.' : 'add to Favorites.'));

    if (isFavorite && !indicator) {
      item.appendChild(createFavoriteIndicator());
    } else if (!isFavorite && indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  function refresh() {
    if (!library) {
      return;
    }

    var items = getPresets();
    var libraryKey = getLibraryKey();
    var sorted = sortFavoritesFirst(sortBySavedOrder(items, orderByLibrary[libraryKey] || []));

    moveInOrder(sorted);

    for (var i = 0; i < sorted.length; i += 1) {
      decoratePreset(sorted[i]);
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) {
      return;
    }

    refreshTimer = window.setTimeout(function () {
      refreshTimer = null;

      if (draggedPreset) {
        return;
      }

      refresh();
    }, 40);
  }

  function persistDomOrder() {
    var items = getPresets();
    var order = [];

    for (var i = 0; i < items.length; i += 1) {
      order.push(getPresetKey(items[i]));
    }

    orderByLibrary[getLibraryKey()] = order;
    writeValue(ORDER_STORAGE_KEY, orderByLibrary);
  }

  function showStatus(message) {
    if (!status) {
      return;
    }

    if (statusTimer) {
      window.clearTimeout(statusTimer);
    }

    status.textContent = message;
    status.classList.add('is-visible');
    statusTimer = window.setTimeout(function () {
      status.classList.remove('is-visible');
      statusTimer = null;
    }, 1300);
  }

  function toggleFavorite(item) {
    var key = getPresetKey(item);
    var index = indexOfKey(favorites, key);

    if (index >= 0) {
      favorites.splice(index, 1);
      showStatus('Removed from Favorites');
    } else {
      favorites.push(key);
      showStatus('Added to Favorites');
    }

    writeValue(FAVORITES_STORAGE_KEY, favorites);
    refresh();
  }

  function clearDropIndicators() {
    var items = getPresets();
    for (var i = 0; i < items.length; i += 1) {
      items[i].classList.remove('flow-preset-drop-before', 'flow-preset-drop-after');
    }
  }

  function bindDragEvents() {
    library.addEventListener('dragstart', function (event) {
      var item = closest(event.target, '.preset');

      if (!item || closest(event.target, '.deleteButton')) {
        event.preventDefault();
        return;
      }

      draggedPreset = item;
      dragChanged = false;
      item.classList.add('dragging');
      library.classList.add('preset-library-reordering');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', getPresetKey(item));
        } catch (error) {}

        if (reorderMotion) {
          reorderMotion.createDragGhost(event, item, 'preset-drag-ghost');
        }
      }
    });

    library.addEventListener('dragover', function (event) {
      if (!draggedPreset) {
        return;
      }

      var target = closest(event.target, '.preset');
      event.preventDefault();

      if (!target || target === draggedPreset) {
        clearDropIndicators();
        return;
      }

      var rect = target.getBoundingClientRect();
      var middleX = rect.left + rect.width / 2;
      var middleY = rect.top + rect.height / 2;
      var sameRow = Math.abs(event.clientY - middleY) < rect.height * 0.34;
      var insertBefore = sameRow ? event.clientX < middleX : event.clientY < middleY;
      var alreadyPlaced = insertBefore ? draggedPreset.nextSibling === target : target.nextSibling === draggedPreset;

      clearDropIndicators();
      target.classList.add(insertBefore ? 'flow-preset-drop-before' : 'flow-preset-drop-after');

      if (alreadyPlaced) {
        return;
      }

      var movePreset = function () {
        if (insertBefore) {
          library.insertBefore(draggedPreset, target);
        } else {
          library.insertBefore(draggedPreset, target.nextSibling);
        }
      };

      if (reorderMotion) {
        reorderMotion.animate(library, '.preset', movePreset, draggedPreset);
      } else {
        movePreset();
      }

      dragChanged = true;
    });

    library.addEventListener('drop', function (event) {
      if (!draggedPreset) {
        return;
      }

      event.preventDefault();
      persistDomOrder();
    });

    library.addEventListener('dragend', function () {
      if (draggedPreset) {
        draggedPreset.classList.remove('dragging');
      }

      library.classList.remove('preset-library-reordering');
      clearDropIndicators();
      if (dragChanged) {
        persistDomOrder();
        suppressClickUntil = Date.now() + 180;
        scheduleRefresh();
      }

      draggedPreset = null;
      dragChanged = false;
    });
  }

  function bindPresetActions() {
    library.addEventListener('mousedown', function (event) {
      if (event.button !== 1) {
        return;
      }

      var item = closest(event.target, '.preset');
      if (!item || closest(event.target, '.deleteButton')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      toggleFavorite(item);
    }, true);

    library.addEventListener('auxclick', function (event) {
      if (event.button === 1 && closest(event.target, '.preset')) {
        event.preventDefault();
      }
    }, true);

    library.addEventListener('click', function (event) {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    library.addEventListener('keydown', function (event) {
      var item = closest(event.target, '.preset');
      if (!item) {
        return;
      }

      var key = event.key || event.keyCode;
      if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
        event.preventDefault();
        item.click();
      }
    });
  }

  function init() {
    library = document.getElementById('library');
    libraryDropdown = document.getElementById('ddLibraries');

    if (!library) {
      return;
    }

    status = document.createElement('div');
    status.className = 'preset-manager-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.getElementById('libraryPanel').appendChild(status);

    bindDragEvents();
    bindPresetActions();

    if (libraryDropdown) {
      libraryDropdown.addEventListener('change', scheduleRefresh);
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(scheduleRefresh);
      observer.observe(library, { childList: true });
    }

    refresh();
    window.setTimeout(refresh, 300);
    window.setTimeout(refresh, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
