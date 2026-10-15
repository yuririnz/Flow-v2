(function () {
  'use strict';

  var hostScriptLoaded = false;
  var hostScriptLoading = false;
  var pendingCallbacks = [];
  var scriptPath;
  var solidColorOverlay = null;
  var solidColorKeyHandler = null;
  var motionToolManagerOverlay = null;
  var motionToolManagerKeyHandler = null;
  var motionToolAlertOverlay = null;
  var motionToolAlertKeyHandler = null;
  var SOLID_COLOR_STORAGE_KEY = 'flow-prime-solid-color';
  var MOTION_TOOL_ORDER_STORAGE_KEY = 'flow-motion-tool-order';
  var MOTION_TOOL_VISIBILITY_STORAGE_KEY = 'flow-motion-tool-hidden';
  var draggedMotionTool = null;
  var motionToolDragChanged = false;
  var suppressMotionToolClickUntil = 0;
  var anchorColorRevision = 0;

  function extractCssUrl(value) {
    var match = String(value || '').trim().match(/^url\(["']?(.*?)["']?\)$/);
    return match ? match[1] : '';
  }

  function parseHexColor(value) {
    var hex = String(value || '').trim().replace(/^#/, '');

    if (/^[0-9a-f]{3}$/i.test(hex)) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }

    if (!/^[0-9a-f]{6}$/i.test(hex)) {
      hex = 'ffffff';
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  function getAnchorInnerColor(value) {
    var color = parseHexColor(value);
    var luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
    var factor = luminance > 210 ? 0.48 : luminance > 175 ? 0.62 : 1;

    return {
      r: Math.round(color.r * factor),
      g: Math.round(color.g * factor),
      b: Math.round(color.b * factor)
    };
  }

  function lightenColor(color, amount) {
    return {
      r: Math.round(color.r + (255 - color.r) * amount),
      g: Math.round(color.g + (255 - color.g) * amount),
      b: Math.round(color.b + (255 - color.b) * amount)
    };
  }

  function renderTintedAnchor(button, source, color, propertyName, revision) {
    if (!source) {
      return;
    }

    var image = new Image();
    image.onload = function () {
      if (revision !== anchorColorRevision) {
        return;
      }

      var canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width || 20;
      canvas.height = image.naturalHeight || image.height || 20;
      var context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      var pixels;
      try {
        pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      } catch (error) {
        return;
      }

      var data = pixels.data;
      var darkest = 255;
      var lightest = 0;
      var i;

      for (i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) {
          continue;
        }

        var luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        darkest = Math.min(darkest, luminance);
        lightest = Math.max(lightest, luminance);
      }

      var threshold = (darkest + lightest) / 2;
      for (i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) {
          continue;
        }

        var pixelLuminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        var output = pixelLuminance > threshold ? { r: 255, g: 255, b: 255 } : color;
        data[i] = output.r;
        data[i + 1] = output.g;
        data[i + 2] = output.b;
      }

      context.putImageData(pixels, 0, 0);
      button.style.setProperty(propertyName, 'url("' + canvas.toDataURL('image/png') + '")');
    };
    image.src = source;
  }

  function refreshMotionAnchorColors(themeColor) {
    var buttons = document.querySelectorAll('[data-motion-tools-anchor]');
    var innerColor = getAnchorInnerColor(themeColor);
    var hoverColor = lightenColor(innerColor, 0.18);
    var revision = ++anchorColorRevision;

    for (var i = 0; i < buttons.length; i++) {
      var styles = window.getComputedStyle(buttons[i]);
      var normalSource = extractCssUrl(styles.getPropertyValue('--motion-anchor-image'));
      var hoverSource = extractCssUrl(styles.getPropertyValue('--motion-anchor-hover-image'));
      renderTintedAnchor(buttons[i], normalSource, innerColor, '--motion-anchor-rendered-image', revision);
      renderTintedAnchor(buttons[i], hoverSource, hoverColor, '--motion-anchor-rendered-hover-image', revision);
    }
  }

  window.FlowMotionTools = window.FlowMotionTools || {};
  window.FlowMotionTools.refreshAnchorColors = refreshMotionAnchorColors;

  function closestMotionToolButton(target, grid) {
    while (target && target !== grid) {
      if (target.nodeType === 1 && target.classList && target.classList.contains('motion-tools-action')) {
        if (target.hasAttribute('data-motion-tools-customize')) {
          return null;
        }

        return target.parentNode === grid ? target : null;
      }

      target = target.parentNode;
    }

    return null;
  }

  function getMotionToolOrderKey(button) {
    if (!button) {
      return '';
    }

    return button.getAttribute('data-prime-tool') || (button.hasAttribute('data-motion-tools-secret') ? 'SECRET' : '');
  }

  function getMotionToolButtons(grid) {
    var result = [];
    var children = grid ? grid.children : [];

    for (var i = 0; i < children.length; i++) {
      if (children[i].classList && children[i].classList.contains('motion-tools-action') && !children[i].hasAttribute('data-motion-tools-customize')) {
        result.push(children[i]);
      }
    }

    return result;
  }

  function readMotionToolOrder() {
    try {
      var value = JSON.parse(window.localStorage.getItem(MOTION_TOOL_ORDER_STORAGE_KEY) || '[]');
      return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
    } catch (error) {
      return [];
    }
  }

  function persistMotionToolOrder(grid) {
    var buttons = getMotionToolButtons(grid);
    var order = [];

    for (var i = 0; i < buttons.length; i++) {
      var key = getMotionToolOrderKey(buttons[i]);
      if (key) {
        order.push(key);
      }
    }

    try {
      window.localStorage.setItem(MOTION_TOOL_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch (error) {}
  }

  function restoreMotionToolOrder(grid) {
    var buttons = getMotionToolButtons(grid);
    var order = readMotionToolOrder();
    var byKey = {};
    var placed = {};
    var i;

    for (i = 0; i < buttons.length; i++) {
      byKey[getMotionToolOrderKey(buttons[i])] = buttons[i];
    }

    for (i = 0; i < order.length; i++) {
      if (byKey[order[i]] && !placed[order[i]]) {
        grid.appendChild(byKey[order[i]]);
        placed[order[i]] = true;
      }
    }

    for (i = 0; i < buttons.length; i++) {
      var key = getMotionToolOrderKey(buttons[i]);
      if (!placed[key]) {
        grid.appendChild(buttons[i]);
      }
    }

    var customizeButton = grid.querySelector('[data-motion-tools-customize]');
    if (customizeButton) {
      grid.appendChild(customizeButton);
    }
  }

  function readHiddenMotionTools() {
    try {
      var value = JSON.parse(window.localStorage.getItem(MOTION_TOOL_VISIBILITY_STORAGE_KEY) || '[]');
      return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
    } catch (error) {
      return [];
    }
  }

  function isMotionToolHidden(toolName, hiddenTools) {
    for (var i = 0; i < hiddenTools.length; i++) {
      if (hiddenTools[i] === toolName) {
        return true;
      }
    }

    return false;
  }

  function saveHiddenMotionTools(hiddenTools) {
    try {
      window.localStorage.setItem(MOTION_TOOL_VISIBILITY_STORAGE_KEY, JSON.stringify(hiddenTools));
    } catch (error) {}
  }

  function getCustomizableMotionTools(grid) {
    var result = [];
    var buttons = grid ? grid.querySelectorAll('[data-prime-tool]') : [];

    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].parentNode === grid) {
        result.push(buttons[i]);
      }
    }

    return result;
  }

  function applyMotionToolVisibility(grid, hiddenTools) {
    var buttons = getCustomizableMotionTools(grid);
    hiddenTools = hiddenTools || readHiddenMotionTools();

    for (var i = 0; i < buttons.length; i++) {
      var hidden = isMotionToolHidden(getMotionToolOrderKey(buttons[i]), hiddenTools);
      buttons[i].hidden = hidden;
      buttons[i].setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }
  }

  function clearMotionToolDropIndicators(grid) {
    var buttons = getMotionToolButtons(grid);

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('is-reorder-before', 'is-reorder-after');
    }
  }

  function bindMotionToolReorder(grid) {
    if (!grid) {
      return;
    }

    restoreMotionToolOrder(grid);

    var buttons = getMotionToolButtons(grid);
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('draggable', 'true');
    }

    grid.addEventListener('click', function (event) {
      if (Date.now() < suppressMotionToolClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    grid.addEventListener('dragstart', function (event) {
      var button = closestMotionToolButton(event.target, grid);

      if (!button) {
        event.preventDefault();
        return;
      }

      draggedMotionTool = button;
      motionToolDragChanged = false;
      button.classList.add('is-dragging');
      grid.classList.add('motion-tools-reordering');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', getMotionToolOrderKey(button));
        } catch (error) {}

        if (window.FlowReorderMotion) {
          window.FlowReorderMotion.createDragGhost(event, button, 'motion-tools-drag-ghost');
        }
      }
    });

    grid.addEventListener('dragover', function (event) {
      if (!draggedMotionTool) {
        return;
      }

      var target = closestMotionToolButton(event.target, grid);
      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }

      clearMotionToolDropIndicators(grid);

      if (!target || target === draggedMotionTool) {
        return;
      }

      var rect = target.getBoundingClientRect();
      var middleX = rect.left + rect.width / 2;
      var middleY = rect.top + rect.height / 2;
      var sameRow = Math.abs(event.clientY - middleY) < rect.height * 0.45;
      var insertBefore = sameRow ? event.clientX < middleX : event.clientY < middleY;
      var alreadyPlaced = insertBefore ? draggedMotionTool.nextElementSibling === target : target.nextElementSibling === draggedMotionTool;

      target.classList.add(insertBefore ? 'is-reorder-before' : 'is-reorder-after');

      if (alreadyPlaced) {
        return;
      }

      var move = function () {
        if (insertBefore) {
          grid.insertBefore(draggedMotionTool, target);
        } else {
          grid.insertBefore(draggedMotionTool, target.nextElementSibling);
        }
      };

      if (window.FlowReorderMotion) {
        window.FlowReorderMotion.animate(grid, '.motion-tools-action:not([data-motion-tools-customize]):not([hidden])', move, draggedMotionTool);
      } else {
        move();
      }

      motionToolDragChanged = true;
    });

    grid.addEventListener('drop', function (event) {
      if (!draggedMotionTool) {
        return;
      }

      event.preventDefault();
      persistMotionToolOrder(grid);
    });

    grid.addEventListener('dragend', function () {
      if (draggedMotionTool) {
        draggedMotionTool.classList.remove('is-dragging');
      }

      grid.classList.remove('motion-tools-reordering');
      clearMotionToolDropIndicators(grid);

      if (motionToolDragChanged) {
        persistMotionToolOrder(grid);
      }

      suppressMotionToolClickUntil = Date.now() + 220;
      draggedMotionTool = null;
      motionToolDragChanged = false;
    });
  }

  function getCepBridge() {
    return window.__adobe_cep__;
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

  function getHostScriptPath() {
    if (!scriptPath) {
      scriptPath = getPanelPath() + '/jsx/prime-tools.jsx';
    }

    return scriptPath;
  }

  function quoteExtendScriptString(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function evalScript(script, callback) {
    var cep = getCepBridge();

    if (!cep || typeof cep.evalScript !== 'function') {
      callback('{"ok":false,"message":"CEP bridge is not available."}');
      return;
    }

    cep.evalScript(script, callback);
  }

  function loadHostScript(callback) {
    if (hostScriptLoaded) {
      callback(true);
      return;
    }

    pendingCallbacks.push(callback);

    if (hostScriptLoading) {
      return;
    }

    hostScriptLoading = true;
    evalScript('$.evalFile(new File(' + quoteExtendScriptString(getHostScriptPath()) + ')); "ok";', function (result) {
      var ok = result === 'ok';
      hostScriptLoaded = ok;
      hostScriptLoading = false;

      while (pendingCallbacks.length) {
        pendingCallbacks.shift()(ok);
      }
    });
  }

  function parseHostResult(result) {
    try {
      return JSON.parse(result);
    } catch (error) {
      return {
        ok: false,
        message: result || 'Unknown host response.'
      };
    }
  }

  function setButtonState(button, state) {
    button.classList.remove('is-running', 'is-ok', 'is-error');

    if (state) {
      button.classList.add(state);
    }
  }

  function flashButtonState(button, state) {
    setButtonState(button, state);
    window.setTimeout(function () {
      button.classList.remove(state);
    }, 480);
  }

  function removeFromList(values, value) {
    var result = [];

    for (var i = 0; i < values.length; i++) {
      if (values[i] !== value) {
        result.push(values[i]);
      }
    }

    return result;
  }

  function closeMotionToolManager() {
    if (motionToolManagerKeyHandler) {
      document.removeEventListener('keydown', motionToolManagerKeyHandler);
      motionToolManagerKeyHandler = null;
    }

    if (motionToolManagerOverlay && motionToolManagerOverlay.parentNode) {
      motionToolManagerOverlay.parentNode.removeChild(motionToolManagerOverlay);
    }

    motionToolManagerOverlay = null;
  }

  function createMotionToolManagerItem(button, grid, hiddenTools) {
    var toolName = getMotionToolOrderKey(button);
    var labelText = button.getAttribute('aria-label') || button.getAttribute('title') || toolName;
    var label = document.createElement('label');
    label.className = 'prime-motion-tools-manager__item';

    var icon = document.createElement('span');
    icon.className = 'prime-motion-tools-manager__icon';
    var sourceIcon = button.querySelector('.motion-tools-action__icon');
    if (sourceIcon) {
      icon.appendChild(sourceIcon.cloneNode(true));
    }

    var textWrap = document.createElement('span');
    textWrap.className = 'prime-motion-tools-manager__copy';
    var name = document.createElement('strong');
    name.textContent = labelText;
    var code = document.createElement('span');
    code.textContent = toolName;
    textWrap.appendChild(name);
    textWrap.appendChild(code);

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !isMotionToolHidden(toolName, hiddenTools);
    checkbox.setAttribute('aria-label', 'Show ' + labelText);

    var toggle = document.createElement('span');
    toggle.className = 'prime-motion-tools-manager__toggle';
    toggle.setAttribute('aria-hidden', 'true');

    checkbox.addEventListener('change', function () {
      var nextHidden = readHiddenMotionTools();

      if (checkbox.checked) {
        nextHidden = removeFromList(nextHidden, toolName);
      } else if (!isMotionToolHidden(toolName, nextHidden)) {
        nextHidden.push(toolName);
      }

      saveHiddenMotionTools(nextHidden);
      applyMotionToolVisibility(grid, nextHidden);
    });

    label.appendChild(icon);
    label.appendChild(textWrap);
    label.appendChild(checkbox);
    label.appendChild(toggle);
    return label;
  }

  function openMotionToolManager(grid) {
    closeMotionToolManager();

    var hiddenTools = readHiddenMotionTools();
    var overlay = document.createElement('div');
    overlay.className = 'prime-motion-tools-overlay';
    overlay.innerHTML =
      '<section class="prime-motion-tools-manager" role="dialog" aria-modal="true" aria-labelledby="primeMotionToolsManagerTitle">' +
        '<div class="prime-motion-tools-manager__header">' +
          '<div><h2 id="primeMotionToolsManagerTitle">Customize Motion Tools</h2><p>Choose which shortcuts appear in the grid. Drag visible buttons to reorder them.</p></div>' +
          '<button class="prime-motion-tools-manager__close" type="button" data-motion-tools-manager-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="prime-motion-tools-manager__list" data-motion-tools-manager-list></div>' +
        '<div class="prime-motion-tools-manager__footer">' +
          '<button class="prime-motion-tools-manager__button is-secondary" type="button" data-motion-tools-show-all>Show all</button>' +
          '<button class="prime-motion-tools-manager__button is-primary" type="button" data-motion-tools-manager-close>Done</button>' +
        '</div>' +
      '</section>';

    var list = overlay.querySelector('[data-motion-tools-manager-list]');
    var buttons = getCustomizableMotionTools(grid);
    for (var i = 0; i < buttons.length; i++) {
      list.appendChild(createMotionToolManagerItem(buttons[i], grid, hiddenTools));
    }

    document.body.appendChild(overlay);
    motionToolManagerOverlay = overlay;

    var closeButtons = overlay.querySelectorAll('[data-motion-tools-manager-close]');
    for (var closeIndex = 0; closeIndex < closeButtons.length; closeIndex++) {
      closeButtons[closeIndex].addEventListener('click', closeMotionToolManager);
    }

    overlay.querySelector('[data-motion-tools-show-all]').addEventListener('click', function () {
      saveHiddenMotionTools([]);
      applyMotionToolVisibility(grid, []);

      var checkboxes = overlay.querySelectorAll('input[type="checkbox"]');
      for (var checkboxIndex = 0; checkboxIndex < checkboxes.length; checkboxIndex++) {
        checkboxes[checkboxIndex].checked = true;
      }
    });

    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        closeMotionToolManager();
      }
    });

    motionToolManagerKeyHandler = function (event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        closeMotionToolManager();
      }
    };

    document.addEventListener('keydown', motionToolManagerKeyHandler);
    window.setTimeout(function () {
      var closeButton = overlay.querySelector('[data-motion-tools-manager-close]');
      if (closeButton) {
        closeButton.focus();
      }
    }, 0);
  }

  function closeMotionToolAlert() {
    if (motionToolAlertKeyHandler) {
      document.removeEventListener('keydown', motionToolAlertKeyHandler);
      motionToolAlertKeyHandler = null;
    }

    if (motionToolAlertOverlay && motionToolAlertOverlay.parentNode) {
      motionToolAlertOverlay.parentNode.removeChild(motionToolAlertOverlay);
    }

    motionToolAlertOverlay = null;
  }

  function showMotionToolAlert(title, message) {
    closeMotionToolAlert();

    var overlay = document.createElement('div');
    overlay.className = 'prime-motion-tools-overlay';
    overlay.innerHTML =
      '<section class="prime-motion-tools-alert" role="alertdialog" aria-modal="true" aria-labelledby="primeMotionToolsAlertTitle">' +
        '<div class="prime-motion-tools-alert__mark" aria-hidden="true">!</div>' +
        '<h2 id="primeMotionToolsAlertTitle"></h2>' +
        '<p></p>' +
        '<button class="prime-motion-tools-manager__button is-primary" type="button" data-motion-tools-alert-close>Close</button>' +
      '</section>';

    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('p').textContent = message;
    document.body.appendChild(overlay);
    motionToolAlertOverlay = overlay;

    var closeButton = overlay.querySelector('[data-motion-tools-alert-close]');
    closeButton.addEventListener('click', closeMotionToolAlert);
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        closeMotionToolAlert();
      }
    });

    motionToolAlertKeyHandler = function (event) {
      if (event.key === 'Escape' || event.keyCode === 27 || event.key === 'Enter' || event.keyCode === 13) {
        closeMotionToolAlert();
      }
    };

    document.addEventListener('keydown', motionToolAlertKeyHandler);
    window.setTimeout(function () {
      closeButton.focus();
    }, 0);
  }

  function normalizeHexColor(value, fallback) {
    var hex = String(value || '').replace(/\s+/g, '').replace(/^#/, '');

    if (/^[0-9a-f]{3}$/i.test(hex)) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }

    if (!/^[0-9a-f]{6}$/i.test(hex)) {
      return fallback || '';
    }

    return '#' + hex.toUpperCase();
  }

  function getSavedSolidColor() {
    try {
      return normalizeHexColor(window.localStorage.getItem(SOLID_COLOR_STORAGE_KEY), '#FFFFFF');
    } catch (error) {
      return '#FFFFFF';
    }
  }

  function saveSolidColor(color) {
    try {
      window.localStorage.setItem(SOLID_COLOR_STORAGE_KEY, color);
    } catch (error) {
    }
  }

  function closeSolidColorDialog() {
    if (solidColorKeyHandler) {
      document.removeEventListener('keydown', solidColorKeyHandler);
      solidColorKeyHandler = null;
    }

    if (solidColorOverlay && solidColorOverlay.parentNode) {
      solidColorOverlay.parentNode.removeChild(solidColorOverlay);
    }

    solidColorOverlay = null;
  }

  function openSolidColorDialog(button) {
    closeSolidColorDialog();

    var color = getSavedSolidColor();
    var overlay = document.createElement('div');
    overlay.className = 'prime-solid-color-overlay';
    overlay.innerHTML =
      '<section class="prime-solid-color-dialog" role="dialog" aria-modal="true" aria-labelledby="primeSolidColorTitle">' +
        '<div class="prime-solid-color-dialog__header">' +
          '<div><h2 id="primeSolidColorTitle">Create Solid</h2></div>' +
          '<button class="prime-solid-color-dialog__close" type="button" data-solid-color-cancel aria-label="Close">&times;</button>' +
        '</div>' +
        '<p class="prime-solid-color-dialog__description">Choose the solid color before adding it to the composition.</p>' +
        '<div class="prime-solid-color-dialog__picker">' +
          '<input class="prime-solid-color-dialog__swatch" type="color" data-solid-color-picker aria-label="Choose solid color" />' +
          '<label class="prime-solid-color-dialog__hex"><span>HEX</span><input type="text" maxlength="7" spellcheck="false" data-solid-color-hex /></label>' +
        '</div>' +
        '<div class="prime-solid-color-dialog__actions">' +
          '<button class="prime-solid-color-dialog__button is-secondary" type="button" data-solid-color-cancel>Cancel</button>' +
          '<button class="prime-solid-color-dialog__button is-primary" type="button" data-solid-color-create>Create Solid</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(overlay);
    solidColorOverlay = overlay;

    var picker = overlay.querySelector('[data-solid-color-picker]');
    var hexInput = overlay.querySelector('[data-solid-color-hex]');
    var createButton = overlay.querySelector('[data-solid-color-create]');
    var cancelButtons = overlay.querySelectorAll('[data-solid-color-cancel]');

    picker.value = color.toLowerCase();
    hexInput.value = color;

    picker.addEventListener('input', function () {
      color = normalizeHexColor(picker.value, color);
      hexInput.value = color;
      hexInput.parentNode.classList.remove('is-invalid');
    });

    hexInput.addEventListener('input', function () {
      var nextColor = normalizeHexColor(hexInput.value, '');
      hexInput.parentNode.classList.toggle('is-invalid', !nextColor);

      if (nextColor) {
        color = nextColor;
        picker.value = color.toLowerCase();
      }
    });

    createButton.addEventListener('click', function () {
      var selectedColor = normalizeHexColor(hexInput.value, '');

      if (!selectedColor) {
        hexInput.parentNode.classList.add('is-invalid');
        hexInput.focus();
        return;
      }

      saveSolidColor(selectedColor);
      closeSolidColorDialog();
      executeTool(button, 'SOL', selectedColor);
    });

    for (var i = 0; i < cancelButtons.length; i++) {
      cancelButtons[i].addEventListener('click', closeSolidColorDialog);
    }

    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        closeSolidColorDialog();
      }
    });

    solidColorKeyHandler = function (event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        closeSolidColorDialog();
      } else if ((event.key === 'Enter' || event.keyCode === 13) && document.activeElement === hexInput) {
        createButton.click();
      }
    };

    document.addEventListener('keydown', solidColorKeyHandler);
    window.setTimeout(function () {
      picker.focus();
    }, 0);
  }

  function executeTool(button, toolName, toolArgument) {
    setButtonState(button, 'is-running');
    button.disabled = true;

    loadHostScript(function (loaded) {
      if (!loaded) {
        button.disabled = false;
        flashButtonState(button, 'is-error');
        showMotionToolAlert('Motion Tools unavailable', 'Flow could not load its After Effects helper script. Restart the extension and try again.');
        return;
      }

      var script = 'FlowPrimeTools.run(' + quoteExtendScriptString(toolName);

      if (typeof toolArgument !== 'undefined') {
        script += ', ' + quoteExtendScriptString(toolArgument);
      }

      script += ');';
      evalScript(script, function (result) {
        var response = parseHostResult(result);
        button.disabled = false;
        flashButtonState(button, response.ok ? 'is-ok' : 'is-error');

        if (!response.ok) {
          var label = button.getAttribute('aria-label') || button.getAttribute('title') || toolName;
          var title = response.code === 'missing-effect' ? label + ' not found' : 'Could not apply ' + label;
          showMotionToolAlert(title, response.message || 'After Effects could not apply this tool to the current selection.');
        }
      });
    });
  }

  function placeNewNullAtTop() {
    return !!(document.body && document.body.classList.contains('flow-null-at-top-enabled'));
  }

  function runTool(button) {
    var toolName = button.getAttribute('data-prime-tool');

    if (!toolName || button.classList.contains('is-running')) {
      return;
    }

    if (toolName === 'SOL') {
      openSolidColorDialog(button);
      return;
    }

    if (toolName === 'NUL') {
      executeTool(button, toolName, placeNewNullAtTop() ? 'top' : 'selection');
      return;
    }

    executeTool(button, toolName);
  }

  function selectAnchorButton(button) {
    var buttons = document.querySelectorAll('[data-prime-anchor], [data-motion-tools-anchor]');

    for (var i = 0; i < buttons.length; i++) {
      var selected = buttons[i] === button;
      buttons[i].classList.toggle('is-selected', selected);
      buttons[i].setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  function runAnchorPoint(button) {
    var position = Number(button.getAttribute('data-prime-anchor') || button.getAttribute('data-motion-tools-anchor'));

    if (position < 1 || position > 9 || button.classList.contains('is-running')) {
      return;
    }

    setButtonState(button, 'is-running');
    button.disabled = true;

    loadHostScript(function (loaded) {
      if (!loaded) {
        button.disabled = false;
        flashButtonState(button, 'is-error');
        return;
      }

      evalScript('FlowPrimeTools.setAnchorPoint(' + position + ');', function (result) {
        var response = parseHostResult(result);
        button.disabled = false;

        if (response.ok) {
          selectAnchorButton(button);
        }

        flashButtonState(button, response.ok ? 'is-ok' : 'is-error');
      });
    });
  }

  function clampInteger(value, fallback, min, max) {
    var number = Math.round(Number(value));

    if (!isFinite(number)) {
      number = fallback;
    }

    return Math.max(min, Math.min(max, number));
  }

  function saveSequenceOptions(num, step, order) {
    try {
      window.localStorage.setItem('flow-prime-sequence-num', String(num));
      window.localStorage.setItem('flow-prime-sequence-step', String(step));
      window.localStorage.setItem('flow-prime-sequence-order', String(order));
    } catch (error) {
    }
  }

  function getSavedSequenceOrder() {
    var order = 'downward_order';

    try {
      var storedOrder = window.localStorage.getItem('flow-prime-sequence-order');

      if (/^(align|downward|upward|random)_order$/.test(storedOrder || '')) {
        order = storedOrder;
      }
    } catch (error) {
    }

    return order;
  }

  function restoreSequenceOptions() {
    var numInput = document.querySelector('[data-prime-sequence-num]');
    var stepInput = document.querySelector('[data-prime-sequence-step]');
    if (!numInput || !stepInput) {
      return;
    }

    try {
      var savedNum = window.localStorage.getItem('flow-prime-sequence-num');
      var legacyOffset = window.localStorage.getItem('flow-prime-sequence-offset');
      var savedStep = window.localStorage.getItem('flow-prime-sequence-step');

      if (savedNum === null && legacyOffset !== null) {
        savedNum = Math.abs(Number(legacyOffset));
      }

      if (savedNum !== null) {
        numInput.value = clampInteger(savedNum, 1, 1, 9999);
      }

      if (savedStep !== null) {
        stepInput.value = clampInteger(savedStep, 1, 1, 999);
      }

    } catch (error) {
    }

  }

  function runSequence(button, event) {
    var numInput = document.querySelector('[data-prime-sequence-num]');
    var stepInput = document.querySelector('[data-prime-sequence-step]');
    var order = button.getAttribute('data-prime-sequence-order');

    if (!numInput || !stepInput || !order || button.classList.contains('is-running')) {
      return;
    }

    var num = clampInteger(numInput.value, 1, 1, 9999);
    var step = clampInteger(stepInput.value, 1, 1, 999);
    var withStep = !!(event && event.altKey);
    numInput.value = num;
    stepInput.value = step;
    saveSequenceOptions(num, step, order);

    setButtonState(button, 'is-running');
    button.disabled = true;

    loadHostScript(function (loaded) {
      if (!loaded) {
        button.disabled = false;
        flashButtonState(button, 'is-error');
        return;
      }

      evalScript('FlowPrimeTools.sequenceLayers(' + num + ', ' + quoteExtendScriptString(order) + ', ' + step + ', ' + (withStep ? 'true' : 'false') + ');', function (result) {
        var response = parseHostResult(result);
        button.disabled = false;

        flashButtonState(button, response.ok ? 'is-ok' : 'is-error');
      });
    });
  }

  function runSelector(button, event) {
    var selector = button.getAttribute('data-prime-selector');
    var altPressed = !!event.altKey;
    var shiftPressed = !!event.shiftKey;

    if (!selector || button.classList.contains('is-running')) {
      return;
    }

    setButtonState(button, 'is-running');
    button.disabled = true;

    loadHostScript(function (loaded) {
      if (!loaded) {
        button.disabled = false;
        flashButtonState(button, 'is-error');
        return;
      }

      evalScript('FlowPrimeTools.selectVectorProperties(' + quoteExtendScriptString(selector) + ', ' + (altPressed ? 'true' : 'false') + ', ' + (shiftPressed ? 'true' : 'false') + ');', function (result) {
        var response = parseHostResult(result);
        button.disabled = false;
        flashButtonState(button, response.ok ? 'is-ok' : 'is-error');
      });
    });
  }
  function bindButtons() {
    var motionToolGrid = document.querySelector('.motion-tools-actions');
    var customizeButton = document.querySelector('[data-motion-tools-customize]');
    applyMotionToolVisibility(motionToolGrid);
    bindMotionToolReorder(motionToolGrid);
    refreshMotionAnchorColors(window.getComputedStyle(document.documentElement).getPropertyValue('--curve-theme-color'));

    var buttons = document.querySelectorAll('[data-prime-tool]');
    var anchorButtons = document.querySelectorAll('[data-prime-anchor], [data-motion-tools-anchor]');
    var selectorButtons = document.querySelectorAll('[data-prime-selector]');
    var sequenceButtons = document.querySelectorAll('[data-prime-sequence-order]');
    var sequenceInputs = document.querySelectorAll('[data-prime-sequence-num], [data-prime-sequence-step]');
    var secretButton = document.querySelector('[data-motion-tools-secret]');
    var secretAudio = document.getElementById('motionToolsSecretAudio');

    restoreSequenceOptions();

    if (customizeButton && motionToolGrid) {
      customizeButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openMotionToolManager(motionToolGrid);
      });
    }

    if (secretButton && secretAudio) {
      secretButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        try {
          secretAudio.pause();
          secretAudio.currentTime = 0;
          var playback = secretAudio.play();

          if (playback && typeof playback.catch === 'function') {
            playback.catch(function () {});
          }
        } catch (error) {
        }
      });
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        runTool(event.currentTarget);
      });
    }

    for (var j = 0; j < anchorButtons.length; j++) {
      anchorButtons[j].addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        runAnchorPoint(event.currentTarget);
      });
    }

    for (var k = 0; k < selectorButtons.length; k++) {
      selectorButtons[k].addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        runSelector(event.currentTarget, event);
      });
    }

    for (var orderIndex = 0; orderIndex < sequenceButtons.length; orderIndex++) {
      sequenceButtons[orderIndex].classList.remove('is-selected');
      sequenceButtons[orderIndex].setAttribute('aria-pressed', 'false');
      sequenceButtons[orderIndex].addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        runSequence(event.currentTarget, event);
      });
    }

    for (var inputIndex = 0; inputIndex < sequenceInputs.length; inputIndex++) {
      sequenceInputs[inputIndex].addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.keyCode === 13) && sequenceButtons.length) {
          event.preventDefault();
          var savedOrder = getSavedSequenceOrder();
          var selectedOrder = document.querySelector('[data-prime-sequence-order="' + savedOrder + '"]') || document.querySelector('[data-prime-sequence-order="downward_order"]');

          if (selectedOrder) {
            runSequence(selectedOrder, event);
          }
        }
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }
})();
