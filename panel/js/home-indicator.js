(function () {
  var indicator = document.getElementById('iosHomeIndicator');

  if (!indicator) {
    return;
  }

  var root = document.documentElement;
  var body = document.body;
  var target = indicator.querySelector('.ios-home-indicator__touch-target');
  var storageKey = 'flow.curveGraphSettings';
  var sharedFile = 'Flow-3-curve-settings.json';
  var settingsEvent = 'com.rendertom.flow.v2.settings.changed';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsPointer = 'PointerEvent' in window;
  var maxDistance = 116;
  var completeDistance = 72;
  var completeVelocity = 0.58;
  var position = 0;
  var velocity = 0;
  var startY = 0;
  var lastY = 0;
  var lastTime = 0;
  var frame = null;
  var rgbFrame = null;
  var springTimer = null;
  var lastSettingsRaw = '';
  var homeSettings = {
    homeIndicatorColor: '#ffffff',
    hideHomeIndicator: false,
    rgbMode: false
  };
  var isDragging = false;
  var isCompleting = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pointFromEvent(event) {
    if (event.touches && event.touches.length) {
      return event.touches[0];
    }

    if (event.changedTouches && event.changedTouches.length) {
      return event.changedTouches[0];
    }

    return event;
  }

  function px(value) {
    return value.toFixed(2) + 'px';
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

  function hslToHex(h, s, l) {
    h = ((Number(h) || 0) % 360 + 360) % 360;
    s = clamp(Number(s) || 0, 0, 100) / 100;
    l = clamp(Number(l) || 0, 0, 100) / 100;

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
    var hex = Math.round(clamp(value, 0, 255)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function colorWithAlphaVar(hex) {
    var color = normalizeHex(hex);

    return 'rgba(' +
      parseInt(color.slice(1, 3), 16) + ',' +
      parseInt(color.slice(3, 5), 16) + ',' +
      parseInt(color.slice(5, 7), 16) +
      ',var(--ios-home-indicator-alpha))';
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
          return base.replace(/%24/g, '$') + '/' + sharedFile;
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
      return window.localStorage.getItem(storageKey) || '{}';
    } catch (error) {}

    return '{}';
  }

  function applySettingsRaw(raw) {
    var parsed;

    if (!raw || raw === lastSettingsRaw) {
      return;
    }

    lastSettingsRaw = raw;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parsed = {};
    }

    homeSettings.homeIndicatorColor = normalizeHex(parsed.homeIndicatorColor || '#ffffff');
    homeSettings.hideHomeIndicator = !!parsed.hideHomeIndicator;
    homeSettings.rgbMode = !!parsed.rgbMode;
    body.classList.toggle('ios-home-indicator-hidden', homeSettings.hideHomeIndicator);
    updateHomeIndicatorRgbMode();
  }

  function updateHomeIndicatorRgbMode() {
    if (homeSettings.rgbMode) {
      startHomeIndicatorRgb();
    } else {
      stopHomeIndicatorRgb();
      setHomeIndicatorColor(homeSettings.homeIndicatorColor);
    }
  }

  function setHomeIndicatorColor(color) {
    root.style.setProperty('--ios-home-indicator-color', colorWithAlphaVar(color));
    root.style.setProperty('--ios-home-indicator-glow', hexToRgba(color, 0.18));
  }

  function startHomeIndicatorRgb() {
    if (rgbFrame) {
      return;
    }

    function tick(now) {
      setHomeIndicatorColor(hslToHex(now * 0.055 % 360, 100, 64));
      rgbFrame = window.requestAnimationFrame(tick);
    }

    rgbFrame = window.requestAnimationFrame(tick);
  }

  function stopHomeIndicatorRgb() {
    if (!rgbFrame) {
      return;
    }

    window.cancelAnimationFrame(rgbFrame);
    rgbFrame = null;
  }

  function bindSettingsSync() {
    var handler = function (event) {
      applySettingsRaw(event && event.data ? String(event.data) : readSettingsRaw());
    };

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.addEventListener === 'function') {
          cs.addEventListener(settingsEvent, handler);
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
        window.__adobe_cep__.addEventListener(settingsEvent, handler);
      }
    } catch (error) {}

    window.setInterval(function () {
      applySettingsRaw(readSettingsRaw());
    }, 700);
  }

  function rubberBand(distance) {
    var freeTravel = maxDistance * 0.72;

    if (distance <= freeTravel) {
      return distance;
    }

    return Math.min(maxDistance, freeTravel + (distance - freeTravel) * 0.32);
  }

  function setVisual(nextPosition) {
    position = clamp(nextPosition, -maxDistance * 1.14, 0);

    var distance = Math.max(0, -position);
    var progress = clamp(distance / maxDistance, 0, 1);
    var containerLift = -10 * progress;
    var containerScale = 1 - 0.018 * progress;
    var scaleX = 1 + 0.42 * progress;
    var scaleY = 1 + 0.16 * progress;
    var alpha = 0.82 + 0.14 * progress;
    var scrimAlpha = 0.22 * progress;

    root.style.setProperty('--ios-home-indicator-y', px(position));
    root.style.setProperty('--ios-home-indicator-scale-x', scaleX.toFixed(3));
    root.style.setProperty('--ios-home-indicator-scale-y', scaleY.toFixed(3));
    root.style.setProperty('--ios-home-indicator-alpha', alpha.toFixed(3));
    root.style.setProperty('--ios-home-container-y', px(containerLift));
    root.style.setProperty('--ios-home-container-scale', containerScale.toFixed(4));
    root.style.setProperty('--ios-home-scrim-alpha', scrimAlpha.toFixed(3));
    indicator.dataset.progress = progress.toFixed(3);
  }

  function stopSpring() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }

    if (springTimer) {
      window.clearTimeout(springTimer);
      springTimer = null;
    }
  }

  function settleTo(targetPosition, options, done) {
    options = options || {};
    stopSpring();
    body.classList.remove('ios-home-indicator-dragging');
    body.classList.add('ios-home-indicator-settling');

    if (reduceMotion) {
      setVisual(targetPosition);
      body.classList.remove('ios-home-indicator-settling');
      if (done) {
        done();
      }
      return;
    }

    var stiffness = options.stiffness || 440;
    var damping = options.damping || 40;
    var springVelocity = options.velocity || 0;
    var lastFrameTime = performance.now();
    var startTime = lastFrameTime;
    var maxDuration = options.maxDuration || 650;
    var isFinished = false;

    function finish() {
      if (isFinished) {
        return;
      }

      isFinished = true;
      setVisual(targetPosition);
      body.classList.remove('ios-home-indicator-settling');

      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }

      if (springTimer) {
        window.clearTimeout(springTimer);
        springTimer = null;
      }

      if (done) {
        done();
      }
    }

    function tick(now) {
      var dt = clamp((now - lastFrameTime) / 1000, 0.001, 0.033);
      var displacement = position - targetPosition;
      var acceleration = -stiffness * displacement - damping * springVelocity;

      lastFrameTime = now;
      springVelocity += acceleration * dt;
      setVisual(position + springVelocity * dt);

      if (targetPosition === 0 && position === 0 && springVelocity > 0) {
        springVelocity = 0;
      }

      if (now - startTime > maxDuration || Math.abs(targetPosition - position) < 0.22 && Math.abs(springVelocity) < 4) {
        finish();
        return;
      }

      frame = window.requestAnimationFrame(tick);
    }

    springTimer = window.setTimeout(finish, maxDuration + 48);
    frame = window.requestAnimationFrame(tick);
  }

  function dispatchSwipeUp() {
    var detail = {
      progress: 1,
      velocity: velocity,
      source: 'ios-home-indicator'
    };
    var event;

    try {
      event = new CustomEvent('ios-home-indicator:swipe-up', {
        bubbles: true,
        cancelable: true,
        detail: detail
      });
    } catch (error) {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('ios-home-indicator:swipe-up', true, true, detail);
    }

    return indicator.dispatchEvent(event);
  }

  function navigateToTargetPage() {
    var targetPage = indicator.getAttribute('data-target-page');

    if (!targetPage) {
      return;
    }

    window.location.href = targetPage;
  }

  function vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  }

  function completeGesture() {
    if (isCompleting) {
      return;
    }

    isCompleting = true;
    body.classList.add('ios-home-indicator-completing');
    vibrate();
    var shouldNavigate = dispatchSwipeUp();

    settleTo(-96, {
      damping: 34,
      maxDuration: 360,
      stiffness: 520,
      velocity: -Math.max(velocity * 1000, 360)
    }, function () {
      if (shouldNavigate) {
        navigateToTargetPage();
        return;
      }

      window.setTimeout(function () {
        body.classList.remove('ios-home-indicator-completing');
        settleTo(0, {
          damping: 38,
          maxDuration: 540,
          stiffness: 420,
          velocity: 0
        }, function () {
          isCompleting = false;
        });
      }, reduceMotion ? 0 : 120);
    });
  }

  function startGesture(event) {
    if (isCompleting || event.button > 0) {
      return;
    }

    var point = pointFromEvent(event);

    stopSpring();
    isDragging = true;
    startY = point.clientY;
    lastY = point.clientY;
    lastTime = performance.now();
    velocity = 0;

    body.classList.add('ios-home-indicator-dragging');
    body.classList.remove('ios-home-indicator-settling');

    if (event.pointerId !== undefined && target.setPointerCapture) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch (error) {
        // Synthetic pointer events in headless checks do not always own capture.
      }
    }
  }

  function moveGesture(event) {
    if (!isDragging) {
      return;
    }

    var point = pointFromEvent(event);
    var now = performance.now();
    var dt = Math.max(now - lastTime, 1);
    var upwardDistance = Math.max(0, startY - point.clientY);

    velocity = clamp((lastY - point.clientY) / dt, -1.4, 1.4);
    lastY = point.clientY;
    lastTime = now;
    setVisual(-rubberBand(upwardDistance));
    event.preventDefault();
  }

  function endGesture() {
    if (!isDragging) {
      return;
    }

    isDragging = false;

    if (Math.abs(position) >= completeDistance || velocity >= completeVelocity) {
      completeGesture();
      return;
    }

    settleTo(0, {
      damping: 40,
      maxDuration: 520,
      stiffness: 460,
      velocity: -velocity * 1000
    });
  }

  function cancelGesture() {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    settleTo(0, {
      damping: 42,
      maxDuration: 520,
      stiffness: 430,
      velocity: 0
    });
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }

    event.preventDefault();
    velocity = 0.7;
    completeGesture();
  }

  if (supportsPointer) {
    target.addEventListener('pointerdown', startGesture);
    target.addEventListener('pointermove', moveGesture);
    target.addEventListener('pointerup', endGesture);
    target.addEventListener('pointercancel', cancelGesture);
  } else {
    target.addEventListener('mousedown', startGesture);
    window.addEventListener('mousemove', moveGesture);
    window.addEventListener('mouseup', endGesture);
    target.addEventListener('touchstart', startGesture, { passive: false });
    target.addEventListener('touchmove', moveGesture, { passive: false });
    target.addEventListener('touchend', endGesture);
    target.addEventListener('touchcancel', cancelGesture);
  }

  target.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', cancelGesture);
  applySettingsRaw(readSettingsRaw());
  bindSettingsSync();
  setVisual(0);
})();
