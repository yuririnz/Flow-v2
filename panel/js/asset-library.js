(function () {
  'use strict';

  var STORAGE_KEY = 'flow.assetLibrary';
  var SHARED_FILE = 'Flow-3-asset-library.json';
  var PACKAGED_PATH_PREFIX = '@flow/';
  var IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'svg', 'psd', 'ai'];
  var VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'mpg', 'mpeg', 'mxf'];
  var ALL_EXTENSIONS = IMAGE_EXTENSIONS.concat(VIDEO_EXTENSIONS);
  var state = { version: 1, folders: [] };
  var activeFolderId = null;
  var hostScriptLoaded = false;
  var hostScriptLoading = false;
  var hostScriptCallbacks = [];
  var statusTimer = null;
  var mediaObserver = null;
  var videoObserver = null;
  var contextMenu = null;
  var draggedAssetId = null;
  var draggedFolderId = null;
  var draggedAssetElement = null;
  var assetDragChanged = false;
  var suppressAssetClickUntil = 0;
  var reorderMotion = window.FlowReorderMotion;

  var els = {
    root: document.getElementById('assetLibrary'),
    back: document.getElementById('assetBackButton'),
    title: document.getElementById('assetPageTitle'),
    description: document.getElementById('assetPageDescription'),
    count: document.getElementById('assetPageCount'),
    folderView: document.getElementById('assetFolderView'),
    folderGrid: document.getElementById('assetFolderGrid'),
    folderEmpty: document.getElementById('assetFolderEmpty'),
    itemsView: document.getElementById('assetItemsView'),
    itemGrid: document.getElementById('assetItemGrid'),
    itemEmpty: document.getElementById('assetItemEmpty'),
    status: document.getElementById('assetStatus'),
    primaryAction: document.getElementById('assetPrimaryAction')
  };

  function normalizeSystemPath(path) {
    path = decodeURI(String(path || '')).replace(/\\/g, '/');
    path = path.replace(/^file:\/\/\//i, '');
    path = path.replace(/^file:\/\//i, '');
    return path.replace(/\/+$/, '');
  }

  function getSharedLibraryPath() {
    try {
      if (window.__adobe_cep__ && window.cep && window.cep.fs) {
        var base = normalizeSystemPath(window.__adobe_cep__.getSystemPath('userData'));

        if (base) {
          return base.replace(/%24/g, '$') + '/' + SHARED_FILE;
        }
      }
    } catch (error) {}

    return '';
  }

  function readRawLibrary() {
    var path = getSharedLibraryPath();

    try {
      if (path && window.cep && window.cep.fs && window.cep.fs.readFile) {
        var file = window.cep.fs.readFile(path);

        if (file && file.data) {
          return file.data;
        }
      }
    } catch (error) {}

    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {}

    return '';
  }

  function cleanFolder(folder) {
    var assets = folder && Array.isArray(folder.assets) ? folder.assets : [];

    return {
      id: String(folder && folder.id || createId('folder')),
      name: String(folder && folder.name || 'Untitled folder'),
      iconPath: String(folder && folder.iconPath || ''),
      assets: assets.map(function (asset) {
        return {
          id: String(asset && asset.id || createId('asset')),
          name: String(asset && asset.name || fileNameFromPath(asset && asset.path || 'Asset')),
          path: String(asset && asset.path || ''),
          type: String(asset && asset.type || mediaTypeFromPath(asset && asset.path || ''))
        };
      }).filter(function (asset) {
        return !!asset.path;
      })
    };
  }

  function loadLibrary() {
    var raw = readRawLibrary();
    var parsed;
    var bundled = window.FlowDefaultAssetLibrary;
    var shouldSeedDefaults = !raw && bundled && Array.isArray(bundled.folders);

    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
      parsed = null;
    }

    state = {
      version: 1,
      folders: parsed && Array.isArray(parsed.folders)
        ? parsed.folders.map(cleanFolder)
        : (shouldSeedDefaults ? bundled.folders.map(cleanFolder) : [])
    };

    if (shouldSeedDefaults) {
      saveLibrary();
    }
  }

  function saveLibrary() {
    var raw = JSON.stringify(state);
    var path = getSharedLibraryPath();

    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch (error) {}

    try {
      if (path && window.cep && window.cep.fs && window.cep.fs.writeFile) {
        window.cep.fs.writeFile(path, raw);
      }
    } catch (error) {}
  }

  function createId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function fileNameFromPath(path) {
    var parts = String(path || '').replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'Asset';
  }

  function extensionFromPath(path) {
    var name = fileNameFromPath(path);
    var dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  }

  function mediaTypeFromPath(path) {
    return VIDEO_EXTENSIONS.indexOf(extensionFromPath(path)) >= 0 ? 'video' : 'image';
  }

  function isSupportedPath(path) {
    return ALL_EXTENSIONS.indexOf(extensionFromPath(path)) >= 0;
  }

  function pathToFileUrl(path) {
    var normalized = resolveLibraryPath(path).replace(/\\/g, '/');

    if (/^file:/i.test(normalized)) {
      return normalized;
    }

    if (normalized.slice(0, 2) === '//') {
      return encodeURI('file:' + normalized).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }

    return encodeURI('file:///' + normalized).replace(/#/g, '%23').replace(/\?/g, '%3F');
  }

  function resolveLibraryPath(path) {
    path = String(path || '');

    if (path.indexOf(PACKAGED_PATH_PREFIX) === 0) {
      return getPanelPath() + '/' + path.slice(PACKAGED_PATH_PREFIX.length);
    }

    return path;
  }

  function pluralize(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : plural);
  }

  function getActiveFolder() {
    for (var i = 0; i < state.folders.length; i++) {
      if (state.folders[i].id === activeFolderId) {
        return state.folders[i];
      }
    }

    return null;
  }

  function getFolderById(folderId) {
    for (var i = 0; i < state.folders.length; i++) {
      if (state.folders[i].id === folderId) {
        return state.folders[i];
      }
    }

    return null;
  }

  function closeContextMenu() {
    if (contextMenu && contextMenu.parentNode) {
      contextMenu.parentNode.removeChild(contextMenu);
    }

    contextMenu = null;
  }

  function contextMenuIcon(type) {
    if (type === 'delete') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9 7V4.5h6V7M7.5 7l.8 12h7.4l.8-12M10 10.5v5M14 10.5v5"></path></svg>';
    }

    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16.5-.7 3.2 3.2-.7L18 8.5 15.5 6 5 16.5ZM14 7.5l2.5 2.5"></path></svg>';
  }

  function showContextMenu(event, actions) {
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();

    var menu = document.createElement('div');
    menu.className = 'asset-context-menu';
    menu.setAttribute('role', 'menu');

    for (var i = 0; i < actions.length; i++) {
      (function (action) {
        var button = document.createElement('button');
        button.className = 'asset-context-menu__item' + (action.danger ? ' is-danger' : '');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        button.innerHTML = contextMenuIcon(action.icon) + '<span></span>';
        button.querySelector('span').textContent = action.label;
        button.addEventListener('click', function () {
          closeContextMenu();
          action.run();
        });
        menu.appendChild(button);
      })(actions[i]);
    }

    document.body.appendChild(menu);
    contextMenu = menu;

    var rect = menu.getBoundingClientRect();
    var left = Math.max(6, Math.min(event.clientX, window.innerWidth - rect.width - 6));
    var top = Math.max(6, Math.min(event.clientY, window.innerHeight - rect.height - 6));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    var first = menu.querySelector('button');
    if (first) {
      first.focus();
    }
  }

  function showConfirmDialog(options) {
    closeContextMenu();

    var overlay = document.createElement('div');
    overlay.className = 'asset-dialog-overlay';
    overlay.innerHTML =
      '<section class="asset-dialog asset-dialog--confirm" role="alertdialog" aria-modal="true" aria-labelledby="assetConfirmTitle" aria-describedby="assetConfirmDescription">' +
        '<div class="asset-dialog__header">' +
          '<div><h2 id="assetConfirmTitle"></h2><p id="assetConfirmDescription"></p></div>' +
          '<button class="asset-dialog__close" type="button" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="asset-dialog__actions"><button class="asset-dialog__action is-secondary" type="button">Cancel</button><button class="asset-dialog__action is-danger" type="button"></button></div>' +
      '</section>';

    overlay.querySelector('#assetConfirmTitle').textContent = options.title;
    overlay.querySelector('#assetConfirmDescription').textContent = options.description;
    var closeButton = overlay.querySelector('.asset-dialog__close');
    var cancelButton = overlay.querySelector('.asset-dialog__action.is-secondary');
    var confirmButton = overlay.querySelector('.asset-dialog__action.is-danger');
    confirmButton.textContent = options.confirmLabel;

    function close() {
      document.removeEventListener('keydown', onKeyDown, true);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function confirm() {
      close();
      options.confirm();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        close();
      }
    }

    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    confirmButton.addEventListener('click', confirm);
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        close();
      }
    });
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    cancelButton.focus();
  }

  function deleteFolder(folder) {
    showConfirmDialog({
      title: 'Delete “' + folder.name + '”?',
      description: 'This removes the folder and its saved asset references from Flow. Your original files stay on disk.',
      confirmLabel: 'Delete folder',
      confirm: function () {
        for (var i = 0; i < state.folders.length; i++) {
          if (state.folders[i].id === folder.id) {
            state.folders.splice(i, 1);
            break;
          }
        }

        saveLibrary();
        showFolderList();
        showStatus('Deleted “' + folder.name + '”.', false);
      }
    });
  }

  function deleteAsset(folder, asset) {
    showConfirmDialog({
      title: 'Remove this asset?',
      description: 'This removes “' + asset.name + '” from this Flow folder. The original file stays on disk.',
      confirmLabel: 'Delete asset',
      confirm: function () {
        for (var i = 0; i < folder.assets.length; i++) {
          if (folder.assets[i].id === asset.id) {
            folder.assets.splice(i, 1);
            break;
          }
        }

        saveLibrary();
        renderAssets();
        showStatus('Asset removed from “' + folder.name + '”.', false);
      }
    });
  }

  function folderIconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l1.8 2h9.2v9.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5Z"></path><path d="M3.5 10h17"></path></svg>';
  }

  function renderFolderIcon(container, iconPath) {
    container.textContent = '';

    if (!iconPath) {
      container.innerHTML = folderIconSvg();
      return;
    }

    var image = document.createElement('img');
    image.alt = '';
    image.src = pathToFileUrl(iconPath);
    image.addEventListener('error', function () {
      container.innerHTML = folderIconSvg();
    });
    container.appendChild(image);
  }

  function createFolderCard(folder) {
    var card = document.createElement('button');
    var icon = document.createElement('span');
    var copy = document.createElement('span');
    var name = document.createElement('span');

    card.className = 'asset-folder-card';
    card.type = 'button';
    card.setAttribute('aria-label', 'Open ' + folder.name);
    card.dataset.folderId = folder.id;
    icon.className = 'asset-folder-card__icon';
    copy.className = 'asset-folder-card__copy';
    name.className = 'asset-folder-card__name';
    name.textContent = folder.name;

    renderFolderIcon(icon, folder.iconPath);
    copy.appendChild(name);
    card.appendChild(icon);
    card.appendChild(copy);
    card.addEventListener('click', function () {
      openFolder(folder.id);
    });
    card.addEventListener('contextmenu', function (event) {
      showContextMenu(event, [
        {
          label: 'Edit folder',
          icon: 'edit',
          run: function () { showFolderDialog(folder); }
        },
        {
          label: 'Delete folder',
          icon: 'delete',
          danger: true,
          run: function () { deleteFolder(folder); }
        }
      ]);
    });
    card.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', function (event) {
      if (!event.relatedTarget || !card.contains(event.relatedTarget)) {
        card.classList.remove('is-drop-target');
      }
    });
    card.addEventListener('drop', function (event) {
      event.preventDefault();
      event.stopPropagation();
      card.classList.remove('is-drop-target');
      addDroppedFiles(folder, event);
    });
    return card;
  }

  function renderFolders() {
    els.folderGrid.textContent = '';

    for (var i = 0; i < state.folders.length; i++) {
      els.folderGrid.appendChild(createFolderCard(state.folders[i]));
    }

    els.folderEmpty.hidden = state.folders.length > 0;
    els.count.textContent = pluralize(state.folders.length, 'folder', 'folders');
  }

  function fallbackMediaSvg(type) {
    if (type === 'video') {
      return '<svg class="asset-item__fallback" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="12" height="14" rx="2"></rect><path d="m15.5 10 5-3v10l-5-3z"></path></svg>';
    }

    return '<svg class="asset-item__fallback" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect><circle cx="9" cy="9.5" r="1.4"></circle><path d="m5.5 17 4.2-4.2 3 3 2.3-2.3 3.5 3.5"></path></svg>';
  }

  function loadMediaSource(media, path) {
    if (!media.getAttribute('src')) {
      media.src = pathToFileUrl(path);
    }
  }

  function canPlayVideoPreview(video) {
    return !!(
      activeFolderId &&
      !document.hidden &&
      !els.itemsView.hidden &&
      video &&
      video._flowPreviewVisible
    );
  }

  function playVideoPreview(video) {
    if (!canPlayVideoPreview(video)) {
      return;
    }

    var pending = video.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch(function () {
        // Muted previews normally autoplay. Unsupported codecs still fall back through the error handler.
      });
    }
  }

  function pauseVideoPreview(video, releaseSource) {
    if (!video) {
      return;
    }

    video.pause();
    if (releaseSource && video.getAttribute('src')) {
      video.removeAttribute('src');
      try {
        video.load();
      } catch (error) {}
    }
  }

  function syncVideoPreviews() {
    var videos = els.itemGrid.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      if (canPlayVideoPreview(videos[i])) {
        playVideoPreview(videos[i]);
      } else {
        pauseVideoPreview(videos[i], false);
      }
    }
  }

  function stopVideoPreviews(releaseSources) {
    var videos = els.itemGrid.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      pauseVideoPreview(videos[i], !!releaseSources);
      videos[i]._flowPreviewVisible = false;
    }
  }

  function disconnectMediaObservers() {
    if (mediaObserver) {
      mediaObserver.disconnect();
      mediaObserver = null;
    }

    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
  }

  function observeMedia(media, path) {
    if (!window.IntersectionObserver) {
      loadMediaSource(media, path);
      if (media.tagName === 'VIDEO') {
        media._flowPreviewVisible = true;
        playVideoPreview(media);
      }
      return;
    }

    if (media.tagName === 'VIDEO') {
      if (!videoObserver) {
        videoObserver = new window.IntersectionObserver(function (entries) {
          for (var v = 0; v < entries.length; v++) {
            var video = entries[v].target;
            video._flowPreviewVisible = entries[v].isIntersecting && entries[v].intersectionRatio >= 0.15;

            if (video._flowPreviewVisible) {
              var videoPath = video.getAttribute('data-asset-src');
              if (videoPath) {
                loadMediaSource(video, videoPath);
              }
              playVideoPreview(video);
            } else {
              pauseVideoPreview(video, false);
            }
          }
        }, { root: els.root, rootMargin: '0px', threshold: 0.15 });
      }

      media._flowPreviewVisible = false;
      media.setAttribute('data-asset-src', path);
      videoObserver.observe(media);
      return;
    }

    if (!mediaObserver) {
      mediaObserver = new window.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            var target = entries[i].target;
            var pendingPath = target.getAttribute('data-asset-src');
            target.removeAttribute('data-asset-src');
            loadMediaSource(target, pendingPath);
            mediaObserver.unobserve(target);
          }
        }
      }, { root: els.root, rootMargin: '120px' });
    }

    media.setAttribute('data-asset-src', path);
    mediaObserver.observe(media);
  }

  function createAssetCard(asset, folder) {
    var card = document.createElement('button');
    var preview = document.createElement('span');
    var media = document.createElement(asset.type === 'video' ? 'video' : 'img');

    card.className = 'asset-item';
    card.type = 'button';
    card.draggable = true;
    card.dataset.assetId = asset.id;
    card.setAttribute('aria-label', 'Add ' + asset.name + ' to the active composition');
    preview.className = 'asset-item__preview';
    media.alt = '';

    if (asset.type === 'video') {
      media.muted = true;
      media.defaultMuted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = 'none';
      media.setAttribute('muted', '');
      media.setAttribute('loop', '');
      media.setAttribute('playsinline', '');
    }

    media.addEventListener('error', function () {
      if (videoObserver && asset.type === 'video') {
        videoObserver.unobserve(media);
      }

      if (media.parentNode === preview) {
        preview.removeChild(media);
        preview.insertAdjacentHTML('afterbegin', fallbackMediaSvg(asset.type));
      }
    });

    observeMedia(media, asset.path);
    preview.appendChild(media);
    card.appendChild(preview);
    card.addEventListener('click', function () {
      if (Date.now() < suppressAssetClickUntil) {
        return;
      }

      addAssetToComposition(asset, folder, card);
    });
    card.addEventListener('contextmenu', function (event) {
      showContextMenu(event, [
        {
          label: 'Delete asset',
          icon: 'delete',
          danger: true,
          run: function () { deleteAsset(folder, asset); }
        }
      ]);
    });
    card.addEventListener('dragstart', function (event) {
      closeContextMenu();
      draggedAssetId = asset.id;
      draggedFolderId = folder.id;
      draggedAssetElement = card;
      assetDragChanged = false;
      card.classList.add('is-dragging');
      els.itemGrid.classList.add('asset-grid-reordering');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-flow-asset', asset.id);

      if (reorderMotion) {
        reorderMotion.createDragGhost(event, card, 'asset-drag-ghost');
      }
    });
    card.addEventListener('dragover', function (event) {
      if (!draggedAssetId || draggedFolderId !== folder.id) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearReorderTargets();
      event.dataTransfer.dropEffect = 'move';

      if (draggedAssetId === asset.id) {
        return;
      }

      var rect = card.getBoundingClientRect();
      var after = event.clientY > rect.top + rect.height / 2;
      card.classList.add(after ? 'is-reorder-after' : 'is-reorder-before');
      moveAssetElement(card, after);
    });
    card.addEventListener('dragleave', function (event) {
      if (!event.relatedTarget || !card.contains(event.relatedTarget)) {
        card.classList.remove('is-reorder-before', 'is-reorder-after');
      }
    });
    card.addEventListener('drop', function (event) {
      if (!draggedAssetId || draggedFolderId !== folder.id) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (draggedAssetId === asset.id) {
        finishAssetDrag(folder);
        return;
      }

      var rect = card.getBoundingClientRect();
      var after = event.clientY > rect.top + rect.height / 2;
      moveAssetElement(card, after);
      finishAssetDrag(folder);
    });
    card.addEventListener('dragend', function () {
      finishAssetDrag(folder);
    });
    return card;
  }

  function clearReorderTargets() {
    var targets = els.itemGrid.querySelectorAll('.is-reorder-before, .is-reorder-after');
    for (var i = 0; i < targets.length; i++) {
      targets[i].classList.remove('is-reorder-before', 'is-reorder-after');
    }
  }

  function persistAssetDomOrder(folder) {
    var nodes = els.itemGrid.querySelectorAll('.asset-item');
    var byId = {};
    var reordered = [];
    var i;

    for (i = 0; i < folder.assets.length; i++) {
      byId[folder.assets[i].id] = folder.assets[i];
    }

    for (i = 0; i < nodes.length; i++) {
      if (byId[nodes[i].dataset.assetId]) {
        reordered.push(byId[nodes[i].dataset.assetId]);
      }
    }

    if (reordered.length === folder.assets.length) {
      folder.assets = reordered;
      saveLibrary();
    }
  }

  function moveAssetElement(target, after) {
    if (!draggedAssetElement || target === draggedAssetElement) {
      return;
    }

    var alreadyPlaced = after ? target.nextSibling === draggedAssetElement : draggedAssetElement.nextSibling === target;
    if (alreadyPlaced) {
      return;
    }

    var move = function () {
      if (after) {
        els.itemGrid.insertBefore(draggedAssetElement, target.nextSibling);
      } else {
        els.itemGrid.insertBefore(draggedAssetElement, target);
      }
    };

    if (reorderMotion) {
      reorderMotion.animate(els.itemGrid, '.asset-item', move, draggedAssetElement);
    } else {
      move();
    }

    assetDragChanged = true;
  }

  function moveDraggedAssetElementToEnd() {
    if (!draggedAssetElement || draggedAssetElement === els.itemGrid.lastElementChild) {
      return;
    }

    var move = function () {
      els.itemGrid.appendChild(draggedAssetElement);
    };

    if (reorderMotion) {
      reorderMotion.animate(els.itemGrid, '.asset-item', move, draggedAssetElement);
    } else {
      move();
    }

    assetDragChanged = true;
  }

  function finishAssetDrag(folder) {
    if (draggedAssetElement) {
      draggedAssetElement.classList.remove('is-dragging');
    }

    els.itemGrid.classList.remove('asset-grid-reordering');
    suppressAssetClickUntil = Date.now() + 240;

    if (assetDragChanged && folder) {
      persistAssetDomOrder(folder);
      showStatus('Asset order updated.', false);
    }

    draggedAssetId = null;
    draggedFolderId = null;
    draggedAssetElement = null;
    assetDragChanged = false;
    clearReorderTargets();
  }

  function renderAssets() {
    var folder = getActiveFolder();

    if (!folder) {
      showFolderList();
      return;
    }

    stopVideoPreviews(true);
    disconnectMediaObservers();

    els.itemGrid.textContent = '';

    for (var i = 0; i < folder.assets.length; i++) {
      els.itemGrid.appendChild(createAssetCard(folder.assets[i], folder));
    }

    els.itemEmpty.hidden = folder.assets.length > 0;
    els.title.textContent = folder.name;
    els.description.textContent = 'Drop media here. Click any preview to add it.';
  }

  function openFolder(folderId) {
    activeFolderId = folderId;
    els.root.classList.add('is-folder-open');
    els.back.hidden = false;
    els.folderView.hidden = true;
    els.itemsView.hidden = false;
    renderAssets();
  }

  function showFolderList() {
    stopVideoPreviews(true);
    disconnectMediaObservers();
    activeFolderId = null;
    els.root.classList.remove('is-folder-open');
    els.back.hidden = true;
    els.folderView.hidden = false;
    els.itemsView.hidden = true;
    els.title.textContent = 'Assets';
    els.description.textContent = 'Keep images and videos ready to add.';
    els.primaryAction.setAttribute('aria-label', 'Create folder');
    els.primaryAction.setAttribute('title', 'Create folder');
    renderFolders();
  }

  function fileUriToPath(value) {
    var path = String(value || '').replace(/^\s+|\s+$/g, '');

    if (!/^file:/i.test(path)) {
      return path;
    }

    try {
      path = decodeURI(path);
    } catch (error) {}

    path = path.replace(/^file:\/\/\//i, '');
    path = path.replace(/^file:\/\//i, '');
    return path.replace(/^\/([A-Za-z]:)/, '$1');
  }

  function droppedPaths(event) {
    var transfer = event && event.dataTransfer;
    var paths = [];
    var seen = {};

    function append(path) {
      path = fileUriToPath(path);
      var key = normalizeSystemPath(path).toLowerCase();

      if (!path || seen[key]) {
        return;
      }

      seen[key] = true;
      paths.push(path);
    }

    if (!transfer) {
      return paths;
    }

    if (transfer.files) {
      for (var i = 0; i < transfer.files.length; i++) {
        append(transfer.files[i].path || '');
      }
    }

    if (!paths.length && typeof transfer.getData === 'function') {
      var raw = transfer.getData('text/uri-list') || transfer.getData('text/plain') || '';
      var lines = raw.split(/\r?\n/);

      for (var j = 0; j < lines.length; j++) {
        if (lines[j] && lines[j].charAt(0) !== '#') {
          append(lines[j]);
        }
      }
    }

    return paths;
  }

  function addPathsToFolder(folder, paths) {
    var existing = {};
    var added = 0;

    for (var i = 0; i < folder.assets.length; i++) {
      existing[normalizeSystemPath(folder.assets[i].path).toLowerCase()] = true;
    }

    for (var j = 0; j < paths.length; j++) {
      var path = String(paths[j] || '');
      var key = normalizeSystemPath(path).toLowerCase();

      if (!path || !isSupportedPath(path) || existing[key]) {
        continue;
      }

      folder.assets.push({
        id: createId('asset'),
        name: fileNameFromPath(path),
        path: path,
        type: mediaTypeFromPath(path)
      });
      existing[key] = true;
      added++;
    }

    if (added) {
      saveLibrary();

      if (activeFolderId === folder.id) {
        renderAssets();
      } else {
        renderFolders();
      }
    }

    return added;
  }

  function addDroppedFiles(folder, event) {
    var paths = droppedPaths(event);
    var added = addPathsToFolder(folder, paths);

    if (added) {
      showStatus(pluralize(added, 'asset', 'assets') + ' added to “' + folder.name + '”.', false);
    } else {
      showStatus(paths.length ? 'No new supported files were added.' : 'Flow could not read the dropped file path.', true);
    }
  }

  function showStatus(message, isError) {
    window.clearTimeout(statusTimer);
    els.status.textContent = message;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = false;
    statusTimer = window.setTimeout(function () {
      els.status.hidden = true;
    }, isError ? 4200 : 2400);
  }

  function selectFiles(options, callback) {
    options = options || {};
    var extensions = options.extensions || ALL_EXTENSIONS;

    try {
      if (window.cep && window.cep.fs) {
        var picker = window.cep.fs.showOpenDialogEx || window.cep.fs.showOpenDialog;

        if (typeof picker === 'function') {
          var result = picker.call(window.cep.fs, !!options.multiple, false, options.title || 'Choose files', '', extensions);
          var paths = result && Array.isArray(result.data) ? result.data : [];

          if (!result || result.err === 0 || result.err === undefined) {
            callback(paths.filter(Boolean));
            return;
          }
        }
      }
    } catch (error) {}

    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!options.multiple;
    input.accept = extensions.map(function (extension) { return '.' + extension; }).join(',');
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var paths = [];

      for (var i = 0; i < input.files.length; i++) {
        var path = input.files[i].path || '';

        if (path) {
          paths.push(path);
        }
      }

      document.body.removeChild(input);

      if (!paths.length && input.files.length) {
        showStatus('Flow could not read the selected file path.', true);
      }

      callback(paths);
    });
    document.body.appendChild(input);
    input.click();
  }

  function showFolderDialog(folder) {
    var overlay = document.createElement('div');
    var isEditing = !!folder;
    var iconPath = isEditing ? folder.iconPath : '';

    overlay.className = 'asset-dialog-overlay';
    overlay.innerHTML =
      '<section class="asset-dialog" role="dialog" aria-modal="true" aria-labelledby="assetDialogTitle">' +
        '<div class="asset-dialog__header">' +
          '<div><h2 id="assetDialogTitle"></h2><p class="asset-dialog__description"></p></div>' +
          '<button class="asset-dialog__close" type="button" aria-label="Close">×</button>' +
        '</div>' +
        '<label class="asset-dialog__field"><span>Folder name</span><input class="asset-dialog__input" type="text" maxlength="48" autocomplete="off" spellcheck="false" placeholder="e.g. Overlays" /></label>' +
        '<div class="asset-dialog__field"><span>Folder icon · Optional</span><div class="asset-dialog__icon-row"><div class="asset-dialog__icon-preview"></div><div class="asset-dialog__icon-actions"><button class="asset-dialog__icon-button" type="button">Choose icon</button><button class="asset-dialog__icon-button is-muted" type="button">Use default</button></div></div></div>' +
        '<div class="asset-dialog__error" role="alert"></div>' +
        '<div class="asset-dialog__actions"><button class="asset-dialog__action is-secondary" type="button">Cancel</button><button class="asset-dialog__action is-primary" type="button"></button></div>' +
      '</section>';

    var dialog = overlay.querySelector('.asset-dialog');
    var title = overlay.querySelector('#assetDialogTitle');
    var description = overlay.querySelector('.asset-dialog__description');
    var input = overlay.querySelector('.asset-dialog__input');
    var preview = overlay.querySelector('.asset-dialog__icon-preview');
    var iconButton = overlay.querySelector('.asset-dialog__icon-button');
    var defaultIconButton = overlay.querySelector('.asset-dialog__icon-button.is-muted');
    var error = overlay.querySelector('.asset-dialog__error');
    var closeButton = overlay.querySelector('.asset-dialog__close');
    var cancelButton = overlay.querySelector('.asset-dialog__action.is-secondary');
    var saveButton = overlay.querySelector('.asset-dialog__action.is-primary');

    title.textContent = isEditing ? 'Edit folder' : 'Create folder';
    description.textContent = isEditing ? 'Update the folder name or choose a different icon.' : 'Name the folder and optionally choose a custom image for its icon.';
    input.value = isEditing ? folder.name : '';
    saveButton.textContent = isEditing ? 'Save changes' : 'Create folder';

    function syncIcon() {
      renderFolderIcon(preview, iconPath);
      iconButton.textContent = iconPath ? 'Change icon' : 'Choose icon';
      defaultIconButton.hidden = !iconPath;
    }

    syncIcon();

    function close() {
      document.removeEventListener('keydown', onKeyDown, true);

      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function save() {
      var name = input.value.replace(/^\s+|\s+$/g, '');

      if (!name) {
        error.textContent = 'Enter a folder name.';
        input.focus();
        return;
      }

      for (var i = 0; i < state.folders.length; i++) {
        if (state.folders[i].id !== (folder && folder.id) && state.folders[i].name.toLowerCase() === name.toLowerCase()) {
          error.textContent = 'A folder with this name already exists.';
          input.focus();
          input.select();
          return;
        }
      }

      if (isEditing) {
        folder.name = name;
        folder.iconPath = iconPath;
      } else {
        state.folders.push({
          id: createId('folder'),
          name: name,
          iconPath: iconPath,
          assets: []
        });
      }

      saveLibrary();
      if (activeFolderId === (folder && folder.id)) {
        renderAssets();
      } else {
        renderFolders();
      }
      close();
      showStatus((isEditing ? 'Updated “' : 'Created “') + name + '”.', false);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault();
        close();
      } else if ((event.key === 'Enter' || event.keyCode === 13) && event.target !== iconButton) {
        event.preventDefault();
        save();
      }
    }

    iconButton.addEventListener('click', function () {
      selectFiles({
        multiple: false,
        title: 'Choose a folder icon',
        extensions: IMAGE_EXTENSIONS
      }, function (paths) {
        if (!paths.length) {
          return;
        }

        iconPath = paths[0];
        syncIcon();
      });
    });
    defaultIconButton.addEventListener('click', function () {
      iconPath = '';
      syncIcon();
    });
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    saveButton.addEventListener('click', save);
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        close();
      }
    });
    dialog.addEventListener('mousedown', function (event) {
      event.stopPropagation();
    });
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    window.setTimeout(function () {
      input.focus();
    }, 0);
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
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"';
  }

  function evalScript(script, callback) {
    var bridge = window.__adobe_cep__;

    if (!bridge || typeof bridge.evalScript !== 'function') {
      callback('{"ok":false,"message":"The After Effects bridge is unavailable."}');
      return;
    }

    bridge.evalScript(script, callback);
  }

  function loadHostScript(callback) {
    if (hostScriptLoaded) {
      callback(true);
      return;
    }

    hostScriptCallbacks.push(callback);

    if (hostScriptLoading) {
      return;
    }

    hostScriptLoading = true;
    var path = getPanelPath() + '/jsx/asset-library.jsx';
    evalScript('$.evalFile(new File(' + quoteExtendScriptString(path) + ')); "ok";', function (result) {
      var ok = result === 'ok';
      hostScriptLoaded = ok;
      hostScriptLoading = false;

      while (hostScriptCallbacks.length) {
        hostScriptCallbacks.shift()(ok);
      }
    });
  }

  function parseHostResult(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { ok: false, message: String(raw || 'After Effects returned an unknown error.') };
    }
  }

  function addAssetToComposition(asset, folder, card) {
    if (card.disabled) {
      return;
    }

    card.disabled = true;
    showStatus('Adding “' + asset.name + '”…', false);
    loadHostScript(function (loaded) {
      if (!loaded) {
        card.disabled = false;
        showStatus('Could not load the asset importer.', true);
        return;
      }

      var script = 'FlowAssetLibrary.add(' +
        quoteExtendScriptString(resolveLibraryPath(asset.path)) + ', ' +
        quoteExtendScriptString(asset.name) + ', ' +
        quoteExtendScriptString(folder.name) +
      ');';

      evalScript(script, function (raw) {
        var result = parseHostResult(raw);
        card.disabled = false;
        showStatus(result.message || (result.ok ? 'Asset added.' : 'Could not add the asset.'), !result.ok);
      });
    });
  }

  function bindEvents() {
    els.back.addEventListener('click', showFolderList);
    els.primaryAction.addEventListener('click', function () {
      if (!activeFolderId) {
        showFolderDialog(null);
      }
    });
    els.itemsView.addEventListener('dragenter', function (event) {
      if (!activeFolderId || draggedAssetId) {
        return;
      }

      event.preventDefault();
      els.itemsView.classList.add('is-drag-over');
    });
    els.itemsView.addEventListener('dragover', function (event) {
      if (!activeFolderId) {
        return;
      }

      event.preventDefault();
      if (draggedAssetId) {
        event.dataTransfer.dropEffect = 'move';
        els.itemsView.classList.remove('is-drag-over');
        return;
      }

      event.dataTransfer.dropEffect = 'copy';
      els.itemsView.classList.add('is-drag-over');
    });
    els.itemsView.addEventListener('dragleave', function (event) {
      if (!event.relatedTarget || !els.itemsView.contains(event.relatedTarget)) {
        els.itemsView.classList.remove('is-drag-over');
      }
    });
    els.itemsView.addEventListener('drop', function (event) {
      var folder = getActiveFolder();

      event.preventDefault();
      els.itemsView.classList.remove('is-drag-over');

      if (folder && draggedAssetId && draggedFolderId === folder.id) {
        moveDraggedAssetElementToEnd();
        finishAssetDrag(folder);
        return;
      }

      if (folder) {
        addDroppedFiles(folder, event);
      }
    });
    document.addEventListener('mousedown', function (event) {
      if (contextMenu && !contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    }, true);
    document.addEventListener('keydown', function (event) {
      if ((event.key === 'Escape' || event.keyCode === 27) && contextMenu) {
        event.preventDefault();
        closeContextMenu();
      }
    }, true);
    window.addEventListener('blur', function () {
      closeContextMenu();
      stopVideoPreviews(false);
    });
    window.addEventListener('focus', syncVideoPreviews);
    els.root.addEventListener('scroll', closeContextMenu);
    document.addEventListener('visibilitychange', syncVideoPreviews);
    document.addEventListener('ios-home-indicator:swipe-up', function () {
      stopVideoPreviews(false);
    });
    window.addEventListener('pagehide', function () {
      stopVideoPreviews(false);
    });
    window.addEventListener('beforeunload', function () {
      stopVideoPreviews(false);
    });
  }

  function init() {
    if (!els.root) {
      return;
    }

    loadLibrary();
    bindEvents();
    showFolderList();

    window.FlowAssetLibraryUI = {
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      openCreateFolder: function () { showFolderDialog(null); },
      showFolders: showFolderList
    };
  }

  init();
})();
