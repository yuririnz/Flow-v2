(function () {
  'use strict';

  var MODES = ['bezier', 'fourkey', 'custom', 'elastic', 'bounce', 'wave', 'steps'];
  var CURVE_PRESET_STORAGE_KEY = 'flow.curveTypePresetsByLibrary';
  var CURVE_PRESET_LEGACY_STORAGE_KEY = 'flow.curveTypePresets';
  var CURVE_PRESET_MIGRATED_KEY = 'flow.curveTypePresetsByLibraryMigrated';
  var CURVE_SETTINGS_STORAGE_KEY = 'flow.curveGraphSettings';
  var CURVE_PANEL_HEIGHT_STORAGE_KEY = 'flow.curveGraphPanelHeight';
  var CURVE_SETTINGS_SHARED_FILE = 'Flow-3-curve-settings.json';
  var CURVE_SETTINGS_EVENT = 'com.rendertom.flow.v2.settings.changed';
  var SETTINGS_EXTENSION_ID = 'com.rendertom.flow.v2.settings';
  var GRAPH_EDITOR_EXTENSION_ID = 'com.rendertom.flow.v2.graphEditor';
  var GRAPH_EDITOR_STORAGE_KEY = 'flow.graphEditorState';
  var GRAPH_EDITOR_SHARED_FILE = 'Flow-3-graph-editor.json';
  var GRAPH_EDITOR_STATE_EVENT = 'com.rendertom.flow.v2.graphEditor.state';
  var GRAPH_EDITOR_CHANGED_EVENT = 'com.rendertom.flow.v2.graphEditor.changed';
  var GRAPH_EDITOR_READY_EVENT = 'com.rendertom.flow.v2.graphEditor.ready';
  var GRAPH_EDITOR_CLOSED_EVENT = 'com.rendertom.flow.v2.graphEditor.closed';
  var APPLY_SHORTCUT_DOUBLE_PRESS_MS = 500;
  var BEZIER_VALUE_MIN = -4;
  var BEZIER_VALUE_MAX = 5;
  var CONTROL_VALUE_MIN = -1;
  var CONTROL_VALUE_MAX = 2;
  var FOUR_KEY_VALUE_MIN = -2;
  var FOUR_KEY_VALUE_MAX = 3;
  var OSCILLATOR_AMPLITUDE_MAX = 2;
  var state = {
    mode: 'bezier',
    dragHandle: null,
    pendingDragPoint: null,
    dragSnapOrigin: null,
    dragSnapDirection: '',
    bezierValues: [0, 0, 1, 1],
    bezierDragChanged: false,
    bezierClickAnimation: null,
    bezierClickAnimationFrame: null,
    originalValueText: '',
    dividerDrag: null,
    hostLoaded: false,
    hostLoading: false,
    callbacks: [],
    renderView: null,
    renderFrame: null,
    frameModeParams: null,
    renderVelocity: { min: 0, max: 0 },
    rgbFrame: null,
    rgbHue: 0,
    speedGraph: false,
    expressionMode: false,
    motionToolsMode: false,
    emojiBrowserMode: false,
    expressionScrub: null,
    expressionCopyTimer: null,
    graphEditorActive: false,
    graphEditorApplying: false,
    graphEditorLastRaw: '',
    graphEditorLastSignature: '',
    graphEditorRevision: 0,
    graphEditorPublishTimer: null,
    graphEditorPendingRaw: '',
    readStateTimer: null,
    customEndpoint: 'start',
    customPointIndex: 0,
    customDrag: null,
    customEditorKey: '',
    customAnchorElements: [],
    customControlElements: [],
    suppressCustomDblClick: false,
    previewFrame: null,
    previewResetTimer: null,
    previewStart: null,
    previewProgress: 0,
    previewTrackWidth: 0,
    transition: null,
    transitionFrame: null,
    syncingBezierText: false,
    pendingBezierText: '',
    lastBezierText: '',
    expressionParamsHtml: '',
    expressionCodeText: '',
    curvePresets: [],
    curvePresetsByLibrary: {},
    currentLibraryKey: '',
    selectedCurvePresetId: '',
    graphHistory: [],
    graphHistoryLimit: 40,
    pendingGraphHistory: null,
    historyRestoring: false,
    applyShortcutLastKey: '',
    applyShortcutLastAt: 0,
    applyShortcutBridge: null,
    applyShortcutBridgeReady: false,
    applyShortcutBridgeBuffer: '',
    applyShortcutBridgeKeyCode: 0,
    backgroundMedia: null,
    settings: getDefaultSettings(),
    settingsRaw: '',
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
    }
  };

  var els = {};

  function normalizeLanguage(value) {
    value = String(value || '').toLowerCase();

    return value === 'zh' || value === 'th' ? value : 'en';
  }

  function normalizeApplyShortcutKey(value) {
    value = String(value || 'Alt');

    if (value === ' ' || value === 'Spacebar') {
      return 'Space';
    }

    if (value === 'Ctrl') {
      return 'Control';
    }

    if (value === 'OS') {
      return 'Meta';
    }

    if (value.length === 1) {
      return value.toUpperCase();
    }

    if (/^(Alt|Control|Shift|Meta|Enter|Space|Tab|Escape|Backspace|Delete|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|F(?:[1-9]|1[0-2]))$/.test(value)) {
      return value;
    }

    return 'Alt';
  }

  function getShortcutEventKey(event) {
    var key = event && (event.key || event.keyIdentifier || '');

    if (!key && event && event.keyCode) {
      key = event.keyCode === 18 ? 'Alt' :
        event.keyCode === 17 ? 'Control' :
        event.keyCode === 16 ? 'Shift' :
        event.keyCode === 91 ? 'Meta' :
        event.keyCode === 32 ? 'Space' : String.fromCharCode(event.keyCode);
    }

    return normalizeApplyShortcutKey(key);
  }

  function getShortcutVirtualKeyCode(value) {
    value = normalizeApplyShortcutKey(value);

    var keyCodes = {
      Alt: 18,
      Control: 17,
      Shift: 16,
      Meta: 91,
      Enter: 13,
      Space: 32,
      Tab: 9,
      Escape: 27,
      Backspace: 8,
      Delete: 46,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39
    };

    if (Object.prototype.hasOwnProperty.call(keyCodes, value)) {
      return keyCodes[value];
    }

    if (/^F(?:[1-9]|1[0-2])$/.test(value)) {
      return 111 + Number(value.slice(1));
    }

    return value.length === 1 ? value.toUpperCase().charCodeAt(0) : 0;
  }

  function registerApplyShortcutInterest() {
    var keyCode = getShortcutVirtualKeyCode(state.settings.applyShortcutKey);

    if (!keyCode) {
      return;
    }

    var interest = JSON.stringify([{ keyCode: keyCode }]);

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.registerKeyEventsInterest === 'function') {
        window.__adobe_cep__.registerKeyEventsInterest(interest);
        return;
      }
    } catch (error) {}

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();
        if (cs && typeof cs.registerKeyEventsInterest === 'function') {
          cs.registerKeyEventsInterest(interest);
        }
      }
    } catch (error) {}
  }

  function getNodeRequire() {
    try {
      if (typeof window.require === 'function') {
        return window.require;
      }

      if (typeof require === 'function') {
        return require;
      }
    } catch (error) {}

    return null;
  }

  function nativeApplyShortcutBridgeSupported() {
    var nodeRequire = getNodeRequire();

    if (!nodeRequire) {
      return false;
    }

    try {
      return nodeRequire('process').platform === 'win32';
    } catch (error) {}

    return false;
  }

  function sendApplyShortcutBridgeConfig() {
    var child = state.applyShortcutBridge;
    var keyCode = getShortcutVirtualKeyCode(state.settings.applyShortcutKey);

    if (!child || !state.applyShortcutBridgeReady || !child.stdin || !keyCode) {
      return;
    }

    state.applyShortcutBridgeKeyCode = keyCode;

    try {
      child.stdin.write('CONFIG ' + keyCode + ' ' + APPLY_SHORTCUT_DOUBLE_PRESS_MS + '\n');
    } catch (error) {
      state.applyShortcutBridgeReady = false;
    }
  }

  function handleApplyShortcutBridgeLine(line, child) {
    line = String(line || '').replace(/^\s+|\s+$/g, '').toUpperCase();

    if (!line || state.applyShortcutBridge !== child) {
      return;
    }

    if (line === 'READY') {
      state.applyShortcutBridgeReady = true;
      sendApplyShortcutBridgeConfig();
      return;
    }

    if (line === 'APPLY' && els.applyButton && !document.querySelector('.curve-modal')) {
      state.applyShortcutLastKey = '';
      state.applyShortcutLastAt = 0;
      els.applyButton.click();
    }
  }

  function handleApplyShortcutBridgeData(data, child) {
    if (state.applyShortcutBridge !== child) {
      return;
    }

    state.applyShortcutBridgeBuffer += String(data || '');
    var lines = state.applyShortcutBridgeBuffer.split(/\r?\n/);
    state.applyShortcutBridgeBuffer = lines.pop() || '';

    for (var i = 0; i < lines.length; i += 1) {
      handleApplyShortcutBridgeLine(lines[i], child);
    }
  }

  function clearApplyShortcutBridge(child) {
    if (state.applyShortcutBridge !== child) {
      return;
    }

    state.applyShortcutBridge = null;
    state.applyShortcutBridgeReady = false;
    state.applyShortcutBridgeBuffer = '';
    state.applyShortcutBridgeKeyCode = 0;
  }

  function startApplyShortcutBridge() {
    var keyCode = getShortcutVirtualKeyCode(state.settings.applyShortcutKey);

    if (!keyCode || !nativeApplyShortcutBridgeSupported()) {
      return;
    }

    if (state.applyShortcutBridge) {
      if (state.applyShortcutBridgeReady && state.applyShortcutBridgeKeyCode !== keyCode) {
        sendApplyShortcutBridgeConfig();
      }
      return;
    }

    var nodeRequire = getNodeRequire();

    try {
      var childProcess = nodeRequire('child_process');
      var fileSystem = nodeRequire('fs');
      var nodePath = nodeRequire('path');
      var helperPath = nodePath.join(getPanelPath(), 'bin', 'flow-shortcut-helper.exe');

      if (!fileSystem.existsSync(helperPath)) {
        return;
      }

      var child = childProcess.spawn(helperPath, [], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      });

      state.applyShortcutBridge = child;
      state.applyShortcutBridgeReady = false;
      state.applyShortcutBridgeBuffer = '';

      if (child.stdout) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', function (data) {
          handleApplyShortcutBridgeData(data, child);
        });
      }

      child.on('error', function () {
        clearApplyShortcutBridge(child);
      });

      child.on('exit', function () {
        clearApplyShortcutBridge(child);
      });
    } catch (error) {
      state.applyShortcutBridge = null;
      state.applyShortcutBridgeReady = false;
    }
  }

  function stopApplyShortcutBridge() {
    var child = state.applyShortcutBridge;

    if (!child) {
      return;
    }

    clearApplyShortcutBridge(child);

    try {
      if (child.stdin) {
        child.stdin.end('QUIT\n');
      }
    } catch (error) {}

    window.setTimeout(function () {
      try {
        if (!child.killed) {
          child.kill();
        }
      } catch (error) {}
    }, 300);
  }

  function normalizeBackgroundEffect(value, disableSnowflake) {
    value = String(value || '').toLowerCase();

    if (value === 'snow' || value === 'rain' || value === 'particles' || value === 'none') {
      return value;
    }

    return disableSnowflake ? 'none' : 'snow';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getModeYLimits(mode) {
    if (mode === 'bezier') {
      return { min: BEZIER_VALUE_MIN, max: BEZIER_VALUE_MAX };
    }

    if (mode === 'fourkey') {
      return { min: FOUR_KEY_VALUE_MIN, max: FOUR_KEY_VALUE_MAX };
    }

    return { min: CONTROL_VALUE_MIN, max: CONTROL_VALUE_MAX };
  }

  function round(value, digits) {
    var multiplier = Math.pow(10, digits || 2);
    return Math.round(value * multiplier) / multiplier;
  }

  function matchesSelector(element, selector) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    var matches = element.matches || element.msMatchesSelector || element.webkitMatchesSelector;
    return matches ? matches.call(element, selector) : false;
  }

  function closest(element, selector) {
    while (element && element !== document) {
      if (matchesSelector(element, selector)) {
        return element;
      }

      element = element.parentNode;
    }

    return null;
  }

  function getDefaultFlowPageVisibility() {
    return {
      easeOut: true,
      ease: true,
      easeIn: true,
      motionTools: true,
      expressionMode: true,
      previewButton: true,
      emojiBrowser: true,
      previewBar: true
    };
  }

  function mergeFlowPageVisibility(value) {
    var defaults = getDefaultFlowPageVisibility();
    var incoming = value || {};

    for (var key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        defaults[key] = incoming[key] !== false;
      }
    }

    return defaults;
  }

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
      liquidGlassApply: false,
      motionToolTextLabels: false,
      placeNewNullAtTop: false,
      applyShortcutKey: 'Alt',
      flowPageVisibility: getDefaultFlowPageVisibility(),
      background: {
        kind: '',
        src: '',
        name: '',
        opacity: 15,
        size: 0
      }
    };
  }

  function mergeSettings(settings) {
    var defaults = getDefaultSettings();
    var merged = settings || {};
    var handleImageSrc = merged.handleImage && merged.handleImage.src || defaults.handleImage.src;
    var handleStyle = normalizeHandleStyle(merged.handleStyle || defaults.handleStyle);
    var backgroundMediaColorEnabled = typeof merged.backgroundMediaColorEnabled === 'boolean' ?
      merged.backgroundMediaColorEnabled : !!merged.backgroundColorEnabled;
    var backgroundEffect = normalizeBackgroundEffect(merged.backgroundEffect, merged.disableSnowflake);

    if (handleStyle === 'custom' && !handleImageSrc) {
      handleStyle = defaults.handleStyle;
    }

    return {
      language: normalizeLanguage(merged.language || defaults.language),
      profileName: typeof merged.profileName === 'string' ? merged.profileName.slice(0, 40) : defaults.profileName,
      profileBio: typeof merged.profileBio === 'string' ? merged.profileBio.slice(0, 120) : defaults.profileBio,
      profileImage: {
        src: merged.profileImage && merged.profileImage.src || defaults.profileImage.src,
        name: merged.profileImage && merged.profileImage.name || defaults.profileImage.name
      },
      themeColor: merged.themeColor || defaults.themeColor,
      panelBackgroundColor: merged.panelBackgroundColor || defaults.panelBackgroundColor,
      panelBackgroundColor2: merged.panelBackgroundColor2 || defaults.panelBackgroundColor2,
      panelBackgroundDirection: typeof merged.panelBackgroundDirection === 'number' ? clamp(merged.panelBackgroundDirection, 0, 360) : defaults.panelBackgroundDirection,
      panelBackgroundIntensity: typeof merged.panelBackgroundIntensity === 'number' ? clamp(merged.panelBackgroundIntensity, 0, 100) : defaults.panelBackgroundIntensity,
      graphLineColor: merged.graphLineColor || defaults.graphLineColor,
      handleColor: merged.handleColor || defaults.handleColor,
      homeIndicatorColor: merged.homeIndicatorColor || defaults.homeIndicatorColor,
      backgroundMediaColorEnabled: backgroundMediaColorEnabled,
      handleStyle: handleStyle,
      handleSize: clamp(Number(merged.handleSize) || defaults.handleSize, 8, 32),
      handleLineThickness: clamp(Number(merged.handleLineThickness) || defaults.handleLineThickness, 0.5, 4),
      handleImage: {
        src: handleImageSrc,
        name: merged.handleImage && merged.handleImage.name || defaults.handleImage.name
      },
      hideHomeIndicator: !!merged.hideHomeIndicator,
      backgroundEffect: backgroundEffect,
      disableSnowflake: backgroundEffect === 'none',
      rgbMode: !!merged.rgbMode,
      autoApply: !!merged.autoApply,
      liquidGlassApply: !!merged.liquidGlassApply,
      motionToolTextLabels: !!merged.motionToolTextLabels,
      placeNewNullAtTop: !!merged.placeNewNullAtTop,
      applyShortcutKey: normalizeApplyShortcutKey(merged.applyShortcutKey || defaults.applyShortcutKey),
      flowPageVisibility: mergeFlowPageVisibility(merged.flowPageVisibility),
      background: {
        kind: merged.background && merged.background.kind || defaults.background.kind,
        src: merged.background && merged.background.src || defaults.background.src,
        name: merged.background && merged.background.name || defaults.background.name,
        opacity: typeof (merged.background && merged.background.opacity) === 'number' ? merged.background.opacity : defaults.background.opacity,
        size: Math.max(0, Number(merged.background && merged.background.size) || 0)
      }
    };
  }

  function normalizeHandleStyle(value) {
    value = String(value || '').toLowerCase();

    if (value === 'heart' || value === 'circle' || value === 'square' || value === 'diamond' || value === 'star' || value === 'custom') {
      return value;
    }

    return 'heart';
  }

  function init() {
    els.body = document.body;
    els.container = document.getElementById('container');
    els.graphPanel = document.getElementById('graphPanel');
    els.tabs = document.querySelectorAll('[data-curve-mode]');
    els.graphTop = document.getElementById('graphPanel-top');
    els.divider = document.getElementById('divider');
    els.wrapper = document.getElementById('canvas-wrapper');
    els.preview = document.getElementById('curveModePreview');
    els.controls = document.getElementById('controls');
    els.endpointStart = document.getElementById('curveModeEndpointStart');
    els.endpointEnd = document.getElementById('curveModeEndpointEnd');
    els.handleA = document.getElementById('curveModeHandleA');
    els.handleB = document.getElementById('curveModeHandleB');
    els.handleC = document.getElementById('curveModeHandleC');
    els.handleD = document.getElementById('curveModeHandleD');
    els.undoGraphButton = document.getElementById('btn_undoGraph');
    els.readButton = document.getElementById('btn_readValue');
    els.valueButton = document.getElementById('btn_editBezierValues');
    els.speedGraphButton = document.getElementById('btn_speedGraph');
    els.saveButton = document.getElementById('btn_saveCurve');
    els.applyButton = document.getElementById('btn_applyValues');
    els.settingsButton = document.getElementById('btn_curveSettings');
    els.graphEditorButton = document.getElementById('btn_expandGraphEditor');
    els.motionToolsButton = document.getElementById('btn_motionToolsMode');
    els.expressionButton = document.getElementById('btn_expressionMode');
    els.previewButton = document.getElementById('btn_curvePreview');
    els.previewStrip = document.getElementById('curvePreviewStrip');
    els.previewTrack = document.getElementById('curvePreviewTrack');
    els.previewBall = document.getElementById('curvePreviewBall');
    els.previewTrail = document.getElementById('curvePreviewTrail');
    els.easeDirectionControl = document.getElementById('easeDirectionControl');
    els.easeOutButton = document.querySelector('label[for="Out"]');
    els.easeButton = document.querySelector('label[for="Both"]');
    els.easeInButton = document.querySelector('label[for="In"]');
    els.emojiBrowserButton = document.getElementById('btn_emojiBrowserMode');
    els.motionToolsPanel = document.getElementById('motionToolsPanel');
    els.expressionPanel = document.getElementById('curveExpressionPanel');
    els.emojiBrowserPanel = document.getElementById('emojiBrowserPanel');
    els.expressionParams = document.getElementById('curveExpressionParams');
    els.expressionCode = document.getElementById('curveExpressionCode');
    els.expressionCopyButton = document.getElementById('btn_copyExpression');
    els.expressionImportButton = document.getElementById('btn_importExpression');
    els.libraryPanel = document.getElementById('libraryPanel');
    els.library = document.getElementById('library');
    els.libraryDropdown = document.getElementById('ddLibraries');
    els.libraryToolbar = document.getElementById('libraryIOButtons');
    els.coordinateLabel = document.createElement('div');
    els.coordinateLabel.className = 'curve-coordinate-label';
    els.coordinateLabel.setAttribute('aria-hidden', 'true');
    els.backgroundLayer = document.createElement('div');
    els.backgroundLayer.className = 'curve-graph-background';
    els.backgroundLayer.setAttribute('aria-hidden', 'true');
    els.mediaStatus = document.createElement('div');
    els.mediaStatus.className = 'curve-graph-media-status';
    els.mediaStatus.setAttribute('role', 'status');
    els.mediaStatus.setAttribute('aria-live', 'polite');
    els.customLayer = document.createElement('div');
    els.customLayer.className = 'curve-custom-layer';

    if (!els.graphTop || !els.preview || !els.endpointStart || !els.endpointEnd || !els.handleA || !els.handleB || !els.handleC || !els.handleD) {
      return;
    }

    els.graphTop.insertBefore(els.backgroundLayer, els.graphTop.firstChild);
    els.graphTop.appendChild(els.customLayer);
    els.graphTop.appendChild(els.coordinateLabel);
    els.graphTop.appendChild(els.mediaStatus);

    if (els.valueButton) {
      state.originalValueText = els.valueButton.textContent;
      state.lastBezierText = els.valueButton.textContent;
      state.bezierValues = parseBezierValues(els.valueButton.textContent) || state.bezierValues;
    }

    bindTabs();
    bindHandles();
    bindFourKeyControls();
    bindCustomEditor();
    bindApply();
    bindApplyShortcut();
    bindGraphUndo();
    bindPanelActions();
    bindPreview();
    bindMotionToolsMode();
    bindExpressionMode();
    bindEmojiBrowserMode();
    bindSpeedGraph();
    bindSettings();
    bindGraphEditor();
    bindDividerOverlay();
    bindBezierValueObserver();
    bindLibraryScope();
    bindBackgroundMediaResume();
    loadSettings();
    applySettings();
    startSettingsSync();
    startGraphEditorSync();
    loadCurvePresets();
    setMode('bezier', { animate: false });
    renderCurvePresets();
    updateUndoGraphButton();
    updateExpressionModeState();
    updateMotionToolsModeState();

    window.addEventListener('resize', function () {
      positionDividerOverlay();
      state.previewTrackWidth = getPreviewTrackWidth();
      updatePreviewPosition(state.previewProgress);
      render();
    });

    window.addEventListener('beforeunload', stopApplyShortcutBridge);
    window.addEventListener('beforeunload', function () {
      stopPreview(false);
    });

    if (window.ResizeObserver) {
      var graphResizeObserver = new window.ResizeObserver(function () {
        positionDividerOverlay();
        render();
      });
      graphResizeObserver.observe(els.graphTop);
    }

    window.setTimeout(positionDividerOverlay, 80);
    window.setTimeout(positionDividerOverlay, 320);
    window.setTimeout(positionDividerOverlay, 900);
    window.setTimeout(render, 80);
    window.setTimeout(render, 320);
    window.setTimeout(render, 900);
    window.setTimeout(renderCurvePresets, 600);
    window.setTimeout(renderCurvePresets, 1400);
  }

  function bindTabs() {
    for (var i = 0; i < els.tabs.length; i++) {
      els.tabs[i].addEventListener('click', function (event) {
        event.preventDefault();
        var historySnapshot = captureGraphSnapshot();
        state.selectedCurvePresetId = '';
        setMode(event.currentTarget.getAttribute('data-curve-mode'));
        renderCurvePresets();
        pushGraphUndoSnapshot(historySnapshot);
      });
    }
  }

  function bindHandles() {
    els.handleA.addEventListener('mousedown', startDrag);
    els.handleB.addEventListener('mousedown', startDrag);
    els.handleC.addEventListener('mousedown', startDrag);
    els.handleD.addEventListener('mousedown', startDrag);
    els.graphTop.addEventListener('mousedown', moveNearestBezierHandleToClick);
    els.endpointStart.addEventListener('mousedown', selectCustomEndpoint);
    els.endpointEnd.addEventListener('mousedown', selectCustomEndpoint);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
  }

  function bindFourKeyControls() {
    if (els.readButton) {
      els.readButton.addEventListener('click', function (event) {
        if (state.mode !== 'fourkey') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        readCurrentFourKey();
      }, true);
    }
  }

  function bindCustomEditor() {
    if (!els.graphTop || !els.customLayer) {
      return;
    }

    els.customLayer.addEventListener('mousedown', startCustomDrag);
    els.graphTop.addEventListener('dblclick', handleCustomDoubleClick);
  }

  function selectCustomEndpoint(event) {
    if (state.mode !== 'custom') {
      return;
    }

    state.customEndpoint = event.currentTarget === els.endpointStart ? 'start' : 'end';
    updateEndpointSelection();
    event.preventDefault();
    event.stopPropagation();
  }

  function updateEndpointSelection() {
    els.endpointStart.classList.toggle('is-selected', state.customEndpoint === 'start');
    els.endpointEnd.classList.toggle('is-selected', state.customEndpoint === 'end');
  }

  function handleCustomDoubleClick(event) {
    if (state.mode !== 'custom' || isSpeedGraphActive()) {
      return;
    }

    if (state.suppressCustomDblClick) {
      state.suppressCustomDblClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    var anchor = closest(event.target, '.curve-custom-anchor');

    if (anchor) {
      deleteCustomPoint(Number(anchor.getAttribute('data-index')));
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (closest(event.target, '.curve-custom-control')) {
      return;
    }

    var point = clientToNormal(event.clientX, event.clientY);

    if (addCustomPointAtX(point.x)) {
      cancelCurveTransition();
      state.selectedCurvePresetId = '';
      updateValueText();
      updateExpressionPanel();
      render();
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function startCustomDrag(event) {
    if (state.mode !== 'custom' || isSpeedGraphActive()) {
      return;
    }

    var target = closest(event.target, '.curve-custom-anchor, .curve-custom-control');

    if (!target) {
      return;
    }

    var index = Number(target.getAttribute('data-index'));

    if (!isFinite(index)) {
      return;
    }

    queueGraphUndoSnapshot();

    if (matchesSelector(target, '.curve-custom-anchor')) {
      if (event.detail && event.detail > 1) {
        if (deleteCustomPoint(index)) {
          state.suppressCustomDblClick = true;
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      state.customDrag = { type: 'anchor', index: index, element: target };
    } else {
      state.customDrag = {
        type: 'control',
        index: index,
        control: target.getAttribute('data-control'),
        element: target
      };
    }

    state.customPointIndex = index;
    state.pendingDragPoint = null;
    target.classList.add('is-dragging');
    cancelCurveTransition();
    state.selectedCurvePresetId = '';
    els.body.classList.add('curve-drag-xy');
    updateCoordinateLabel(getCustomDragPoint());
    event.preventDefault();
    event.stopPropagation();
  }

  function deleteCustomPoint(index) {
    var points = state.params.custom.points;

    if (points.length <= 2 || index <= 0 || index >= points.length - 1) {
      return false;
    }

    var historySnapshot = captureGraphSnapshot();
    points.splice(index, 1);
    state.customPointIndex = clamp(index - 1, 0, points.length - 1);
    cancelCurveTransition();
    state.selectedCurvePresetId = '';
    updateValueText();
    updateExpressionPanel();
    render();
    pushGraphUndoSnapshot(historySnapshot);
    return true;
  }

  function addCustomPointAtX(x) {
    var params = state.params.custom;
    var points = params.points;

    if (points.length >= 7) {
      return false;
    }

    var historySnapshot = captureGraphSnapshot();

    x = clamp(x, 0, 1);

    var segment = -1;

    for (var i = 0; i < points.length - 1; i++) {
      if (x >= points[i].x && x <= points[i + 1].x) {
        segment = i;
        break;
      }
    }

    if (segment < 0) {
      return false;
    }

    var p0 = points[segment];
    var p3 = points[segment + 1];
    var t = solveCustomSegmentTForX(p0, p3, x);
    var q0 = {
      x: p0.x + (p0.cx2 - p0.x) * t,
      y: p0.y + (p0.cy2 - p0.y) * t
    };
    var q1 = {
      x: p0.cx2 + (p3.cx1 - p0.cx2) * t,
      y: p0.cy2 + (p3.cy1 - p0.cy2) * t
    };
    var q2 = {
      x: p3.cx1 + (p3.x - p3.cx1) * t,
      y: p3.cy1 + (p3.y - p3.cy1) * t
    };
    var r0 = {
      x: q0.x + (q1.x - q0.x) * t,
      y: q0.y + (q1.y - q0.y) * t
    };
    var r1 = {
      x: q1.x + (q2.x - q1.x) * t,
      y: q1.y + (q2.y - q1.y) * t
    };
    var split = {
      x: r0.x + (r1.x - r0.x) * t,
      y: r0.y + (r1.y - r0.y) * t
    };

    points[segment] = {
      x: p0.x,
      y: p0.y,
      cx1: p0.cx1,
      cy1: p0.cy1,
      cx2: q0.x,
      cy2: q0.y
    };

    points[segment + 1] = {
      x: p3.x,
      y: p3.y,
      cx1: q2.x,
      cy1: q2.y,
      cx2: p3.cx2,
      cy2: p3.cy2
    };

    points.splice(segment + 1, 0, {
      x: split.x,
      y: split.y,
      cx1: r0.x,
      cy1: r0.y,
      cx2: r1.x,
      cy2: r1.y
    });

    state.customPointIndex = segment + 1;
    pushGraphUndoSnapshot(historySnapshot);
    return true;
  }

  function solveCustomSegmentTForX(p0, p3, x) {
    var low = 0;
    var high = 1;
    var t = 0.5;

    for (var i = 0; i < 30; i++) {
      t = (low + high) / 2;
      var tx = cubic(t, p0.x, p0.cx2, p3.cx1, p3.x);

      if (Math.abs(tx - x) < 0.0001) {
        break;
      }

      if (tx < x) {
        low = t;
      } else {
        high = t;
      }
    }

    return t;
  }

  function bindApply() {
    if (!els.applyButton) {
      return;
    }

    els.applyButton.addEventListener('click', function (event) {
      if (state.expressionMode) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        applyCurrentExpression();
        return;
      }

      if (state.mode === 'bezier') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      applyCurrentMode();
    }, true);
  }

  function isEditableTarget(target) {
    if (!target || target === document.body) {
      return false;
    }

    var tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function bindApplyShortcut() {
    document.addEventListener('keydown', function (event) {
      if (!els.applyButton || event.repeat || isEditableTarget(event.target) || document.querySelector('.curve-modal')) {
        return;
      }

      if (state.applyShortcutBridgeReady) {
        return;
      }

      var configuredKey = normalizeApplyShortcutKey(state.settings.applyShortcutKey);
      var eventKey = getShortcutEventKey(event);

      if (eventKey !== configuredKey) {
        state.applyShortcutLastKey = '';
        state.applyShortcutLastAt = 0;
        return;
      }

      var now = Date.now();
      var isSecondPress = state.applyShortcutLastKey === eventKey && now - state.applyShortcutLastAt <= APPLY_SHORTCUT_DOUBLE_PRESS_MS;

      event.preventDefault();
      event.stopPropagation();

      if (isSecondPress) {
        state.applyShortcutLastKey = '';
        state.applyShortcutLastAt = 0;
        els.applyButton.click();
      } else {
        state.applyShortcutLastKey = eventKey;
        state.applyShortcutLastAt = now;
      }
    }, true);

    window.addEventListener('blur', function () {
      state.applyShortcutLastKey = '';
      state.applyShortcutLastAt = 0;
    });
  }

  function captureGraphSnapshot() {
    var params = {};

    for (var i = 0; i < MODES.length; i += 1) {
      if (MODES[i] !== 'bezier') {
        params[MODES[i]] = cloneParams(MODES[i]);
      }
    }

    return {
      mode: state.mode,
      bezierValues: getCurrentBezierValues(),
      params: params,
      speedGraph: !!state.speedGraph,
      customEndpoint: state.customEndpoint
    };
  }

  function getGraphSnapshotSignature(snapshot) {
    try {
      return JSON.stringify(snapshot || captureGraphSnapshot());
    } catch (error) {
      return '';
    }
  }

  function pushGraphUndoSnapshot(snapshot) {
    if (!snapshot || state.historyRestoring || getGraphSnapshotSignature(snapshot) === getGraphSnapshotSignature()) {
      return;
    }

    var last = state.graphHistory.length ? state.graphHistory[state.graphHistory.length - 1] : null;

    if (!last || getGraphSnapshotSignature(last) !== getGraphSnapshotSignature(snapshot)) {
      state.graphHistory.push(snapshot);
    }

    if (state.graphHistory.length > state.graphHistoryLimit) {
      state.graphHistory.splice(0, state.graphHistory.length - state.graphHistoryLimit);
    }

    updateUndoGraphButton();
  }

  function queueGraphUndoSnapshot() {
    if (!state.pendingGraphHistory && !state.historyRestoring) {
      state.pendingGraphHistory = captureGraphSnapshot();
    }
  }

  function commitQueuedGraphUndo() {
    var snapshot = state.pendingGraphHistory;
    state.pendingGraphHistory = null;
    pushGraphUndoSnapshot(snapshot);
  }

  function updateUndoGraphButton() {
    if (!els.undoGraphButton) {
      return;
    }

    var canUndo = state.graphHistory.length > 0;
    els.undoGraphButton.disabled = !canUndo;
    els.undoGraphButton.setAttribute('aria-disabled', canUndo ? 'false' : 'true');
    els.undoGraphButton.setAttribute('data-tooltip', canUndo ? 'Undo graph edit' : 'Nothing to undo');
  }

  function restoreGraphSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    var fromMode = state.mode;
    var fromParams = cloneParams(fromMode);
    state.historyRestoring = true;

    try {
      cancelBezierClickAnimation();
      cancelCurveTransition();

      for (var i = 0; i < MODES.length; i += 1) {
        var mode = MODES[i];
        if (mode !== 'bezier' && snapshot.params && snapshot.params[mode]) {
          state.params[mode] = cloneParams(mode, snapshot.params[mode]);
        }
      }

      state.bezierValues = snapshot.bezierValues.slice(0, 4);
      state.originalValueText = formatBezierValues(state.bezierValues);
      state.speedGraph = !!snapshot.speedGraph;
      state.customEndpoint = snapshot.customEndpoint === 'end' ? 'end' : 'start';
      state.selectedCurvePresetId = '';
      state.renderView = null;

      setMode(snapshot.mode, {
        fromMode: fromMode,
        fromParams: fromParams
      });

      if (snapshot.mode === 'bezier') {
        setBezierValueText(snapshot.bezierValues);
        commitBezierToNativeGraph();
      }

      updateEndpointSelection();
      updateValueText();
      updateExpressionPanel();
      renderCurvePresets();
      render();
      publishGraphEditorState(true);
    } finally {
      state.historyRestoring = false;
    }
  }

  function undoGraph() {
    if (!state.graphHistory.length) {
      return;
    }

    state.pendingGraphHistory = null;
    restoreGraphSnapshot(state.graphHistory.pop());
    updateUndoGraphButton();
  }

  function bindGraphUndo() {
    if (!els.undoGraphButton) {
      return;
    }

    els.undoGraphButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      undoGraph();
    });
  }

  function bindBackgroundMediaResume() {
    if (els.graphTop) {
      els.graphTop.addEventListener('click', function () {
        if (state.backgroundMedia && state.backgroundMedia.tagName && state.backgroundMedia.tagName.toLowerCase() === 'video') {
          safePlayMedia(state.backgroundMedia);
        }
      });
    }
  }

  function safePlayMedia(media) {
    if (!media || typeof media.play !== 'function') {
      return;
    }

    try {
      var result = media.play();

      if (result && typeof result.then === 'function') {
        result.then(function () {
          if (state.backgroundMedia === media) {
            setGraphMediaStatus('');
          }
        }, function () {
          if (state.backgroundMedia === media) {
            setGraphMediaStatus('Video preview is paused. Click the panel to resume.');
          }
        });
      }
    } catch (error) {
      setGraphMediaStatus('Video preview is paused. Click the panel to resume.');
    }
  }

  function setGraphMediaStatus(message) {
    if (!els.mediaStatus) {
      return;
    }

    els.mediaStatus.textContent = message || '';
    els.mediaStatus.classList.toggle('is-visible', !!message);
  }

  function startDrag(event) {
    queueGraphUndoSnapshot();
    cancelBezierClickAnimation();

    if (event.currentTarget === els.handleA) {
      state.dragHandle = 'A';
    } else if (event.currentTarget === els.handleB) {
      state.dragHandle = 'B';
    } else if (event.currentTarget === els.handleC) {
      state.dragHandle = 'C';
    } else {
      state.dragHandle = 'D';
    }

    state.pendingDragPoint = null;
    resetHandleGridSnap();

    if (state.mode === 'bezier' && els.valueButton) {
      state.bezierDragChanged = false;
      els.valueButton.setAttribute('data-flow-bezier-drag-value', formatBezierValues(state.bezierValues));
      els.valueButton.classList.add('flow-bezier-drag-readout');
    }

    cancelCurveTransition();
    state.selectedCurvePresetId = '';
    els.body.classList.add('curve-drag-' + getHandleAxis(state.dragHandle));
    event.currentTarget.classList.add('is-dragging');
    updateCoordinateLabel(getHandlePointForName(state.dragHandle));
    event.preventDefault();
  }

  function moveNearestBezierHandleToClick(event) {
    if (state.mode !== 'bezier' || isSpeedGraphActive() || state.dragHandle || state.customDrag || event.button !== 0) {
      return;
    }

    if (closest(event.target, '.curve-mode-handle, .curve-mode-endpoint, .curve-graph-expand')) {
      return;
    }

    cancelCurveTransition();

    var rect = els.graphTop.getBoundingClientRect();
    var view = getInteractiveViewRange();
    var area = getGraphArea(view, rect);
    var points = getHandlePoints();
    var pointA = normalToAreaPoint(area, points.a.x, points.a.y, view);
    var pointB = normalToAreaPoint(area, points.b.x, points.b.y, view);
    var clickX = event.clientX - rect.left;
    var clickY = event.clientY - rect.top;
    var distanceA = Math.pow(clickX - pointA.x, 2) + Math.pow(clickY - pointA.y, 2);
    var distanceB = Math.pow(clickX - pointB.x, 2) + Math.pow(clickY - pointB.y, 2);
    var handleName = distanceA <= distanceB ? 'A' : 'B';
    var point = clientToNormal(event.clientX, event.clientY);

    state.selectedCurvePresetId = '';
    renderCurvePresets();
    animateBezierHandleToPoint(handleName, point.x, point.y);
    event.preventDefault();
  }

  function animateBezierHandleToPoint(handleName, x, y) {
    cancelBezierClickAnimation();

    var from = getCurrentBezierValues();
    var to = from.slice(0, 4);
    var index = handleName === 'A' ? 0 : 2;

    to[index] = round(clamp(x, 0, 1), 2);
    to[index + 1] = round(clamp(y, BEZIER_VALUE_MIN, BEZIER_VALUE_MAX), 2);

    if (sameNumbers(from, to)) {
      return;
    }

    pushGraphUndoSnapshot(captureGraphSnapshot());

    state.bezierClickAnimation = {
      from: from,
      to: to,
      duration: 200,
      start: 0
    };

    if (els.valueButton) {
      state.bezierDragChanged = false;
      els.valueButton.setAttribute('data-flow-bezier-drag-value', formatBezierValues(from));
      els.valueButton.classList.add('flow-bezier-drag-readout');
    }

    var raf = getAnimationFrame();

    function tick(now) {
      var animation = state.bezierClickAnimation;

      if (!animation) {
        return;
      }

      if (!animation.start) {
        animation.start = now;
      }

      var linear = clamp((now - animation.start) / animation.duration, 0, 1);
      var eased = easeOriginalFlowClick(linear);
      var values = [];

      for (var i = 0; i < 4; i++) {
        values.push(animation.from[i] + (animation.to[i] - animation.from[i]) * eased);
      }

      setBezierDragValues(values);
      render();

      if (linear < 1) {
        state.bezierClickAnimationFrame = raf(tick);
        return;
      }

      state.bezierClickAnimation = null;
      state.bezierClickAnimationFrame = null;
      setBezierDragValues(animation.to);
      finishBezierDrag();
      commitBezierToNativeGraph();
      render();
    }

    state.bezierClickAnimationFrame = raf(tick);
  }

  function cancelBezierClickAnimation() {
    var wasAnimating = !!state.bezierClickAnimation;

    if (state.bezierClickAnimationFrame) {
      getCancelAnimationFrame()(state.bezierClickAnimationFrame);
      state.bezierClickAnimationFrame = null;
    }

    state.bezierClickAnimation = null;

    if (wasAnimating) {
      finishBezierDrag();
    }
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

  function drag(event) {
    if (!state.customDrag && !state.dragHandle) {
      return;
    }

    state.pendingDragPoint = {
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: !!event.shiftKey
    };
    requestRenderFrame();

    if (state.customDrag) {
      event.preventDefault();
    }
  }

  function stopDrag(event) {
    var wasDragging = !!state.customDrag || !!state.dragHandle;

    if (wasDragging) {
      if (event && isFinite(event.clientX) && isFinite(event.clientY)) {
        state.pendingDragPoint = {
          clientX: event.clientX,
          clientY: event.clientY,
          shiftKey: !!event.shiftKey
        };
      }

      if (state.renderFrame) {
        getCancelAnimationFrame()(state.renderFrame);
        state.renderFrame = null;
      }

      applyPendingDragUpdate();
      render();
    }

    if (state.customDrag) {
      if (state.customDrag.element) {
        state.customDrag.element.classList.remove('is-dragging');
      }

      state.customDrag = null;
      state.pendingDragPoint = null;

      if (els.body) {
        els.body.classList.remove('curve-drag-xy');
      }

      hideCoordinateLabel();
      commitQueuedGraphUndo();
      return;
    }

    if (state.dragHandle && state.mode === 'bezier') {
      finishBezierDrag();
      commitBezierToNativeGraph();
    }

    if (els.body) {
      els.body.classList.remove('curve-drag-x', 'curve-drag-y', 'curve-drag-xy');
    }

    state.dragHandle = null;
    state.pendingDragPoint = null;
    resetHandleGridSnap();
    els.handleA.classList.remove('is-dragging');
    els.handleB.classList.remove('is-dragging');
    els.handleC.classList.remove('is-dragging');
    els.handleD.classList.remove('is-dragging');
    hideCoordinateLabel();
    commitQueuedGraphUndo();
  }

  function applyPendingDragUpdate() {
    var pending = state.pendingDragPoint;

    if (!pending) {
      return false;
    }

    state.pendingDragPoint = null;
    var point = clientToNormal(pending.clientX, pending.clientY);

    if (state.customDrag) {
      if (state.customDrag.type === 'anchor') {
        moveCustomAnchor(state.customDrag.index, point.x, point.y);
      } else {
        moveCustomControl(state.customDrag.index, state.customDrag.control, point.x, point.y);
      }

      updateValueText();
      return true;
    }

    if (state.dragHandle) {
      point = snapHandlePointToGrid(pending, point);
      updateParamsFromDrag(state.dragHandle, point.x, point.y);
      updateValueText();
      return true;
    }

    return false;
  }

  function snapHandlePointToGrid(pending, point) {
    if (!pending.shiftKey) {
      resetHandleGridSnap();
      return point;
    }

    if (!state.dragSnapOrigin) {
      state.dragSnapOrigin = {
        clientX: pending.clientX,
        clientY: pending.clientY
      };
      state.dragSnapDirection = '';
    }

    if (!state.dragSnapDirection) {
      var deltaX = Math.abs(pending.clientX - state.dragSnapOrigin.clientX);
      var deltaY = Math.abs(pending.clientY - state.dragSnapOrigin.clientY);

      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 20) {
        state.dragSnapDirection = deltaX > deltaY ? 'horizontal' : deltaY > deltaX ? 'vertical' : '';
      }
    }

    if (state.dragSnapDirection === 'horizontal') {
      point.y = Math.round(point.y * 4) / 4;
    } else if (state.dragSnapDirection === 'vertical') {
      point.x = Math.round(point.x * 4) / 4;
    }

    return point;
  }

  function resetHandleGridSnap() {
    state.dragSnapOrigin = null;
    state.dragSnapDirection = '';
  }

  function getCustomDragPoint() {
    var drag = state.customDrag;
    var points = state.params.custom.points;

    if (!drag || !points[drag.index]) {
      return null;
    }

    var point = points[drag.index];

    if (drag.type === 'anchor') {
      return { x: point.x, y: point.y };
    }

    if (drag.control === 'cx1') {
      return { x: point.cx1, y: point.cy1 };
    }

    return { x: point.cx2, y: point.cy2 };
  }

  function moveCustomAnchor(index, x, y) {
    var points = state.params.custom.points;
    var point = points[index];

    if (!point) {
      return;
    }

    var nextX;
    var nextY;

    if (index === 0) {
      nextX = 0;
      nextY = 0;
    } else if (index === points.length - 1) {
      nextX = 1;
      nextY = 1;
    } else {
      nextX = clamp(x, points[index - 1].x + 0.01, points[index + 1].x - 0.01);
      nextY = clamp(y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
    }

    var dx = nextX - point.x;
    var dy = nextY - point.y;

    point.x = nextX;
    point.y = nextY;
    point.cx1 += dx;
    point.cy1 += dy;
    point.cx2 += dx;
    point.cy2 += dy;
    normalizeCustomPoint(index);
  }

  function moveCustomControl(index, control, x, y) {
    var points = state.params.custom.points;
    var point = points[index];

    if (!point) {
      return;
    }

    if (control === 'cx1') {
      if (index <= 0) {
        return;
      }

      var left = points[index - 1].x;
      var cx1 = clamp(x, left, point.x);
      var cy1 = clamp(y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
      point.cx1 = cx1;
      point.cy1 = cy1;

      if (index < points.length - 1) {
        mirrorCustomControl(index, 'cx1');
      }
    } else {
      if (index >= points.length - 1) {
        return;
      }

      var right = points[index + 1].x;
      var cx2 = clamp(x, point.x, right);
      var cy2 = clamp(y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
      point.cx2 = cx2;
      point.cy2 = cy2;

      if (index > 0) {
        mirrorCustomControl(index, 'cx2');
      }
    }

    normalizeCustomPoint(index);
  }

  function mirrorCustomControl(index, movedControl) {
    var points = state.params.custom.points;
    var point = points[index];
    var dx = movedControl === 'cx1' ? point.cx1 - point.x : point.cx2 - point.x;
    var dy = movedControl === 'cx1' ? point.cy1 - point.y : point.cy2 - point.y;
    var length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.0005) {
      return;
    }

    if (movedControl === 'cx1') {
      var outLength = Math.sqrt(Math.pow(point.cx2 - point.x, 2) + Math.pow(point.cy2 - point.y, 2));
      var outRatio = outLength / length;
      point.cx2 = point.x - dx * outRatio;
      point.cy2 = point.y - dy * outRatio;
    } else {
      var inLength = Math.sqrt(Math.pow(point.cx1 - point.x, 2) + Math.pow(point.cy1 - point.y, 2));
      var inRatio = inLength / length;
      point.cx1 = point.x - dx * inRatio;
      point.cy1 = point.y - dy * inRatio;
    }
  }

  function normalizeCustomPoint(index) {
    var points = state.params.custom.points;
    var point = points[index];

    if (!point) {
      return;
    }

    point.y = clamp(point.y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
    point.cy1 = clamp(point.cy1, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
    point.cy2 = clamp(point.cy2, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);

    if (index > 0) {
      point.cx1 = clamp(point.cx1, points[index - 1].x, point.x);
    } else {
      point.cx1 = point.x;
      point.cy1 = point.y;
    }

    if (index < points.length - 1) {
      point.cx2 = clamp(point.cx2, point.x, points[index + 1].x);
    } else {
      point.cx2 = point.x;
      point.cy2 = point.y;
    }
  }

  function bindPanelActions() {
    if (els.valueButton) {
      els.valueButton.addEventListener('click', function (event) {
        if (state.mode === 'bezier') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        openValueEditor();
      }, true);
    }

    if (els.saveButton) {
      els.saveButton.addEventListener('click', function (event) {
        if (state.mode === 'bezier') {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        openSavePresetDialog();
      }, true);
    }
  }

  function bindPreview() {
    if (!els.previewButton) {
      return;
    }

    function activatePreview(event) {
      event.preventDefault();
      event.stopPropagation();
      playPreview();
    }

    els.previewButton.addEventListener('click', activatePreview);
    els.previewButton.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        activatePreview(event);
      }
    });
  }

  function bindExpressionMode() {
    if (els.expressionButton) {
      els.expressionButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (state.mode === 'fourkey') {
          return;
        }

        state.expressionMode = !state.expressionMode;

        if (state.expressionMode) {
          state.motionToolsMode = false;
          state.emojiBrowserMode = false;
          updateMotionToolsModeState();
          updateEmojiBrowserModeState();
        }

        updateExpressionModeState();
      });
    }

    if (els.expressionCopyButton) {
      els.expressionCopyButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyCurrentExpression();
      });
    }

    if (els.expressionImportButton) {
      els.expressionImportButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        importExpression();
      });
    }

    if (els.expressionParams) {
      els.expressionParams.addEventListener('mousedown', startExpressionParamScrub);
      document.addEventListener('mousemove', dragExpressionParam);
      document.addEventListener('mouseup', stopExpressionParamScrub);
    }
  }

  function bindMotionToolsMode() {
    if (!els.motionToolsButton) {
      return;
    }

    els.motionToolsButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      state.motionToolsMode = !state.motionToolsMode;

      if (state.motionToolsMode) {
        state.expressionMode = false;
        state.emojiBrowserMode = false;
        updateExpressionModeState();
        updateEmojiBrowserModeState();
      }

      updateMotionToolsModeState();
    });
  }

  function bindEmojiBrowserMode() {
    if (!els.emojiBrowserButton) {
      return;
    }

    els.emojiBrowserButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      state.emojiBrowserMode = !state.emojiBrowserMode;

      if (state.emojiBrowserMode) {
        state.expressionMode = false;
        state.motionToolsMode = false;
        updateExpressionModeState();
        updateMotionToolsModeState();
      }

      updateEmojiBrowserModeState();
    });
  }

  function bindSpeedGraph() {
    if (!els.speedGraphButton) {
      return;
    }

    els.speedGraphButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (state.mode !== 'bezier') {
        return;
      }

      var historySnapshot = captureGraphSnapshot();
      state.speedGraph = !state.speedGraph;
      updateSpeedGraphState();
      updateHandleCursors();
      render();
      pushGraphUndoSnapshot(historySnapshot);
    });
  }

  function bindSettings() {
    if (!els.settingsButton) {
      return;
    }

    els.settingsButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openSettingsWindow();
    });
  }

  function bindGraphEditor() {
    if (!els.graphEditorButton) {
      return;
    }

    els.graphEditorButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openGraphEditorWindow();
    });
  }

  function openGraphEditorWindow() {
    var popup = null;

    state.graphEditorActive = true;
    publishGraphEditorState(true);

    if (requestOpenGraphEditorExtension()) {
      return;
    }

    try {
      popup = window.open('graph-editor.html', 'FlowGraphEditor', 'width=570,height=470,resizable=yes,scrollbars=no');
    } catch (error) {}

    if (popup && popup.focus) {
      popup.focus();
    }
  }

  function requestOpenGraphEditorExtension() {
    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.requestOpenExtension === 'function') {
          cs.requestOpenExtension(GRAPH_EDITOR_EXTENSION_ID, '');
          return true;
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.requestOpenExtension === 'function') {
        window.__adobe_cep__.requestOpenExtension(GRAPH_EDITOR_EXTENSION_ID, '');
        return true;
      }
    } catch (error) {}

    return false;
  }

  function startGraphEditorSync() {
    addGraphEditorEventListener(GRAPH_EDITOR_READY_EVENT, function () {
      state.graphEditorActive = true;
      publishGraphEditorState(true);
    });

    addGraphEditorEventListener(GRAPH_EDITOR_CHANGED_EVENT, function (raw) {
      state.graphEditorActive = true;
      receiveGraphEditorState(raw);
    });

    addGraphEditorEventListener(GRAPH_EDITOR_CLOSED_EVENT, function () {
      state.graphEditorActive = false;
    });

    window.addEventListener('storage', function (event) {
      if (event.key === GRAPH_EDITOR_STORAGE_KEY) {
        receiveGraphEditorState(event.newValue || '');
      }
    });

    window.setInterval(syncGraphEditorFromStorage, 260);
  }

  function addGraphEditorEventListener(type, callback) {
    var handler = function (event) {
      callback(event && typeof event === 'object' && 'data' in event ? event.data : event);
    };

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.addEventListener === 'function') {
          cs.addEventListener(type, handler);
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
        window.__adobe_cep__.addEventListener(type, handler);
      }
    } catch (error) {}
  }

  function dispatchGraphEditorEvent(type, raw) {
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

  function getGraphEditorSharedPath() {
    try {
      if (window.__adobe_cep__ && window.cep && window.cep.fs) {
        var base = normalizeSystemPath(window.__adobe_cep__.getSystemPath('userData'));

        if (base) {
          return base.replace(/%24/g, '$') + '/' + GRAPH_EDITOR_SHARED_FILE;
        }
      }
    } catch (error) {}

    return '';
  }

  function readGraphEditorStateRaw() {
    var sharedPath = getGraphEditorSharedPath();

    try {
      if (sharedPath && window.cep && window.cep.fs && window.cep.fs.readFile) {
        var file = window.cep.fs.readFile(sharedPath);

        if (file && file.data) {
          return file.data;
        }
      }
    } catch (error) {}

    try {
      return window.localStorage.getItem(GRAPH_EDITOR_STORAGE_KEY) || '';
    } catch (error) {}

    return '';
  }

  function writeGraphEditorStateRaw(raw) {
    var sharedPath = getGraphEditorSharedPath();

    try {
      window.localStorage.setItem(GRAPH_EDITOR_STORAGE_KEY, raw);
    } catch (error) {}

    try {
      if (sharedPath && window.cep && window.cep.fs && window.cep.fs.writeFile) {
        window.cep.fs.writeFile(sharedPath, raw);
      }
    } catch (error) {}
  }

  function getGraphEditorCoreState() {
    var params = {};

    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i] !== 'bezier') {
        params[MODES[i]] = cloneParams(MODES[i]);
      }
    }

    return {
      mode: state.mode,
      bezierValues: state.bezierValues.slice(0, 4),
      params: params
    };
  }

  function getGraphEditorSignature(core) {
    try {
      return JSON.stringify(core || getGraphEditorCoreState());
    } catch (error) {
      return '';
    }
  }

  function buildGraphEditorPayload(sender) {
    var core = getGraphEditorCoreState();
    state.graphEditorRevision = Math.max(Date.now(), state.graphEditorRevision + 1);

    return {
      version: 1,
      sender: sender,
      revision: state.graphEditorRevision,
      mode: core.mode,
      bezierValues: core.bezierValues,
      params: core.params
    };
  }

  function publishGraphEditorState(force) {
    if (!state.graphEditorActive || state.graphEditorApplying) {
      return;
    }

    var core = getGraphEditorCoreState();
    var signature = getGraphEditorSignature(core);

    if (!force && signature === state.graphEditorLastSignature) {
      return;
    }

    state.graphEditorLastSignature = signature;
    var raw = '';

    try {
      raw = JSON.stringify(buildGraphEditorPayload('main'));
    } catch (error) {
      return;
    }

    dispatchGraphEditorEvent(GRAPH_EDITOR_STATE_EVENT, raw);

    if (force) {
      if (state.graphEditorPublishTimer) {
        window.clearTimeout(state.graphEditorPublishTimer);
        state.graphEditorPublishTimer = null;
      }

      state.graphEditorPendingRaw = '';
      state.graphEditorLastRaw = raw;
      writeGraphEditorStateRaw(raw);
      return;
    }

    state.graphEditorPendingRaw = raw;

    if (!state.graphEditorPublishTimer) {
      state.graphEditorPublishTimer = window.setTimeout(function () {
        var pending = state.graphEditorPendingRaw;
        state.graphEditorPublishTimer = null;
        state.graphEditorPendingRaw = '';

        if (pending) {
          state.graphEditorLastRaw = pending;
          writeGraphEditorStateRaw(pending);
        }
      }, 45);
    }
  }

  function syncGraphEditorFromStorage() {
    if (!state.graphEditorActive) {
      return;
    }

    var raw = readGraphEditorStateRaw();

    if (!raw || raw === state.graphEditorLastRaw) {
      return;
    }

    receiveGraphEditorState(raw);
  }

  function receiveGraphEditorState(raw) {
    var payload;

    if (!raw || raw === state.graphEditorLastRaw) {
      return;
    }

    state.graphEditorLastRaw = raw;

    try {
      payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (error) {
      return;
    }

    if (!payload || payload.sender !== 'editor') {
      return;
    }

    applyGraphEditorState(payload);
  }

  function normalizeGraphEditorBezierValues(values) {
    if (!values || values.length < 4) {
      return null;
    }

    var next = [];

    for (var i = 0; i < 4; i++) {
      var value = Number(values[i]);

      if (!isFinite(value)) {
        return null;
      }

      next.push(value);
    }

    next[0] = round(clamp(next[0], 0, 1), 2);
    next[1] = round(clamp(next[1], BEZIER_VALUE_MIN, BEZIER_VALUE_MAX), 2);
    next[2] = round(clamp(next[2], 0, 1), 2);
    next[3] = round(clamp(next[3], BEZIER_VALUE_MIN, BEZIER_VALUE_MAX), 2);
    return next;
  }

  function applyGraphEditorState(payload) {
    var interactionActive = !!payload.interactionActive;
    var historySnapshot = interactionActive ? null : captureGraphSnapshot();

    if (interactionActive) {
      queueGraphUndoSnapshot();
    }

    cancelBezierClickAnimation();
    var nextMode = MODES.indexOf(payload.mode) === -1 ? state.mode : payload.mode;
    var nextBezier = normalizeGraphEditorBezierValues(payload.bezierValues);
    var incomingParams = payload.params || {};

    state.graphEditorApplying = true;

    try {
      for (var i = 0; i < MODES.length; i++) {
        var mode = MODES[i];

        if (mode !== 'bezier' && incomingParams[mode]) {
          try {
            state.params[mode] = cloneParams(mode, incomingParams[mode]);
          } catch (error) {}
        }
      }

      if (nextBezier) {
        state.bezierValues = nextBezier;
        state.originalValueText = formatBezierValues(nextBezier);
        setBezierValueText(nextBezier);
      }

      state.selectedCurvePresetId = '';
      state.renderView = null;
      setMode(nextMode, { animate: false });
      updateValueText();

      if (nextMode === 'bezier') {
        commitBezierToNativeGraph();
      }

      state.graphEditorLastSignature = getGraphEditorSignature(getGraphEditorCoreState());
    } finally {
      state.graphEditorApplying = false;
    }

    render();
    renderCurvePresets();

    if (!interactionActive && state.pendingGraphHistory) {
      commitQueuedGraphUndo();
    } else if (!interactionActive) {
      pushGraphUndoSnapshot(historySnapshot);
    }
  }
  function bindDividerOverlay() {
    if (!els.libraryPanel || !els.divider || !els.container || !els.graphPanel) {
      return;
    }

    restoreGraphPanelHeight();
    positionDividerOverlay();
    els.divider.addEventListener('mousedown', startDividerDrag);
    els.divider.addEventListener('touchstart', startDividerDrag);
    document.addEventListener('mousemove', dragDivider);
    document.addEventListener('touchmove', dragDivider);
    document.addEventListener('mouseup', stopDividerDrag);
    document.addEventListener('touchend', stopDividerDrag);

    if (window.ResizeObserver) {
      var dividerResizeObserver = new window.ResizeObserver(function () {
        restoreGraphPanelHeight(false);
        positionDividerOverlay();
      });
      dividerResizeObserver.observe(els.container);
      dividerResizeObserver.observe(els.libraryPanel);
    }
  }

  function isPortraitLayout() {
    try {
      return window.getComputedStyle(els.container).flexDirection === 'column';
    } catch (error) {
      return true;
    }
  }

  function getGraphPanelChromeHeight() {
    if (!els.graphPanel || !els.graphTop) {
      return 154;
    }

    var panelRect = els.graphPanel.getBoundingClientRect();
    var graphRect = els.graphTop.getBoundingClientRect();
    var chrome = panelRect.height - graphRect.height;

    if (!isFinite(chrome) || chrome <= 0) {
      return 154;
    }

    return Math.max(142, Math.round(chrome));
  }

  function getGraphPanelWidth() {
    if (els.graphPanel) {
      var panelRect = els.graphPanel.getBoundingClientRect();
      if (panelRect.width > 0) {
        return panelRect.width;
      }
    }

    if (els.container) {
      return els.container.getBoundingClientRect().width || 300;
    }

    return 300;
  }

  function getGraphPanelHeightBounds() {
    var containerRect = els.container.getBoundingClientRect();
    var panelWidth = getGraphPanelWidth();
    var chrome = getGraphPanelChromeHeight();
    var minGraphTop = Math.max(172, Math.min(210, panelWidth * 0.62));
    var maxGraphTop = Math.max(minGraphTop, Math.min(270, panelWidth * 0.9));
    var lowerReserve = Math.max(118, Math.min(172, containerRect.height * 0.28));
    var min = Math.round(chrome + minGraphTop);
    var max = Math.max(min, Math.round(Math.min(chrome + maxGraphTop, containerRect.height - lowerReserve)));

    return {
      min: min,
      max: max
    };
  }

  function getDefaultGraphPanelHeight() {
    var bounds = getGraphPanelHeightBounds();
    var panelWidth = getGraphPanelWidth();
    var chrome = getGraphPanelChromeHeight();
    var targetGraphTop = Math.max(196, Math.min(238, panelWidth * 0.74));

    return clamp(Math.round(chrome + targetGraphTop), bounds.min, bounds.max);
  }

  function applyGraphPanelHeight(height, persist) {
    if (!els.graphPanel || !isPortraitLayout()) {
      if (els.graphPanel) {
        els.graphPanel.style.height = '';
        els.graphPanel.style.flexBasis = '';
      }

      return;
    }

    var bounds = getGraphPanelHeightBounds();
    var nextHeight = Math.round(clamp(height, bounds.min, bounds.max));

    els.graphPanel.style.height = nextHeight + 'px';
    els.graphPanel.style.flexBasis = nextHeight + 'px';

    if (persist !== false) {
      try {
        window.localStorage.setItem(CURVE_PANEL_HEIGHT_STORAGE_KEY, String(nextHeight));
      } catch (error) {}
    }

    positionDividerOverlay();
    render();
  }

  function restoreGraphPanelHeight(useStored) {
    if (!els.graphPanel) {
      return;
    }

    if (!isPortraitLayout()) {
      els.graphPanel.style.height = '';
      els.graphPanel.style.flexBasis = '';
      return;
    }

    var height = 0;
    var bounds = getGraphPanelHeightBounds();

    if (useStored !== false) {
      try {
        height = Number(window.localStorage.getItem(CURVE_PANEL_HEIGHT_STORAGE_KEY)) || 0;
      } catch (error) {
        height = 0;
      }
    } else {
      height = els.graphPanel.getBoundingClientRect().height;
    }

    if (!height || height < bounds.min - 2) {
      height = getDefaultGraphPanelHeight();
    }

    applyGraphPanelHeight(height, false);
  }

  function getDividerClientY(event) {
    if (event.touches && event.touches[0]) {
      return event.touches[0].clientY;
    }

    return event.clientY;
  }

  function startDividerDrag(event) {
    if (!els.graphPanel || !isPortraitLayout()) {
      return;
    }

    event.preventDefault();
    state.dividerDrag = {
      startY: getDividerClientY(event),
      startHeight: els.graphPanel.getBoundingClientRect().height
    };

    if (els.body) {
      els.body.classList.add('curve-divider-dragging');
    }
  }

  function dragDivider(event) {
    if (!state.dividerDrag) {
      return;
    }

    event.preventDefault();
    applyGraphPanelHeight(state.dividerDrag.startHeight + getDividerClientY(event) - state.dividerDrag.startY, false);
  }

  function stopDividerDrag() {
    if (!state.dividerDrag) {
      return;
    }

    if (els.graphPanel) {
      applyGraphPanelHeight(els.graphPanel.getBoundingClientRect().height, true);
    }

    state.dividerDrag = null;

    if (els.body) {
      els.body.classList.remove('curve-divider-dragging');
    }
  }

  function positionDividerOverlay() {
    if (!els.libraryPanel || !els.divider || !els.container) {
      return;
    }

    var libraryRect = els.libraryPanel.getBoundingClientRect();
    var containerRect = els.container.getBoundingClientRect();
    var top = Math.max(0, libraryRect.top - containerRect.top);

    els.divider.style.top = Math.round(top) + 'px';
  }

  function loadSettings() {
    try {
      state.settingsRaw = readSettingsRaw();
      state.settings = mergeSettings(JSON.parse(state.settingsRaw));
    } catch (error) {
      state.settingsRaw = '';
      state.settings = getDefaultSettings();
    }
  }

  function persistSettings() {
    try {
      state.settingsRaw = JSON.stringify(state.settings);
      window.localStorage.setItem(CURVE_SETTINGS_STORAGE_KEY, state.settingsRaw);
      writeSharedSettingsRaw(state.settingsRaw);
    } catch (error) {}
  }

  function getSharedSettingsPath() {
    try {
      if (window.__adobe_cep__ && window.cep && window.cep.fs) {
        var base = normalizeSystemPath(window.__adobe_cep__.getSystemPath('userData'));

        if (base) {
          return base.replace(/%24/g, '$') + '/' + CURVE_SETTINGS_SHARED_FILE;
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
      return window.localStorage.getItem(CURVE_SETTINGS_STORAGE_KEY) || '{}';
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

  function openSettingsWindow() {
    var settingsUrl = 'settings.html';
    var popup = null;

    if (requestOpenSettingsExtension()) {
      return;
    }

    try {
      popup = window.open(settingsUrl, 'Settings', 'width=583,height=620,resizable=no,scrollbars=no');
    } catch (error) {}

    if (popup && popup.focus) {
      popup.focus();
    }
  }

  function requestOpenSettingsExtension() {
    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.requestOpenExtension === 'function') {
          cs.requestOpenExtension(SETTINGS_EXTENSION_ID, '');
          return true;
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.requestOpenExtension === 'function') {
        window.__adobe_cep__.requestOpenExtension(SETTINGS_EXTENSION_ID, '');
        return true;
      }
    } catch (error) {}

    return false;
  }

  function startSettingsSync() {
    window.addEventListener('storage', function (event) {
      if (event.key === CURVE_SETTINGS_STORAGE_KEY) {
        syncSettingsFromStorage();
      }
    });

    addCepSettingsListener();
    window.setInterval(syncSettingsFromStorage, 900);
  }

  function addCepSettingsListener() {
    var handler = function (event) {
      applySettingsRaw(event && typeof event === 'object' && 'data' in event ? event.data : event);
    };

    try {
      if (window.CSInterface) {
        var cs = new window.CSInterface();

        if (cs && typeof cs.addEventListener === 'function') {
          cs.addEventListener(CURVE_SETTINGS_EVENT, handler);
        }
      }
    } catch (error) {}

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === 'function') {
        window.__adobe_cep__.addEventListener(CURVE_SETTINGS_EVENT, handler);
      }
    } catch (error) {}
  }

  function syncSettingsFromStorage() {
    var raw = '';

    try {
      raw = readSettingsRaw();
    } catch (error) {
      return;
    }

    if (raw === state.settingsRaw) {
      return;
    }

    applySettingsRaw(raw);
  }

  function applySettingsRaw(raw) {
    if (typeof raw === 'object' && raw !== null) {
      try {
        raw = JSON.stringify(raw);
      } catch (error) {
        raw = '{}';
      }
    }

    raw = String(raw || '{}');

    if (raw === state.settingsRaw) {
      return;
    }

    state.settingsRaw = raw;

    try {
      state.settings = mergeSettings(JSON.parse(raw));
    } catch (error) {
      state.settings = getDefaultSettings();
    }

    try {
      window.localStorage.setItem(CURVE_SETTINGS_STORAGE_KEY, state.settingsRaw);
    } catch (error) {}

    applySettings();
  }

  function applySettings() {
    updateRgbMode();
    applyActiveColors();
    applyHandleAppearance(document.documentElement);
    applyFlowPageVisibility();
    renderGraphBackground();
    render();
    registerApplyShortcutInterest();
    startApplyShortcutBridge();

    if (els.applyButton) {
      var shortcutLabel = normalizeApplyShortcutKey(state.settings.applyShortcutKey) + ' ×2';
      els.applyButton.setAttribute('aria-label', 'Apply graph (double-press ' + shortcutLabel + ')');
      els.applyButton.setAttribute('data-tooltip', 'Apply graph · ' + shortcutLabel);
    }

    if (state.settings.autoApply) {
      window.setTimeout(function () {
        if (els.applyButton && state.mode !== 'bezier') {
          els.applyButton.click();
        }
      }, 60);
    }
  }

  function setFlowElementVisible(element, isVisible) {
    if (element) {
      element.hidden = !isVisible;
    }
  }

  function updateLibraryToolbarWidth() {
    if (!els.libraryToolbar) {
      return;
    }

    var buttons = els.libraryToolbar.querySelectorAll('.button');
    var visibleButtonCount = 0;
    var index;

    for (index = 0; index < buttons.length; index += 1) {
      if (!buttons[index].hidden) {
        visibleButtonCount += 1;
      }
    }

    var buttonWidth = 24;
    var buttonGap = 2;
    var naturalWidth = visibleButtonCount > 0
      ? visibleButtonCount * buttonWidth + (visibleButtonCount - 1) * buttonGap
      : 0;

    els.libraryToolbar.style.width = Math.min(206, naturalWidth) + 'px';
  }

  function applyFlowPageVisibility() {
    var visibility = state.settings.flowPageVisibility || getDefaultFlowPageVisibility();
    var showAnyEaseDirection = visibility.easeOut || visibility.ease || visibility.easeIn;
    var modeChanged = false;

    setFlowElementVisible(els.easeOutButton, visibility.easeOut);
    setFlowElementVisible(els.easeButton, visibility.ease);
    setFlowElementVisible(els.easeInButton, visibility.easeIn);
    setFlowElementVisible(els.easeDirectionControl, showAnyEaseDirection);
    setFlowElementVisible(els.motionToolsButton, visibility.motionTools);
    setFlowElementVisible(els.expressionButton, visibility.expressionMode);
    setFlowElementVisible(els.previewButton, visibility.previewButton);
    setFlowElementVisible(els.emojiBrowserButton, visibility.emojiBrowser);
    setFlowElementVisible(els.previewStrip, visibility.previewBar);
    updateLibraryToolbarWidth();

    if (!visibility.motionTools && state.motionToolsMode) {
      state.motionToolsMode = false;
      modeChanged = true;
    }

    if (!visibility.expressionMode && state.expressionMode) {
      state.expressionMode = false;
      modeChanged = true;
    }

    if (!visibility.emojiBrowser && state.emojiBrowserMode) {
      state.emojiBrowserMode = false;
      modeChanged = true;
    }

    if ((!visibility.previewButton || !visibility.previewBar) && (state.previewFrame || state.previewResetTimer)) {
      stopPreview(true);
    }

    if (modeChanged) {
      updateExpressionModeState();
      updateMotionToolsModeState();
      updateEmojiBrowserModeState();
    }
  }

  function applyActiveColors() {
    var root = document.documentElement;
    var themeColor = getActiveThemeColor();
    var graphLineColor = getActiveGraphLineColor();
    var handleColor = getActiveHandleColor();
    var homeIndicatorColor = getActiveHomeIndicatorColor();

    root.style.setProperty('--flow-panel-background', state.settings.panelBackgroundColor);
    root.style.setProperty('--flow-panel-background-end', state.settings.panelBackgroundColor2);
    root.style.setProperty('--flow-panel-background-direction', Math.round(clamp(Number(state.settings.panelBackgroundDirection) || 0, 0, 360)) + 'deg');
    root.style.setProperty('--flow-panel-background-dim', (1 - clamp(Number(state.settings.panelBackgroundIntensity) || 0, 0, 100) / 100).toFixed(3));
    root.style.setProperty('--curve-theme-color', themeColor);
    root.style.setProperty('--curve-theme-soft', hexToRgba(themeColor, 0.22));
    root.style.setProperty('--curve-theme-glow', hexToRgba(themeColor, 0.44));
    root.style.setProperty('--curve-line-color', graphLineColor);
    root.style.setProperty('--curve-line-glow', hexToRgba(graphLineColor, 0.68));
    root.style.setProperty('--curve-line-halo', hexToRgba(graphLineColor, 0.36));
    root.style.setProperty('--curve-handle-color', handleColor);
    root.style.setProperty('--curve-handle-soft', hexToRgba(handleColor, 0.28));
    root.style.setProperty('--ios-home-indicator-color', colorWithAlphaVar(homeIndicatorColor));
    root.style.setProperty('--ios-home-indicator-glow', hexToRgba(homeIndicatorColor, 0.18));

    if (window.FlowMotionTools && typeof window.FlowMotionTools.refreshAnchorColors === 'function') {
      window.FlowMotionTools.refreshAnchorColors(themeColor);
    }

    if (els.body) {
      var backgroundEffect = normalizeBackgroundEffect(state.settings.backgroundEffect, state.settings.disableSnowflake);
      els.body.classList.toggle('curve-rgb-mode', state.settings.rgbMode);
      els.body.classList.toggle('motion-tools-text-labels', !!state.settings.motionToolTextLabels);
      els.body.classList.toggle('flow-null-at-top-enabled', !!state.settings.placeNewNullAtTop);
      if (els.applyButton) {
        els.applyButton.classList.toggle('apply-liquid-glass', !!state.settings.liquidGlassApply);
      }
      els.body.classList.toggle('ios-home-indicator-hidden', state.settings.hideHomeIndicator);
      els.body.classList.toggle('flow-snow-disabled', backgroundEffect !== 'snow');
      els.body.setAttribute('data-flow-background-effect', backgroundEffect);
    }
  }

  function applyHandleAppearance(root) {
    var styles = ['heart', 'circle', 'square', 'diamond', 'star', 'custom'];
    var style = normalizeHandleStyle(state.settings.handleStyle);
    var imageSrc = state.settings.handleImage && state.settings.handleImage.src || '';

    if (style === 'custom' && !imageSrc) {
      style = 'heart';
    }

    if (!els.body) {
      return;
    }

    for (var i = 0; i < styles.length; i++) {
      els.body.classList.remove('curve-handle-style-' + styles[i]);
    }

    els.body.classList.add('curve-handle-style-' + style);
    root.style.setProperty('--curve-handle-image', imageSrc ? toCssUrl(imageSrc) : 'none');
    root.style.setProperty('--curve-handle-size', Math.round(clamp(state.settings.handleSize, 8, 32)) + 'px');
  }

  function toCssUrl(value) {
    value = String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
    return 'url("' + value + '")';
  }

  function updateRgbMode() {
    if (state.settings.rgbMode) {
      startRgbMode();
    } else {
      stopRgbMode();
    }
  }

  function startRgbMode() {
    if (state.rgbFrame) {
      return;
    }

    function tick(now) {
      if (!state.settings.rgbMode) {
        state.rgbFrame = null;
        return;
      }

      state.rgbHue = now * 0.055 % 360;
      applyActiveColors();
      render();
      state.rgbFrame = window.requestAnimationFrame(tick);
    }

    state.rgbFrame = window.requestAnimationFrame(tick);
  }

  function stopRgbMode() {
    if (!state.rgbFrame) {
      return;
    }

    window.cancelAnimationFrame(state.rgbFrame);
    state.rgbFrame = null;
    state.rgbHue = 0;
    applyActiveColors();
  }

  function getRgbModeColor() {
    return hslToHex(state.rgbHue, 100, 64);
  }

  function getActiveThemeColor() {
    return state.settings.rgbMode ? getRgbModeColor() : state.settings.themeColor;
  }

  function getActiveGraphLineColor() {
    return state.settings.rgbMode ? getRgbModeColor() : state.settings.graphLineColor;
  }

  function getActiveHandleColor() {
    return state.settings.rgbMode ? getRgbModeColor() : state.settings.handleColor;
  }

  function getActiveHomeIndicatorColor() {
    return state.settings.rgbMode ? getRgbModeColor() : state.settings.homeIndicatorColor;
  }

  function colorWithAlphaVar(hex) {
    var match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');

    if (!match) {
      return 'rgba(255,255,255,var(--ios-home-indicator-alpha))';
    }

    return 'rgba(' + parseInt(match[1], 16) + ',' + parseInt(match[2], 16) + ',' + parseInt(match[3], 16) + ',var(--ios-home-indicator-alpha))';
  }

  function hexToRgba(hex, alpha) {
    var match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');

    if (!match) {
      return 'rgba(255,255,255,' + alpha + ')';
    }

    return 'rgba(' + parseInt(match[1], 16) + ',' + parseInt(match[2], 16) + ',' + parseInt(match[3], 16) + ',' + alpha + ')';
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

  function renderGraphBackground() {
    if (!els.backgroundLayer) {
      return;
    }

    while (els.backgroundLayer.firstChild) {
      els.backgroundLayer.removeChild(els.backgroundLayer.firstChild);
    }

    state.backgroundMedia = null;
    setGraphMediaStatus('');

    els.backgroundLayer.classList.remove('has-color');
    els.backgroundLayer.classList.toggle('use-original-color', state.settings.backgroundMediaColorEnabled);
    els.backgroundLayer.style.backgroundColor = '';
    els.backgroundLayer.style.setProperty('--curve-background-media-opacity', String(clamp(state.settings.background.opacity, 0, 100) / 100));

    if (!state.settings.background.src) {
      els.backgroundLayer.classList.remove('has-media');
      return;
    }

    els.backgroundLayer.classList.add('has-media');

    var media;

    if (state.settings.background.kind === 'video') {
      media = document.createElement('video');
      media.autoplay = true;
      media.loop = true;
      media.muted = true;
      media.playsInline = true;
      media.addEventListener('loadeddata', function () {
        if (state.backgroundMedia !== media) {
          return;
        }
        setGraphMediaStatus('');
        safePlayMedia(media);
      });
    } else {
      media = document.createElement('img');
      media.alt = '';
      media.addEventListener('load', function () {
        if (state.backgroundMedia !== media) {
          return;
        }
        setGraphMediaStatus('');
      });
    }

    media.addEventListener('error', function () {
      if (state.backgroundMedia !== media) {
        return;
      }
      setGraphMediaStatus('Could not decode this background. Try H.264 MP4, PNG, JPG, or GIF.');
    });

    media.src = state.settings.background.src;
    els.backgroundLayer.appendChild(media);
    state.backgroundMedia = media;
    safePlayMedia(media);
  }

  function bindBezierValueObserver() {
    if (!els.valueButton || !window.MutationObserver) {
      return;
    }

    var observer = new MutationObserver(function () {
      var currentText = els.valueButton.textContent;

      if (state.pendingBezierText) {
        if (currentText === state.pendingBezierText) {
          state.pendingBezierText = '';
          state.originalValueText = currentText;
          state.lastBezierText = currentText;
          state.bezierValues = parseBezierValues(currentText) || state.bezierValues;
          return;
        }

        state.pendingBezierText = '';
      }

      if (state.mode !== 'bezier' || state.syncingBezierText) {
        state.lastBezierText = currentText;
        state.bezierValues = parseBezierValues(currentText) || state.bezierValues;
        return;
      }

      var previous = parseBezierValues(state.lastBezierText);
      var next = parseBezierValues(currentText);
      state.originalValueText = currentText;
      state.lastBezierText = currentText;

      if (!previous || !next || sameNumbers(previous, next)) {
        state.bezierValues = next || state.bezierValues;
        render();
        return;
      }

      state.bezierValues = next.slice(0, 4);
      startCurveTransition(
        'bezier',
        { values: previous },
        'bezier',
        { values: next }
      );
      var historySnapshot = captureGraphSnapshot();
      historySnapshot.bezierValues = previous.slice(0, 4);
      pushGraphUndoSnapshot(historySnapshot);
    });

    observer.observe(els.valueButton, { childList: true, characterData: true, subtree: true });
  }

  function bindLibraryScope() {
    if (els.library) {
      els.library.addEventListener('click', function (event) {
        var preset = closest(event.target, '.preset');

        if (!preset || preset.classList.contains('flow-curve-type-preset')) {
          return;
        }

        state.selectedCurvePresetId = '';
        setMode('bezier');
        renderCurvePresets();
      }, true);
    }

    if (!els.libraryDropdown) {
      hydrateCurrentCurvePresets();
      return;
    }

    var scheduleSync = function () {
      window.setTimeout(syncCurvePresetLibrary, 40);
      window.setTimeout(syncCurvePresetLibrary, 220);
    };

    els.libraryDropdown.addEventListener('change', scheduleSync);
    els.libraryDropdown.addEventListener('input', scheduleSync);

    window.setInterval(function () {
      if (state.currentLibraryKey !== getCurrentLibraryKey()) {
        syncCurvePresetLibrary();
      }
    }, 900);

    if (window.MutationObserver && els.library) {
      var renderQueued = false;
      var observer = new MutationObserver(function () {
        if (renderQueued) {
          return;
        }

        renderQueued = true;
        window.setTimeout(function () {
          renderQueued = false;

          if (els.library.querySelectorAll('.flow-curve-type-preset').length !== state.curvePresets.length) {
            renderCurvePresets();
          }
        }, 90);
      });

      observer.observe(els.library, { childList: true });
    }
  }

  function setMode(mode, options) {
    if (MODES.indexOf(mode) === -1) {
      mode = 'bezier';
    }

    options = options || {};
    cancelBezierClickAnimation();
    var previousMode = options.fromMode || state.mode;
    var previousParams = options.fromParams ? cloneParams(previousMode, options.fromParams) : cloneParams(previousMode);

    if (state.mode === 'bezier' && mode !== 'bezier' && els.valueButton) {
      state.originalValueText = formatBezierValues(state.bezierValues);
    }

    state.mode = mode;

    if (mode === 'fourkey') {
      state.expressionMode = false;
    }

    for (var i = 0; i < els.tabs.length; i++) {
      var tabMode = els.tabs[i].getAttribute('data-curve-mode');
      var isActive = tabMode === mode;
      els.tabs[i].classList.toggle('is-active', isActive);
      els.tabs[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    for (var j = 0; j < MODES.length; j++) {
      els.body.classList.remove('curve-mode-' + MODES[j]);
    }

    els.body.classList.add('curve-mode-' + mode);
    els.body.classList.add('curve-mode-preview-active');
    updateSpeedGraphState();
    updateExpressionModeState();
    updateHandleCursors();

    if (els.readButton) {
      if (state.readStateTimer) {
        window.clearTimeout(state.readStateTimer);
        state.readStateTimer = null;
      }
      els.readButton.classList.remove('is-ok', 'is-error');
      els.readButton.setAttribute('data-tooltip', mode === 'fourkey' ? 'Read 4-Key values' : 'Read values');
    }

    if (mode === 'bezier' && previousMode !== 'bezier' && state.originalValueText) {
      setBezierValueText(parseBezierValues(state.originalValueText) || [0, 0, 1, 1]);
    }

    updateValueText();
    stopPreview(true);
    if (options.animate !== false) {
      startCurveTransition(previousMode, previousParams, mode, cloneParams(mode));
    } else {
      cancelCurveTransition();
      render();
    }
  }

  function requestRenderFrame() {
    if (state.renderFrame) {
      return;
    }

    var raf = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 16);
    };

    state.renderFrame = raf(function () {
      state.renderFrame = null;
      applyPendingDragUpdate();
      render();
    });
  }

  function getAnimationFrame() {
    return window.requestAnimationFrame || function (callback) {
      return window.setTimeout(function () {
        callback(Date.now());
      }, 16);
    };
  }

  function getCancelAnimationFrame() {
    return window.cancelAnimationFrame || window.clearTimeout;
  }

  function easeGraphTransition(t) {
    var eased = 1 - Math.pow(1 - t, 3);
    return clamp(eased + Math.sin(t * Math.PI) * 0.035, 0, 1);
  }

  function cancelCurveTransition() {
    if (state.transitionFrame) {
      getCancelAnimationFrame()(state.transitionFrame);
      state.transitionFrame = null;
    }

    state.transition = null;

    if (els.body) {
      els.body.classList.remove('curve-graph-animating');
    }
  }

  function startCurveTransition(fromMode, fromParams, toMode, toParams) {
    cancelBezierClickAnimation();
    cancelCurveTransition();

    state.transition = {
      fromMode: fromMode,
      fromParams: cloneParams(fromMode, fromParams),
      toMode: toMode,
      toParams: cloneParams(toMode, toParams),
      duration: 360,
      progress: 0,
      start: 0
    };

    if (els.body) {
      els.body.classList.add('curve-graph-animating');
    }

    var raf = getAnimationFrame();
    render();

    function tick(now) {
      if (!state.transition) {
        return;
      }

      if (!state.transition.start) {
        state.transition.start = now;
      }

      var linear = clamp((now - state.transition.start) / state.transition.duration, 0, 1);
      state.transition.progress = easeGraphTransition(linear);
      render();

      if (linear < 1) {
        state.transitionFrame = raf(tick);
      } else {
        state.transition = null;
        state.transitionFrame = null;

        if (els.body) {
          els.body.classList.remove('curve-graph-animating');
        }

        render();
      }
    }

    state.transitionFrame = raf(tick);
  }

  function getCanvasArea(rect) {
    return {
      left: 0,
      top: 0,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
  }

  function getGraphArea(view, graphRect) {
    graphRect = graphRect || els.graphTop.getBoundingClientRect();
    var wrapperRect = els.wrapper ? els.wrapper.getBoundingClientRect() : null;
    var useNativeWrapper = !els.body || !els.body.classList.contains('curve-mode-preview-active');

    if (useNativeWrapper && wrapperRect && wrapperRect.width > 8 && wrapperRect.height > 8) {
      return {
        left: wrapperRect.left - graphRect.left,
        top: wrapperRect.top - graphRect.top,
        width: wrapperRect.width,
        height: wrapperRect.height
      };
    }

    var width = Math.max(1, graphRect.width);
    var height = Math.max(1, graphRect.height);
    var size = Math.max(1, Math.min(width, height));

    return {
      left: (width - size) / 2,
      top: (height - size) / 2,
      width: size,
      height: size
    };
  }

  function getVisibleHandleNames(mode) {
    if (mode === 'fourkey') {
      return ['a', 'b', 'c', 'd'];
    }

    if (mode === 'bezier' || mode === 'custom' || mode === 'bounce') {
      return ['a', 'b'];
    }

    if (mode === 'steps') {
      return ['a'];
    }

    return ['a', 'b', 'c'];
  }

  function getHandleAxis(handleName) {
    if (state.mode === 'bezier') {
      return isSpeedGraphActive() ? 'x' : 'xy';
    }

    if (state.mode === 'custom') {
      return 'xy';
    }

    if (state.mode === 'steps') {
      return 'x';
    }

    if (state.mode === 'bounce') {
      return handleName === 'A' ? 'y' : 'x';
    }

    if (state.mode === 'elastic') {
      return handleName === 'B' ? 'x' : 'y';
    }

    if (state.mode === 'wave') {
      return handleName === 'A' ? 'x' : 'y';
    }

    return 'xy';
  }

  function updateHandleCursors() {
    els.handleA.setAttribute('data-axis', getHandleAxis('A'));
    els.handleB.setAttribute('data-axis', getHandleAxis('B'));
    els.handleC.setAttribute('data-axis', getHandleAxis('C'));
    els.handleD.setAttribute('data-axis', getHandleAxis('D'));
  }

  function isSpeedGraphActive() {
    return state.mode === 'bezier' && state.speedGraph;
  }

  function updateSpeedGraphState() {
    var active = isSpeedGraphActive();

    if (els.body) {
      els.body.classList.toggle('curve-speed-graph-active', active);
    }

    if (els.speedGraphButton) {
      els.speedGraphButton.classList.toggle('is-active', active);
      els.speedGraphButton.setAttribute('aria-pressed', active ? 'true' : 'false');
      els.speedGraphButton.setAttribute('aria-hidden', state.mode === 'bezier' ? 'false' : 'true');
    }
  }

  function updateExpressionModeState() {
    if (state.mode === 'fourkey') {
      state.expressionMode = false;
    }

    if (els.body) {
      els.body.classList.toggle('curve-expression-mode-active', state.expressionMode);
    }

    if (els.expressionButton) {
      els.expressionButton.classList.toggle('is-active', state.expressionMode);
      els.expressionButton.setAttribute('aria-pressed', state.expressionMode ? 'true' : 'false');
      els.expressionButton.setAttribute('aria-disabled', state.mode === 'fourkey' ? 'true' : 'false');
    }

    if (els.expressionPanel) {
      els.expressionPanel.hidden = !state.expressionMode;
    }

    if (els.library) {
      els.library.hidden = state.expressionMode || state.motionToolsMode || state.emojiBrowserMode;
    }

    updateExpressionPanel();
  }

  function updateMotionToolsModeState() {
    if (els.body) {
      els.body.classList.toggle('curve-motion-tools-mode-active', state.motionToolsMode);
    }

    if (els.motionToolsButton) {
      els.motionToolsButton.classList.toggle('is-active', state.motionToolsMode);
      els.motionToolsButton.setAttribute('aria-pressed', state.motionToolsMode ? 'true' : 'false');
    }

    if (els.motionToolsPanel) {
      els.motionToolsPanel.hidden = !state.motionToolsMode;
    }

    if (els.library) {
      els.library.hidden = state.expressionMode || state.motionToolsMode || state.emojiBrowserMode;
    }
  }

  function updateEmojiBrowserModeState() {
    if (els.body) {
      els.body.classList.toggle('curve-emoji-browser-mode-active', state.emojiBrowserMode);
    }

    if (els.emojiBrowserButton) {
      els.emojiBrowserButton.classList.toggle('is-active', state.emojiBrowserMode);
      els.emojiBrowserButton.setAttribute('aria-pressed', state.emojiBrowserMode ? 'true' : 'false');
    }

    if (els.emojiBrowserPanel) {
      els.emojiBrowserPanel.hidden = !state.emojiBrowserMode;
    }

    if (els.library) {
      els.library.hidden = state.expressionMode || state.motionToolsMode || state.emojiBrowserMode;
    }

    var modeEvent;

    try {
      modeEvent = new CustomEvent('flow:emoji-browser-mode', {
        detail: { active: state.emojiBrowserMode }
      });
    } catch (error) {
      modeEvent = document.createEvent('CustomEvent');
      modeEvent.initCustomEvent('flow:emoji-browser-mode', false, false, {
        active: state.emojiBrowserMode
      });
    }

    document.dispatchEvent(modeEvent);
  }

  function includeRangeY(range, y) {
    if (!isFinite(y)) {
      return;
    }

    range.min = Math.min(range.min, y);
    range.max = Math.max(range.max, y);
  }

  function includeModeRange(range, mode, params) {
    if (!params) {
      return;
    }

    var handles = getHandlePointsFor(mode, params);
    var visibleHandles = getVisibleHandleNames(mode);

    for (var handleIndex = 0; handleIndex < visibleHandles.length; handleIndex++) {
      includeRangeY(range, handles[visibleHandles[handleIndex]].y);
    }

    if (mode === 'custom') {
      var customPoints = params.points;

      for (var pointIndex = 0; pointIndex < customPoints.length; pointIndex++) {
        includeRangeY(range, customPoints[pointIndex].y);
        includeRangeY(range, customPoints[pointIndex].cy1);
        includeRangeY(range, customPoints[pointIndex].cy2);
      }
    }

    var samples = mode === 'steps' ? Math.max(2, params.count || 6) * 2 : 180;

    for (var i = 0; i <= samples; i++) {
      includeRangeY(range, evaluateWithParams(mode, params, i / samples));
    }
  }

  function includeRenderedRange(range) {
    var handles = getAnimatedHandlePoints();
    var visibleHandles = getVisibleHandleNames(state.mode);

    for (var handleIndex = 0; handleIndex < visibleHandles.length; handleIndex++) {
      var handleKey = visibleHandles[handleIndex];
      includeRangeY(range, handles[handleKey].y);
    }

    var samples = state.mode === 'steps' ? Math.max(2, state.params.steps.count || 6) * 2 : 180;

    for (var i = 0; i <= samples; i++) {
      includeRangeY(range, getCurveYForDraw(i / samples));
    }
  }

  function getModeParams(mode) {
    if (state.frameModeParams && mode === state.mode) {
      return state.frameModeParams;
    }

    return mode === 'bezier' ? cloneParams('bezier') : state.params[mode];
  }

  function getViewRange() {
    if (isSpeedGraphActive()) {
      return getSpeedGraphViewRange();
    }

    var range = { min: 0, max: 1 };

    if (state.transition) {
      includeRenderedRange(range);
    } else {
      includeModeRange(range, state.mode, getModeParams(state.mode));
    }

    var span = Math.max(0.0001, range.max - range.min);
    var padding = Math.max(span * 0.08, 0.08);
    range.min -= padding;
    range.max += padding;

    if (range.max - range.min < 1.2) {
      var center = (range.min + range.max) / 2;
      range.min = center - 0.6;
      range.max = center + 0.6;
    }

    return range;
  }

  function getSpeedGraphViewRange() {
    return {
      min: -0.05,
      max: 1.1
    };
  }

  function yToScreen(y, area, view) {
    var span = Math.max(0.0001, view.max - view.min);
    return area.top + (1 - ((y - view.min) / span)) * area.height;
  }

  function screenToY(clientY, graphRect, area, view) {
    var span = Math.max(0.0001, view.max - view.min);
    var normalizedY = 1 - ((clientY - graphRect.top - area.top) / area.height);
    return view.min + normalizedY * span;
  }

  function normalToAreaPoint(area, x, y, view) {
    return {
      x: area.left + clamp(x, 0, 1) * area.width,
      y: yToScreen(y, area, view)
    };
  }

  function resolveRenderView(target) {
    if (!state.renderView) {
      state.renderView = { min: target.min, max: target.max };
      state.renderVelocity.min = 0;
      state.renderVelocity.max = 0;
      return state.renderView;
    }

    var deltaMin = target.min - state.renderView.min;
    var deltaMax = target.max - state.renderView.max;
    var ease = 0.18;

    state.renderView.min += deltaMin * ease;
    state.renderView.max += deltaMax * ease;

    if (
      Math.abs(state.renderView.min - target.min) < 0.002 &&
      Math.abs(state.renderView.max - target.max) < 0.002
    ) {
      state.renderView.min = target.min;
      state.renderView.max = target.max;
    } else {
      requestRenderFrame();
    }

    return state.renderView;
  }

  function getInteractiveViewRange() {
    return state.renderView || getViewRange();
  }

  function clientToNormal(clientX, clientY) {
    var graphRect = els.graphTop.getBoundingClientRect();
    var view = getInteractiveViewRange();
    var area = getGraphArea(view, graphRect);
    var x = (clientX - graphRect.left - area.left) / area.width;
    var y = screenToY(clientY, graphRect, area, view);
    var limits = getModeYLimits(state.mode);

    return {
      x: clamp(x, 0, 1),
      y: clamp(y, Math.min(limits.min, view.min - 1), Math.max(limits.max, view.max + 1))
    };
  }

  function normalToPoint(x, y) {
    var view = getInteractiveViewRange();
    var area = getGraphArea(view);
    return normalToAreaPoint(area, x, y, view);
  }

  function setHandlePosition(handle, x, y, area, view) {
    var point = area && view ? normalToAreaPoint(area, x, y, view) : normalToPoint(x, y);
    handle.style.left = point.x + 'px';
    handle.style.top = point.y + 'px';
  }

  function setEndpointPosition(endpoint, x, y, area, view) {
    var point = normalToAreaPoint(area, x, y, view);
    endpoint.style.left = point.x + 'px';
    endpoint.style.top = point.y + 'px';
  }

  function getHandlePointForName(handleName) {
    var points = getHandlePoints();
    var key = handleName === 'A' ? 'a' : handleName === 'B' ? 'b' : handleName === 'C' ? 'c' : 'd';
    return points[key] || { x: 0, y: 0 };
  }

  function updateCoordinateLabel(point, area, view) {
    if (!els.coordinateLabel || !point) {
      return;
    }

    view = view || getInteractiveViewRange();
    area = area || getGraphArea(view);
    var screen = normalToAreaPoint(area, point.x, point.y, view);
    var labelX = clamp(screen.x + 10, 6, area.left + area.width - 58);
    var labelY = clamp(screen.y - 26, 6, area.top + area.height - 18);

    var displayX = point.x;

    if (state.mode === 'fourkey' && state.dragHandle) {
      displayX = state.dragHandle === 'A' || state.dragHandle === 'B'
        ? point.x * 2
        : (point.x - 0.5) * 2;
    }

    els.coordinateLabel.textContent = round(displayX, 2).toFixed(2) + ', ' + round(point.y, 2).toFixed(2);
    els.coordinateLabel.style.left = labelX + 'px';
    els.coordinateLabel.style.top = labelY + 'px';
    els.coordinateLabel.classList.add('is-visible');
  }

  function hideCoordinateLabel() {
    if (els.coordinateLabel) {
      els.coordinateLabel.classList.remove('is-visible');
    }
  }

  function updateParamsFromDrag(handleName, x, y) {
    var params = state.params[state.mode];

    if (state.mode === 'bezier') {
      updateBezierValuesFromDrag(handleName, x, y);
      return;
    }

    if (state.mode === 'fourkey') {
      var segment = handleName === 'A' || handleName === 'B' ? params.segmentA : params.segmentB;
      var control = handleName === 'A' || handleName === 'C' ? segment.p1 : segment.p2;
      control.x = round(clamp(handleName === 'A' || handleName === 'B' ? x * 2 : (x - 0.5) * 2, 0, 1), 2);
      control.y = round(clamp(y, FOUR_KEY_VALUE_MIN, FOUR_KEY_VALUE_MAX), 2);
    } else if (state.mode === 'custom') {
      var points = params.points;

      if (handleName === 'A') {
        points[0].cx2 = clamp(x, points[0].x, points[1].x);
        points[0].cy2 = clamp(y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
      } else {
        points[1].cx1 = clamp(x, points[0].x, points[1].x);
        points[1].cy1 = clamp(y, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
      }
    } else if (state.mode === 'elastic') {
      if (handleName === 'A') {
        params.amplitude = round(clamp(1 - y, 0.1, OSCILLATOR_AMPLITUDE_MAX), 2);
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

  function updateBezierValuesFromDrag(handleName, x, y) {
    if (!els.valueButton) {
      return;
    }

    var values = getCurrentBezierValues();
    var index = handleName === 'A' ? 0 : 2;

    if (isSpeedGraphActive()) {
      if (handleName === 'A') {
        values[0] = round(clamp(x * 2, 0, 1), 2);
        values[1] = 0;
      } else {
        values[2] = round(clamp((x - 0.5) * 2, 0, 1), 2);
        values[3] = 1;
      }

      setBezierDragValues(values);
      return;
    }

    values[index] = round(clamp(x, 0, 1), 2);
    values[index + 1] = round(clamp(y, BEZIER_VALUE_MIN, BEZIER_VALUE_MAX), 2);
    setBezierDragValues(values);
  }

  function setBezierDragValues(values) {
    state.bezierValues = values.slice(0, 4);
    state.bezierDragChanged = true;

    if (els.valueButton) {
      els.valueButton.setAttribute('data-flow-bezier-drag-value', formatBezierValues(state.bezierValues));
    }
  }

  function finishBezierDrag() {
    if (!els.valueButton) {
      state.bezierDragChanged = false;
      return;
    }

    if (state.bezierDragChanged) {
      setBezierValueText(state.bezierValues);
    }

    els.valueButton.classList.remove('flow-bezier-drag-readout');
    els.valueButton.removeAttribute('data-flow-bezier-drag-value');
    state.bezierDragChanged = false;
  }

  function getHandlePoints() {
    if (isSpeedGraphActive()) {
      return getBezierSpeedHandlePoints();
    }

    return getHandlePointsFor(state.mode, getModeParams(state.mode));
  }

  function getBezierSpeedHandlePoints() {
    var values = getCurrentBezierValues();
    var scale = getBezierSpeedScale(values);
    var leftSpeed = values[0] > 0.0001 ? values[1] / values[0] : 0;
    var rightSpeed = 1 - values[2] > 0.0001 ? (1 - values[3]) / (1 - values[2]) : 0;

    return {
      a: { x: values[0] * 0.5, y: clamp(Math.abs(leftSpeed) / Math.max(0.0001, scale) * 0.85, 0, 1) },
      b: { x: 0.5 + values[2] * 0.5, y: clamp(Math.abs(rightSpeed) / Math.max(0.0001, scale) * 0.85, 0, 1) },
      c: { x: 0.5, y: 0 }
    };
  }

  function getHandlePointsFor(mode, params) {
    if (mode === 'bezier') {
      var values = params && params.values ? params.values : [0, 0, 1, 1];

      return {
        a: { x: values[0], y: values[1] },
        b: { x: values[2], y: values[3] },
        c: { x: 0.5, y: 0.5 }
      };
    }

    if (mode === 'custom') {
      var points = params.points;

      return {
        a: { x: points[0].cx2, y: points[0].cy2 },
        b: { x: points[1].cx1, y: points[1].cy1 },
        c: { x: 0, y: 0 }
      };
    }

    if (mode === 'fourkey') {
      return {
        a: { x: params.segmentA.p1.x * 0.5, y: params.segmentA.p1.y },
        b: { x: params.segmentA.p2.x * 0.5, y: params.segmentA.p2.y },
        c: { x: 0.5 + params.segmentB.p1.x * 0.5, y: params.segmentB.p1.y },
        d: { x: 0.5 + params.segmentB.p2.x * 0.5, y: params.segmentB.p2.y }
      };
    }

    if (mode === 'elastic') {
      return {
        a: { x: 0, y: 1 - params.amplitude },
        b: { x: 0.5 / params.frequency, y: 0.5 },
        c: { x: 1, y: 1 - params.amplitude * Math.exp(-params.decay * 0.5) }
      };
    }

    if (mode === 'bounce') {
      return {
        a: { x: 0, y: 1 - params.stiffness },
        b: { x: params.bounces / 10, y: 0.5 },
        c: { x: 0, y: 0 }
      };
    }

    if (mode === 'wave') {
      return {
        a: { x: Math.min(1 / Math.max(0.1, params.frequency), 1), y: 0.5 },
        b: { x: 0.5, y: 0.5 + 0.5 * Math.exp(-params.decay * 0.5) },
        c: { x: 0.25, y: 0.5 + params.sharpness * 0.5 }
      };
    }

    if (mode === 'steps') {
      return {
        a: { x: params.count / 20, y: 0.5 },
        b: { x: 0, y: 0 },
        c: { x: 0, y: 0 }
      };
    }

    return {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      c: { x: 0, y: 0 },
      d: { x: 0, y: 0 }
    };
  }

  function evaluate(mode, x) {
    return evaluateWithParams(mode, getModeParams(mode), x);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function interpolatePoint(from, to, t) {
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t)
    };
  }

  function getCurveYForDraw(x) {
    if (isSpeedGraphActive()) {
      return getBezierSpeedAtX(x, getCurrentBezierValues());
    }

    if (!state.transition) {
      return evaluate(state.mode, x);
    }

    return lerp(
      evaluateWithParams(state.transition.fromMode, state.transition.fromParams, x),
      evaluateWithParams(state.transition.toMode, state.transition.toParams, x),
      state.transition.progress
    );
  }

  function getAnimatedHandlePoints() {
    if (isSpeedGraphActive()) {
      return getBezierSpeedHandlePoints();
    }

    var target = getHandlePoints();

    if (!state.transition) {
      return target;
    }

    var from = getHandlePointsFor(state.transition.fromMode, state.transition.fromParams);
    var to = getHandlePointsFor(state.transition.toMode, state.transition.toParams);
    var t = state.transition.progress;

    return {
      a: interpolatePoint(from.a || target.a, to.a || target.a, t),
      b: interpolatePoint(from.b || target.b, to.b || target.b, t),
      c: interpolatePoint(from.c || target.c, to.c || target.c, t),
      d: interpolatePoint(from.d || to.d || { x: 0.5, y: 0.5 }, to.d || from.d || { x: 0.5, y: 0.5 }, t)
    };
  }

  function evaluateWithParams(mode, p, x) {
    if (mode === 'bezier') {
      var values = p && p.values ? p.values : [0, 0, 1, 1];
      return cubicBezierAtX(x, values[0], values[1], values[2], values[3]);
    }

    if (mode === 'custom') {
      return customPathY(p.points, x);
    }

    if (mode === 'fourkey') {
      if (x <= 0.5) {
        return cubicBezierSegmentAtX(
          x * 2,
          p.segmentA.p1.x,
          p.segmentA.p1.y,
          p.segmentA.p2.x,
          p.segmentA.p2.y,
          0,
          1
        );
      }

      return cubicBezierSegmentAtX(
        (x - 0.5) * 2,
        p.segmentB.p1.x,
        p.segmentB.p1.y,
        p.segmentB.p2.x,
        p.segmentB.p2.y,
        1,
        0
      );
    }

    if (mode === 'elastic') {
      var err0 = 1 - p.amplitude;
      var err1 = -p.amplitude * Math.exp(-p.decay) * Math.cos(p.frequency * Math.PI * 2);
      var raw = 1 - p.amplitude * Math.exp(-p.decay * x) * Math.cos(p.frequency * Math.PI * 2 * x);
      return raw - (err0 * (1 - x) + err1 * x);
    }

    if (mode === 'bounce') {
      var segs = p.bounces + 1;
      var seg = Math.min(Math.floor(x * segs), segs - 1);

      if (seg === 0) {
        var localLead = x * segs;
        return localLead * localLead;
      }

      var mid = (seg + 0.5) / segs;
      var halfWidth = 0.5 / segs;
      var normalized = (x - mid) / halfWidth;
      return 1 - Math.pow(p.stiffness, seg) * (1 - normalized * normalized);
    }

    if (mode === 'wave') {
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

    if (mode === 'steps') {
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

    return x;
  }

  function solveBezierT(x, p1x, p2x) {
    if (x <= 0) {
      return 0;
    }

    if (x >= 1) {
      return 1;
    }

    var low = 0;
    var high = 1;
    var t = x;

    for (var i = 0; i < 14; i++) {
      var mt = 1 - t;
      var bx = 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t;

      if (Math.abs(bx - x) < 0.0005) {
        break;
      }

      if (bx < x) {
        low = t;
      } else {
        high = t;
      }

      t = (low + high) / 2;
    }

    return t;
  }

  function customPathY(points, x) {
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
    var mt = 1 - t;

    return mt * mt * mt * p0.y + 3 * mt * mt * t * p0.cy2 + 3 * mt * t * t * p3.cy1 + t * t * t * p3.y;
  }

  function cubicBezierAtX(x, p1x, p1y, p2x, p2y) {
    var low = 0;
    var high = 1;
    var t = x;

    for (var i = 0; i < 18; i++) {
      var cx = cubic(t, 0, p1x, p2x, 1);
      if (Math.abs(cx - x) < 0.0001) {
        break;
      }

      if (cx < x) {
        low = t;
      } else {
        high = t;
      }

      t = (low + high) / 2;
    }

    return cubic(t, 0, p1y, p2y, 1);
  }

  function cubicBezierSegmentAtX(x, p1x, p1y, p2x, p2y, startY, endY) {
    var t = solveBezierT(clamp(x, 0, 1), p1x, p2x);
    return cubic(t, startY, p1y, p2y, endY);
  }

  function getBezierSpeedAtX(x, values) {
    var scale = arguments.length > 2 ? arguments[2] : getBezierSpeedScale(values);
    var t = solveBezierT(clamp(x, 0, 1), values[0], values[2]);
    return getBezierSpeedAtT(t, values, scale);
  }

  function getBezierSpeedScale(values) {
    var samples = 100;
    var max = 0.0001;

    for (var i = 0; i <= samples; i++) {
      max = Math.max(max, getBezierRawSpeedAtT(i / samples, values));
    }

    return max;
  }

  function getBezierSpeedAtT(t, values, scale) {
    return clamp(getBezierRawSpeedAtT(t, values) / Math.max(0.0001, scale) * 0.85, 0, 1);
  }

  function getBezierSpeedPointAtT(t, values, scale) {
    return {
      x: cubic(t, 0, values[0], values[2], 1),
      y: getBezierSpeedAtT(t, values, scale)
    };
  }

  function getBezierRawSpeedAtT(t, values) {
    var dx = cubicDerivative(t, 0, values[0], values[2], 1);
    var dy = cubicDerivative(t, 0, values[1], values[3], 1);

    if (Math.abs(dx) < 0.0001) {
      return 0;
    }

    return Math.abs(dy / dx);
  }

  function cubicDerivative(t, p0, p1, p2, p3) {
    var mt = 1 - t;
    return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
  }

  function cubic(t, p0, p1, p2, p3) {
    var mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function render() {
    if (!els.preview) {
      return;
    }

    state.frameModeParams = state.mode === 'bezier'
      ? { values: state.bezierValues.slice(0, 4) }
      : state.params[state.mode];

    var rect = els.graphTop.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    var pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    var cssWidth = rect.width + 'px';
    var cssHeight = rect.height + 'px';

    if (els.preview.width !== pixelWidth) {
      els.preview.width = pixelWidth;
    }

    if (els.preview.height !== pixelHeight) {
      els.preview.height = pixelHeight;
    }

    if (els.preview.style.width !== cssWidth) {
      els.preview.style.width = cssWidth;
    }

    if (els.preview.style.height !== cssHeight) {
      els.preview.style.height = cssHeight;
    }

    var ctx = els.previewContext || els.preview.getContext('2d');
    els.previewContext = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    var canvasArea = getCanvasArea(rect);
    var view = resolveRenderView(getViewRange());
    var area = getGraphArea(view, rect);
    drawGrid(ctx, canvasArea, area, view);
    drawGuide(ctx, canvasArea, area, view);
    drawModeGuides(ctx, area, view);
    drawCurve(ctx, area, view);
    drawHandles(ctx, area, view);
    renderCustomEditor(area, view);

    var points = getAnimatedHandlePoints();
    setHandlePosition(els.handleA, points.a.x, points.a.y, area, view);
    setHandlePosition(els.handleB, points.b.x, points.b.y, area, view);
    setHandlePosition(els.handleC, points.c.x, points.c.y, area, view);
    var pointD = points.d || { x: 0.5, y: 0.5 };
    setHandlePosition(els.handleD, pointD.x, pointD.y, area, view);
    setEndpointPosition(els.endpointStart, 0, 0, area, view);
    setEndpointPosition(els.endpointEnd, 1, isSpeedGraphActive() ? 0 : 1, area, view);
    updateEndpointSelection();

    if (state.customDrag) {
      updateCoordinateLabel(getCustomDragPoint(), area, view);
    } else if (state.dragHandle) {
      updateCoordinateLabel(getHandlePointForName(state.dragHandle), area, view);
    }

    updateExpressionPanel();
    state.frameModeParams = null;
    publishGraphEditorState(false);
  }

  function renderCustomEditor(area, view) {
    if (!els.customLayer) {
      return;
    }

    if (state.mode !== 'custom' || isSpeedGraphActive()) {
      if (els.customLayer.firstChild) {
        els.customLayer.innerHTML = '';
      }

      state.customEditorKey = '';
      state.customAnchorElements = [];
      state.customControlElements = [];
      return;
    }

    var points = state.params.custom.points;
    var editorKey = String(points.length);

    if (state.customEditorKey !== editorKey) {
      var html = '';

      for (var i = 0; i < points.length; i++) {
        var point = points[i];

        if (i > 0) {
          html += customControlHtml(i, 'cx1', point.cx1, point.cy1, area, view);
        }

        if (i < points.length - 1) {
          html += customControlHtml(i, 'cx2', point.cx2, point.cy2, area, view);
        }
      }

      for (var j = 0; j < points.length; j++) {
        html += customAnchorHtml(j, points[j].x, points[j].y, area, view);
      }

      els.customLayer.innerHTML = html;
      state.customEditorKey = editorKey;
      state.customAnchorElements = Array.prototype.slice.call(els.customLayer.querySelectorAll('.curve-custom-anchor'));
      state.customControlElements = Array.prototype.slice.call(els.customLayer.querySelectorAll('.curve-custom-control'));
    }

    for (var controlIndex = 0; controlIndex < state.customControlElements.length; controlIndex++) {
      var controlElement = state.customControlElements[controlIndex];
      var pointIndex = Number(controlElement.getAttribute('data-index'));
      var controlName = controlElement.getAttribute('data-control');
      var controlPoint = points[pointIndex];

      if (controlPoint) {
        positionCustomEditorElement(
          controlElement,
          controlPoint[controlName],
          controlPoint[controlName === 'cx1' ? 'cy1' : 'cy2'],
          area,
          view
        );
      }
    }

    for (var anchorIndex = 0; anchorIndex < state.customAnchorElements.length; anchorIndex++) {
      var anchorElement = state.customAnchorElements[anchorIndex];
      var anchorPointIndex = Number(anchorElement.getAttribute('data-index'));
      var anchorPoint = points[anchorPointIndex];

      if (anchorPoint) {
        positionCustomEditorElement(anchorElement, anchorPoint.x, anchorPoint.y, area, view);
        anchorElement.classList.toggle('is-selected', anchorPointIndex === state.customPointIndex);
      }
    }
  }

  function positionCustomEditorElement(element, x, y, area, view) {
    var point = normalToAreaPoint(area, x, y, view);
    var left = point.x + 'px';
    var top = point.y + 'px';

    if (element.style.left !== left) {
      element.style.left = left;
    }

    if (element.style.top !== top) {
      element.style.top = top;
    }
  }

  function customAnchorHtml(index, x, y, area, view) {
    var point = normalToAreaPoint(area, x, y, view);
    var selected = index === state.customPointIndex ? ' is-selected' : '';

    return '<div class="curve-custom-anchor' + selected + '" data-index="' + index + '" style="left:' +
      point.x + 'px;top:' + point.y + 'px"></div>';
  }

  function customControlHtml(index, control, x, y, area, view) {
    var point = normalToAreaPoint(area, x, y, view);

    return '<div class="curve-custom-control" data-index="' + index + '" data-control="' + control + '" style="left:' +
      point.x + 'px;top:' + point.y + 'px"></div>';
  }

  function mapY(y, view) {
    return clamp(y, view.min, view.max);
  }

  function getNeuCurveGridStyle(index) {
    var major = index === 0 || index === 4;
    var insideUnit = index > 0 && index < 4;

    if (major) {
      return { color: 'rgba(255,255,255,0.58)', width: 1.2 };
    }

    if (insideUnit) {
      return { color: 'rgba(255,255,255,0.24)', width: 0.8 };
    }

    return { color: 'rgba(255,255,255,0.105)', width: 0.5 };
  }

  function drawGridLine(ctx, x1, y1, x2, y2, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGrid(ctx, canvasArea, graphArea, view) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(canvasArea.left, canvasArea.top, canvasArea.width, canvasArea.height);
    ctx.clip();

    for (var xi = -60; xi <= 80; xi++) {
      var xValue = xi / 4;
      var x = graphArea.left + graphArea.width * xValue;

      if (x < canvasArea.left - 20 || x > canvasArea.left + canvasArea.width + 20) {
        continue;
      }

      var xStyle = getNeuCurveGridStyle(xi);
      drawGridLine(
        ctx,
        x,
        canvasArea.top,
        x,
        canvasArea.top + canvasArea.height,
        xStyle.color,
        xStyle.width
      );
    }

    for (var yi = -60; yi <= 80; yi++) {
      var yValue = yi / 4;
      var py = yToScreen(yValue, graphArea, view);

      if (py < canvasArea.top - 20 || py > canvasArea.top + canvasArea.height + 20) {
        continue;
      }

      var yStyle = getNeuCurveGridStyle(yi);
      drawGridLine(
        ctx,
        canvasArea.left,
        py,
        canvasArea.left + canvasArea.width,
        py,
        yStyle.color,
        yStyle.width
      );
    }

    if (state.mode === 'steps') {
      var count = state.params.steps.count;

      for (var step = 1; step < count; step++) {
        var sx = graphArea.left + graphArea.width * (step / count);
        drawGridLine(ctx, sx, canvasArea.top, sx, canvasArea.top + canvasArea.height, 'rgba(255,255,255,0.16)', 0.9, [2, 4]);
      }
    }

    ctx.restore();
  }

  function drawGuide(ctx, canvasArea, graphArea, view) {
    var bottomLeft = normalToAreaPoint(graphArea, 0, 0, view);
    var topLeft = normalToAreaPoint(graphArea, 0, 1, view);
    var bottomRight = normalToAreaPoint(graphArea, 1, 0, view);
    var topRight = normalToAreaPoint(graphArea, 1, 1, view);
    var horizontalLeft = canvasArea.left;
    var horizontalRight = canvasArea.left + canvasArea.width;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, canvasArea.top);
    ctx.lineTo(topLeft.x, canvasArea.top + canvasArea.height);
    ctx.moveTo(topRight.x, canvasArea.top);
    ctx.lineTo(topRight.x, canvasArea.top + canvasArea.height);
    ctx.moveTo(horizontalLeft, topLeft.y);
    ctx.lineTo(horizontalRight, topRight.y);
    ctx.moveTo(horizontalLeft, bottomLeft.y);
    ctx.lineTo(horizontalRight, bottomRight.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawCurve(ctx, area, view) {
    if (isSpeedGraphActive()) {
      drawSpeedCurve(ctx, area, view);
      return;
    }

    ctx.save();
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = hexToRgba(getActiveGraphLineColor(), 0.72);
    ctx.shadowBlur = 22;
    ctx.strokeStyle = getActiveGraphLineColor();
    ctx.beginPath();

    if (state.mode === 'steps' && !state.transition) {
      drawStepsPath(ctx, area, view);
      ctx.stroke();
      ctx.restore();
      return;
    }

    var samples = 120;

    for (var i = 0; i <= samples; i++) {
      var x = i / samples;
      var y = mapY(getCurveYForDraw(x), view);
      var px = area.left + x * area.width;
      var py = yToScreen(y, area, view);

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawSpeedCurve(ctx, area, view) {
    var values = getCurrentBezierValues();
    var scale = getBezierSpeedScale(values);
    var samples = 300;
    var baseline = yToScreen(0, area, view);
    var path = [];
    var i;
    var x;
    var y;
    var px;
    var py;

    for (i = 0; i <= samples; i++) {
      var speedPoint = getBezierSpeedPointAtT(i / samples, values, scale);
      x = speedPoint.x;
      y = mapY(speedPoint.y, view);
      px = area.left + x * area.width;
      py = yToScreen(y, area, view);
      path.push({ x: px, y: py });
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(area.left, baseline);

    for (i = 0; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }

    ctx.lineTo(area.left + area.width, baseline);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(getActiveGraphLineColor(), 0.15);
    ctx.fill();

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = hexToRgba(getActiveGraphLineColor(), 0.72);
    ctx.shadowBlur = 22;
    ctx.strokeStyle = getActiveGraphLineColor();
    ctx.beginPath();

    for (i = 0; i < path.length; i++) {
      if (i === 0) {
        ctx.moveTo(path[i].x, path[i].y);
      } else {
        ctx.lineTo(path[i].x, path[i].y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawModeGuides(ctx, area, view) {
    if (state.mode === 'wave') {
      drawWaveGuides(ctx, area, view);
    }
  }

  function drawWaveGuides(ctx, area, view) {
    var p = state.params.wave;
    var samples = 80;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 0.9;
    ctx.setLineDash([3, 4]);

    for (var side = -1; side <= 1; side += 2) {
      ctx.beginPath();

      for (var i = 0; i <= samples; i++) {
        var x = i / samples;
        var envelope = 0.5 + side * 0.5 * Math.exp(-p.decay * x);
        var px = area.left + x * area.width;
        var py = yToScreen(mapY(envelope, view), area, view);

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStepsPath(ctx, area, view) {
    var count = state.params.steps.count;
    var previousY = evaluate('steps', 0);
    var start = normalToAreaPoint(area, 0, previousY, view);
    ctx.moveTo(start.x, start.y);

    for (var step = 1; step <= count; step++) {
      var x = step / count;
      var y = evaluate('steps', x);
      var px = area.left + x * area.width;
      var pyPrevious = yToScreen(mapY(previousY, view), area, view);
      var pyNext = yToScreen(mapY(y, view), area, view);

      ctx.lineTo(px, pyPrevious);
      ctx.lineTo(px, pyNext);
      previousY = y;
    }
  }

  function drawHandles(ctx, area, view) {
    if (state.mode !== 'custom' && state.mode !== 'bezier' && state.mode !== 'fourkey') {
      return;
    }

    if (isSpeedGraphActive()) {
      return;
    }

    if (state.mode === 'custom') {
      drawCustomHandles(ctx, area, view);
      return;
    }

    if (state.mode === 'fourkey') {
      drawFourKeyHandles(ctx, area, view);
      return;
    }

    var start = normalToAreaPoint(area, 0, 0, view);
    var end = normalToAreaPoint(area, 1, 1, view);
    var points = getAnimatedHandlePoints();
    var a = normalToAreaPoint(area, points.a.x, points.a.y, view);
    var b = normalToAreaPoint(area, points.b.x, points.b.y, view);

    ctx.save();
    ctx.strokeStyle = hexToRgba(getActiveHandleColor(), 0.44);
    ctx.lineWidth = state.settings.handleLineThickness;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(a.x, a.y);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

  }

  function drawFourKeyHandles(ctx, area, view) {
    var points = getAnimatedHandlePoints();
    var start = normalToAreaPoint(area, 0, 0, view);
    var middle = normalToAreaPoint(area, 0.5, 1, view);
    var end = normalToAreaPoint(area, 1, 0, view);
    var a = normalToAreaPoint(area, points.a.x, points.a.y, view);
    var b = normalToAreaPoint(area, points.b.x, points.b.y, view);
    var c = normalToAreaPoint(area, points.c.x, points.c.y, view);
    var d = normalToAreaPoint(area, points.d.x, points.d.y, view);

    ctx.save();
    ctx.strokeStyle = hexToRgba(getActiveHandleColor(), 0.44);
    ctx.lineWidth = state.settings.handleLineThickness;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(a.x, a.y);
    ctx.moveTo(middle.x, middle.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(middle.x, middle.y);
    ctx.lineTo(c.x, c.y);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#050505';
    ctx.strokeStyle = hexToRgba(getActiveHandleColor(), 0.72);
    ctx.lineWidth = 1.2;
    var anchors = [start, middle, end];

    for (var i = 0; i < anchors.length; i++) {
      ctx.beginPath();
      ctx.arc(anchors[i].x, anchors[i].y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCustomHandles(ctx, area, view) {
    var points = state.params.custom.points;

    ctx.save();
    ctx.strokeStyle = hexToRgba(getActiveHandleColor(), 0.44);
    ctx.lineWidth = state.settings.handleLineThickness;
    ctx.beginPath();

    for (var i = 0; i < points.length; i++) {
      var anchor = normalToAreaPoint(area, points[i].x, points[i].y, view);

      if (i > 0) {
        var incoming = normalToAreaPoint(area, points[i].cx1, points[i].cy1, view);
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(incoming.x, incoming.y);
      }

      if (i < points.length - 1) {
        var outgoing = normalToAreaPoint(area, points[i].cx2, points[i].cy2, view);
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(outgoing.x, outgoing.y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  function updateValueText() {
    if (!els.valueButton) {
      return;
    }

    if (state.mode === 'bezier') {
      var bezierTooltip = els.valueButton.textContent || 'Edit bezier values';

      if (els.valueButton.getAttribute('data-tooltip') !== bezierTooltip) {
        els.valueButton.setAttribute('data-tooltip', bezierTooltip);
      }

      return;
    }

    var p = state.params[state.mode];
    var text = '';

    if (state.mode === 'custom') {
      text = 'CUSTOM ' + p.points.length + ' PTS';
    } else if (state.mode === 'fourkey') {
      text = '4-KEY ' + getValueInputText('fourkey', p);
    } else if (state.mode === 'elastic') {
      text = 'ELASTIC ' + p.amplitude.toFixed(2) + ', ' + p.frequency.toFixed(2) + ', ' + p.decay.toFixed(2);
    } else if (state.mode === 'bounce') {
      text = 'BOUNCE ' + p.bounces + ', ' + p.stiffness.toFixed(2);
    } else if (state.mode === 'wave') {
      text = 'WAVE ' + p.frequency.toFixed(2) + ', ' + p.amplitude.toFixed(2) + ', ' + p.decay.toFixed(2);
    } else if (state.mode === 'steps') {
      text = 'STEPS ' + p.count;
    }

    if (els.valueButton.textContent !== text) {
      els.valueButton.textContent = text;
    }

    if (els.valueButton.getAttribute('data-tooltip') !== text) {
      els.valueButton.setAttribute('data-tooltip', text);
    }
  }

  function getValueInputText(mode, params) {
    var p = params || state.params[mode];

    if (mode === 'fourkey') {
      return [
        p.segmentA.p1.x,
        p.segmentA.p1.y,
        p.segmentA.p2.x,
        p.segmentA.p2.y,
        p.segmentB.p1.x,
        p.segmentB.p1.y,
        p.segmentB.p2.x,
        p.segmentB.p2.y
      ].map(function (value) { return round(value, 2).toFixed(2); }).join(', ');
    }

    if (mode === 'custom') {
      return [
        p.points[0].cx2,
        p.points[0].cy2,
        p.points[1].cx1,
        p.points[1].cy1
      ].map(function (value) { return round(value, 2).toFixed(2); }).join(', ');
    }

    if (mode === 'elastic') {
      return [p.amplitude, p.frequency, p.decay].map(function (value) { return round(value, 2).toFixed(2); }).join(', ');
    }

    if (mode === 'bounce') {
      return [p.bounces, p.stiffness].join(', ');
    }

    if (mode === 'wave') {
      return [p.frequency, p.amplitude, p.decay, p.sharpness].map(function (value) { return round(value, 2).toFixed(2); }).join(', ');
    }

    return String(p.count);
  }

  function getExpressionParamsHtml() {
    var rows = getExpressionParamRows();
    var html = '';

    for (var i = 0; i < rows.length; i++) {
      html += '<span class="curve-expression-param"><span>' + rows[i].label + '</span>';

      if (rows[i].values) {
        for (var j = 0; j < rows[i].values.length; j++) {
          html += '<strong class="curve-expression-value" data-expression-key="' + rows[i].values[j].key + '">' + rows[i].values[j].value + '</strong>';
        }
      } else if (rows[i].key) {
        html += '<strong class="curve-expression-value" data-expression-key="' + rows[i].key + '">' + rows[i].value + '</strong>';
      } else {
        html += '<strong>' + rows[i].value + '</strong>';
      }

      html += '</span>';
    }

    return html;
  }

  function getExpressionParamRows() {
    var p = state.params[state.mode];

    if (state.mode === 'bezier') {
      var values = getCurrentBezierValues();

      return [
        {
          label: 'P1',
          values: [
            { key: 'bezier.0', value: formatTinyNumber(values[0]) },
            { key: 'bezier.1', value: formatTinyNumber(values[1]) }
          ]
        },
        {
          label: 'P2',
          values: [
            { key: 'bezier.2', value: formatTinyNumber(values[2]) },
            { key: 'bezier.3', value: formatTinyNumber(values[3]) }
          ]
        }
      ];
    }

    if (state.mode === 'custom') {
      return [
        {
          label: 'P1',
          values: [
            { key: 'custom.cx2', value: formatTinyNumber(p.points[0].cx2) },
            { key: 'custom.cy2', value: formatTinyNumber(p.points[0].cy2) }
          ]
        },
        {
          label: 'P2',
          values: [
            { key: 'custom.cx1', value: formatTinyNumber(p.points[1].cx1) },
            { key: 'custom.cy1', value: formatTinyNumber(p.points[1].cy1) }
          ]
        }
      ];
    }

    if (state.mode === 'elastic') {
      return [
        { label: 'AMP', key: 'elastic.amplitude', value: formatTinyNumber(p.amplitude) },
        { label: 'FREQ', key: 'elastic.frequency', value: formatTinyNumber(p.frequency) },
        { label: 'DECAY', key: 'elastic.decay', value: formatTinyNumber(p.decay) }
      ];
    }

    if (state.mode === 'bounce') {
      return [
        { label: 'BOUNCES', key: 'bounce.bounces', value: String(p.bounces) },
        { label: 'STIFF', key: 'bounce.stiffness', value: formatTinyNumber(p.stiffness) }
      ];
    }

    if (state.mode === 'wave') {
      return [
        { label: 'FREQ', key: 'wave.frequency', value: formatTinyNumber(p.frequency) },
        { label: 'AMP', key: 'wave.amplitude', value: formatTinyNumber(p.amplitude) },
        { label: 'DECAY', key: 'wave.decay', value: formatTinyNumber(p.decay) },
        { label: 'SHARP', key: 'wave.sharpness', value: formatTinyNumber(p.sharpness) }
      ];
    }

    return [
      { label: 'STEPS', key: 'steps.count', value: String(p.count) },
      { label: 'POS', value: String(p.position || 'end').toUpperCase() }
    ];
  }

  function startExpressionParamScrub(event) {
    var target = closest(event.target, '.curve-expression-value');

    if (!target) {
      return;
    }

    var key = target.getAttribute('data-expression-key');
    var value = getExpressionScrubValue(key);

    if (!key || value === null) {
      return;
    }

    queueGraphUndoSnapshot();

    state.expressionScrub = {
      key: key,
      startX: event.clientX,
      startValue: value
    };

    if (els.body) {
      els.body.classList.add('curve-expression-scrubbing');
    }

    cancelCurveTransition();
    state.selectedCurvePresetId = '';
    event.preventDefault();
    event.stopPropagation();
  }

  function dragExpressionParam(event) {
    if (!state.expressionScrub) {
      return;
    }

    var meta = getExpressionScrubMeta(state.expressionScrub.key);
    var delta = event.clientX - state.expressionScrub.startX;
    var next = state.expressionScrub.startValue + delta * meta.step;

    if (meta.integer) {
      next = Math.round(next);
    }

    setExpressionScrubValue(state.expressionScrub.key, next);
    updateValueText();
    render();
    event.preventDefault();
  }

  function stopExpressionParamScrub() {
    if (!state.expressionScrub) {
      return;
    }

    if (state.mode === 'bezier') {
      commitBezierToNativeGraph();
    }

    state.expressionScrub = null;

    if (els.body) {
      els.body.classList.remove('curve-expression-scrubbing');
    }

    commitQueuedGraphUndo();
  }

  function getExpressionScrubMeta(key) {
    if (/bounces|steps\.count/.test(key)) {
      return { step: 0.08, integer: true };
    }

    if (/frequency|decay/.test(key)) {
      return { step: 0.05, integer: false };
    }

    if (/stiffness|sharpness/.test(key)) {
      return { step: 0.01, integer: false };
    }

    return { step: 0.01, integer: false };
  }

  function getExpressionScrubValue(key) {
    var values;
    var index;
    var p;

    if (/^bezier\./.test(key)) {
      values = getCurrentBezierValues();
      index = Number(key.split('.')[1]);
      return values[index];
    }

    if (/^custom\./.test(key)) {
      p = state.params.custom;
      return key === 'custom.cx2' ? p.points[0].cx2 :
        key === 'custom.cy2' ? p.points[0].cy2 :
        key === 'custom.cx1' ? p.points[1].cx1 :
        key === 'custom.cy1' ? p.points[1].cy1 : null;
    }

    p = state.params[state.mode];

    if (!p) {
      return null;
    }

    return key === 'elastic.amplitude' ? p.amplitude :
      key === 'elastic.frequency' ? p.frequency :
      key === 'elastic.decay' ? p.decay :
      key === 'bounce.bounces' ? p.bounces :
      key === 'bounce.stiffness' ? p.stiffness :
      key === 'wave.frequency' ? p.frequency :
      key === 'wave.amplitude' ? p.amplitude :
      key === 'wave.decay' ? p.decay :
      key === 'wave.sharpness' ? p.sharpness :
      key === 'steps.count' ? p.count : null;
  }

  function setExpressionScrubValue(key, value) {
    var values;
    var index;
    var p;

    if (/^bezier\./.test(key)) {
      values = getCurrentBezierValues();
      index = Number(key.split('.')[1]);
      values[index] = round(clamp(value, index === 0 || index === 2 ? 0 : BEZIER_VALUE_MIN, index === 0 || index === 2 ? 1 : BEZIER_VALUE_MAX), 2);
      setBezierValueText(values);
      return;
    }

    if (/^custom\./.test(key)) {
      p = state.params.custom;

      if (key === 'custom.cx2') {
        p.points[0].cx2 = round(clamp(value, p.points[0].x, p.points[1].x), 2);
      } else if (key === 'custom.cy2') {
        p.points[0].cy2 = round(clamp(value, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX), 2);
      } else if (key === 'custom.cx1') {
        p.points[1].cx1 = round(clamp(value, p.points[0].x, p.points[1].x), 2);
      } else if (key === 'custom.cy1') {
        p.points[1].cy1 = round(clamp(value, CONTROL_VALUE_MIN, CONTROL_VALUE_MAX), 2);
      }

      return;
    }

    if (key === 'elastic.amplitude') {
      state.params.elastic.amplitude = round(clamp(value, 0.1, OSCILLATOR_AMPLITUDE_MAX), 2);
    } else if (key === 'elastic.frequency') {
      state.params.elastic.frequency = round(clamp(value, 1, 20), 2);
    } else if (key === 'elastic.decay') {
      state.params.elastic.decay = round(clamp(value, 0, 20), 2);
    } else if (key === 'bounce.bounces') {
      state.params.bounce.bounces = Math.round(clamp(value, 1, 10));
    } else if (key === 'bounce.stiffness') {
      state.params.bounce.stiffness = round(clamp(value, 0.1, 0.95), 2);
    } else if (key === 'wave.frequency') {
      state.params.wave.frequency = round(clamp(value, 0.5, 20), 2);
    } else if (key === 'wave.amplitude') {
      state.params.wave.amplitude = round(clamp(value, 0, OSCILLATOR_AMPLITUDE_MAX), 2);
    } else if (key === 'wave.decay') {
      state.params.wave.decay = round(clamp(value, 0, 20), 2);
    } else if (key === 'wave.sharpness') {
      state.params.wave.sharpness = round(clamp(value, -1, 1), 2);
    } else if (key === 'steps.count') {
      state.params.steps.count = Math.round(clamp(value, 2, 20));
    }
  }

  function updateExpressionPanel() {
    if (!state.expressionMode || !els.expressionPanel) {
      return;
    }

    if (els.expressionParams) {
      var paramsHtml = getExpressionParamsHtml();

      if (state.expressionParamsHtml !== paramsHtml) {
        els.expressionParams.innerHTML = paramsHtml;
        state.expressionParamsHtml = paramsHtml;
      }
    }

    if (els.expressionCode) {
      var expressionCode = buildCurrentExpression();

      if (state.expressionCodeText !== expressionCode) {
        els.expressionCode.value = expressionCode;
        state.expressionCodeText = expressionCode;
      }
    }
  }

  function formatTinyNumber(value) {
    return round(Number(value) || 0, 2).toFixed(2);
  }

  function formatExpressionNumber(value, fallback) {
    var parsed = Number(value);

    if (isNaN(parsed)) {
      parsed = fallback || 0;
    }

    return parsed.toFixed(4);
  }

  function getExpressionPayload() {
    if (state.mode === 'bezier') {
      return { values: getCurrentBezierValues() };
    }

    return cloneParams(state.mode);
  }

  function buildCurrentExpression() {
    return buildCompactExpressionForMode(state.mode, getExpressionPayload());
  }

  function buildCompactExpressionForMode(mode, params) {
    if (mode === 'bezier') {
      var values = params && params.values ? params.values : [0, 0, 1, 1];

      return 'cubic-bezier(' +
        formatTinyNumber(values[0]) + ', ' +
        formatTinyNumber(values[1]) + ', ' +
        formatTinyNumber(values[2]) + ', ' +
        formatTinyNumber(values[3]) + ')';
    }

    if (mode === 'custom') {
      return buildNeuCurveCustomExpression(params);
    }

    if (mode === 'elastic') {
      return buildNeuCurveTimelineExpression(
        [
          'var amp=' + formatExpressionNumber(params.amplitude, 1) + ', freq=' + formatExpressionNumber(params.frequency, 3) + ', decay=' + formatExpressionNumber(params.decay, 4) + ';'
        ],
        [
          'var w=Math.exp(-decay);',
          'var err0=1-amp;',
          'var err1=-amp*w*Math.cos(freq*Math.PI*2);',
          'var raw=1-amp*Math.exp(-decay*t)*Math.cos(freq*Math.PI*2*t);',
          'var ease=raw-(err0*(1-t)+err1*t);'
        ]
      );
    }

    if (mode === 'bounce') {
      var segs = Math.max(2, Math.round(Number(params.bounces) || 3) + 1);

      return buildNeuCurveTimelineExpression(
        [
          'var segs=' + segs + ', k=' + formatExpressionNumber(params.stiffness, 0.6) + ';'
        ],
        [
          'var seg=Math.min(Math.floor(t*segs),segs-1);',
          'if(seg===0){var lt=t*segs;var ease=lt*lt;}',
          'else{var mid=(seg+0.5)/segs,hw=0.5/segs,nt=(t-mid)/hw;var ease=1-Math.pow(k,seg)*(1-nt*nt);}'
        ]
      );
    }

    if (mode === 'wave') {
      return buildNeuCurveTimelineExpression(
        [
          'var freq=' + formatExpressionNumber(params.frequency, 2.5) + ', decay=' + formatExpressionNumber(params.decay, 0) + ', sharp=' + formatExpressionNumber(params.sharpness, 0) + ';'
        ],
        [
          'var phase=t*freq;',
          'var sig=Math.sin(phase*Math.PI*2 - Math.PI/2);',
          'var s=0.5+0.5*sig;',
          'var tr=Math.abs(((phase+0.5)%1)*2-1);',
          'var osc;',
          'if (sharp > 0) osc = s + (tr - s) * sharp;',
          'else {',
          '  var exponent = 1.0 / (1.0 + Math.abs(sharp));',
          '  var shaped = (sig < 0 ? -1 : 1) * Math.pow(Math.abs(sig), exponent);',
          '  osc=0.5+0.5*shaped;',
          '}',
          'var envelope=Math.exp(-decay*t);',
          'var ease=0.5+(osc-0.5)*1.0*envelope;'
        ],
        true
      );
    }

    var count = Math.max(2, Math.round(Number(params.count) || 6));
    var position = String(params.position || 'end');
    var method = position === 'start' ? 'ceil' : position === 'both' ? 'round' : 'floor';

    return buildNeuCurveTimelineExpression(
      [],
      [
        'var ease=Math.' + method + '(t*' + count + ')/' + count + ';'
      ]
    );
  }

  function buildNeuCurveCustomExpression(params) {
    var points = params.points || [
      { x: 0, y: 0, cx1: 0, cy1: 0, cx2: 0.33, cy2: 0 },
      { x: 1, y: 1, cx1: 0.67, cy1: 1, cx2: 1, cy2: 1 }
    ];
    var literal = '[';

    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      literal += '[' +
        formatNeuCurvePointNumber(point.x, 0) + ',' +
        formatNeuCurvePointNumber(point.y, 0) + ',' +
        formatNeuCurvePointNumber(point.cx1, point.x || 0) + ',' +
        formatNeuCurvePointNumber(point.cy1, point.y || 0) + ',' +
        formatNeuCurvePointNumber(point.cx2, point.x || 0) + ',' +
        formatNeuCurvePointNumber(point.cy2, point.y || 0) +
        ']';

      if (i < points.length - 1) {
        literal += ',';
      }
    }

    literal += ']';

    return buildNeuCurveTimelineExpression(
      ['var pts=' + literal + ';'],
      [
        'var n=pts.length-1;',
        'var seg=Math.min(Math.floor(t*n),n-1);',
        'var lt=(t-seg/n)*n, mt=1-lt;',
        'var p0=pts[seg],p3=pts[seg+1];',
        'var ease=mt*mt*mt*p0[1]+3*mt*mt*lt*p0[5]+3*mt*lt*lt*p3[2]+lt*lt*lt*p3[1];'
      ]
    );
  }

  function buildNeuCurveTimelineExpression(setupLines, easeLines, appendEaseLine) {
    var lines = [];
    var i;

    for (i = 0; i < setupLines.length; i++) {
      lines.push(setupLines[i]);
    }

    lines.push('var t=(time-key(1).time)/(key(numKeys).time-key(1).time);');
    lines.push('t=Math.max(0,Math.min(1,t));');

    for (i = 0; i < easeLines.length; i++) {
      lines.push(easeLines[i]);
    }

    lines.push('var t0=key(1).time, t1=key(numKeys).time;');
    lines.push('try{var v0=key(1).value, v1=key(numKeys).value; v0+(v1-v0)*ease;}catch(e){valueAtTime(t0+(t1-t0)*ease);}');

    if (appendEaseLine) {
      lines.push('ease;');
    }

    return lines.join('\n');
  }

  function formatNeuCurvePointNumber(value, fallback) {
    var parsed = Number(value);

    if (isNaN(parsed)) {
      parsed = fallback || 0;
    }

    return parsed.toFixed(3);
  }

  function buildExpressionForMode(mode, params, startIndex, endIndex) {
    return [
      '// Flow expression mode: ' + mode,
      'var i1 = ' + startIndex + ';',
      'var i2 = ' + endIndex + ';',
      buildExpressionCurveFunction(mode, params),
      'function mix(a, b, k) {',
      '  if (a instanceof Array && b instanceof Array) {',
      '    var r = [];',
      '    for (var i = 0; i < a.length; i++) r.push(a[i] + (b[i] - a[i]) * k);',
      '    return r;',
      '  }',
      '  return a + (b - a) * k;',
      '}',
      'if (numKeys < i2) {',
      '  value;',
      '} else {',
      '  var t1 = key(i1).time;',
      '  var t2 = key(i2).time;',
      '  if (time < t1 || time > t2 || t2 <= t1) {',
      '    value;',
      '  } else {',
      '    var t = Math.max(0, Math.min(1, (time - t1) / (t2 - t1)));',
      '    var e = curveEase(t);',
      '    try {',
      '      mix(key(i1).value, key(i2).value, e);',
      '    } catch (err) {',
      '      valueAtTime(t1 + (t2 - t1) * e);',
      '    }',
      '  }',
      '}'
    ].join('\n');
  }

  function buildExpressionCurveFunction(mode, params) {
    if (mode === 'bezier') {
      var values = params && params.values ? params.values : [0, 0, 1, 1];

      return [
        'var p1x = ' + formatExpressionNumber(values[0], 0) + ';',
        'var p1y = ' + formatExpressionNumber(values[1], 0) + ';',
        'var p2x = ' + formatExpressionNumber(values[2], 1) + ';',
        'var p2y = ' + formatExpressionNumber(values[3], 1) + ';',
        '// cubic-bezier(' + formatExpressionNumber(values[0], 0) + ', ' + formatExpressionNumber(values[1], 0) + ', ' + formatExpressionNumber(values[2], 1) + ', ' + formatExpressionNumber(values[3], 1) + ')',
        'function solveBezierT(x, a, b) {',
        '  if (x <= 0) return 0;',
        '  if (x >= 1) return 1;',
        '  var low = 0, high = 1, t = x;',
        '  for (var i = 0; i < 14; i++) {',
        '    var mt = 1 - t;',
        '    var bx = 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;',
        '    if (Math.abs(bx - x) < 0.0005) break;',
        '    if (bx < x) low = t; else high = t;',
        '    t = (low + high) / 2;',
        '  }',
        '  return t;',
        '}',
        'function curveEase(x) {',
        '  var t = solveBezierT(x, p1x, p2x);',
        '  var mt = 1 - t;',
        '  return mt*mt*mt*0 + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t;',
        '}'
      ].join('\n');
    }

    if (mode === 'custom') {
      return buildCustomExpressionFunction(params);
    }

    if (mode === 'elastic') {
      return [
        'function curveEase(t) {',
        '  var amp = ' + formatExpressionNumber(params.amplitude, 1) + ';',
        '  var freq = ' + formatExpressionNumber(params.frequency, 3) + ';',
        '  var decay = ' + formatExpressionNumber(params.decay, 4) + ';',
        '  var err0 = 1 - amp;',
        '  var err1 = -amp * Math.exp(-decay) * Math.cos(freq * Math.PI * 2);',
        '  var raw = 1 - amp * Math.exp(-decay * t) * Math.cos(freq * Math.PI * 2 * t);',
        '  return raw - (err0 * (1 - t) + err1 * t);',
        '}'
      ].join('\n');
    }

    if (mode === 'bounce') {
      return [
        'function curveEase(t) {',
        '  var bounces = Math.max(1, Math.round(' + formatExpressionNumber(params.bounces, 3) + '));',
        '  var stiffness = Math.max(0.1, Math.min(0.95, ' + formatExpressionNumber(params.stiffness, 0.6) + '));',
        '  var segs = bounces + 1;',
        '  var seg = Math.min(Math.floor(t * segs), segs - 1);',
        '  if (seg === 0) {',
        '    var localLead = t * segs;',
        '    return localLead * localLead;',
        '  }',
        '  var mid = (seg + 0.5) / segs;',
        '  var halfWidth = 0.5 / segs;',
        '  var normalized = (t - mid) / halfWidth;',
        '  return 1 - Math.pow(stiffness, seg) * (1 - normalized * normalized);',
        '}'
      ].join('\n');
    }

    if (mode === 'wave') {
      return [
        'function curveEase(t) {',
        '  var amp = ' + formatExpressionNumber(params.amplitude, 1) + ';',
        '  var freq = ' + formatExpressionNumber(params.frequency, 2.5) + ';',
        '  var decay = ' + formatExpressionNumber(params.decay, 0) + ';',
        '  var sharpness = ' + formatExpressionNumber(params.sharpness, 0) + ';',
        '  var phase = t * freq;',
        '  var sig = Math.sin(phase * Math.PI * 2 - Math.PI / 2);',
        '  var sine = 0.5 + 0.5 * sig;',
        '  var triangle = Math.abs(((phase + 0.5) % 1) * 2 - 1);',
        '  var oscillator;',
        '  if (sharpness > 0) {',
        '    oscillator = sine + (triangle - sine) * sharpness;',
        '  } else {',
        '    var exponent = 1 / (1 + Math.abs(sharpness));',
        '    oscillator = 0.5 + 0.5 * ((sig < 0 ? -1 : 1) * Math.pow(Math.abs(sig), exponent));',
        '  }',
        '  return 0.5 + (oscillator - 0.5) * amp * Math.exp(-decay * t);',
        '}'
      ].join('\n');
    }

    return [
      'function curveEase(t) {',
      '  var count = Math.max(2, Math.round(' + formatExpressionNumber(params.count, 6) + '));',
      '  var position = "' + String(params.position || 'end').replace(/"/g, '') + '";',
      '  if (t >= 1) return 1;',
      '  if (position === "start") return Math.ceil(t * count) / count;',
      '  if (position === "both") return Math.round(t * count) / count;',
      '  return Math.floor(t * count) / count;',
      '}'
    ].join('\n');
  }

  function buildCustomExpressionFunction(params) {
    var points = params.points || [
      { x: 0, y: 0, cx1: 0, cy1: 0, cx2: 0.33, cy2: 0 },
      { x: 1, y: 1, cx1: 0.67, cy1: 1, cx2: 1, cy2: 1 }
    ];
    var literal = '[';

    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      literal += '[' +
        formatExpressionNumber(point.x, 0) + ',' +
        formatExpressionNumber(point.y, 0) + ',' +
        formatExpressionNumber(point.cx1, point.x || 0) + ',' +
        formatExpressionNumber(point.cy1, point.y || 0) + ',' +
        formatExpressionNumber(point.cx2, point.x || 0) + ',' +
        formatExpressionNumber(point.cy2, point.y || 0) +
        ']';

      if (i < points.length - 1) {
        literal += ',';
      }
    }

    literal += ']';

    return [
      'var pts = ' + literal + ';',
      'function solveBezierT(x, p1x, p2x) {',
      '  if (x <= 0) return 0;',
      '  if (x >= 1) return 1;',
      '  var low = 0, high = 1, t = x;',
      '  for (var i = 0; i < 14; i++) {',
      '    var mt = 1 - t;',
      '    var bx = 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t;',
      '    if (Math.abs(bx - x) < 0.0005) break;',
      '    if (bx < x) low = t; else high = t;',
      '    t = (low + high) / 2;',
      '  }',
      '  return t;',
      '}',
      'function curveEase(x) {',
      '  var seg = 0;',
      '  while (seg < pts.length - 2 && x > pts[seg + 1][0]) seg++;',
      '  var p0 = pts[seg];',
      '  var p3 = pts[seg + 1];',
      '  var width = p3[0] - p0[0];',
      '  if (width <= 0.000001) return p3[1];',
      '  var localX = (x - p0[0]) / width;',
      '  var nx1 = (p0[4] - p0[0]) / width;',
      '  var nx2 = (p3[2] - p0[0]) / width;',
      '  var t = solveBezierT(localX, nx1, nx2);',
      '  var mt = 1 - t;',
      '  return mt*mt*mt*p0[1] + 3*mt*mt*t*p0[5] + 3*mt*t*t*p3[3] + t*t*t*p3[1];',
      '}'
    ].join('\n');
  }

  function copyCurrentExpression() {
    var text = buildCurrentExpression();

    copyTextToClipboard(text);
    setCopyButtonText('Copied');
  }

  function copyTextToClipboard(text) {
    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(text).catch(function () {
        fallbackCopyText(text);
      });
      return;
    }

    fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch (error) {}

    document.body.removeChild(textarea);
  }

  function setCopyButtonText(text) {
    if (!els.expressionCopyButton) {
      return;
    }

    els.expressionCopyButton.textContent = text;

    if (state.expressionCopyTimer) {
      window.clearTimeout(state.expressionCopyTimer);
    }

    state.expressionCopyTimer = window.setTimeout(function () {
      if (els.expressionCopyButton) {
        els.expressionCopyButton.textContent = 'Copy Expression';
      }
      state.expressionCopyTimer = null;
    }, 1200);
  }

  function importExpression() {
    showCurveDialog({
      title: 'Import Expression',
      text: 'Paste Expression here:',
      value: '',
      confirmText: 'Import',
      onConfirm: function (input) {
        if (!input) {
          return '';
        }

        var parsed = parseImportedExpression(input);

        if (!parsed) {
          return 'Could not read that expression.';
        }

        applyImportedExpression(parsed);
        return '';
      }
    });
  }

  function parseImportedExpression(input) {
    var text = String(input || '');
    var match = text.match(/cubic-bezier\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);

    if (match) {
      return {
        mode: 'bezier',
        params: { values: [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])] }
      };
    }

    var p1x = findVarNumber(text, 'p1x');
    var p1y = findVarNumber(text, 'p1y');
    var p2x = findVarNumber(text, 'p2x');
    var p2y = findVarNumber(text, 'p2y');

    if (p1x !== null && p1y !== null && p2x !== null && p2y !== null) {
      return { mode: 'bezier', params: { values: [p1x, p1y, p2x, p2y] } };
    }

    var pts = parsePointLiteral(text);

    if (pts) {
      return {
        mode: 'custom',
        params: {
          points: pts,
          mode: 'bake',
          bakeResolution: 8,
          isMirrored: false
        }
      };
    }

    var count = findVarNumber(text, 'count');
    var position = findVarString(text, 'position') || 'end';

    if (count !== null) {
      return {
        mode: 'steps',
        params: {
          count: Math.round(clamp(count, 2, 20)),
          position: position
        }
      };
    }

    match = text.match(/var\s+ease\s*=\s*Math\.(floor|ceil|round)\s*\(\s*t\s*\*\s*([-\d.]+)\s*\)\s*\/\s*([-\d.]+)/i);

    if (match) {
      return {
        mode: 'steps',
        params: {
          count: Math.round(clamp(Number(match[2]), 2, 20)),
          position: match[1] === 'ceil' ? 'start' : match[1] === 'round' ? 'both' : 'end'
        }
      };
    }

    var amp = findVarNumber(text, 'amp');
    var freq = findVarNumber(text, 'freq');
    var decay = findVarNumber(text, 'decay');
    var sharpness = findVarNumber(text, 'sharpness');
    var sharp = findVarNumber(text, 'sharp');

    if (freq !== null && decay !== null && (sharpness !== null || sharp !== null || /osc|triangle|sine/i.test(text))) {
      return {
        mode: 'wave',
        params: {
          amplitude: amp === null ? 1 : clamp(amp, 0, OSCILLATOR_AMPLITUDE_MAX),
          frequency: clamp(freq, 0.5, 20),
          decay: clamp(decay, 0, 20),
          sharpness: clamp(sharpness === null ? (sharp === null ? 0 : sharp) : sharpness, -1, 1),
          isMirrored: false
        }
      };
    }

    if (amp !== null && freq !== null && decay !== null) {
      return {
        mode: 'elastic',
        params: {
          amplitude: clamp(amp, 0.1, OSCILLATOR_AMPLITUDE_MAX),
          frequency: clamp(freq, 1, 20),
          decay: clamp(decay, 0, 20),
          isMirrored: false
        }
      };
    }

    var bounces = findVarNumber(text, 'bounces');
    var stiffness = findVarNumber(text, 'stiffness');

    if (bounces === null) {
      var segs = findVarNumber(text, 'segs');
      bounces = segs === null ? null : segs - 1;
    }

    if (stiffness === null) {
      stiffness = findVarNumber(text, 'k');
    }

    if (bounces !== null && stiffness !== null) {
      return {
        mode: 'bounce',
        params: {
          bounces: Math.round(clamp(bounces, 1, 10)),
          stiffness: clamp(stiffness, 0.1, 0.95),
          isMirrored: false
        }
      };
    }

    return null;
  }

  function findVarNumber(text, name) {
    var match = String(text).match(new RegExp('(?:var\\s+|[,;]\\s*)' + name + '\\s*=\\s*([-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?)', 'i'));
    return match ? Number(match[1]) : null;
  }

  function findVarString(text, name) {
    var match = String(text).match(new RegExp("var\\s+" + name + "\\s*=\\s*['\\\"]([^'\\\"]+)['\\\"]", 'i'));
    return match ? match[1] : '';
  }

  function parsePointLiteral(text) {
    var match = String(text).match(/var\s+pts\s*=\s*(\[[\s\S]*?\]);/i);
    var raw;
    var parsed;
    var points = [];

    if (!match) {
      return null;
    }

    raw = match[1];

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    if (!parsed || !parsed.length) {
      return null;
    }

    for (var i = 0; i < parsed.length; i++) {
      if (!parsed[i] || parsed[i].length < 6) {
        return null;
      }

      points.push({
        x: clamp(Number(parsed[i][0]), 0, 1),
        y: clamp(Number(parsed[i][1]), CONTROL_VALUE_MIN, CONTROL_VALUE_MAX),
        cx1: clamp(Number(parsed[i][2]), 0, 1),
        cy1: clamp(Number(parsed[i][3]), CONTROL_VALUE_MIN, CONTROL_VALUE_MAX),
        cx2: clamp(Number(parsed[i][4]), 0, 1),
        cy2: clamp(Number(parsed[i][5]), CONTROL_VALUE_MIN, CONTROL_VALUE_MAX)
      });
    }

    return points.length >= 2 ? points : null;
  }

  function applyImportedExpression(parsed) {
    var historySnapshot = captureGraphSnapshot();

    if (parsed.mode === 'bezier') {
      setMode('bezier', { animate: false });
      setBezierValueText(parsed.params.values);
    } else {
      state.params[parsed.mode] = cloneParams(parsed.mode, parsed.params);
      setMode(parsed.mode, { animate: false });
    }

    state.selectedCurvePresetId = '';
    renderCurvePresets();
    updateExpressionPanel();
    pushGraphUndoSnapshot(historySnapshot);
  }

  function getValueFormatText(mode) {
    if (mode === 'fourkey') {
      return 'Format "A x1, y1, x2, y2, B x1, y1, x2, y2"';
    }

    if (mode === 'custom') {
      return 'Format "x1, y1, x2, y2"';
    }

    if (mode === 'elastic') {
      return 'Format "amplitude, frequency, decay"';
    }

    if (mode === 'bounce') {
      return 'Format "bounces, stiffness"';
    }

    if (mode === 'wave') {
      return 'Format "frequency, amplitude, decay, sharpness"';
    }

    return 'Format "steps"';
  }

  function parseNumberList(value) {
    var matches = String(value).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    var numbers = [];

    for (var i = 0; i < matches.length; i++) {
      numbers.push(Number(matches[i]));
    }

    return numbers;
  }

  function applyValueInput(value) {
    var historySnapshot = captureGraphSnapshot();
    var numbers = parseNumberList(value);
    var p = state.params[state.mode];

    if (state.mode === 'fourkey') {
      if (numbers.length < 8) {
        return 'Use eight values: A x1, y1, x2, y2, B x1, y1, x2, y2.';
      }

      p.segmentA.p1.x = clamp(numbers[0], 0, 1);
      p.segmentA.p1.y = clamp(numbers[1], FOUR_KEY_VALUE_MIN, FOUR_KEY_VALUE_MAX);
      p.segmentA.p2.x = clamp(numbers[2], 0, 1);
      p.segmentA.p2.y = clamp(numbers[3], FOUR_KEY_VALUE_MIN, FOUR_KEY_VALUE_MAX);
      p.segmentB.p1.x = clamp(numbers[4], 0, 1);
      p.segmentB.p1.y = clamp(numbers[5], FOUR_KEY_VALUE_MIN, FOUR_KEY_VALUE_MAX);
      p.segmentB.p2.x = clamp(numbers[6], 0, 1);
      p.segmentB.p2.y = clamp(numbers[7], FOUR_KEY_VALUE_MIN, FOUR_KEY_VALUE_MAX);
    } else if (state.mode === 'custom') {
      if (numbers.length < 4) {
        return 'Use four values: x1, y1, x2, y2.';
      }

      p.points[0].cx2 = clamp(numbers[0], 0, 1);
      p.points[0].cy2 = clamp(numbers[1], CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
      p.points[1].cx1 = clamp(numbers[2], 0, 1);
      p.points[1].cy1 = clamp(numbers[3], CONTROL_VALUE_MIN, CONTROL_VALUE_MAX);
    } else if (state.mode === 'elastic') {
      if (numbers.length < 3) {
        return 'Use three values: amplitude, frequency, decay.';
      }

      p.amplitude = round(clamp(numbers[0], 0.1, OSCILLATOR_AMPLITUDE_MAX), 2);
      p.frequency = round(clamp(numbers[1], 1, 20), 2);
      p.decay = round(clamp(numbers[2], 0, 20), 2);
    } else if (state.mode === 'bounce') {
      if (numbers.length < 2) {
        return 'Use two values: bounces, stiffness.';
      }

      p.bounces = Math.round(clamp(numbers[0], 1, 10));
      p.stiffness = round(clamp(numbers[1], 0.1, 0.95), 2);
    } else if (state.mode === 'wave') {
      if (numbers.length < 3) {
        return 'Use at least three values: frequency, amplitude, decay.';
      }

      p.frequency = round(clamp(numbers[0], 0.5, 20), 2);
      p.amplitude = round(clamp(numbers[1], 0, OSCILLATOR_AMPLITUDE_MAX), 2);
      p.decay = round(clamp(numbers[2], 0, 20), 2);
      p.sharpness = round(clamp(numbers.length > 3 ? numbers[3] : p.sharpness, -1, 1), 2);
    } else if (state.mode === 'steps') {
      if (numbers.length < 1) {
        return 'Use one value: steps.';
      }

      p.count = Math.round(clamp(numbers[0], 2, 20));
    }

    updateValueText();
    render();
    renderCurvePresets();
    pushGraphUndoSnapshot(historySnapshot);
    return '';
  }

  function openValueEditor() {
    showCurveDialog({
      title: 'Enter new values',
      text: getValueFormatText(state.mode),
      value: getValueInputText(state.mode),
      confirmText: 'OK',
      onConfirm: function (value) {
        return applyValueInput(value);
      }
    });
  }

  function openSavePresetDialog() {
    showCurveDialog({
      title: 'Save graph preset',
      text: 'Name this ' + state.mode + ' graph',
      value: state.mode.charAt(0).toUpperCase() + state.mode.slice(1),
      confirmText: 'Save',
      onConfirm: function (value) {
        var name = String(value || '').replace(/^\s+|\s+$/g, '');

        if (!name) {
          return 'Preset name cannot be empty.';
        }

        saveCurvePreset(name);
        return '';
      }
    });
  }

  function showCurveDialog(options) {
    var overlay = document.createElement('div');
    overlay.className = 'curve-modal';
    overlay.innerHTML =
      '<div class="curve-modal__panel">' +
        '<div class="curve-modal__title"></div>' +
        '<div class="curve-modal__text"></div>' +
        '<input class="curve-modal__input" type="text" />' +
        '<div class="curve-modal__error"></div>' +
        '<div class="curve-modal__actions">' +
          '<button class="curve-modal__button curve-modal__button--ghost" type="button">Cancel</button>' +
          '<button class="curve-modal__button curve-modal__button--primary" type="button"></button>' +
        '</div>' +
      '</div>';

    var title = overlay.querySelector('.curve-modal__title');
    var text = overlay.querySelector('.curve-modal__text');
    var input = overlay.querySelector('.curve-modal__input');
    var error = overlay.querySelector('.curve-modal__error');
    var cancel = overlay.querySelector('.curve-modal__button--ghost');
    var ok = overlay.querySelector('.curve-modal__button--primary');

    title.textContent = options.title || '';
    text.textContent = options.text || '';
    input.value = options.value || '';
    ok.textContent = options.confirmText || 'OK';

    function close() {
      document.removeEventListener('keydown', onKeyDown, true);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function confirm() {
      var message = options.onConfirm ? options.onConfirm(input.value) : '';

      if (message) {
        error.textContent = message;
        return;
      }

      close();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'Enter') {
        confirm();
      }
    }

    cancel.addEventListener('click', close);
    ok.addEventListener('click', confirm);
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) {
        close();
      }
    });
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  function cloneParams(mode, params) {
    var p = params || state.params[mode];

    if (mode === 'bezier') {
      if (p && p.values) {
        return { values: p.values.slice(0, 4) };
      }

      return { values: getCurrentBezierValues() };
    }

    if (mode === 'custom') {
      return {
        points: clonePoints(p.points),
        mode: p.mode,
        bakeResolution: p.bakeResolution,
        isMirrored: p.isMirrored
      };
    }

    if (mode === 'fourkey') {
      return {
        segmentA: {
          p1: { x: p.segmentA.p1.x, y: p.segmentA.p1.y },
          p2: { x: p.segmentA.p2.x, y: p.segmentA.p2.y }
        },
        segmentB: {
          p1: { x: p.segmentB.p1.x, y: p.segmentB.p1.y },
          p2: { x: p.segmentB.p2.x, y: p.segmentB.p2.y }
        }
      };
    }

    if (mode === 'elastic') {
      return { amplitude: p.amplitude, frequency: p.frequency, decay: p.decay, isMirrored: !!p.isMirrored };
    }

    if (mode === 'bounce') {
      return { bounces: p.bounces, stiffness: p.stiffness, isMirrored: !!p.isMirrored };
    }

    if (mode === 'wave') {
      return { amplitude: p.amplitude, frequency: p.frequency, decay: p.decay, sharpness: p.sharpness, isMirrored: !!p.isMirrored };
    }

    return { count: p.count, position: p.position };
  }

  function saveCurvePreset(name) {
    hydrateCurrentCurvePresets();

    state.curvePresets.push({
      id: String(Date.now()),
      name: name,
      mode: state.mode,
      params: cloneParams(state.mode)
    });

    persistCurvePresets();
    renderCurvePresets();
  }

  function getCurrentLibraryKey() {
    if (!els.libraryDropdown) {
      return 'default';
    }

    var option = els.libraryDropdown.options && els.libraryDropdown.options[els.libraryDropdown.selectedIndex];
    var value = els.libraryDropdown.value || (option ? option.value : '');
    var label = option ? option.textContent : '';
    var key = value && label && value !== label ? value + '::' + label : value || label || 'default';

    return 'library:' + key;
  }

  function hydrateCurrentCurvePresets() {
    var key = getCurrentLibraryKey();

    state.currentLibraryKey = key;

    if (!state.curvePresetsByLibrary[key]) {
      state.curvePresetsByLibrary[key] = [];
    }

    state.curvePresets = state.curvePresetsByLibrary[key];
  }

  function syncCurvePresetLibrary() {
    var nextKey = getCurrentLibraryKey();

    if (nextKey === state.currentLibraryKey) {
      renderCurvePresets();
      return;
    }

    state.currentLibraryKey = nextKey;
    state.selectedCurvePresetId = '';

    if (!state.curvePresetsByLibrary[nextKey]) {
      state.curvePresetsByLibrary[nextKey] = [];
    }

    state.curvePresets = state.curvePresetsByLibrary[nextKey];
    renderCurvePresets();
  }

  function loadCurvePresets() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(CURVE_PRESET_STORAGE_KEY) || '{}') || {};
      state.curvePresetsByLibrary = Object.prototype.toString.call(stored) === '[object Object]' ? stored : {};

      if (!window.localStorage.getItem(CURVE_PRESET_MIGRATED_KEY)) {
        var legacy = JSON.parse(window.localStorage.getItem(CURVE_PRESET_LEGACY_STORAGE_KEY) || '[]') || [];

        if (legacy.length) {
          var key = getCurrentLibraryKey();
          state.curvePresetsByLibrary[key] = (state.curvePresetsByLibrary[key] || []).concat(legacy);
          window.localStorage.setItem(CURVE_PRESET_STORAGE_KEY, JSON.stringify(state.curvePresetsByLibrary));
        }

        window.localStorage.setItem(CURVE_PRESET_MIGRATED_KEY, '1');
      }
    } catch (error) {
      state.curvePresetsByLibrary = {};
    }

    hydrateCurrentCurvePresets();
  }

  function persistCurvePresets() {
    try {
      state.curvePresetsByLibrary[state.currentLibraryKey || getCurrentLibraryKey()] = state.curvePresets;
      window.localStorage.setItem(CURVE_PRESET_STORAGE_KEY, JSON.stringify(state.curvePresetsByLibrary));
    } catch (error) {}
  }

  function renderCurvePresets() {
    if (!els.library) {
      return;
    }

    hydrateCurrentCurvePresets();

    var old = els.library.querySelectorAll('.flow-curve-type-preset');

    for (var i = 0; i < old.length; i++) {
      old[i].parentNode.removeChild(old[i]);
    }

    for (var p = 0; p < state.curvePresets.length; p++) {
      els.library.appendChild(createCurvePresetElement(state.curvePresets[p]));
    }
  }

  function createCurvePresetElement(preset) {
    var item = document.createElement('div');
    item.className = 'preset flow-curve-type-preset';
    item.setAttribute('data-curve-preset-id', preset.id);
    item.setAttribute('data-curve-mode', preset.mode);

    if (preset.id === state.selectedCurvePresetId) {
      item.classList.add('selected');
    }

    item.innerHTML =
      '<div class="svgContainer">' +
        buildCurvePresetSvg(preset.mode, preset.params) +
      '</div>' +
      '<span class="preset-name-label"></span>' +
      '<div class="deleteButton"><i class="fa-solid fa-xmark"></i></div>';

    item.querySelector('.preset-name-label').textContent = preset.name;

    item.addEventListener('click', function (event) {
      if (closest(event.target, '.deleteButton')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }

      restoreCurvePreset(preset);
    }, true);

    item.querySelector('.deleteButton').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      deleteCurvePreset(preset.id);
    }, true);

    return item;
  }

  function deleteCurvePreset(id) {
    hydrateCurrentCurvePresets();
    state.curvePresets = state.curvePresets.filter(function (preset) {
      return preset.id !== id;
    });
    state.curvePresetsByLibrary[state.currentLibraryKey] = state.curvePresets;

    if (state.selectedCurvePresetId === id) {
      state.selectedCurvePresetId = '';
    }

    persistCurvePresets();
    renderCurvePresets();
  }

  function restoreCurvePreset(preset) {
    if (!preset || MODES.indexOf(preset.mode) === -1 || preset.mode === 'bezier') {
      return;
    }

    var historySnapshot = captureGraphSnapshot();
    var fromMode = state.mode;
    var fromParams = cloneParams(fromMode);

    state.params[preset.mode] = cloneParams(preset.mode, preset.params);
    state.selectedCurvePresetId = preset.id;
    setMode(preset.mode, {
      fromMode: fromMode,
      fromParams: fromParams
    });
    renderCurvePresets();
    pushGraphUndoSnapshot(historySnapshot);
  }

  function buildCurvePresetSvg(mode, params) {
    var samples = mode === 'steps' ? Math.max(2, params.count || 6) * 2 : 42;
    var path = '';

    for (var i = 0; i <= samples; i++) {
      var x = i / samples;
      var y = clamp(evaluateWithParams(mode, params, x), -0.2, 1.2);
      var px = 5 + x * 34;
      var py = 39 - ((y + 0.2) / 1.4) * 34;
      path += (i === 0 ? 'M ' : ' L ') + round(px, 2) + ' ' + round(py, 2);
    }

    return '<svg viewBox="0 0 44 44" aria-hidden="true"><path d="' + path + '"></path></svg>';
  }

  function getCurrentBezierValues() {
    return state.bezierValues.slice(0, 4);
  }

  function parseBezierValues(value) {
    var numbers = parseNumberList(value);

    if (numbers.length < 4) {
      return null;
    }

    return numbers.slice(0, 4);
  }

  function sameNumbers(a, b) {
    if (!a || !b || a.length !== b.length) {
      return false;
    }

    for (var i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > 0.0001) {
        return false;
      }
    }

    return true;
  }

  function formatBezierValues(values) {
    return values.map(function (value) {
      return round(value, 2).toFixed(2);
    }).join(', ');
  }

  function setBezierValueText(values) {
    if (!els.valueButton) {
      return;
    }

    state.bezierValues = values.slice(0, 4);
    var text = formatBezierValues(state.bezierValues);

    if (els.valueButton.textContent === text) {
      if (els.valueButton.getAttribute('data-tooltip') !== text) {
        els.valueButton.setAttribute('data-tooltip', text);
      }

      state.originalValueText = text;
      state.lastBezierText = text;
      return;
    }

    state.pendingBezierText = text;
    state.syncingBezierText = true;
    els.valueButton.textContent = text;
    els.valueButton.setAttribute('data-tooltip', text);
    state.originalValueText = text;
    state.lastBezierText = text;
    state.syncingBezierText = false;
  }

  function commitBezierToNativeGraph() {
    var values = getCurrentBezierValues();

    try {
      if (window.CubicBezier && window.GraphPanel && typeof window.GraphPanel.setBezier === 'function') {
        window.GraphPanel.setBezier(new window.CubicBezier(values.join(', ')));
      }
    } catch (error) {}
  }

  function getBezierPreviewValue(t) {
    var numbers = getCurrentBezierValues();

    return cubicBezierAtX(t, numbers[0], numbers[1], numbers[2], numbers[3]);
  }

  function getPreviewValue(t) {
    if (state.mode === 'bezier') {
      return getBezierPreviewValue(t);
    }

    return evaluate(state.mode, t);
  }

  function getPreviewTrackWidth() {
    if (!els.previewTrack) {
      return 0;
    }

    return Math.max(0, els.previewTrack.clientWidth || els.previewTrack.getBoundingClientRect().width || 0);
  }

  function updatePreviewPosition(value) {
    if (!els.previewBall || !els.previewTrail) {
      return;
    }

    var progress = clamp(value, 0, 1);
    var trackWidth = state.previewTrackWidth || getPreviewTrackWidth();
    var ballOffset = progress * trackWidth - 4;

    state.previewProgress = progress;
    els.previewBall.style.transform = 'translate3d(' + ballOffset.toFixed(2) + 'px, -50%, 0)';
    els.previewTrail.style.transform = 'translateY(-50%) scaleX(' + progress.toFixed(4) + ')';
  }

  function setPreviewPlaying(isPlaying) {
    if (els.body) {
      els.body.classList.toggle('curve-preview-playing', isPlaying);
    }

    if (els.previewButton) {
      els.previewButton.classList.toggle('is-active', isPlaying);
      els.previewButton.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    }
  }

  function stopPreview(resetPosition) {
    if (state.previewFrame) {
      getCancelAnimationFrame()(state.previewFrame);
      state.previewFrame = null;
    }

    if (state.previewResetTimer) {
      window.clearTimeout(state.previewResetTimer);
      state.previewResetTimer = null;
    }

    state.previewStart = null;
    setPreviewPlaying(false);

    if (resetPosition !== false) {
      updatePreviewPosition(0);
    }
  }

  function getPreviewDuration() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 300;
      }
    } catch (error) {}

    return 1150;
  }

  function playPreview() {
    if (!els.previewButton || !els.previewBall || !els.previewTrail) {
      return;
    }

    stopPreview(true);
    state.previewTrackWidth = getPreviewTrackWidth();
    state.previewStart = null;
    setPreviewPlaying(true);

    var duration = getPreviewDuration();
    var raf = getAnimationFrame();

    function tick(now) {
      if (state.previewStart === null) {
        state.previewStart = now;
      }

      var t = clamp((now - state.previewStart) / duration, 0, 1);
      updatePreviewPosition(getPreviewValue(t));

      if (t < 1) {
        state.previewFrame = raf(tick);
        return;
      }

      state.previewFrame = null;
      state.previewResetTimer = window.setTimeout(function () {
        state.previewResetTimer = null;
        state.previewStart = null;
        setPreviewPlaying(false);
        updatePreviewPosition(0);
      }, 180);
    }

    state.previewFrame = raf(tick);
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

  function loadHost(callback) {
    if (state.hostLoaded) {
      callback(true);
      return;
    }

    state.callbacks.push(callback);

    if (state.hostLoading) {
      return;
    }

    state.hostLoading = true;
    var path = getPanelPath() + '/jsx/curve-types.jsx';
    evalScript('$.evalFile(new File(' + quoteExtendScriptString(path) + ')); "ok";', function (result) {
      var ok = result === 'ok';
      state.hostLoaded = ok;
      state.hostLoading = false;

      while (state.callbacks.length) {
        state.callbacks.shift()(ok);
      }
    });
  }

  function applyCurrentMode() {
    if (!els.applyButton || els.applyButton.classList.contains('is-running')) {
      return;
    }

    setApplyState('is-running');

    loadHost(function (loaded) {
      if (!loaded) {
        flashApplyState('is-error');
        return;
      }

      var payload = getHostPayload();
      var script = 'FlowCurveTypes.apply(' + quoteExtendScriptString(state.mode) + ', ' + quoteExtendScriptString(JSON.stringify(payload)) + ');';
      evalScript(script, function (result) {
        var response = parseHostResult(result);
        flashApplyState(response.ok ? 'is-ok' : 'is-error');
      });
    });
  }

  function readCurrentFourKey() {
    if (!els.readButton) {
      return;
    }

    loadHost(function (loaded) {
      if (!loaded) {
        flashFourKeyReadState(false, 'Could not load the 4-Key host.');
        return;
      }

      evalScript('FlowCurveTypes.readFourKey();', function (result) {
        var response = parseHostResult(result);

        if (!response.ok || !isValidFourKeyParams(response.params)) {
          flashFourKeyReadState(false, response.message || 'Select four consecutive keyframes.');
          return;
        }

        if (state.mode !== 'fourkey') {
          return;
        }

        var historySnapshot = captureGraphSnapshot();
        var fromParams = cloneParams('fourkey');
        state.params.fourkey = cloneParams('fourkey', response.params);
        state.selectedCurvePresetId = '';
        updateValueText();
        startCurveTransition('fourkey', fromParams, 'fourkey', cloneParams('fourkey'));
        renderCurvePresets();
        pushGraphUndoSnapshot(historySnapshot);
        flashFourKeyReadState(true, response.message || 'Read 4-Key values.');
      });
    });
  }

  function isValidFourKeyParams(params) {
    if (!params || !params.segmentA || !params.segmentB ||
        !params.segmentA.p1 || !params.segmentA.p2 ||
        !params.segmentB.p1 || !params.segmentB.p2) {
      return false;
    }

    var values = [
      params.segmentA.p1.x, params.segmentA.p1.y,
      params.segmentA.p2.x, params.segmentA.p2.y,
      params.segmentB.p1.x, params.segmentB.p1.y,
      params.segmentB.p2.x, params.segmentB.p2.y
    ];

    for (var i = 0; i < values.length; i++) {
      if (!isFinite(Number(values[i]))) {
        return false;
      }
    }

    return true;
  }

  function flashFourKeyReadState(ok, message) {
    if (!els.readButton) {
      return;
    }

    if (state.readStateTimer) {
      window.clearTimeout(state.readStateTimer);
    }

    els.readButton.classList.remove('is-ok', 'is-error');
    els.readButton.classList.add(ok ? 'is-ok' : 'is-error');
    els.readButton.setAttribute('data-tooltip', message || (ok ? 'Read 4-Key values.' : 'Could not read 4-Key values.'));

    state.readStateTimer = window.setTimeout(function () {
      state.readStateTimer = null;
      els.readButton.classList.remove('is-ok', 'is-error');
      els.readButton.setAttribute('data-tooltip', state.mode === 'fourkey' ? 'Read 4-Key values' : 'Read values');
    }, 1600);
  }

  function applyCurrentExpression() {
    if (!els.applyButton || els.applyButton.classList.contains('is-running')) {
      return;
    }

    setApplyState('is-running');

    loadHost(function (loaded) {
      if (!loaded) {
        flashApplyState('is-error');
        return;
      }

      var payload = getExpressionPayload();
      var script = 'FlowCurveTypes.applyExpression(' + quoteExtendScriptString(state.mode) + ', ' + quoteExtendScriptString(JSON.stringify(payload)) + ');';
      evalScript(script, function (result) {
        var response = parseHostResult(result);
        flashApplyState(response.ok ? 'is-ok' : 'is-error');
      });
    });
  }

  function getHostPayload() {
    var p = state.params[state.mode];

    if (state.mode === 'bezier') {
      return {
        values: getCurrentBezierValues()
      };
    }

    if (state.mode === 'custom') {
      return {
        points: clonePoints(p.points),
        mode: p.mode,
        bakeResolution: p.bakeResolution,
        isMirrored: p.isMirrored
      };
    }

    if (state.mode === 'fourkey') {
      return cloneParams('fourkey', p);
    }

    if (state.mode === 'elastic') {
      return {
        amplitude: p.amplitude,
        frequency: p.frequency,
        decay: p.decay
      };
    }

    if (state.mode === 'bounce') {
      return {
        bounces: p.bounces,
        stiffness: p.stiffness
      };
    }

    if (state.mode === 'wave') {
      return {
        amplitude: p.amplitude,
        frequency: p.frequency,
        decay: p.decay,
        sharpness: p.sharpness
      };
    }

    return {
      count: p.count,
      position: p.position
    };
  }

  function clonePoints(points) {
    var cloned = [];

    for (var i = 0; i < points.length; i++) {
      cloned.push({
        x: points[i].x,
        y: points[i].y,
        cx1: points[i].cx1,
        cy1: points[i].cy1,
        cx2: points[i].cx2,
        cy2: points[i].cy2
      });
    }

    return cloned;
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

  function setApplyState(stateName) {
    els.applyButton.classList.remove('is-running', 'is-ok', 'is-error');

    if (stateName) {
      els.applyButton.classList.add(stateName);
    }
  }

  function flashApplyState(stateName) {
    setApplyState(stateName);
    window.setTimeout(function () {
      els.applyButton.classList.remove(stateName);
    }, 520);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
