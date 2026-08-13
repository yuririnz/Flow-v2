(function () {
  'use strict';

  var STORAGE_KEY = 'flow.curveGraphSettings';
  var SHARED_FILE = 'Flow-3-curve-settings.json';
  var SETTINGS_EVENT = 'com.rendertom.flow.v2.settings.changed';
  var lastRaw = '';
  var rgbFrame = null;
  var activeSettings = {};

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

  function hslToHex(h, s, l) {
    h = ((Number(h) || 0) % 360 + 360) % 360;
    s = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
    l = Math.max(0, Math.min(100, Number(l) || 0)) / 100;

    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(h / 60 % 2 - 1));
    var m = l - c / 2;
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
    var hex = Math.round(Math.max(0, Math.min(255, value))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function normalizeSystemPath(path) {
    path = decodeURI(String(path || '')).replace(/\\/g, '/');
    path = path.replace(/^file:\/\/\//i, '');
    path = path.replace(/^file:\/\//i, '');
    return path.replace(/\/+$/, '');
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

  function readSettingsRaw() {
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

  function applyRawSettings(raw) {
    var settings;

    if (!raw || raw === lastRaw) {
      return;
    }

    lastRaw = raw;

    try {
      settings = JSON.parse(raw);
    } catch (error) {
      settings = {};
    }

    activeSettings = settings || {};
    applyBackground(activeSettings);
    applyTheme(activeSettings);
    applyBackgroundEffect(activeSettings);
  }

  function applyBackground(settings) {
    var root = document.documentElement;
    var background = normalizeHex(settings && settings.panelBackgroundColor || '#000000');
    var backgroundEnd = normalizeHex(settings && settings.panelBackgroundColor2 || '#2a2a2a');
    var direction = settings && typeof settings.panelBackgroundDirection === 'number' ? settings.panelBackgroundDirection : 0;
    var intensity = settings && typeof settings.panelBackgroundIntensity === 'number' ? settings.panelBackgroundIntensity : 74;

    direction = Math.max(0, Math.min(360, direction));
    intensity = Math.max(0, Math.min(100, intensity));

    root.style.setProperty('--flow-panel-background', background);
    root.style.setProperty('--flow-panel-background-end', backgroundEnd);
    root.style.setProperty('--flow-panel-background-direction', Math.round(direction) + 'deg');
    root.style.setProperty('--flow-panel-background-dim', (1 - intensity / 100).toFixed(3));
  }

  function applyTheme(settings) {
    if (settings && settings.rgbMode) {
      startRgbMode();
      return;
    }

    stopRgbMode();
    applyThemeColor(normalizeHex(settings && settings.themeColor));
  }

  function applyThemeColor(theme) {
    var root = document.documentElement;

    root.style.setProperty('--curve-theme-color', theme);
    root.style.setProperty('--curve-theme-soft', hexToRgba(theme, 0.22));
    root.style.setProperty('--curve-theme-glow', hexToRgba(theme, 0.44));
  }

  function applyBackgroundEffect(settings) {
    var effect = String(settings && settings.backgroundEffect || '').toLowerCase();

    if (effect !== 'snow' && effect !== 'rain' && effect !== 'particles' && effect !== 'none') {
      effect = settings && settings.disableSnowflake ? 'none' : 'snow';
    }

    if (document.body) {
      document.body.classList.toggle('flow-snow-disabled', effect !== 'snow');
      document.body.setAttribute('data-flow-background-effect', effect);
    }
  }

  function startRgbMode() {
    if (rgbFrame) {
      return;
    }

    function tick(now) {
      applyThemeColor(hslToHex(now * 0.055 % 360, 100, 64));
      rgbFrame = window.requestAnimationFrame(tick);
    }

    rgbFrame = window.requestAnimationFrame(tick);
  }

  function stopRgbMode() {
    if (!rgbFrame) {
      return;
    }

    window.cancelAnimationFrame(rgbFrame);
    rgbFrame = null;
  }

  function bindSettingsEvent() {
    var handler = function (event) {
      applyRawSettings(event && event.data ? String(event.data) : readSettingsRaw());
    };

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.addEventListener === 'function') {
          cs.addEventListener(SETTINGS_EVENT, handler);
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
        window.__adobe_cep__.addEventListener(SETTINGS_EVENT, handler);
      }
    } catch (error) {}
  }

  function init() {
    applyRawSettings(readSettingsRaw());
    bindSettingsEvent();

    window.setInterval(function () {
      applyRawSettings(readSettingsRaw());
    }, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
