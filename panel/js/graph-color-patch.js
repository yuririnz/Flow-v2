(function () {
  var legacyColors = {
    '#ffc107': '#ffffff',
    '#ffb300': '#ffffff',
    '#f5c542': '#ffffff',
    '#f6c343': '#ffffff',
    '#ffd54f': '#ffffff',
    'rgb(255, 193, 7)': '#ffffff',
    'rgb(255, 179, 0)': '#ffffff',
    'rgba(255, 193, 7, 1)': '#ffffff',
    'rgba(255, 179, 0, 1)': '#ffffff',
    'orange': '#ffffff',
    'yellow': '#ffffff'
  };

  function normalizeColor(value) {
    if (typeof value !== 'string') {
      return value;
    }

    if (matchesConfiguredGraphLine(value)) {
      return value;
    }

    var normalized = value.trim().toLowerCase();

    if (legacyColors[normalized]) {
      return legacyColors[normalized];
    }

    var hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);

    if (hex) {
      var color = hex[1];

      if (color.length === 3) {
        color = color.replace(/./g, '$&$&');
      }

      if (isLegacyWarmLine(parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16))) {
        return '#ffffff';
      }
    }

    var rgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);

    if (rgb && isLegacyWarmLine(parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10))) {
      return '#ffffff';
    }

    return value;
  }

  function matchesConfiguredGraphLine(value) {
    var configured = '';

    try {
      configured = getComputedStyle(document.documentElement).getPropertyValue('--curve-line-color');
    } catch (error) {
      configured = '';
    }

    return colorKey(value) && colorKey(value) === colorKey(configured);
  }

  function colorKey(value) {
    var normalized = String(value || '').trim().toLowerCase();
    var hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    var rgb = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);

    if (hex) {
      var color = hex[1];

      if (color.length === 3) {
        color = color.replace(/./g, '$&$&');
      }

      return '#' + color;
    }

    if (rgb) {
      return '#' + toHex(parseInt(rgb[1], 10)) + toHex(parseInt(rgb[2], 10)) + toHex(parseInt(rgb[3], 10));
    }

    return '';
  }

  function toHex(value) {
    var hex = Math.max(0, Math.min(255, value || 0)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function isLegacyWarmLine(red, green, blue) {
    return red >= 220 && green >= 150 && green <= 225 && blue <= 90;
  }

  function patchContextSetter(property) {
    var descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, property);

    if (!descriptor || !descriptor.set || !descriptor.get) {
      return;
    }

    Object.defineProperty(CanvasRenderingContext2D.prototype, property, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) {
        descriptor.set.call(this, normalizeColor(value));
      }
    });
  }

  patchContextSetter('strokeStyle');
  patchContextSetter('fillStyle');
})();
