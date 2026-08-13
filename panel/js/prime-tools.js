(function () {
  'use strict';

  var hostScriptLoaded = false;
  var hostScriptLoading = false;
  var pendingCallbacks = [];
  var scriptPath;
  var solidColorOverlay = null;
  var solidColorKeyHandler = null;
  var SOLID_COLOR_STORAGE_KEY = 'flow-prime-solid-color';

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
      });
    });
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
    var buttons = document.querySelectorAll('[data-prime-tool]');
    var anchorButtons = document.querySelectorAll('[data-prime-anchor], [data-motion-tools-anchor]');
    var selectorButtons = document.querySelectorAll('[data-prime-selector]');
    var sequenceButtons = document.querySelectorAll('[data-prime-sequence-order]');
    var sequenceInputs = document.querySelectorAll('[data-prime-sequence-num], [data-prime-sequence-step]');
    var secretButton = document.querySelector('[data-motion-tools-secret]');
    var secretAudio = document.getElementById('motionToolsSecretAudio');

    restoreSequenceOptions();

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
