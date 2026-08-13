(function () {
  'use strict';

  var STORAGE_KEY = 'flow.curveGraphSettings';
  var SHARED_FILE = 'Flow-3-curve-settings.json';
  var SETTINGS_EVENT = 'com.rendertom.flow.v2.settings.changed';
  var colors = ['#2f6bff', '#ff3131', '#13baf3', '#35d07f', '#ffd21f', '#a45ac5', '#ff9c44', '#ffffff'];
  var handleStyles = ['heart', 'circle', 'square', 'diamond', 'star', 'custom'];
  var settings = getDefaultSettings();
  var activeColorKey = '';
  var activeEditor = null;
  var profileSaveTimer = null;
  var els = {};

  function getDefaultSettings() {
    return {
      language: 'en',
      profileName: 'leylin',
      profileBio: 'Flow Settings',
      profileImage: {
        src: '',
        name: ''
      },
      themeColor: '#ffffff',
      panelBackgroundColor: '#000000',
      panelBackgroundColor2: '#2a2a2a',
      panelBackgroundDirection: 0,
      panelBackgroundIntensity: 74,
      graphLineColor: '#ffffff',
      handleColor: '#ffffff',
      homeIndicatorColor: '#ffffff',
      backgroundMediaColorEnabled: false,
      handleStyle: 'heart',
      handleSize: 14,
      handleLineThickness: 1,
      handleImage: {
        src: '',
        name: ''
      },
      hideHomeIndicator: false,
      backgroundEffect: 'snow',
      disableSnowflake: false,
      rgbMode: false,
      autoApply: false,
      background: {
        kind: '',
        src: '',
        name: '',
        opacity: 15
      }
    };
  }

  function mergeSettings(value) {
    var defaults = getDefaultSettings();
    var incoming = value || {};
    var handleImageSrc = incoming.handleImage && incoming.handleImage.src || defaults.handleImage.src;
    var handleStyle = normalizeHandleStyle(incoming.handleStyle || defaults.handleStyle);
    var backgroundMediaColorEnabled = typeof incoming.backgroundMediaColorEnabled === 'boolean' ?
      incoming.backgroundMediaColorEnabled : !!incoming.backgroundColorEnabled;
    var backgroundEffect = normalizeBackgroundEffect(incoming.backgroundEffect, incoming.disableSnowflake);

    if (handleStyle === 'custom' && !handleImageSrc) {
      handleStyle = defaults.handleStyle;
    }

    return {
      language: normalizeLanguage(incoming.language || defaults.language),
      profileName: normalizeProfileText(incoming.profileName, defaults.profileName, 40, false),
      profileBio: normalizeProfileText(incoming.profileBio, defaults.profileBio, 120, true),
      profileImage: {
        src: incoming.profileImage && incoming.profileImage.src || defaults.profileImage.src,
        name: incoming.profileImage && incoming.profileImage.name || defaults.profileImage.name
      },
      themeColor: normalizeHex(incoming.themeColor || defaults.themeColor),
      panelBackgroundColor: normalizeHex(incoming.panelBackgroundColor || defaults.panelBackgroundColor),
      panelBackgroundColor2: normalizeHex(incoming.panelBackgroundColor2 || defaults.panelBackgroundColor2),
      panelBackgroundDirection: typeof incoming.panelBackgroundDirection === 'number' ? clamp(incoming.panelBackgroundDirection, 0, 360) : defaults.panelBackgroundDirection,
      panelBackgroundIntensity: typeof incoming.panelBackgroundIntensity === 'number' ? clamp(incoming.panelBackgroundIntensity, 0, 100) : defaults.panelBackgroundIntensity,
      graphLineColor: normalizeHex(incoming.graphLineColor || defaults.graphLineColor),
      handleColor: normalizeHex(incoming.handleColor || defaults.handleColor),
      homeIndicatorColor: normalizeHex(incoming.homeIndicatorColor || defaults.homeIndicatorColor),
      backgroundMediaColorEnabled: backgroundMediaColorEnabled,
      handleStyle: handleStyle,
      handleSize: clamp(Number(incoming.handleSize) || defaults.handleSize, 8, 32),
      handleLineThickness: clamp(Number(incoming.handleLineThickness) || defaults.handleLineThickness, 0.5, 4),
      handleImage: {
        src: handleImageSrc,
        name: incoming.handleImage && incoming.handleImage.name || defaults.handleImage.name
      },
      hideHomeIndicator: !!incoming.hideHomeIndicator,
      backgroundEffect: backgroundEffect,
      disableSnowflake: backgroundEffect === 'none',
      rgbMode: !!incoming.rgbMode,
      autoApply: !!incoming.autoApply,
      background: {
        kind: incoming.background && incoming.background.kind || defaults.background.kind,
        src: incoming.background && incoming.background.src || defaults.background.src,
        name: incoming.background && incoming.background.name || defaults.background.name,
        opacity: typeof (incoming.background && incoming.background.opacity) === 'number' ? incoming.background.opacity : defaults.background.opacity
      }
    };
  }

  function normalizeHandleStyle(value) {
    value = String(value || '').toLowerCase();

    for (var i = 0; i < handleStyles.length; i++) {
      if (handleStyles[i] === value) {
        return value;
      }
    }

    return 'heart';
  }

  function normalizeLanguage(value) {
    value = String(value || '').toLowerCase();

    return value === 'zh' || value === 'th' ? value : 'en';
  }

  function normalizeBackgroundEffect(value, disableSnowflake) {
    value = String(value || '').toLowerCase();

    if (value === 'snow' || value === 'rain' || value === 'particles' || value === 'none') {
      return value;
    }

    return disableSnowflake ? 'none' : 'snow';
  }

  function normalizeProfileText(value, fallback, maxLength, allowEmpty) {
    if (typeof value !== 'string') {
      return fallback;
    }

    value = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    return value || (allowEmpty ? '' : fallback);
  }

  function localizedText(key, fallback) {
    if (window.FlowSettingsI18n && typeof window.FlowSettingsI18n.getText === 'function') {
      return window.FlowSettingsI18n.getText(key);
    }

    return fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resizeSettingsWindow(retries) {
    retries = typeof retries === 'number' ? retries : 1;

    window.setTimeout(function () {
      var panel = document.querySelector('.settings-window');
      var body = document.querySelector('.settings-body');
      var width;
      var height;
      var chromeHeight;

      if (!panel || !body) {
        return;
      }

      width = Math.ceil(panel.getBoundingClientRect().width + 12);
      height = Math.ceil(panel.getBoundingClientRect().height + 12);
      width = 583;
      height = 620;

      try {
        if (window.__adobe_cep__ && typeof window.__adobe_cep__.resizeContent === 'function') {
          window.__adobe_cep__.resizeContent(width, height);
        }
      } catch (error) {}

      try {
        if (window.CSInterface) {
          var cs = new window.CSInterface();

          if (cs && typeof cs.resizeContent === 'function') {
            cs.resizeContent(width, height);
          }
        }
      } catch (error) {}

      try {
        if (typeof window.resizeTo === 'function') {
          chromeHeight = Math.max(0, (window.outerHeight || height) - (window.innerHeight || height));
          window.resizeTo(width, height + chromeHeight);
        }
      } catch (error) {}

      if (retries > 0) {
        resizeSettingsWindow(retries - 1);
      }
    }, 0);
  }

  function getSharedSettingsPath() {
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

  function normalizeSystemPath(path) {
    path = decodeURI(String(path || '')).replace(/\\/g, '/');
    path = path.replace(/^file:\/\/\//i, '');
    path = path.replace(/^file:\/\//i, '');
    return path.replace(/\/+$/, '');
  }

  function readSharedSettingsRaw() {
    var sharedPath = getSharedSettingsPath();

    try {
      if (sharedPath && window.cep && window.cep.fs && window.cep.fs.readFile) {
        var file = window.cep.fs.readFile(sharedPath);

        if (file && file.data) {
          return file.data;
        }
      }
    } catch (error) {}

    try {
      return window.localStorage.getItem(STORAGE_KEY) || '{}';
    } catch (error) {}

    return '{}';
  }

  function writeSharedSettingsRaw(raw) {
    var sharedPath = getSharedSettingsPath();

    try {
      if (sharedPath && window.cep && window.cep.fs && window.cep.fs.writeFile) {
        window.cep.fs.writeFile(sharedPath, raw);
      }
    } catch (error) {}
  }

  function loadSettings() {
    try {
      settings = mergeSettings(JSON.parse(readSharedSettingsRaw()));
    } catch (error) {
      settings = getDefaultSettings();
    }
  }

  function saveSettings() {
    var raw = '';

    try {
      raw = JSON.stringify(settings);
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch (error) {}

    if (raw) {
      writeSharedSettingsRaw(raw);
      dispatchSettingsChanged(raw);
    }
  }

  function dispatchSettingsChanged(raw) {
    var event = {
      type: SETTINGS_EVENT,
      scope: 'APPLICATION',
      appId: '',
      extensionId: '',
      data: raw
    };

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.dispatchEvent === 'function') {
          cs.dispatchEvent(event);
          return;
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.dispatchEvent === 'function') {
        window.__adobe_cep__.dispatchEvent(event);
      }
    } catch (error) {}
  }

  function init() {
    els.profileButton = document.getElementById('settingsProfileButton');
    els.profileAvatar = document.getElementById('settingsProfileAvatar');
    els.profileNameDisplay = document.getElementById('settingsProfileNameDisplay');
    els.profileBioDisplay = document.getElementById('settingsProfileBioDisplay');
    els.profileEditorAvatar = document.getElementById('settingsProfileEditorAvatar');
    els.profileAvatarButton = document.getElementById('settingsProfileAvatarButton');
    els.profileFileInput = document.getElementById('settingsProfileFileInput');
    els.clearProfileImage = document.getElementById('settingsClearProfileImage');
    els.profileName = document.getElementById('settingsProfileName');
    els.profileBio = document.getElementById('settingsProfileBio');
    els.resetProfile = document.getElementById('settingsResetProfile');
    els.language = document.getElementById('settingsLanguage');
    els.autoApply = document.getElementById('settingsAutoApply');
    els.hideHomeIndicator = document.getElementById('settingsHideHomeIndicator');
    els.backgroundEffect = document.getElementById('settingsBackgroundEffect');
    els.rgbMode = document.getElementById('settingsRgbMode');
    els.backgroundMediaColorEnabled = document.getElementById('settingsBackgroundMediaColorEnabled');
    els.backgroundDirection = document.getElementById('settingsBackgroundDirection');
    els.backgroundDirectionValue = document.getElementById('settingsBackgroundDirectionValue');
    els.backgroundIntensity = document.getElementById('settingsBackgroundIntensity');
    els.backgroundIntensityValue = document.getElementById('settingsBackgroundIntensityValue');
    els.backgroundGradientPreview = document.getElementById('settingsBackgroundGradientPreview');
    els.swatches = document.getElementById('settingsSwatches');
    els.handlePresets = document.getElementById('settingsHandlePresets');
    els.handleDropzone = document.getElementById('settingsHandleDropzone');
    els.handlePreview = document.getElementById('settingsHandlePreview');
    els.handleEmpty = document.getElementById('settingsHandleEmpty');
    els.handleFileInput = document.getElementById('settingsHandleFileInput');
    els.clearHandleImage = document.getElementById('settingsClearHandleImage');
    els.handleSize = document.getElementById('settingsHandleSize');
    els.handleSizeValue = document.getElementById('settingsHandleSizeValue');
    els.handleLineThickness = document.getElementById('settingsHandleLineThickness');
    els.handleLineThicknessValue = document.getElementById('settingsHandleLineThicknessValue');
    els.dropzone = document.getElementById('settingsDropzone');
    els.dropPreview = document.getElementById('settingsDropPreview');
    els.dropEmpty = document.getElementById('settingsDropEmpty');
    els.fileInput = document.getElementById('settingsFileInput');
    els.clearBackground = document.getElementById('settingsClearBackground');
    els.opacity = document.getElementById('settingsOpacity');
    els.opacityValue = document.getElementById('settingsOpacityValue');
    els.colorEditButtons = document.querySelectorAll('[data-color-edit]');

    loadSettings();
    buildSwatches();
    bindEvents();
    refresh();
  }

  function buildSwatches() {
    var html = '';

    for (var i = 0; i < colors.length; i++) {
      html += '<button type="button" data-quick-preset="' + colors[i] + '" style="--swatch:' + colors[i] + '" aria-label="' + colors[i] + '"></button>';
    }

    els.swatches.innerHTML = html;
  }

  function bindEvents() {
    for (var e = 0; e < els.colorEditButtons.length; e++) {
      els.colorEditButtons[e].addEventListener('click', function (event) {
        var key = event.currentTarget.getAttribute('data-color-edit');

        if (activeColorKey === key) {
          closeColorEditor();
        } else {
          openColorEditor(key, event.currentTarget);
        }
      });
    }

    var swatches = els.swatches.querySelectorAll('[data-quick-preset]');

    for (var s = 0; s < swatches.length; s++) {
      swatches[s].addEventListener('click', function (event) {
        var color = normalizeHex(event.currentTarget.getAttribute('data-quick-preset'));

        settings.themeColor = color;
        settings.handleColor = color;
        settings.graphLineColor = color;
        settings.homeIndicatorColor = color;
        saveSettings();
        refresh();
      });
    }

    bindProfileEvents();

    els.autoApply.addEventListener('change', function () {
      settings.autoApply = els.autoApply.checked;
      saveSettings();
    });

    if (els.language) {
      els.language.addEventListener('change', function () {
        settings.language = normalizeLanguage(els.language.value);
        saveSettings();

        if (window.FlowSettingsI18n && typeof window.FlowSettingsI18n.apply === 'function') {
          window.FlowSettingsI18n.apply(settings.language);
        }
      });
    }

    els.hideHomeIndicator.addEventListener('change', function () {
      settings.hideHomeIndicator = els.hideHomeIndicator.checked;
      saveSettings();
    });

    if (els.backgroundEffect) {
      els.backgroundEffect.addEventListener('change', function () {
        settings.backgroundEffect = normalizeBackgroundEffect(els.backgroundEffect.value, false);
        settings.disableSnowflake = settings.backgroundEffect === 'none';
        saveSettings();
      });
    }

    els.rgbMode.addEventListener('change', function () {
      settings.rgbMode = els.rgbMode.checked;
      saveSettings();
      refreshTheme();
    });

    els.backgroundMediaColorEnabled.addEventListener('change', function () {
      settings.backgroundMediaColorEnabled = els.backgroundMediaColorEnabled.checked;
      saveSettings();
      refreshBackgroundMediaColor();
    });

    els.backgroundDirection.addEventListener('input', function () {
      settings.panelBackgroundDirection = clamp(Number(els.backgroundDirection.value) || 0, 0, 360);
      saveSettings();
      refreshBackgroundGradient();
    });

    els.backgroundIntensity.addEventListener('input', function () {
      settings.panelBackgroundIntensity = clamp(Number(els.backgroundIntensity.value) || 0, 0, 100);
      saveSettings();
      refreshBackgroundGradient();
    });

    var handlePresetButtons = els.handlePresets.querySelectorAll('[data-handle-style]');

    for (var h = 0; h < handlePresetButtons.length; h++) {
      handlePresetButtons[h].addEventListener('click', function (event) {
        settings.handleStyle = normalizeHandleStyle(event.currentTarget.getAttribute('data-handle-style'));
        saveSettings();
        refreshHandleStyles();
      });
    }

    els.handleDropzone.addEventListener('click', function () {
      if (settings.handleImage.src && settings.handleStyle !== 'custom') {
        settings.handleStyle = 'custom';
        saveSettings();
        refreshHandleStyles();
        return;
      }

      els.handleFileInput.click();
    });

    els.handleDropzone.addEventListener('dragover', function (event) {
      event.preventDefault();
      els.handleDropzone.classList.add('is-dragging');
    });

    els.handleDropzone.addEventListener('dragleave', function () {
      els.handleDropzone.classList.remove('is-dragging');
    });

    els.handleDropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      els.handleDropzone.classList.remove('is-dragging');
      handleHandleFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    });

    els.handleFileInput.addEventListener('change', function () {
      handleHandleFile(els.handleFileInput.files && els.handleFileInput.files[0]);
      els.handleFileInput.value = '';
    });

    els.clearHandleImage.addEventListener('click', function () {
      settings.handleImage.src = '';
      settings.handleImage.name = '';

      if (settings.handleStyle === 'custom') {
        settings.handleStyle = 'heart';
      }

      saveSettings();
      refreshHandleStyles();
    });

    els.handleSize.addEventListener('input', function () {
      settings.handleSize = clamp(Number(els.handleSize.value) || 14, 8, 32);
      saveSettings();
      refreshHandleSize();
    });

    els.handleLineThickness.addEventListener('input', function () {
      settings.handleLineThickness = clamp(Number(els.handleLineThickness.value) || 1, 0.5, 4);
      saveSettings();
      refreshHandleLineThickness();
    });

    els.dropzone.addEventListener('click', function () {
      els.fileInput.click();
    });

    els.dropzone.addEventListener('dragover', function (event) {
      event.preventDefault();
      els.dropzone.classList.add('is-dragging');
    });

    els.dropzone.addEventListener('dragleave', function () {
      els.dropzone.classList.remove('is-dragging');
    });

    els.dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      els.dropzone.classList.remove('is-dragging');
      handleBackgroundFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    });

    els.fileInput.addEventListener('change', function () {
      handleBackgroundFile(els.fileInput.files && els.fileInput.files[0]);
      els.fileInput.value = '';
    });

    els.clearBackground.addEventListener('click', function () {
      settings.background.kind = '';
      settings.background.src = '';
      settings.background.name = '';
      saveSettings();
      refreshBackground();
    });

    els.opacity.addEventListener('input', function () {
      settings.background.opacity = clamp(Number(els.opacity.value) || 0, 0, 100);
      saveSettings();
      refreshOpacity();
    });
  }

  function bindProfileEvents() {
    if (!els.profileAvatarButton || !els.profileFileInput) {
      return;
    }

    els.profileAvatarButton.addEventListener('click', function () {
      els.profileFileInput.click();
    });

    els.profileFileInput.addEventListener('change', function () {
      handleProfileFile(els.profileFileInput.files && els.profileFileInput.files[0]);
      els.profileFileInput.value = '';
    });

    els.clearProfileImage.addEventListener('click', function () {
      settings.profileImage.src = '';
      settings.profileImage.name = '';
      saveSettings();
      refreshProfile();
    });

    els.profileName.addEventListener('input', function () {
      settings.profileName = String(els.profileName.value || '').slice(0, 40);
      refreshProfileSummary();
      scheduleProfileSave();
    });

    els.profileBio.addEventListener('input', function () {
      settings.profileBio = String(els.profileBio.value || '').slice(0, 120);
      refreshProfileSummary();
      scheduleProfileSave();
    });

    els.profileName.addEventListener('change', flushProfileSave);
    els.profileBio.addEventListener('change', flushProfileSave);

    els.resetProfile.addEventListener('click', function () {
      var defaults = getDefaultSettings();
      settings.profileName = defaults.profileName;
      settings.profileBio = defaults.profileBio;
      settings.profileImage.src = defaults.profileImage.src;
      settings.profileImage.name = defaults.profileImage.name;
      flushProfileSave();
      refreshProfile();
    });
  }

  function scheduleProfileSave() {
    if (profileSaveTimer) {
      window.clearTimeout(profileSaveTimer);
    }

    profileSaveTimer = window.setTimeout(function () {
      profileSaveTimer = null;
      saveSettings();
    }, 180);
  }

  function flushProfileSave() {
    if (profileSaveTimer) {
      window.clearTimeout(profileSaveTimer);
      profileSaveTimer = null;
    }

    settings.profileName = normalizeProfileText(settings.profileName, getDefaultSettings().profileName, 40, false);
    settings.profileBio = normalizeProfileText(settings.profileBio, getDefaultSettings().profileBio, 120, true);
    saveSettings();
    refreshProfile();
  }

  function openColorEditor(key, button) {
    var row = document.querySelector('[data-setting-row="' + key + '"]');

    closeColorEditor();

    if (!row) {
      return;
    }

    activeColorKey = key;
    button.classList.add('is-open');
    button.setAttribute('data-i18n', 'close');
    button.textContent = localizedText('close', 'Close');

    activeEditor = document.createElement('div');
    activeEditor.className = 'settings-color-editor';
    activeEditor.innerHTML =
      '<div class="settings-color-preview"></div>' +
      '<input class="settings-color-slider settings-color-hue" type="range" min="0" max="360" step="1" data-color-slider="hue" />' +
      '<input class="settings-color-slider settings-color-saturation" type="range" min="0" max="100" step="1" data-color-slider="saturation" />' +
      '<input class="settings-color-slider settings-color-value" type="range" min="0" max="100" step="1" data-color-slider="value" />' +
      '<input class="settings-hex-input" type="text" spellcheck="false" />';

    row.parentNode.insertBefore(activeEditor, row.nextSibling);
    bindColorEditorEvents();
    refreshColorEditor(true);
    resizeSettingsWindow(2);
  }

  function closeColorEditor() {
    var buttons = document.querySelectorAll('[data-color-edit]');

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('is-open');
      buttons[i].setAttribute('data-i18n', 'edit');
      buttons[i].textContent = localizedText('edit', 'Edit');
    }

    if (activeEditor && activeEditor.parentNode) {
      activeEditor.parentNode.removeChild(activeEditor);
    }

    activeEditor = null;
    activeColorKey = '';
    resizeSettingsWindow(2);
  }

  function bindColorEditorEvents() {
    var sliders = activeEditor.querySelectorAll('[data-color-slider]');
    var hexInput = activeEditor.querySelector('.settings-hex-input');

    for (var i = 0; i < sliders.length; i++) {
      sliders[i].addEventListener('input', updateColorFromSliders);
    }

    hexInput.addEventListener('change', updateColorFromHex);
    hexInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        updateColorFromHex(event);
        hexInput.blur();
      }
    });
  }

  function updateColorFromSliders() {
    var h = Number(activeEditor.querySelector('[data-color-slider="hue"]').value) || 0;
    var s = Number(activeEditor.querySelector('[data-color-slider="saturation"]').value) || 0;
    var v = Number(activeEditor.querySelector('[data-color-slider="value"]').value) || 0;

    settings[activeColorKey] = hsvToHex(h, s, v);
    saveSettings();
    refreshTheme();
    refreshSwatches();
    refreshColorEditor(false);
  }

  function updateColorFromHex(event) {
    var value = normalizeHex(event.currentTarget.value);

    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      refreshColorEditor(true);
      return;
    }

    settings[activeColorKey] = value;
    saveSettings();
    refreshTheme();
    refreshSwatches();
    refreshColorEditor(true);
  }

  function refreshColorEditor(updateSliders) {
    if (!activeEditor || !activeColorKey) {
      return;
    }

    var color = normalizeHex(settings[activeColorKey]);
    var hsv = hexToHsv(color);
    var hue = activeEditor.querySelector('[data-color-slider="hue"]');
    var saturation = activeEditor.querySelector('[data-color-slider="saturation"]');
    var value = activeEditor.querySelector('[data-color-slider="value"]');
    var preview = activeEditor.querySelector('.settings-color-preview');
    var hex = activeEditor.querySelector('.settings-hex-input');

    if (updateSliders) {
      hue.value = String(Math.round(hsv.h));
      saturation.value = String(Math.round(hsv.s));
      value.value = String(Math.round(hsv.v));
    }

    hue.style.background = 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
    saturation.style.background = 'linear-gradient(to right, ' + hsvToHex(hsv.h, 0, hsv.v) + ', ' + hsvToHex(hsv.h, 100, hsv.v) + ')';
    value.style.background = 'linear-gradient(to right, #000000, ' + hsvToHex(hsv.h, hsv.s, 100) + ', #ffffff)';
    preview.style.setProperty('--editor-color', color);
    hex.value = '# ' + color.slice(1).toUpperCase();
  }

  function refresh() {
    refreshTheme();
    refreshSwatches();
    refreshBackgroundMediaColor();
    refreshHandleStyles();
    refreshHandleSize();
    refreshHandleLineThickness();
    refreshBackground();
    refreshOpacity();
    refreshProfile();
    if (els.language) {
      els.language.value = normalizeLanguage(settings.language);
    }
    els.autoApply.checked = settings.autoApply;
    els.hideHomeIndicator.checked = settings.hideHomeIndicator;
    if (els.backgroundEffect) {
      els.backgroundEffect.value = normalizeBackgroundEffect(settings.backgroundEffect, settings.disableSnowflake);
    }
    els.rgbMode.checked = settings.rgbMode;
    els.backgroundMediaColorEnabled.checked = settings.backgroundMediaColorEnabled;

    if (activeEditor) {
      refreshColorEditor(true);
    }

    resizeSettingsWindow(2);
  }

  function refreshProfile() {
    if (!els.profileAvatar || !els.profileEditorAvatar) {
      return;
    }

    var avatarSource = settings.profileImage && settings.profileImage.src || '../leylin.png';
    els.profileAvatar.src = avatarSource;
    els.profileEditorAvatar.src = avatarSource;
    els.profileName.value = settings.profileName;
    els.profileBio.value = settings.profileBio;
    els.clearProfileImage.disabled = !(settings.profileImage && settings.profileImage.src);
    refreshProfileSummary();
  }

  function refreshProfileSummary() {
    var defaults = getDefaultSettings();
    var name = normalizeProfileText(settings.profileName, defaults.profileName, 40, false);
    var bio = normalizeProfileText(settings.profileBio, defaults.profileBio, 120, true);

    if (els.profileNameDisplay) {
      els.profileNameDisplay.textContent = name;
      els.profileNameDisplay.title = name;
    }

    if (els.profileBioDisplay) {
      els.profileBioDisplay.textContent = bio;
      els.profileBioDisplay.title = bio;
    }
  }

  function refreshTheme() {
    var backgroundButtons = document.querySelectorAll('[data-background-color-edit]');
    document.documentElement.style.setProperty('--settings-theme', settings.themeColor);
    document.documentElement.style.setProperty('--settings-theme-soft', hexToRgba(settings.themeColor, 0.26));

    for (var i = 0; i < backgroundButtons.length; i++) {
      var key = backgroundButtons[i].getAttribute('data-color-edit');
      var color = normalizeHex(settings[key]);
      backgroundButtons[i].style.setProperty('--settings-edit-color', color);
      backgroundButtons[i].setAttribute('aria-label', 'Edit background gradient color ' + color);
    }

    refreshBackgroundGradient();
  }

  function refreshBackgroundGradient() {
    var direction = Math.round(clamp(Number(settings.panelBackgroundDirection) || 0, 0, 360));
    var intensity = Math.round(clamp(Number(settings.panelBackgroundIntensity) || 0, 0, 100));
    var dim = (1 - intensity / 100).toFixed(3);

    els.backgroundDirection.value = String(direction);
    els.backgroundDirectionValue.textContent = direction + '°';
    els.backgroundIntensity.value = String(intensity);
    els.backgroundIntensityValue.textContent = intensity + '%';

    document.documentElement.style.setProperty('--settings-background-start', settings.panelBackgroundColor);
    document.documentElement.style.setProperty('--settings-background-end', settings.panelBackgroundColor2);
    document.documentElement.style.setProperty('--settings-background-direction', direction + 'deg');
    document.documentElement.style.setProperty('--settings-background-dim', dim);
  }

  function refreshBackgroundMediaColor() {
    els.backgroundMediaColorEnabled.checked = settings.backgroundMediaColorEnabled;
    els.dropzone.classList.toggle('use-original-color', settings.backgroundMediaColorEnabled);
  }

  function refreshHandleStyles() {
    var buttons = els.handlePresets.querySelectorAll('[data-handle-style]');

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-selected', buttons[i].getAttribute('data-handle-style') === settings.handleStyle);
      buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-handle-style') === settings.handleStyle ? 'true' : 'false');
    }

    while (els.handlePreview.firstChild) {
      els.handlePreview.removeChild(els.handlePreview.firstChild);
    }

    if (settings.handleImage.src) {
      var image = document.createElement('img');
      image.src = settings.handleImage.src;
      image.alt = '';
      els.handlePreview.appendChild(image);
      els.handleDropzone.classList.add('has-image');
      els.handleDropzone.title = settings.handleImage.name || 'Custom image handle';
    } else {
      els.handleDropzone.classList.remove('has-image');
      els.handleDropzone.title = 'Upload a PNG or animated GIF handle';
    }

    els.handleDropzone.classList.toggle('is-selected', settings.handleStyle === 'custom');
    els.handleDropzone.setAttribute('aria-pressed', settings.handleStyle === 'custom' ? 'true' : 'false');
    els.clearHandleImage.disabled = !settings.handleImage.src;
    resizeSettingsWindow(2);
  }

  function refreshHandleSize() {
    var size = Math.round(clamp(settings.handleSize, 8, 32));
    var previewSize = clamp(size, 12, 24);

    els.handleSize.value = String(size);
    els.handleSizeValue.textContent = size + 'px';
    document.documentElement.style.setProperty('--settings-handle-preview-size', previewSize + 'px');
  }

  function refreshHandleLineThickness() {
    var thickness = Math.round(clamp(settings.handleLineThickness, 0.5, 4) * 100) / 100;

    els.handleLineThickness.value = String(thickness);
    els.handleLineThicknessValue.textContent = thickness + 'px';
  }

  function refreshSwatches() {
    var swatches = els.swatches.querySelectorAll('[data-quick-preset]');
    var selected = normalizeHex(settings.themeColor);

    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle('is-selected', normalizeHex(swatches[i].getAttribute('data-quick-preset')) === selected);
    }
  }

  function refreshBackground() {
    while (els.dropPreview.firstChild) {
      els.dropPreview.removeChild(els.dropPreview.firstChild);
    }

    if (!settings.background.src) {
      els.dropzone.classList.remove('has-media');
      els.dropEmpty.style.display = '';
      resizeSettingsWindow(2);
      return;
    }

    var media = settings.background.kind === 'video' ? document.createElement('video') : document.createElement('img');
    media.src = settings.background.src;
    media.alt = '';

    if (media.tagName.toLowerCase() === 'video') {
      media.muted = true;
      media.loop = true;
      media.autoplay = true;
      media.playsInline = true;
    }

    els.dropPreview.appendChild(media);
    media.style.opacity = String(clamp(settings.background.opacity, 0, 100) / 100);
    try {
      if (media.play) {
        media.play();
      }
    } catch (error) {}
    els.dropzone.classList.add('has-media');
    els.dropEmpty.style.display = 'none';
    resizeSettingsWindow(2);
  }

  function refreshOpacity() {
    els.opacity.value = String(settings.background.opacity);
    els.opacityValue.textContent = Math.round(settings.background.opacity) + '%';

    if (els.dropPreview.firstChild) {
      els.dropPreview.firstChild.style.opacity = String(clamp(settings.background.opacity, 0, 100) / 100);
    }
  }

  function handleProfileFile(file) {
    if (!file) {
      return;
    }

    var name = String(file.name || '');
    var type = String(file.type || '');
    var allowed = /\.(png|jpe?g|gif|webp)$/i.test(name) || /^image\/(png|jpeg|gif|webp)$/i.test(type);

    if (!allowed) {
      return;
    }

    var imageSrc = getFileMediaSource(file);

    if (imageSrc) {
      storeProfileImage(imageSrc, name);
      return;
    }

    var reader = new FileReader();

    reader.onload = function () {
      storeProfileImage(String(reader.result || ''), name);
    };

    reader.readAsDataURL(file);
  }

  function storeProfileImage(src, name) {
    if (!src) {
      return;
    }

    settings.profileImage.src = src;
    settings.profileImage.name = name;
    saveSettings();
    refreshProfile();
  }

  function handleHandleFile(file) {
    if (!file) {
      return;
    }

    var name = String(file.name || '');
    var type = String(file.type || '');
    var allowed = /\.(png|gif)$/i.test(name) || /^image\/(png|gif)$/i.test(type);

    if (!allowed) {
      return;
    }

    var imageSrc = getFileMediaSource(file);

    if (imageSrc) {
      storeHandleImage(imageSrc, name);
      return;
    }

    var reader = new FileReader();

    reader.onload = function () {
      storeHandleImage(String(reader.result || ''), name);
    };

    reader.readAsDataURL(file);
  }

  function storeHandleImage(src, name) {
    if (!src) {
      return;
    }

    settings.handleImage.src = src;
    settings.handleImage.name = name;
    settings.handleStyle = 'custom';
    saveSettings();
    refreshHandleStyles();
  }

  function handleBackgroundFile(file) {
    if (!file) {
      return;
    }

    var name = String(file.name || '');
    var type = String(file.type || '');
    var isVideo = /\.mp4$/i.test(name) || type === 'video/mp4';
    var allowed = isVideo || /\.(png|jpe?g|gif)$/i.test(name) || /^image\/(png|jpeg|gif)$/i.test(type);

    if (!allowed) {
      return;
    }

    var mediaSrc = getFileMediaSource(file);

    if (mediaSrc) {
      settings.background.kind = isVideo ? 'video' : 'image';
      settings.background.src = mediaSrc;
      settings.background.name = name;
      saveSettings();
      refreshBackground();
      return;
    }

    var reader = new FileReader();

    reader.onload = function () {
      settings.background.kind = isVideo ? 'video' : 'image';
      settings.background.src = String(reader.result || '');
      settings.background.name = name;
      saveSettings();
      refreshBackground();
    };

    reader.readAsDataURL(file);
  }

  function getFileMediaSource(file) {
    var path = file && (file.path || file.fullPath || file.name && '');

    if (!path || path === file.name) {
      return '';
    }

    path = String(path);

    if (/^file:/i.test(path)) {
      return path;
    }

    path = path.replace(/\\/g, '/');

    if (/^[a-z]:\//i.test(path)) {
      return 'file:///' + encodeFilePath(path);
    }

    if (path.charAt(0) === '/') {
      return 'file://' + encodeFilePath(path);
    }

    return '';
  }

  function encodeFilePath(path) {
    return String(path).split('/').map(function (part) {
      return encodeURIComponent(part);
    }).join('/').replace(/^([a-zA-Z])%3A/, '$1:');
  }

  function normalizeHex(value) {
    var hex = String(value || '').replace(/[^0-9a-f]/gi, '');

    if (hex.length === 3) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }

    if (hex.length !== 6) {
      return '#ffffff';
    }

    return '#' + hex.toLowerCase();
  }

  function hexToRgba(hex, alpha) {
    var color = normalizeHex(hex);
    return 'rgba(' + parseInt(color.slice(1, 3), 16) + ',' + parseInt(color.slice(3, 5), 16) + ',' + parseInt(color.slice(5, 7), 16) + ',' + alpha + ')';
  }

  function hexToHsv(hex) {
    var color = normalizeHex(hex);
    var r = parseInt(color.slice(1, 3), 16) / 255;
    var g = parseInt(color.slice(3, 5), 16) / 255;
    var b = parseInt(color.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var h = 0;

    if (delta) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }

      h *= 60;

      if (h < 0) {
        h += 360;
      }
    }

    return {
      h: h,
      s: max === 0 ? 0 : delta / max * 100,
      v: max * 100
    };
  }

  function hsvToHex(h, s, v) {
    h = ((Number(h) || 0) % 360 + 360) % 360;
    s = clamp(Number(s) || 0, 0, 100) / 100;
    v = clamp(Number(v) || 0, 0, 100) / 100;

    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r = 0;
    var g = 0;
    var b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return '#' + toHex((r + m) * 255) + toHex((g + m) * 255) + toHex((b + m) * 255);
  }

  function toHex(value) {
    var hex = Math.round(clamp(value, 0, 255)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
