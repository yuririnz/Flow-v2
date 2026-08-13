(function () {
  'use strict';

  var MODES = ['bezier', 'fourkey', 'custom', 'elastic', 'bounce', 'wave', 'steps'];
  var MODE_LABELS = {
    bezier: 'Bezier',
    fourkey: '4-Key',
    custom: 'Custom',
    elastic: 'Elastic',
    bounce: 'Bounce',
    wave: 'Wave',
    steps: 'Step'
  };
  var STATE_STORAGE_KEY = 'flow.graphEditorState';
  var STATE_SHARED_FILE = 'Flow-3-graph-editor.json';
  var SETTINGS_SHARED_FILE = 'Flow-3-curve-settings.json';
  var STATE_EVENT = 'com.rendertom.flow.v2.graphEditor.state';
  var CHANGED_EVENT = 'com.rendertom.flow.v2.graphEditor.changed';
  var READY_EVENT = 'com.rendertom.flow.v2.graphEditor.ready';
  var CLOSED_EVENT = 'com.rendertom.flow.v2.graphEditor.closed';
  var BEZIER_MIN = -4;
  var BEZIER_MAX = 5;
  var CONTROL_MIN = -1;
  var CONTROL_MAX = 2;
  var FOURKEY_MIN = -2;
  var FOURKEY_MAX = 3;

  var state = {
    mode: 'bezier',
    bezierValues: [0.33, 0, 0.67, 1],
    params: {
      fourkey: {
        segmentA: { p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
        segmentB: { p1: { x: 0.42, y: 1 }, p2: { x: 0.58, y: 0 } }
      },
      custom: {
        points: [
          { x: 0, y: 0, cx1: 0, cy1: 0, cx2: 0.33, cy2: 0 },
          { x: 1, y: 1, cx1: 0.67, cy1: 1, cx2: 1, cy2: 1 }
        ],
        mode: 'bake',
        bakeResolution: 8,
        isMirrored: false
      },
      elastic: { amplitude: 1, frequency: 3, decay: 4, isMirrored: false },
      bounce: { bounces: 3, stiffness: 0.6, isMirrored: false },
      wave: { amplitude: 1, frequency: 2.5, decay: 0, sharpness: 0, isMirrored: false },
      steps: { count: 6, position: 'end' }
    },
    settings: {
      themeColor: '#ffffff',
      panelBackgroundColor: '#000000',
      panelBackgroundColor2: '#222222',
      panelBackgroundDirection: 0,
      panelBackgroundIntensity: 74,
      graphLineColor: '#ffffff',
      handleColor: '#ffffff',
      handleStyle: 'heart',
      handleSize: 14,
      handleLineThickness: 1,
      handleImage: { src: '', name: '' },
      rgbMode: false
    },
    drag: null,
    clickAnimation: null,
    clickAnimationFrame: null,
    view: null,
    plot: null,
    lastStateRaw: '',
    lastStateSignature: '',
    lastSettingsRaw: '',
    revision: 0,
    sendFrame: null,
    fileTimer: null,
    pendingRaw: '',
    rgbFrame: null,
    rgbHue: 0
  };

  var els = {};

  function init() {
    els.canvas = document.getElementById('graphEditorCanvas');
    els.stage = document.getElementById('graphEditorStage');
    els.readout = document.getElementById('graphEditorReadout');
    els.coordinates = document.getElementById('graphEditorCoordinates');
    els.modeButtons = document.querySelectorAll('[data-editor-mode]');
    els.handles = document.querySelectorAll('[data-editor-handle]');

    if (!els.canvas || !els.stage || !els.modeButtons.length || !els.handles.length) {
      return;
    }

    addCepListener(STATE_EVENT, receiveMainState);
    loadInitialState();
    syncSettings();
    bindModeButtons();
    bindHandles();
    updateModeButtons();
    applySettings();
    resizeAndRender();

    window.addEventListener('resize', resizeAndRender);
    window.addEventListener('beforeunload', closeEditor);

    if (window.ResizeObserver) {
      var observer = new window.ResizeObserver(resizeAndRender);
      observer.observe(els.stage);
    }

    window.setInterval(syncStateFromFile, 180);
    window.setInterval(syncSettings, 650);
    dispatchCepEvent(READY_EVENT, '');
  }

  function bindModeButtons() {
    for (var i = 0; i < els.modeButtons.length; i++) {
      els.modeButtons[i].addEventListener('click', function (event) {
        var mode = event.currentTarget.getAttribute('data-editor-mode');

        if (MODES.indexOf(mode) === -1 || mode === state.mode) {
          return;
        }

        cancelBezierClickAnimation();
        state.mode = mode;
        state.view = null;
        updateModeButtons();
        render();
        sendEditorState(true);
      });
    }
  }

  function bindHandles() {
    for (var i = 0; i < els.handles.length; i++) {
      els.handles[i].addEventListener('mousedown', startHandleDrag);
    }

    els.stage.addEventListener('mousedown', moveNearestBezierHandleToClick);

    document.addEventListener('mousemove', dragHandle);
    document.addEventListener('mouseup', stopHandleDrag);
  }

  function startHandleDrag(event) {
    var handleName = event.currentTarget.getAttribute('data-editor-handle');

    if (getVisibleHandles().indexOf(handleName) === -1) {
      return;
    }

    cancelBezierClickAnimation();
    state.drag = {
      name: handleName,
      element: event.currentTarget,
      view: copyObject(state.view || calculateViewRange()),
      plot: copyObject(state.plot || getPlotArea()),
      snapOrigin: null,
      snapDirection: ''
    };
    state.view = copyObject(state.drag.view);
    event.currentTarget.classList.add('is-dragging');
    document.body.classList.add('is-handle-dragging');
    updateCoordinateReadout(handleName);
    event.preventDefault();
  }

  function moveNearestBezierHandleToClick(event) {
    if (state.mode !== 'bezier' || state.drag || event.button !== 0) {
      return;
    }

    if (event.target && event.target.getAttribute && event.target.getAttribute('data-editor-handle')) {
      return;
    }

    var rect = els.stage.getBoundingClientRect();
    var view = copyObject(state.view || calculateViewRange());
    var plot = copyObject(state.plot || getPlotArea(rect));
    var handles = getHandlePoints();
    var pointA = pointToScreen(handles.A, plot, view);
    var pointB = pointToScreen(handles.B, plot, view);
    var clickX = event.clientX - rect.left;
    var clickY = event.clientY - rect.top;
    var distanceA = Math.pow(clickX - pointA.x, 2) + Math.pow(clickY - pointA.y, 2);
    var distanceB = Math.pow(clickX - pointB.x, 2) + Math.pow(clickY - pointB.y, 2);
    var handleName = distanceA <= distanceB ? 'A' : 'B';
    var point = clientToNormal(event.clientX, event.clientY, view, plot);

    state.view = view;
    animateBezierHandleToPoint(handleName, point.x, point.y);
    event.preventDefault();
  }

  function animateBezierHandleToPoint(handleName, x, y) {
    cancelBezierClickAnimation();

    var from = state.bezierValues.slice(0, 4);
    var to = from.slice(0, 4);
    var index = handleName === 'A' ? 0 : 2;

    to[index] = round(clamp(x, 0, 1), 2);
    to[index + 1] = round(clamp(y, BEZIER_MIN, BEZIER_MAX), 2);

    if (Math.abs(from[index] - to[index]) < 0.0001 && Math.abs(from[index + 1] - to[index + 1]) < 0.0001) {
      return;
    }

    state.clickAnimation = {
      from: from,
      to: to,
      duration: 200,
      start: 0
    };

    var raf = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(function () {
        callback(Date.now());
      }, 16);
    };

    function tick(now) {
      var animation = state.clickAnimation;

      if (!animation) {
        return;
      }

      if (!animation.start) {
        animation.start = now;
      }

      var linear = clamp((now - animation.start) / animation.duration, 0, 1);
      var eased = easeOriginalFlowClick(linear);

      for (var i = 0; i < 4; i++) {
        state.bezierValues[i] = animation.from[i] + (animation.to[i] - animation.from[i]) * eased;
      }

      render();
      scheduleEditorState();

      if (linear < 1) {
        state.clickAnimationFrame = raf(tick);
        return;
      }

      state.clickAnimation = null;
      state.clickAnimationFrame = null;
      state.bezierValues = animation.to.slice(0, 4);
      render();
      sendEditorState(true);
    }

    state.clickAnimationFrame = raf(tick);
  }

  function cancelBezierClickAnimation() {
    if (state.clickAnimationFrame) {
      (window.cancelAnimationFrame || window.clearTimeout)(state.clickAnimationFrame);
      state.clickAnimationFrame = null;
    }

    state.clickAnimation = null;
  }

  function easeOriginalFlowClick(progress) {
    var x1 = 0.25;
    var y1 = 0.1;
    var x2 = 0.25;
    var y2 = 1;
    var cx = 3 * x1;
    var bx = 3 * (x2 - x1) - cx;
    var ax = 1 - cx - bx;
    var cy = 3 * y1;
    var by = 3 * (y2 - y1) - cy;
    var ay = 1 - cy - by;
    var guess = clamp(progress, 0, 1);

    for (var i = 0; i < 5; i++) {
      var error = guess * (cx + guess * (bx + guess * ax)) - progress;

      if (Math.abs(error) < 0.001) {
        break;
      }

      var slope = cx + guess * (2 * bx + 3 * ax * guess);

      if (Math.abs(slope) < 0.0001) {
        break;
      }

      guess -= error / slope;
    }

    return clamp(guess * (cy + guess * (by + guess * ay)), 0, 1);
  }

  function dragHandle(event) {
    if (!state.drag) {
      return;
    }

    var point = getSnappedHandlePoint(event, state.drag);
    updateParamsFromDrag(state.drag.name, point.x, point.y);
    render();
    scheduleEditorState();
    updateCoordinateReadout(state.drag.name);
    event.preventDefault();
  }

  function stopHandleDrag(event) {
    if (!state.drag) {
      return;
    }

    if (event && isFinite(event.clientX) && isFinite(event.clientY)) {
      var point = getSnappedHandlePoint(event, state.drag);
      updateParamsFromDrag(state.drag.name, point.x, point.y);
    }

    state.drag.element.classList.remove('is-dragging');
    state.drag = null;
    document.body.classList.remove('is-handle-dragging');
    els.coordinates.classList.remove('is-visible');
    render();
    sendEditorState(true);
  }

  function getSnappedHandlePoint(event, drag) {
    var point = clientToNormal(event.clientX, event.clientY, drag.view, drag.plot);

    if (!event.shiftKey) {
      drag.snapOrigin = null;
      drag.snapDirection = '';
      return point;
    }

    if (!drag.snapOrigin) {
      drag.snapOrigin = {
        clientX: event.clientX,
        clientY: event.clientY
      };
      drag.snapDirection = '';
    }

    if (!drag.snapDirection) {
      var deltaX = Math.abs(event.clientX - drag.snapOrigin.clientX);
      var deltaY = Math.abs(event.clientY - drag.snapOrigin.clientY);

      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 20) {
        drag.snapDirection = deltaX > deltaY ? 'horizontal' : deltaY > deltaX ? 'vertical' : '';
      }
    }

    if (drag.snapDirection === 'horizontal') {
      var stageRect = els.stage.getBoundingClientRect();
      var relativeY = (event.clientY - stageRect.top - drag.plot.top) / drag.plot.height;
      var snappedY = Math.round(relativeY * 5) / 5;
      point.y = drag.view.max - snappedY * (drag.view.max - drag.view.min);
    } else if (drag.snapDirection === 'vertical') {
      point.x = Math.round(point.x * 6) / 6;
    }

    var limits = getModeLimits();
    point.x = clamp(point.x, 0, 1);
    point.y = clamp(point.y, limits.min, limits.max);
    return point;
  }

  function updateModeButtons() {
    for (var i = 0; i < els.modeButtons.length; i++) {
      var active = els.modeButtons[i].getAttribute('data-editor-mode') === state.mode;
      els.modeButtons[i].classList.toggle('is-active', active);
      els.modeButtons[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function loadInitialState() {
    var raw = readStateRaw();

    if (!raw) {
      return;
    }

    try {
      applyPayload(JSON.parse(raw));
      state.lastStateRaw = raw;
    } catch (error) {}
  }

  function receiveMainState(event) {
    var raw = event && typeof event === 'object' && 'data' in event ? event.data : event;
    var payload;

    if (state.drag || state.clickAnimation || !raw || raw === state.lastStateRaw) {
      return;
    }

    try {
      payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
      return;
    }

    if (!payload || payload.sender !== 'main') {
      return;
    }

    state.lastStateRaw = typeof raw === 'string' ? raw : JSON.stringify(payload);
    applyPayload(payload);
    state.lastStateSignature = getStateSignature();
    updateModeButtons();
    state.view = null;
    render();
  }

  function syncStateFromFile() {
    if (state.drag || state.clickAnimation) {
      return;
    }

    var raw = readStateRaw();
    var payload;

    if (!raw || raw === state.lastStateRaw) {
      return;
    }

    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return;
    }

    state.lastStateRaw = raw;

    if (!payload || payload.sender !== 'main') {
      return;
    }

    applyPayload(payload);
    state.lastStateSignature = getStateSignature();
    updateModeButtons();
    state.view = null;
    render();
  }

  function applyPayload(payload) {
    if (!payload) {
      return;
    }

    if (MODES.indexOf(payload.mode) !== -1) {
      state.mode = payload.mode;
    }

    if (payload.bezierValues && payload.bezierValues.length >= 4) {
      var values = [];

      for (var i = 0; i < 4; i++) {
        var value = Number(payload.bezierValues[i]);
        values.push(isFinite(value) ? value : state.bezierValues[i]);
      }

      values[0] = round(clamp(values[0], 0, 1), 2);
      values[1] = round(clamp(values[1], BEZIER_MIN, BEZIER_MAX), 2);
      values[2] = round(clamp(values[2], 0, 1), 2);
      values[3] = round(clamp(values[3], BEZIER_MIN, BEZIER_MAX), 2);
      state.bezierValues = values;
    }

    if (payload.params) {
      for (var modeIndex = 0; modeIndex < MODES.length; modeIndex++) {
        var mode = MODES[modeIndex];

        if (mode !== 'bezier' && payload.params[mode]) {
          state.params[mode] = copyObject(payload.params[mode]);
        }
      }
    }
  }

  function getCoreState() {
    return {
      mode: state.mode,
      bezierValues: state.bezierValues.slice(0, 4),
      params: copyObject(state.params)
    };
  }

  function getStateSignature() {
    try {
      return JSON.stringify(getCoreState());
    } catch (error) {
      return '';
    }
  }

  function buildPayload() {
    var core = getCoreState();
    state.revision = Math.max(Date.now(), state.revision + 1);

    return {
      version: 1,
      sender: 'editor',
      revision: state.revision,
      mode: core.mode,
      bezierValues: core.bezierValues,
      params: core.params
    };
  }

  function scheduleEditorState() {
    if (state.sendFrame) {
      return;
    }

    var raf = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 16);
    };

    state.sendFrame = raf(function () {
      state.sendFrame = null;
      sendEditorState(false);
    });
  }

  function sendEditorState(immediate) {
    var signature = getStateSignature();

    if (!immediate && signature === state.lastStateSignature) {
      return;
    }

    state.lastStateSignature = signature;
    var raw;

    try {
      raw = JSON.stringify(buildPayload());
    } catch (error) {
      return;
    }

    dispatchCepEvent(CHANGED_EVENT, raw);

    if (immediate) {
      if (state.fileTimer) {
        window.clearTimeout(state.fileTimer);
        state.fileTimer = null;
      }

      state.pendingRaw = '';
      state.lastStateRaw = raw;
      writeStateRaw(raw);
      return;
    }

    state.pendingRaw = raw;

    if (!state.fileTimer) {
      state.fileTimer = window.setTimeout(function () {
        var pending = state.pendingRaw;
        state.fileTimer = null;
        state.pendingRaw = '';

        if (pending) {
          state.lastStateRaw = pending;
          writeStateRaw(pending);
        }
      }, 45);
    }
  }

  function closeEditor() {
    cancelBezierClickAnimation();

    if (state.sendFrame) {
      (window.cancelAnimationFrame || window.clearTimeout)(state.sendFrame);
      state.sendFrame = null;
    }

    sendEditorState(true);
    dispatchCepEvent(CLOSED_EVENT, '');
  }

  function addCepListener(type, callback) {
    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.addEventListener === 'function') {
          cs.addEventListener(type, callback);
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
        window.__adobe_cep__.addEventListener(type, callback);
      }
    } catch (error) {}
  }

  function dispatchCepEvent(type, raw) {
    var event = {
      type: type,
      scope: 'APPLICATION',
      appId: '',
      extensionId: '',
      data: raw || ''
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

  function getSharedPath(fileName) {
    try {
      if (window.__adobe_cep__ && window.cep && window.cep.fs) {
        var base = normalizeSystemPath(window.__adobe_cep__.getSystemPath('userData'));

        if (base) {
          return base.replace(/%24/g, '$') + '/' + fileName;
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

  function readSharedFile(fileName) {
    var path = getSharedPath(fileName);

    try {
      if (path && window.cep && window.cep.fs && window.cep.fs.readFile) {
        var file = window.cep.fs.readFile(path);
        return file && file.data ? file.data : '';
      }
    } catch (error) {}

    return '';
  }

  function writeSharedFile(fileName, raw) {
    var path = getSharedPath(fileName);

    try {
      if (path && window.cep && window.cep.fs && window.cep.fs.writeFile) {
        window.cep.fs.writeFile(path, raw);
      }
    } catch (error) {}
  }

  function readStateRaw() {
    var raw = readSharedFile(STATE_SHARED_FILE);

    if (raw) {
      return raw;
    }

    try {
      return window.localStorage.getItem(STATE_STORAGE_KEY) || '';
    } catch (error) {}

    return '';
  }

  function writeStateRaw(raw) {
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, raw);
    } catch (error) {}

    writeSharedFile(STATE_SHARED_FILE, raw);
  }

  function syncSettings() {
    var raw = readSharedFile(SETTINGS_SHARED_FILE);

    if (!raw || raw === state.lastSettingsRaw) {
      return;
    }

    try {
      var incoming = JSON.parse(raw);
      state.settings.themeColor = normalizeHex(incoming.themeColor, '#ffffff');
      state.settings.panelBackgroundColor = normalizeHex(incoming.panelBackgroundColor, '#000000');
      state.settings.panelBackgroundColor2 = normalizeHex(incoming.panelBackgroundColor2, '#222222');
      state.settings.panelBackgroundDirection = clamp(Number(incoming.panelBackgroundDirection) || 0, 0, 360);
      state.settings.panelBackgroundIntensity = clamp(Number(incoming.panelBackgroundIntensity) || 0, 0, 100);
      state.settings.graphLineColor = normalizeHex(incoming.graphLineColor, '#ffffff');
      state.settings.handleColor = normalizeHex(incoming.handleColor, '#ffffff');
      state.settings.handleStyle = normalizeHandleStyle(incoming.handleStyle);
      state.settings.handleSize = clamp(Number(incoming.handleSize) || 14, 8, 32);
      state.settings.handleLineThickness = clamp(Number(incoming.handleLineThickness) || 1, 0.5, 4);
      state.settings.handleImage = incoming.handleImage || { src: '', name: '' };
      state.settings.rgbMode = !!incoming.rgbMode;
      state.lastSettingsRaw = raw;
      applySettings();
      render();
    } catch (error) {}
  }

  function applySettings() {
    var root = document.documentElement;
    var style = state.settings.handleStyle;
    var image = state.settings.handleImage && state.settings.handleImage.src || '';

    if (style === 'custom' && !image) {
      style = 'heart';
    }

    root.style.setProperty('--editor-background-1', state.settings.panelBackgroundColor);
    root.style.setProperty('--editor-background-2', state.settings.panelBackgroundColor2);
    root.style.setProperty('--editor-background-direction', Math.round(state.settings.panelBackgroundDirection) + 'deg');
    root.style.setProperty('--editor-background-dim', (1 - state.settings.panelBackgroundIntensity / 100).toFixed(3));
    root.style.setProperty('--editor-handle-size', Math.round(state.settings.handleSize) + 'px');
    root.style.setProperty('--editor-handle-image', image ? toCssUrl(image) : 'none');

    var styles = ['heart', 'circle', 'square', 'diamond', 'star', 'custom'];

    for (var i = 0; i < styles.length; i++) {
      document.body.classList.remove('handle-style-' + styles[i]);
    }

    document.body.classList.add('handle-style-' + style);
    updateActiveColors();
    updateRgbAnimation();
  }

  function updateRgbAnimation() {
    if (state.settings.rgbMode && !state.rgbFrame) {
      var tick = function (now) {
        state.rgbHue = now * 0.055 % 360;
        updateActiveColors();
        render();
        state.rgbFrame = window.requestAnimationFrame(tick);
      };

      state.rgbFrame = window.requestAnimationFrame(tick);
    } else if (!state.settings.rgbMode && state.rgbFrame) {
      window.cancelAnimationFrame(state.rgbFrame);
      state.rgbFrame = null;
      state.rgbHue = 0;
      updateActiveColors();
    }
  }

  function getActiveColor(key) {
    return state.settings.rgbMode ? hslToHex(state.rgbHue, 100, 64) : state.settings[key];
  }

  function updateActiveColors() {
    var root = document.documentElement;
    var theme = getActiveColor('themeColor');
    var line = getActiveColor('graphLineColor');
    var handle = getActiveColor('handleColor');

    root.style.setProperty('--editor-theme-color', theme);
    root.style.setProperty('--editor-theme-glow', hexToRgba(theme, 0.34));
    root.style.setProperty('--editor-line-color', line);
    root.style.setProperty('--editor-line-glow', hexToRgba(line, 0.62));
    root.style.setProperty('--editor-handle-color', handle);
    root.style.setProperty('--editor-handle-glow', hexToRgba(handle, 0.38));
  }
  function updateParamsFromDrag(handleName, x, y) {
    var params = state.params[state.mode];

    if (state.mode === 'bezier') {
      var index = handleName === 'A' ? 0 : 2;
      state.bezierValues[index] = round(clamp(x, 0, 1), 2);
      state.bezierValues[index + 1] = round(clamp(y, BEZIER_MIN, BEZIER_MAX), 2);
      return;
    }

    if (state.mode === 'fourkey') {
      var segment = handleName === 'A' || handleName === 'B' ? params.segmentA : params.segmentB;
      var control = handleName === 'A' || handleName === 'C' ? segment.p1 : segment.p2;
      control.x = round(clamp(handleName === 'A' || handleName === 'B' ? x * 2 : (x - 0.5) * 2, 0, 1), 2);
      control.y = round(clamp(y, FOURKEY_MIN, FOURKEY_MAX), 2);
    } else if (state.mode === 'custom') {
      var points = params.points;

      if (!points || points.length < 2) {
        return;
      }

      if (handleName === 'A') {
        points[0].cx2 = round(clamp(x, points[0].x, points[1].x), 2);
        points[0].cy2 = round(clamp(y, CONTROL_MIN, CONTROL_MAX), 2);
      } else {
        points[1].cx1 = round(clamp(x, points[0].x, points[1].x), 2);
        points[1].cy1 = round(clamp(y, CONTROL_MIN, CONTROL_MAX), 2);
      }
    } else if (state.mode === 'elastic') {
      if (handleName === 'A') {
        params.amplitude = round(clamp(1 - y, 0.1, 2), 2);
      } else if (handleName === 'B') {
        params.frequency = round(clamp(0.5 / Math.max(0.01, x), 1, 20), 2);
      } else {
        var decayRatio = clamp((1 - y) / params.amplitude, 0.001, 0.99);
        params.decay = round(clamp(-Math.log(decayRatio) / 0.5, 0, 20), 2);
      }
    } else if (state.mode === 'bounce') {
      if (handleName === 'A') {
        params.stiffness = round(clamp(1 - y, 0.1, 0.95), 2);
      } else {
        params.bounces = Math.round(clamp(x * 10, 1, 10));
      }
    } else if (state.mode === 'wave') {
      if (handleName === 'A') {
        params.frequency = round(clamp(1 / Math.max(0.02, x), 0.5, 20), 2);
      } else if (handleName === 'B') {
        var decayInput = (y - 0.5) / 0.5;

        if (decayInput > 0.001) {
          params.decay = round(clamp(-Math.log(clamp(decayInput, 0.001, 1)) / 0.5, 0, 20), 2);
        }
      } else {
        var sharpY = Math.abs(y - 0.5) < 0.04 ? 0.5 : y;
        params.sharpness = round(clamp((sharpY - 0.5) / 0.5, -1, 1), 2);
      }
    } else if (state.mode === 'steps') {
      params.count = Math.round(clamp(x * 20, 2, 20));
    }
  }

  function clientToNormal(clientX, clientY, view, plot) {
    var rect = els.stage.getBoundingClientRect();
    var x = (clientX - rect.left - plot.left) / plot.width;
    var normalizedY = 1 - ((clientY - rect.top - plot.top) / plot.height);
    var y = view.min + normalizedY * (view.max - view.min);
    var limits = getModeLimits();

    return {
      x: clamp(x, 0, 1),
      y: clamp(y, limits.min, limits.max)
    };
  }

  function getModeLimits() {
    if (state.mode === 'bezier') {
      return { min: BEZIER_MIN, max: BEZIER_MAX };
    }

    if (state.mode === 'fourkey') {
      return { min: FOURKEY_MIN, max: FOURKEY_MAX };
    }

    return { min: CONTROL_MIN, max: CONTROL_MAX };
  }

  function getVisibleHandles() {
    if (state.mode === 'fourkey') {
      return ['A', 'B', 'C', 'D'];
    }

    if (state.mode === 'bezier' || state.mode === 'custom' || state.mode === 'bounce') {
      return ['A', 'B'];
    }

    if (state.mode === 'steps') {
      return ['A'];
    }

    return ['A', 'B', 'C'];
  }

  function getHandlePoints() {
    var params = state.params[state.mode];

    if (state.mode === 'bezier') {
      return {
        A: { x: state.bezierValues[0], y: state.bezierValues[1] },
        B: { x: state.bezierValues[2], y: state.bezierValues[3] }
      };
    }

    if (state.mode === 'fourkey') {
      return {
        A: { x: params.segmentA.p1.x * 0.5, y: params.segmentA.p1.y },
        B: { x: params.segmentA.p2.x * 0.5, y: params.segmentA.p2.y },
        C: { x: 0.5 + params.segmentB.p1.x * 0.5, y: params.segmentB.p1.y },
        D: { x: 0.5 + params.segmentB.p2.x * 0.5, y: params.segmentB.p2.y }
      };
    }

    if (state.mode === 'custom') {
      var points = params.points || [];

      if (points.length < 2) {
        return { A: { x: 0.33, y: 0 }, B: { x: 0.67, y: 1 } };
      }

      return {
        A: { x: points[0].cx2, y: points[0].cy2 },
        B: { x: points[1].cx1, y: points[1].cy1 }
      };
    }

    if (state.mode === 'elastic') {
      return {
        A: { x: 0, y: 1 - params.amplitude },
        B: { x: 0.5 / params.frequency, y: 0.5 },
        C: { x: 1, y: 1 - params.amplitude * Math.exp(-params.decay * 0.5) }
      };
    }

    if (state.mode === 'bounce') {
      return {
        A: { x: 0, y: 1 - params.stiffness },
        B: { x: params.bounces / 10, y: 0.5 }
      };
    }

    if (state.mode === 'wave') {
      return {
        A: { x: Math.min(1 / Math.max(0.1, params.frequency), 1), y: 0.5 },
        B: { x: 0.5, y: 0.5 + 0.5 * Math.exp(-params.decay * 0.5) },
        C: { x: 0.25, y: 0.5 + params.sharpness * 0.5 }
      };
    }

    return {
      A: { x: params.count / 20, y: 0.5 }
    };
  }

  function resizeAndRender() {
    state.view = null;
    render();
  }

  function render() {
    if (!els.canvas || !els.stage) {
      return;
    }

    var rect = els.stage.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(1, Math.round(rect.width * dpr));
    var height = Math.max(1, Math.round(rect.height * dpr));

    if (els.canvas.width !== width) {
      els.canvas.width = width;
    }

    if (els.canvas.height !== height) {
      els.canvas.height = height;
    }

    els.canvas.style.width = rect.width + 'px';
    els.canvas.style.height = rect.height + 'px';

    var ctx = els.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = 'rgba(2, 2, 4, 0.78)';
    ctx.fillRect(0, 0, rect.width, rect.height);

    var view = state.view || calculateViewRange();
    var plot = getPlotArea(rect);
    state.view = view;
    state.plot = plot;

    drawGrid(ctx, plot, view);
    drawControlGuides(ctx, plot, view);
    drawCurve(ctx, plot, view);
    drawEndpoints(ctx, plot, view);
    positionHandles(plot, view);
    updateHeaderReadout();
  }

  function getPlotArea(rect) {
    rect = rect || els.stage.getBoundingClientRect();
    var inset = Math.max(5, Math.round(state.settings.handleSize / 2) + 1);

    return {
      left: inset,
      top: inset,
      width: Math.max(1, rect.width - inset * 2),
      height: Math.max(1, rect.height - inset * 2)
    };
  }

  function calculateViewRange() {
    var range = { min: 0, max: 1 };
    var handles = getHandlePoints();
    var visible = getVisibleHandles();

    for (var h = 0; h < visible.length; h++) {
      var handle = handles[visible[h]];

      if (handle && isFinite(handle.y)) {
        range.min = Math.min(range.min, handle.y);
        range.max = Math.max(range.max, handle.y);
      }
    }

    if (state.mode === 'custom') {
      var points = state.params.custom.points || [];

      for (var p = 0; p < points.length; p++) {
        range.min = Math.min(range.min, points[p].y, points[p].cy1, points[p].cy2);
        range.max = Math.max(range.max, points[p].y, points[p].cy1, points[p].cy2);
      }
    }

    var samples = state.mode === 'steps' ? Math.max(12, state.params.steps.count * 2) : 220;

    for (var i = 0; i <= samples; i++) {
      var y = evaluate(i / samples);

      if (isFinite(y)) {
        range.min = Math.min(range.min, y);
        range.max = Math.max(range.max, y);
      }
    }

    if (range.min >= 0 && range.max <= 1) {
      return { min: -0.08, max: 1.08 };
    }

    var span = Math.max(0.0001, range.max - range.min);
    var padding = Math.max(0.08, span * 0.08);
    range.min -= padding;
    range.max += padding;

    if (range.max - range.min < 1.16) {
      var center = (range.min + range.max) / 2;
      range.min = center - 0.58;
      range.max = center + 0.58;
    }

    return range;
  }

  function drawGrid(ctx, plot, view) {
    ctx.save();
    ctx.lineWidth = 1;

    for (var xIndex = 0; xIndex <= 6; xIndex++) {
      var x = plot.left + plot.width * xIndex / 6;
      ctx.strokeStyle = xIndex === 0 || xIndex === 6 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.13)';
      drawLine(ctx, x, plot.top, x, plot.top + plot.height);
    }

    for (var yIndex = 0; yIndex <= 5; yIndex++) {
      var y = plot.top + plot.height * yIndex / 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      drawLine(ctx, plot.left, y, plot.left + plot.width, y);
    }

    var zeroY = yToScreen(0, plot, view);
    var oneY = yToScreen(1, plot, view);

    if (zeroY >= plot.top - 1 && zeroY <= plot.top + plot.height + 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.58)';
      ctx.lineWidth = 1.2;
      drawLine(ctx, plot.left, zeroY, plot.left + plot.width, zeroY);
    }

    if (oneY >= plot.top - 1 && oneY <= plot.top + plot.height + 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.58)';
      ctx.lineWidth = 1.2;
      drawLine(ctx, plot.left, oneY, plot.left + plot.width, oneY);
    }

    ctx.restore();
  }

  function drawControlGuides(ctx, plot, view) {
    var handles = getHandlePoints();
    var segments = [];

    if (state.mode === 'bezier') {
      segments.push([{ x: 0, y: 0 }, handles.A]);
      segments.push([{ x: 1, y: 1 }, handles.B]);
    } else if (state.mode === 'fourkey') {
      segments.push([{ x: 0, y: 0 }, handles.A]);
      segments.push([{ x: 0.5, y: 1 }, handles.B]);
      segments.push([{ x: 0.5, y: 1 }, handles.C]);
      segments.push([{ x: 1, y: 0 }, handles.D]);
    } else if (state.mode === 'custom') {
      var points = state.params.custom.points || [];

      if (points.length > 1) {
        segments.push([{ x: points[0].x, y: points[0].y }, handles.A]);
        segments.push([{ x: points[1].x, y: points[1].y }, handles.B]);
      }
    }

    if (!segments.length) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = state.settings.handleLineThickness;

    for (var i = 0; i < segments.length; i++) {
      var start = pointToScreen(segments[i][0], plot, view);
      var end = pointToScreen(segments[i][1], plot, view);
      drawLine(ctx, start.x, start.y, end.x, end.y);
    }

    ctx.restore();
  }

  function drawCurve(ctx, plot, view) {
    var lineColor = getActiveColor('graphLineColor');
    var samples = state.mode === 'steps' ? Math.max(240, state.params.steps.count * 30) : 400;

    ctx.save();
    ctx.beginPath();

    for (var i = 0; i <= samples; i++) {
      var x = i / samples;
      var point = pointToScreen({ x: x, y: evaluate(x) }, plot, view);

      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 11;
    ctx.stroke();
    ctx.restore();
  }

  function drawEndpoints(ctx, plot, view) {
    var endpoints = state.mode === 'fourkey'
      ? [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }]
      : [{ x: 0, y: evaluate(0) }, { x: 1, y: evaluate(1) }];

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.84)';
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 5;

    for (var i = 0; i < endpoints.length; i++) {
      var point = pointToScreen(endpoints[i], plot, view);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function positionHandles(plot, view) {
    var points = getHandlePoints();
    var visible = getVisibleHandles();

    for (var i = 0; i < els.handles.length; i++) {
      var element = els.handles[i];
      var name = element.getAttribute('data-editor-handle');
      var point = points[name];
      var show = visible.indexOf(name) !== -1 && point;

      if (!show) {
        element.style.display = 'none';
        continue;
      }

      var screen = pointToScreen(point, plot, view);
      element.style.display = 'block';
      element.style.left = screen.x + 'px';
      element.style.top = screen.y + 'px';
      element.title = name + ': ' + round(point.x, 2).toFixed(2) + ', ' + round(point.y, 2).toFixed(2);
    }
  }

  function updateHeaderReadout() {
    var text = MODE_LABELS[state.mode] + '  ';

    if (state.mode === 'bezier') {
      text += formatNumbers(state.bezierValues);
    } else if (state.mode === 'fourkey') {
      var p = state.params.fourkey;
      text += formatNumbers([
        p.segmentA.p1.x, p.segmentA.p1.y, p.segmentA.p2.x, p.segmentA.p2.y,
        p.segmentB.p1.x, p.segmentB.p1.y, p.segmentB.p2.x, p.segmentB.p2.y
      ]);
    } else if (state.mode === 'custom') {
      text += (state.params.custom.points || []).length + ' points';
    } else if (state.mode === 'elastic') {
      text += 'A ' + state.params.elastic.amplitude.toFixed(2) + '  F ' + state.params.elastic.frequency.toFixed(2) + '  D ' + state.params.elastic.decay.toFixed(2);
    } else if (state.mode === 'bounce') {
      text += state.params.bounce.bounces + ' bounces  S ' + state.params.bounce.stiffness.toFixed(2);
    } else if (state.mode === 'wave') {
      text += 'F ' + state.params.wave.frequency.toFixed(2) + '  D ' + state.params.wave.decay.toFixed(2) + '  S ' + state.params.wave.sharpness.toFixed(2);
    } else {
      text += state.params.steps.count + ' steps  ' + state.params.steps.position;
    }

    els.readout.textContent = text;
  }

  function updateCoordinateReadout(handleName) {
    var point = getHandlePoints()[handleName];

    if (!point) {
      return;
    }

    els.coordinates.textContent = handleName + '  ' + round(point.x, 2).toFixed(2) + ', ' + round(point.y, 2).toFixed(2);
    els.coordinates.classList.add('is-visible');
  }

  function pointToScreen(point, plot, view) {
    return {
      x: plot.left + clamp(point.x, 0, 1) * plot.width,
      y: yToScreen(point.y, plot, view)
    };
  }

  function yToScreen(y, plot, view) {
    return plot.top + (1 - ((y - view.min) / Math.max(0.0001, view.max - view.min))) * plot.height;
  }

  function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function evaluate(x) {
    var p = state.params[state.mode];

    if (state.mode === 'bezier') {
      return cubicBezierAtX(x, state.bezierValues[0], state.bezierValues[1], state.bezierValues[2], state.bezierValues[3]);
    }

    if (state.mode === 'custom') {
      return customPathY(p.points, x);
    }

    if (state.mode === 'fourkey') {
      if (x <= 0.5) {
        return cubicBezierSegmentAtX(x * 2, p.segmentA.p1.x, p.segmentA.p1.y, p.segmentA.p2.x, p.segmentA.p2.y, 0, 1);
      }

      return cubicBezierSegmentAtX((x - 0.5) * 2, p.segmentB.p1.x, p.segmentB.p1.y, p.segmentB.p2.x, p.segmentB.p2.y, 1, 0);
    }

    if (state.mode === 'elastic') {
      var errorStart = 1 - p.amplitude;
      var errorEnd = -p.amplitude * Math.exp(-p.decay) * Math.cos(p.frequency * Math.PI * 2);
      var raw = 1 - p.amplitude * Math.exp(-p.decay * x) * Math.cos(p.frequency * Math.PI * 2 * x);
      return raw - (errorStart * (1 - x) + errorEnd * x);
    }

    if (state.mode === 'bounce') {
      var segments = p.bounces + 1;
      var segment = Math.min(Math.floor(x * segments), segments - 1);

      if (segment === 0) {
        var lead = x * segments;
        return lead * lead;
      }

      var middle = (segment + 0.5) / segments;
      var halfWidth = 0.5 / segments;
      var normalized = (x - middle) / halfWidth;
      return 1 - Math.pow(p.stiffness, segment) * (1 - normalized * normalized);
    }

    if (state.mode === 'wave') {
      var phase = x * p.frequency;
      var signal = Math.sin(phase * Math.PI * 2 - Math.PI / 2);
      var sine = 0.5 + 0.5 * signal;
      var triangle = Math.abs(((phase + 0.5) % 1) * 2 - 1);
      var oscillator;

      if (p.sharpness > 0) {
        oscillator = sine + (triangle - sine) * p.sharpness;
      } else {
        var exponent = 1 / (1 + Math.abs(p.sharpness));
        oscillator = 0.5 + 0.5 * ((signal < 0 ? -1 : 1) * Math.pow(Math.abs(signal), exponent));
      }

      return 0.5 + (oscillator - 0.5) * Math.exp(-p.decay * x);
    }

    if (x >= 1) {
      return 1;
    }

    if (p.position === 'start') {
      return Math.ceil(x * p.count) / p.count;
    }

    if (p.position === 'both') {
      return Math.round(x * p.count) / p.count;
    }

    return Math.floor(x * p.count) / p.count;
  }

  function customPathY(points, x) {
    if (!points || points.length < 2) {
      return x;
    }

    var segment = 0;

    while (segment < points.length - 2 && x > points[segment + 1].x) {
      segment++;
    }

    var p0 = points[segment];
    var p3 = points[segment + 1];
    var width = p3.x - p0.x;

    if (width <= 0.000001) {
      return p3.y;
    }

    var localX = (x - p0.x) / width;
    var nx1 = (p0.cx2 - p0.x) / width;
    var nx2 = (p3.cx1 - p0.x) / width;
    var t = solveBezierT(localX, nx1, nx2);
    return cubic(t, p0.y, p0.cy2, p3.cy1, p3.y);
  }

  function cubicBezierAtX(x, p1x, p1y, p2x, p2y) {
    var t = solveBezierT(x, p1x, p2x);
    return cubic(t, 0, p1y, p2y, 1);
  }

  function cubicBezierSegmentAtX(x, p1x, p1y, p2x, p2y, startY, endY) {
    return cubic(solveBezierT(x, p1x, p2x), startY, p1y, p2y, endY);
  }

  function solveBezierT(x, p1x, p2x) {
    x = clamp(x, 0, 1);
    var low = 0;
    var high = 1;
    var t = x;

    for (var i = 0; i < 18; i++) {
      var currentX = cubic(t, 0, p1x, p2x, 1);

      if (Math.abs(currentX - x) < 0.0001) {
        break;
      }

      if (currentX < x) {
        low = t;
      } else {
        high = t;
      }

      t = (low + high) / 2;
    }

    return t;
  }

  function cubic(t, p0, p1, p2, p3) {
    var mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function formatNumbers(values) {
    return values.map(function (value) {
      return round(Number(value) || 0, 2).toFixed(2);
    }).join(', ');
  }

  function normalizeHandleStyle(value) {
    value = String(value || '').toLowerCase();
    return ['heart', 'circle', 'square', 'diamond', 'star', 'custom'].indexOf(value) === -1 ? 'heart' : value;
  }

  function normalizeHex(value, fallback) {
    value = String(value || '').trim();

    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return '#' + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2) + value.charAt(3) + value.charAt(3);
    }

    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function hexToRgba(hex, alpha) {
    hex = normalizeHex(hex, '#ffffff');
    return 'rgba(' +
      parseInt(hex.slice(1, 3), 16) + ',' +
      parseInt(hex.slice(3, 5), 16) + ',' +
      parseInt(hex.slice(5, 7), 16) + ',' +
      alpha + ')';
  }

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    var chroma = (1 - Math.abs(2 * l - 1)) * s;
    var section = h / 60;
    var x = chroma * (1 - Math.abs(section % 2 - 1));
    var values;

    if (section < 1) {
      values = [chroma, x, 0];
    } else if (section < 2) {
      values = [x, chroma, 0];
    } else if (section < 3) {
      values = [0, chroma, x];
    } else if (section < 4) {
      values = [0, x, chroma];
    } else if (section < 5) {
      values = [x, 0, chroma];
    } else {
      values = [chroma, 0, x];
    }

    var match = l - chroma / 2;
    return '#' + values.map(function (value) {
      var hex = Math.round((value + match) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function toCssUrl(value) {
    value = String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
    return 'url("' + value + '")';
  }
  function copyObject(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    var multiplier = Math.pow(10, digits || 2);
    return Math.round(value * multiplier) / multiplier;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();