var FlowPrimeTools = FlowPrimeTools || {};

(function () {
  var actionStatus = null;

  function escapeResultText(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  function result(ok, message, code) {
    return '{"ok":' + (ok ? 'true' : 'false') + ',"message":"' + escapeResultText(message || '') + '","code":"' + escapeResultText(code || '') + '"}';
  }

  function setActionStatus(ok, message, code) {
    actionStatus = {
      ok: !!ok,
      message: message || '',
      code: code || ''
    };

    return !!ok;
  }

  function activeComp() {
    var comp = app.project && app.project.activeItem;

    if (!comp || !(comp instanceof CompItem)) {
      throw new Error('Please select an active composition.');
    }

    return comp;
  }

  function selectedLayers(comp) {
    return comp.selectedLayers || [];
  }

  function firstSelectedLayer(comp) {
    var layers = selectedLayers(comp);
    return layers.length ? layers[0] : null;
  }

  function matchLayerTiming(layer, targetLayer, moveBeforeTarget) {
    if (!layer || !targetLayer) {
      return;
    }

    layer.inPoint = targetLayer.inPoint;
    layer.outPoint = targetLayer.outPoint;

    if (moveBeforeTarget !== false) {
      layer.moveBefore(targetLayer);
    }
  }

  function addEffect(layer, matchNames) {
    var effects = layer.property('ADBE Effect Parade');

    if (!effects) {
      return false;
    }

    for (var i = 0; i < matchNames.length; i++) {
      try {
        effects.addProperty(matchNames[i]);
        return true;
      } catch (error) {
      }
    }

    return false;
  }

  function addEffectToSelection(matchNames) {
    var comp = activeComp();
    var layers = selectedLayers(comp);
    var applied = false;

    for (var i = 0; i < layers.length; i++) {
      applied = addEffect(layers[i], matchNames) || applied;
    }

    return applied;
  }

  function normalizeEffectName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function containsAllEffectTerms(value, terms) {
    if (!terms || !terms.length) {
      return false;
    }

    for (var i = 0; i < terms.length; i++) {
      if (value.indexOf(normalizeEffectName(terms[i])) === -1) {
        return false;
      }
    }

    return true;
  }

  function effectNameIsAlias(value, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (value === normalizeEffectName(aliases[i])) {
        return true;
      }
    }

    return false;
  }

  function findInstalledEffect(definition) {
    var catalog = app.effects;

    if (!catalog || typeof catalog.length === 'undefined') {
      return null;
    }

    var best = null;
    var bestScore = -1;

    for (var i = 0; i < catalog.length; i++) {
      var effect = catalog[i];
      if (!effect) {
        continue;
      }

      var displayName = String(effect.displayName || '');
      var matchName = String(effect.matchName || '');
      var displayKey = normalizeEffectName(displayName);
      var matchKey = normalizeEffectName(matchName);
      var combined = displayKey + matchKey;
      var exact = effectNameIsAlias(displayKey, definition.aliases) || effectNameIsAlias(matchKey, definition.aliases);

      if (!exact && !containsAllEffectTerms(combined, definition.terms)) {
        continue;
      }

      var score = exact ? 1000 : 100;
      if (definition.preferVersionTwo) {
        if (displayKey.indexOf('deepglow2') !== -1 || matchKey.indexOf('deepglow2') !== -1) {
          score += 500;
        } else if (/^2(?:\.|$)/.test(String(effect.version || ''))) {
          score += 80;
        }
      }

      if (combined.indexOf('pro') !== -1) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        best = {
          displayName: displayName || definition.label,
          matchName: matchName,
          version: String(effect.version || '')
        };
      }
    }

    return best;
  }

  function applyEffectDefinition(definition) {
    var comp = activeComp();
    var layers = selectedLayers(comp);

    if (!layers.length) {
      return setActionStatus(false, 'Select at least one layer before applying ' + definition.label + '.', 'no-selection');
    }

    var installed = findInstalledEffect(definition);
    var matchNames = [];

    if (installed && installed.matchName) {
      matchNames.push(installed.matchName);
    } else if (app.effects && typeof app.effects.length !== 'undefined') {
      return setActionStatus(false, definition.missingMessage || (definition.label + ' is not installed in After Effects.'), 'missing-effect');
    } else {
      matchNames = definition.aliases;
    }

    var applied = false;
    for (var i = 0; i < layers.length; i++) {
      applied = addEffect(layers[i], matchNames) || applied;
    }

    if (!applied) {
      return setActionStatus(false, definition.missingMessage || (definition.label + ' is not installed or could not be loaded by After Effects.'), 'missing-effect');
    }

    var appliedName = installed && installed.displayName ? installed.displayName : definition.label;
    return setActionStatus(true, appliedName + ' applied.', '');
  }

  function enableTimeRemap() {
    var comp = activeComp();
    var layers = selectedLayers(comp);

    if (!layers.length) {
      return setActionStatus(false, 'Select at least one footage or precomposition layer.', 'no-selection');
    }

    var applied = false;
    for (var i = 0; i < layers.length; i++) {
      try {
        if (layers[i].canSetTimeRemapEnabled) {
          layers[i].timeRemapEnabled = true;
          applied = true;
        }
      } catch (error) {
      }
    }

    if (!applied) {
      return setActionStatus(false, 'Time Remap is not available for the selected layers.', 'unsupported-layer');
    }

    return setActionStatus(true, 'Time Remap enabled.', '');
  }

  function colorFromHex(value) {
    var hex = String(value || '').replace(/^#/, '');

    if (!/^[0-9a-f]{6}$/i.test(hex)) {
      return [1, 1, 1];
    }

    return [
      parseInt(hex.substring(0, 2), 16) / 255,
      parseInt(hex.substring(2, 4), 16) / 255,
      parseInt(hex.substring(4, 6), 16) / 255
    ];
  }

  function freezeFrame() {
    var comp = activeComp();
    var layers = selectedLayers(comp);
    var currentTime = comp.time;
    var applied = false;

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      if (!layer.canSetTimeRemapEnabled || currentTime < layer.inPoint || currentTime > layer.outPoint) {
        continue;
      }

      layer.timeRemapEnabled = true;
      var timeRemap = layer.property('ADBE Time Remapping');

      if (!timeRemap) {
        continue;
      }

      var freezeValue = timeRemap.valueAtTime(currentTime, true);

      while (timeRemap.numKeys > 0) {
        timeRemap.removeKey(1);
      }

      timeRemap.setValueAtTime(layer.inPoint, freezeValue);
      timeRemap.setValueAtTime(Math.max(layer.inPoint, layer.outPoint - comp.frameDuration), freezeValue);

      for (var key = 1; key <= timeRemap.numKeys; key++) {
        timeRemap.setInterpolationTypeAtKey(key, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
      }

      applied = true;
    }

    return applied;
  }

  function fitToComp() {
    var comp = activeComp();

    if (selectedLayers(comp).length === 0) {
      return false;
    }

    app.executeCommand(2732);
    return true;
  }

  function setDashOnStroke(stroke) {
    var dashes = stroke.property('ADBE Vector Stroke Dashes');

    if (!dashes) {
      return false;
    }

    var dash = dashes.property('ADBE Vector Stroke Dash 1');
    var gap = dashes.property('ADBE Vector Stroke Gap 1');

    if (!dash) {
      try {
        dash = dashes.addProperty('ADBE Vector Stroke Dash 1');
      } catch (error) {
      }
    }

    if (!gap) {
      try {
        gap = dashes.addProperty('ADBE Vector Stroke Gap 1');
      } catch (error) {
      }
    }

    if (dash) {
      dash.setValue(18);
    }

    if (gap) {
      gap.setValue(10);
    }

    return !!dash;
  }

  function dashGroup(group) {
    var applied = false;

    if (!group || !group.numProperties) {
      return false;
    }

    for (var i = 1; i <= group.numProperties; i++) {
      var item = group.property(i);

      if (!item) {
        continue;
      }

      if (item.matchName === 'ADBE Vector Graphic - Stroke') {
        applied = setDashOnStroke(item) || applied;
      }

      if (item.matchName === 'ADBE Vector Group') {
        applied = dashGroup(item.property('ADBE Vectors Group')) || applied;
      } else if (item.numProperties) {
        applied = dashGroup(item) || applied;
      }
    }

    return applied;
  }

  function addDashToShapePaths() {
    var comp = activeComp();
    var layers = selectedLayers(comp);
    var applied = false;

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      if (!(layer instanceof ShapeLayer)) {
        continue;
      }

      applied = dashGroup(layer.property('ADBE Root Vectors Group')) || applied;
    }

    return applied;
  }

  function createAdjustmentLayer() {
    var comp = activeComp();
    var target = firstSelectedLayer(comp);
    var layer = comp.layers.addSolid([1, 1, 1], 'Adjustment Layer', comp.width, comp.height, comp.pixelAspect, comp.duration);
    layer.adjustmentLayer = true;
    layer.label = 5;
    layer.startTime = 0;
    matchLayerTiming(layer, target);
    return true;
  }

  function createSolidLayer(colorHex) {
    var comp = activeComp();
    var target = firstSelectedLayer(comp);
    var layer = comp.layers.addSolid(colorFromHex(colorHex), 'Solid Layer', comp.width, comp.height, comp.pixelAspect, comp.duration);
    layer.label = 1;
    layer.startTime = 0;
    matchLayerTiming(layer, target);
    return true;
  }

  function selectionCenterExpression(targets) {
    var layerIndexes = [];

    for (var i = 0; i < targets.length; i++) {
      layerIndexes.push(targets[i].index);
    }

    return [
      'var flowLayerIndexes = [' + layerIndexes.join(',') + '];',
      'var flowMinX = 1e20;',
      'var flowMinY = 1e20;',
      'var flowMaxX = -1e20;',
      'var flowMaxY = -1e20;',
      'function flowIncludePoint(flowPoint) {',
      '  flowMinX = Math.min(flowMinX, flowPoint[0]);',
      '  flowMinY = Math.min(flowMinY, flowPoint[1]);',
      '  flowMaxX = Math.max(flowMaxX, flowPoint[0]);',
      '  flowMaxY = Math.max(flowMaxY, flowPoint[1]);',
      '}',
      'for (var flowIndex = 0; flowIndex < flowLayerIndexes.length; flowIndex++) {',
      '  var flowLayer = thisComp.layer(flowLayerIndexes[flowIndex]);',
      '  try {',
      '    var flowRect = flowLayer.sourceRectAtTime(time, false);',
      '    var flowLeft = flowRect.left;',
      '    var flowTop = flowRect.top;',
      '    var flowRight = flowLeft + flowRect.width;',
      '    var flowBottom = flowTop + flowRect.height;',
      '    flowIncludePoint(flowLayer.toComp([flowLeft, flowTop, 0]));',
      '    flowIncludePoint(flowLayer.toComp([flowRight, flowTop, 0]));',
      '    flowIncludePoint(flowLayer.toComp([flowLeft, flowBottom, 0]));',
      '    flowIncludePoint(flowLayer.toComp([flowRight, flowBottom, 0]));',
      '  } catch (flowBoundsError) {',
      '    try {',
      '      flowIncludePoint(flowLayer.toComp(flowLayer.anchorPoint));',
      '    } catch (flowPointError) {',
      '      flowIncludePoint(flowLayer.toComp([0, 0, 0]));',
      '    }',
      '  }',
      '}',
      'flowMinX < 1e20 ? [(flowMinX + flowMaxX) / 2, (flowMinY + flowMaxY) / 2] : value;'
    ].join('\n');
  }

  function centerNullOnTargets(nullLayer, targets, comp) {
    if (!nullLayer) {
      return;
    }

    var transform = nullLayer.property('ADBE Transform Group');
    var anchor = transform && transform.property('ADBE Anchor Point');
    var position = transform && transform.property('ADBE Position');

    if (anchor) {
      var anchorValue = anchor.value;
      anchor.setValue(anchorValue.length > 2 ? [50, 50, anchorValue[2]] : [50, 50]);
    }

    if (!targets.length || !position || !position.canSetExpression) {
      return;
    }

    var center = null;

    try {
      position.expression = selectionCenterExpression(targets);
      center = position.valueAtTime(comp.time, false);

      if (position.expressionError) {
        center = null;
      }
    } catch (error) {
      center = null;
    } finally {
      try {
        position.expression = '';
      } catch (clearExpressionError) {
      }
    }

    if (!center || center.length < 2 || !isFinite(center[0]) || !isFinite(center[1])) {
      return;
    }

    position.setValue([center[0], center[1]]);
  }

  function createNullObject(placement) {
    var comp = activeComp();
    var targets = selectedLayers(comp);
    var target = firstSelectedLayer(comp);
    var placeAtTop = placement === 'top';
    var layer = comp.layers.addNull(comp.duration);
    layer.name = 'Null';
    layer.label = 1;
    layer.startTime = 0;
    matchLayerTiming(layer, target, !placeAtTop);

    if (placeAtTop && typeof layer.moveToBeginning === 'function') {
      layer.moveToBeginning();
    }

    centerNullOnTargets(layer, targets, comp);

    for (var i = 0; i < targets.length; i++) {
      targets[i].parent = layer;
    }

    return true;
  }

  function createCamera() {
    var comp = activeComp();
    var target = firstSelectedLayer(comp);
    var camera = comp.layers.addCamera('Camera', [comp.width / 2, comp.height / 2]);
    camera.startTime = 0;
    matchLayerTiming(camera, target);
    return true;
  }

  function setAnchorPoint(pos) {
    var comp = activeComp();
    var layers = selectedLayers(comp);

    if (layers.length === 0) {
      return false;
    }

    var applied = false;
    var currentTime = comp.time;

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      if (layer instanceof CameraLayer || layer instanceof LightLayer || layer.nullLayer) {
        continue;
      }

      var transform = layer.property('ADBE Transform Group');
      var anchor = transform && transform.property('ADBE Anchor Point');

      if (!anchor) {
        continue;
      }

      var row = Math.floor((pos - 1) / 3);
      var col = (pos - 1) % 3;
      var masks = layer.property('ADBE Mask Parade');
      var hasMasks = false;
      var maskIndex;

      if (masks && masks.numProperties !== 0) {
        for (maskIndex = 1; maskIndex <= masks.numProperties; maskIndex++) {
          if (masks.property(maskIndex).maskMode !== MaskMode.NONE) {
            hasMasks = true;
            break;
          }
        }
      }

      var x;
      var y;

      if (!hasMasks) {
        var sourceRect = layer.sourceRectAtTime(currentTime, false);

        if (col === 0) {
          x = sourceRect.left;
        } else if (col === 1) {
          x = sourceRect.left + sourceRect.width / 2;
        } else {
          x = sourceRect.left + sourceRect.width;
        }

        if (row === 0) {
          y = sourceRect.top;
        } else if (row === 1) {
          y = sourceRect.top + sourceRect.height / 2;
        } else {
          y = sourceRect.top + sourceRect.height;
        }
      } else {
        var xBounds = [];
        var yBounds = [];

        for (maskIndex = 1; maskIndex <= masks.numProperties; maskIndex++) {
          var mask = masks.property(maskIndex);

          if (mask.maskMode === MaskMode.NONE) {
            continue;
          }

          var maskPath = mask.property('ADBE Mask Shape');
          var vertices = maskPath.valueAtTime(currentTime, false).vertices;

          for (var vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
            xBounds.push(vertices[vertexIndex][0]);
            yBounds.push(vertices[vertexIndex][1]);
          }
        }

        xBounds.sort(function (a, b) {
          return a - b;
        });
        yBounds.sort(function (a, b) {
          return a - b;
        });

        var xLow = xBounds[0];
        var xHigh = xBounds[xBounds.length - 1];
        var yLow = yBounds[0];
        var yHigh = yBounds[yBounds.length - 1];

        if (layer instanceof TextLayer || layer instanceof ShapeLayer) {
          var maskedSourceRect = layer.sourceRectAtTime(currentTime, false);
          var sourceXLow = maskedSourceRect.left;
          var sourceXHigh = sourceXLow + maskedSourceRect.width;
          var sourceYLow = maskedSourceRect.top;
          var sourceYHigh = sourceYLow + maskedSourceRect.height;
          xLow = Math.max(xLow, sourceXLow);
          xHigh = Math.min(xHigh, sourceXHigh);
          yLow = Math.max(yLow, sourceYLow);
          yHigh = Math.min(yHigh, sourceYHigh);
        }

        x = col === 0 ? xLow : (col === 1 ? xLow + (xHigh - xLow) / 2 : xHigh);
        y = row === 0 ? yLow : (row === 1 ? yLow + (yHigh - yLow) / 2 : yHigh);
      }

      var currentAnchor = anchor.value;
      var nextAnchor = currentAnchor.length > 2 ? [x, y, currentAnchor[2]] : [x, y];

      if (anchor.isTimeVarying) {
        anchor.setValueAtTime(currentTime, nextAnchor);
        applied = true;
        continue;
      }

      var scale = transform.property('ADBE Scale');
      var scaleValue = scale.valueAtTime(currentTime, false);
      var xMove = (x - currentAnchor[0]) * (scaleValue[0] / 100);
      var yMove = (y - currentAnchor[1]) * (scaleValue[1] / 100);
      var position = transform.property('ADBE Position');
      var positionExpressionWasEnabled = false;
      var duplicateLayer = null;
      var oldParent = layer.parent;

      if (position.expressionEnabled) {
        position.expressionEnabled = false;
        positionExpressionWasEnabled = true;
      }

      try {
        duplicateLayer = layer.duplicate();
        duplicateLayer.moveToEnd();

        var duplicateScale = duplicateLayer.property('ADBE Transform Group').property('ADBE Scale');
        var unitScale = duplicateScale.value.length > 2 ? [100, 100, 100] : [100, 100];

        if (duplicateScale.isTimeVarying) {
          duplicateScale.setValueAtTime(currentTime, unitScale);
        } else {
          duplicateScale.setValue(unitScale);
        }

        layer.parent = duplicateLayer;
        anchor.setValue(nextAnchor);

        if (position.isTimeVarying) {
          for (var keyIndex = 1; keyIndex <= position.numKeys; keyIndex++) {
            var keyPosition = position.keyValue(keyIndex);
            var nextKeyPosition = [keyPosition[0] + xMove, keyPosition[1] + yMove];

            if (keyPosition.length > 2) {
              nextKeyPosition.push(keyPosition[2]);
            }

            position.setValueAtKey(keyIndex, nextKeyPosition);
          }
        } else {
          var currentPosition = position.value;
          var nextPosition = [currentPosition[0] + xMove, currentPosition[1] + yMove];

          if (currentPosition.length > 2) {
            nextPosition.push(currentPosition[2]);
          }

          position.setValue(nextPosition);
        }

        applied = true;
      } finally {
        layer.parent = oldParent;

        if (positionExpressionWasEnabled) {
          position.expressionEnabled = true;
        }

        if (duplicateLayer) {
          duplicateLayer.remove();
        }
      }
    }

    return applied;
  }

  function projectItemNameExists(name) {
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i).name === name) {
        return true;
      }
    }

    return false;
  }

  function uniqueProjectItemName(baseName) {
    var cleanBase = String(baseName || 'Flow Precomp');
    var name = cleanBase;
    var suffix = 2;

    while (projectItemNameExists(name)) {
      name = cleanBase + ' ' + suffix;
      suffix++;
    }

    return name;
  }

  function deselectAllLayers(comp) {
    for (var i = 1; i <= comp.numLayers; i++) {
      comp.layer(i).selected = false;
    }
  }

  function precomposeSelectedLayers() {
    var comp = activeComp();
    var layers = selectedLayers(comp);

    if (layers.length === 0) {
      return false;
    }

    var indices = [];
    var baseName = layers.length === 1 ? layers[0].name + ' Precomp' : 'Flow Precomp';

    for (var i = 0; i < layers.length; i++) {
      indices.push(layers[i].index);
    }

    indices.sort(function (a, b) {
      return a - b;
    });

    var precomp = comp.layers.precompose(indices, uniqueProjectItemName(baseName), true);

    if (!precomp) {
      return false;
    }

    deselectAllLayers(comp);

    for (var layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
      var layer = comp.layer(layerIndex);

      if (layer.source === precomp) {
        layer.selected = true;
        break;
      }
    }

    return true;
  }

  function propertyHasAnimation(property) {
    return !!property && (property.numKeys > 0 || property.expressionEnabled);
  }

  function valuesNear(a, b) {
    if (a instanceof Array || b instanceof Array) {
      if (!(a instanceof Array) || !(b instanceof Array) || a.length !== b.length) {
        return false;
      }

      for (var i = 0; i < a.length; i++) {
        if (Math.abs(Number(a[i]) - Number(b[i])) > 0.001) {
          return false;
        }
      }

      return true;
    }

    return Math.abs(Number(a) - Number(b)) <= 0.001;
  }

  function copyAnimatedProperty(sourceProperty, targetProperty) {
    if (!sourceProperty || !targetProperty) {
      return;
    }

    try {
      if (targetProperty.canSetExpression) {
        targetProperty.expression = '';
      }
    } catch (expressionClearError) {
    }

    while (targetProperty.numKeys > 0) {
      targetProperty.removeKey(targetProperty.numKeys);
    }

    if (sourceProperty.numKeys > 0) {
      for (var keyIndex = 1; keyIndex <= sourceProperty.numKeys; keyIndex++) {
        targetProperty.setValueAtTime(sourceProperty.keyTime(keyIndex), sourceProperty.keyValue(keyIndex));
      }

      for (var copiedKey = 1; copiedKey <= sourceProperty.numKeys; copiedKey++) {
        try {
          targetProperty.setInterpolationTypeAtKey(copiedKey, sourceProperty.keyInInterpolationType(copiedKey), sourceProperty.keyOutInterpolationType(copiedKey));
        } catch (interpolationError) {
        }

        try {
          targetProperty.setTemporalEaseAtKey(copiedKey, sourceProperty.keyInTemporalEase(copiedKey), sourceProperty.keyOutTemporalEase(copiedKey));
          targetProperty.setTemporalContinuousAtKey(copiedKey, sourceProperty.keyTemporalContinuous(copiedKey));
          targetProperty.setTemporalAutoBezierAtKey(copiedKey, sourceProperty.keyTemporalAutoBezier(copiedKey));
        } catch (temporalError) {
        }

        try {
          targetProperty.setSpatialTangentsAtKey(copiedKey, sourceProperty.keyInSpatialTangent(copiedKey), sourceProperty.keyOutSpatialTangent(copiedKey));
          targetProperty.setSpatialContinuousAtKey(copiedKey, sourceProperty.keySpatialContinuous(copiedKey));
          targetProperty.setSpatialAutoBezierAtKey(copiedKey, sourceProperty.keySpatialAutoBezier(copiedKey));
          targetProperty.setRovingAtKey(copiedKey, sourceProperty.keyRoving(copiedKey));
        } catch (spatialError) {
        }
      }
    } else {
      targetProperty.setValue(sourceProperty.value);
    }

    try {
      if (sourceProperty.canSetExpression && targetProperty.canSetExpression && sourceProperty.expression !== '') {
        targetProperty.expression = sourceProperty.expression;
        targetProperty.expressionEnabled = sourceProperty.expressionEnabled;
      }
    } catch (expressionCopyError) {
    }
  }

  function copyTransform(sourceLayer, targetLayer) {
    var sourceTransform = sourceLayer.property('ADBE Transform Group');
    var targetTransform = targetLayer.property('ADBE Transform Group');
    var sourcePosition = sourceTransform.property('ADBE Position');
    var targetPosition = targetTransform.property('ADBE Position');
    var propertyNames = [
      'ADBE Anchor Point',
      'ADBE Scale',
      'ADBE Orientation',
      'ADBE Rotate X',
      'ADBE Rotate Y',
      'ADBE Rotate Z'
    ];

    if (sourcePosition.dimensionsSeparated) {
      targetPosition.dimensionsSeparated = true;
      copyAnimatedProperty(sourceTransform.property('ADBE Position_0'), targetTransform.property('ADBE Position_0'));
      copyAnimatedProperty(sourceTransform.property('ADBE Position_1'), targetTransform.property('ADBE Position_1'));

      if (sourceTransform.property('ADBE Position_2') && targetTransform.property('ADBE Position_2')) {
        copyAnimatedProperty(sourceTransform.property('ADBE Position_2'), targetTransform.property('ADBE Position_2'));
      }
    } else {
      copyAnimatedProperty(sourcePosition, targetPosition);
    }

    for (var i = 0; i < propertyNames.length; i++) {
      copyAnimatedProperty(sourceTransform.property(propertyNames[i]), targetTransform.property(propertyNames[i]));
    }
  }

  function isIdentityPrecompTransform(layer, source, comp) {
    if (layer.parent || layer.threeDLayer) {
      return false;
    }

    var transform = layer.property('ADBE Transform Group');
    var anchor = transform.property('ADBE Anchor Point');
    var position = transform.property('ADBE Position');
    var scale = transform.property('ADBE Scale');
    var rotation = transform.property('ADBE Rotate Z');

    if (propertyHasAnimation(anchor) || propertyHasAnimation(position) || propertyHasAnimation(scale) || propertyHasAnimation(rotation) || position.dimensionsSeparated) {
      return false;
    }

    return valuesNear(anchor.value, [source.width / 2, source.height / 2]) &&
      valuesNear(position.value, [comp.width / 2, comp.height / 2]) &&
      valuesNear(scale.value, [100, 100]) &&
      valuesNear(rotation.value, 0);
  }

  function validateUnprecompLayer(layer) {
    if (!layer.source || !(layer.source instanceof CompItem)) {
      return;
    }

    if (layer.timeRemapEnabled || Math.abs(layer.stretch - 100) > 0.001) {
      throw new Error('UnPre-Comp does not alter precomps with time remapping or time stretch.');
    }

    var effects = layer.property('ADBE Effect Parade');
    var masks = layer.property('ADBE Mask Parade');
    var opacity = layer.property('ADBE Transform Group').property('ADBE Opacity');

    if ((effects && effects.numProperties > 0) || (masks && masks.numProperties > 0)) {
      throw new Error('Move effects and masks inside the precomp before using UnPre-Comp.');
    }

    if (propertyHasAnimation(opacity) || Math.abs(opacity.value - 100) > 0.001) {
      throw new Error('UnPre-Comp requires the precomp layer opacity to remain at 100%.');
    }

    try {
      if (layer.blendingMode !== BlendingMode.NORMAL || layer.hasTrackMatte) {
        throw new Error('UnPre-Comp requires normal blending and no track matte on the precomp layer.');
      }
    } catch (blendStateError) {
      if (String(blendStateError).indexOf('UnPre-Comp') !== -1) {
        throw blendStateError;
      }
    }
  }

  function createTransformController(comp, outerLayer, firstCopiedLayer) {
    var controller = comp.layers.addNull(comp.duration);
    controller.name = outerLayer.name + ' Controls';
    controller.threeDLayer = outerLayer.threeDLayer;

    var transform = controller.property('ADBE Transform Group');
    var anchor = transform.property('ADBE Anchor Point');
    var position = transform.property('ADBE Position');
    var scale = transform.property('ADBE Scale');

    anchor.setValue(controller.threeDLayer ? [0, 0, 0] : [0, 0]);
    position.setValue(controller.threeDLayer ? [0, 0, 0] : [0, 0]);
    scale.setValue(controller.threeDLayer ? [100, 100, 100] : [100, 100]);
    controller.startTime = outerLayer.inPoint;
    controller.inPoint = outerLayer.inPoint;
    controller.outPoint = outerLayer.outPoint;

    if (firstCopiedLayer) {
      controller.moveBefore(firstCopiedLayer);
    } else {
      controller.moveBefore(outerLayer);
    }

    return controller;
  }

  function unprecomposeLayer(comp, outerLayer, selectedOutputLayers) {
    var sourceComp = outerLayer.source;
    var copiedByIndex = [];
    var records = [];
    var outerStartTime = outerLayer.startTime;
    var outerInPoint = outerLayer.inPoint;
    var outerOutPoint = outerLayer.outPoint;
    var outerParent = outerLayer.parent;
    var needsController = !isIdentityPrecompTransform(outerLayer, sourceComp, comp);

    for (var sourceIndex = 1; sourceIndex <= sourceComp.numLayers; sourceIndex++) {
      var sourceLayer = sourceComp.layer(sourceIndex);
      var sourceParent = sourceLayer.parent;
      var sourceWasLocked = sourceLayer.locked;

      var temporaryLayer = null;
      var copiedLayer = null;

      try {
        if (sourceWasLocked) {
          sourceLayer.locked = false;
        }

        temporaryLayer = sourceLayer.duplicate();
        temporaryLayer.locked = false;
        temporaryLayer.parent = null;
        temporaryLayer.copyToComp(comp);
        copiedLayer = comp.layer(1);
        copiedLayer.moveBefore(outerLayer);
      } finally {
        if (temporaryLayer) {
          temporaryLayer.remove();
        }

        sourceLayer.locked = sourceWasLocked;
      }

      if (!copiedLayer) {
        throw new Error('A layer inside the precomp could not be copied.');
      }

      copiedByIndex[sourceIndex] = copiedLayer;
      records.push({
        layer: copiedLayer,
        parentIndex: sourceParent ? sourceParent.index : 0,
        locked: sourceWasLocked
      });
    }

    var controller = null;

    if (needsController) {
      controller = createTransformController(comp, outerLayer, records.length ? records[0].layer : null);
    }

    for (var recordIndex = 0; recordIndex < records.length; recordIndex++) {
      var record = records[recordIndex];
      var restoredLayer = record.layer;
      var wasLocked = restoredLayer.locked;

      if (wasLocked) {
        restoredLayer.locked = false;
      }

      restoredLayer.startTime += outerStartTime;

      if (restoredLayer.inPoint < outerInPoint) {
        restoredLayer.inPoint = outerInPoint;
      }

      if (restoredLayer.outPoint > outerOutPoint) {
        restoredLayer.outPoint = outerOutPoint;
      }

      if (record.parentIndex > 0 && copiedByIndex[record.parentIndex]) {
        restoredLayer.setParentWithJump(copiedByIndex[record.parentIndex]);
      } else if (controller) {
        restoredLayer.setParentWithJump(controller);
      }

      restoredLayer.locked = record.locked;
      restoredLayer.selected = true;
      selectedOutputLayers.push(restoredLayer);
    }

    if (controller) {
      controller.parent = outerParent;
      copyTransform(outerLayer, controller);
      controller.selected = false;
    }

    if (outerLayer.locked) {
      outerLayer.locked = false;
    }

    outerLayer.remove();
    return true;
  }

  function unprecomposeSelectedLayers() {
    var comp = activeComp();
    var layers = selectedLayers(comp);
    var precompLayers = [];
    var selectedOutputLayers = [];

    for (var i = 0; i < layers.length; i++) {
      if (layers[i].source && layers[i].source instanceof CompItem) {
        precompLayers.push(layers[i]);
      }
    }

    if (precompLayers.length === 0) {
      return false;
    }

    for (var validateIndex = 0; validateIndex < precompLayers.length; validateIndex++) {
      validateUnprecompLayer(precompLayers[validateIndex]);
    }

    precompLayers.sort(function (a, b) {
      return b.index - a.index;
    });

    deselectAllLayers(comp);

    for (var layerIndex = 0; layerIndex < precompLayers.length; layerIndex++) {
      unprecomposeLayer(comp, precompLayers[layerIndex], selectedOutputLayers);
    }

    return selectedOutputLayers.length > 0;
  }

  function scanForMatchingProperties(propertyGroup, targetMatchNames, foundProperties) {
    if (!propertyGroup || !propertyGroup.numProperties) {
      return;
    }

    for (var i = 1; i <= propertyGroup.numProperties; i++) {
      var currentProperty = propertyGroup.property(i);

      if (!currentProperty) {
        continue;
      }

      if (currentProperty.propertyType === PropertyType.PROPERTY) {
        for (var targetIndex = 0; targetIndex < targetMatchNames.length; targetIndex++) {
          if (currentProperty.matchName === targetMatchNames[targetIndex]) {
            foundProperties.push(currentProperty);
            break;
          }
        }
      } else if ((currentProperty.propertyType === PropertyType.INDEXED_GROUP || currentProperty.propertyType === PropertyType.NAMED_GROUP) && currentProperty.numProperties > 0) {
        scanForMatchingProperties(currentProperty, targetMatchNames, foundProperties);
      }
    }
  }

  function deselectPropertiesRecursive(propertyGroup) {
    if (!propertyGroup || !propertyGroup.numProperties) {
      return;
    }

    for (var i = 1; i <= propertyGroup.numProperties; i++) {
      var currentProperty = propertyGroup.property(i);

      if (!currentProperty) {
        continue;
      }

      try {
        currentProperty.selected = false;
      } catch (selectionError) {
      }

      if ((currentProperty.propertyType === PropertyType.INDEXED_GROUP || currentProperty.propertyType === PropertyType.NAMED_GROUP) && currentProperty.numProperties > 0) {
        deselectPropertiesRecursive(currentProperty);
      }
    }
  }

  function selectVectorProperties(mode, altPressed, shiftPressed) {
    var comp = activeComp();
    var selected = selectedLayers(comp);

    if (selected.length === 0) {
      return false;
    }

    var targetLayers = [];
    var targets = [];

    for (var layerIndex = 0; layerIndex < selected.length; layerIndex++) {
      targetLayers.push(selected[layerIndex]);
    }

    if (mode === 'fill') {
      targets = altPressed ? ['ADBE Vector Fill Color', 'ADBE Vector Stroke Color'] : ['ADBE Vector Fill Color'];
    } else if (mode === 'stroke') {
      if (shiftPressed) {
        targets = ['ADBE Vector Stroke Width', 'ADBE Vector Stroke Color'];
      } else if (altPressed) {
        targets = ['ADBE Vector Stroke Width'];
      } else {
        targets = ['ADBE Vector Stroke Color'];
      }
    } else if (mode === 'path') {
      targets = altPressed ? ['ADBE Mask Shape'] : ['ADBE Vector Shape'];
    } else {
      return false;
    }

    deselectAllLayers(comp);

    for (var targetLayerIndex = 0; targetLayerIndex < targetLayers.length; targetLayerIndex++) {
      deselectPropertiesRecursive(targetLayers[targetLayerIndex]);
    }

    var foundProperties = [];

    for (var scanIndex = 0; scanIndex < targetLayers.length; scanIndex++) {
      scanForMatchingProperties(targetLayers[scanIndex], targets, foundProperties);
    }

    var selectionCount = 0;

    for (var propertyIndex = 0; propertyIndex < foundProperties.length; propertyIndex++) {
      try {
        foundProperties[propertyIndex].selected = true;
        selectionCount++;
      } catch (propertySelectionError) {
      }
    }

    return selectionCount > 0;
  }

  function sortLayersForSequence(layers) {
    var sortedLayers = layers.slice(0);

    sortedLayers.sort(function (a, b) {
      return a.index - b.index;
    });

    return sortedLayers;
  }

  function shuffleLayers(groups) {
    for (var i = groups.length - 1; i > 0; i--) {
      var randomIndex = Math.floor(Math.random() * (i + 1));
      var current = groups[i];
      groups[i] = groups[randomIndex];
      groups[randomIndex] = current;
    }
  }

  function randomInteger(min, max) {
    return Math.round(Math.random() * (max - min) + min);
  }

  function layerStartTimeOffset(layer) {
    return layer.inPoint - layer.startTime;
  }

  function layerTimeInFrames(comp, time) {
    return Math.round(time / comp.frameDuration);
  }

  function layerSequenceDifference(comp, layers) {
    if (layers.length <= 1) {
      return true;
    }

    var difference = layerTimeInFrames(comp, layers[1].inPoint) - layerTimeInFrames(comp, layers[0].inPoint);

    for (var i = 1; i < layers.length - 1; i++) {
      var nextDifference = layerTimeInFrames(comp, layers[i + 1].inPoint) - layerTimeInFrames(comp, layers[i].inPoint);

      if (nextDifference !== difference) {
        return false;
      }
    }

    return difference;
  }

  function layersAreInSequence(comp, layers, step, withStep) {
    var firstInPoint = layerTimeInFrames(comp, layers[0].inPoint);
    var groupCount;

    if (!withStep) {
      groupCount = Math.min(step, layers.length);
    } else {
      groupCount = Math.ceil(layers.length / step);

      for (var firstInGroup = step; firstInGroup < layers.length; firstInGroup += step) {
        if (layerTimeInFrames(comp, layers[firstInGroup].inPoint) !== firstInPoint) {
          return false;
        }
      }
    }

    var previousDifference;

    for (var groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      var groupLayers = [];

      if (!withStep) {
        if (layerTimeInFrames(comp, layers[groupIndex].inPoint) !== firstInPoint) {
          return false;
        }

        for (var staggeredIndex = groupIndex; staggeredIndex < layers.length; staggeredIndex += step) {
          groupLayers.push(layers[staggeredIndex]);
        }
      } else {
        groupLayers = layers.slice(groupIndex * step, Math.min(groupIndex * step + step, layers.length));
      }

      var currentDifference = layerSequenceDifference(comp, groupLayers);

      if (currentDifference === false) {
        return false;
      }

      if (typeof previousDifference === 'undefined') {
        previousDifference = currentDifference;
      } else if (currentDifference !== true && previousDifference !== currentDifference) {
        return false;
      }
    }

    return true;
  }

  function leftmostLayerTime(layers) {
    var time = layers[0].inPoint;

    for (var i = 1; i < layers.length; i++) {
      if (layers[i].inPoint < time) {
        time = layers[i].inPoint;
      }
    }

    return time;
  }

  function setLayerStartTime(layer, time) {
    var wasLocked = layer.locked;

    try {
      if (wasLocked) {
        layer.locked = false;
      }

      layer.startTime = time;
    } finally {
      layer.locked = wasLocked;
    }
  }

  function sequenceSelectedLayers(num, order, step, withStep) {
    var comp = activeComp();
    var layers = selectedLayers(comp);

    if (layers.length < 2) {
      return false;
    }

    num = Math.max(1, Math.round(Number(num)));
    step = Math.max(1, Math.round(Number(step)));
    withStep = !!withStep;

    if (isNaN(num)) {
      num = 1;
    }

    if (isNaN(step)) {
      step = 1;
    }

    var sortedLayers = sortLayersForSequence(layers);
    step = Math.min(step, sortedLayers.length);

    if (order === 'align_order') {
      for (var alignIndex = 0; alignIndex < sortedLayers.length; alignIndex++) {
        setLayerStartTime(sortedLayers[alignIndex], comp.time - layerStartTimeOffset(sortedLayers[alignIndex]));
      }

      return true;
    }

    if (order === 'upward_order') {
      sortedLayers.reverse();
    }

    if (order === 'downward_order' || order === 'upward_order') {
      var firstInPoint = sortedLayers[0].inPoint;
      var alreadySequenced = layersAreInSequence(comp, sortedLayers, step, withStep);

      for (var sequenceIndex = 0; sequenceIndex < sortedLayers.length; sequenceIndex++) {
        var layer = sortedLayers[sequenceIndex];
        var offsetMultiplier = withStep ? Math.floor(sequenceIndex % step) : Math.floor(sequenceIndex / step);
        var baseTime = alreadySequenced === false ? firstInPoint : layer.inPoint;
        setLayerStartTime(layer, baseTime - layerStartTimeOffset(layer) + offsetMultiplier * num * comp.frameDuration);
      }

      return true;
    }

    if (order === 'random_order') {
      var groups = [];

      for (var groupStart = 0; groupStart < sortedLayers.length; groupStart += step) {
        groups.push(sortedLayers.slice(groupStart, Math.min(groupStart + step, sortedLayers.length)));
      }

      shuffleLayers(groups);
      var firstTime = leftmostLayerTime(sortedLayers);
      var zeroGroup = randomInteger(0, groups.length - 1);

      for (var randomGroupIndex = 0; randomGroupIndex < groups.length; randomGroupIndex++) {
        var randomOffset = withStep ? randomInteger(0, num) : randomInteger(-Math.ceil(num / 2), Math.ceil(num / 2));

        if (withStep && randomGroupIndex === zeroGroup) {
          randomOffset = 0;
        }

        for (var memberIndex = 0; memberIndex < groups[randomGroupIndex].length; memberIndex++) {
          var randomLayer = groups[randomGroupIndex][memberIndex];
          var randomBaseTime = withStep ? firstTime : randomLayer.inPoint;
          setLayerStartTime(randomLayer, randomBaseTime - layerStartTimeOffset(randomLayer) + randomOffset * comp.frameDuration);
        }
      }

      return true;
    }

    return false;
  }
  var actions = {
    PRE: precomposeSelectedLayers,
    UNP: unprecomposeSelectedLayers,
    FRZ: freezeFrame,
    FIT: fitToComp,
    DSH: addDashToShapePaths,
    ADJ: createAdjustmentLayer,
    MIR: function () {
      return addEffectToSelection(['ADBE Mirror']);
    },
    SOL: createSolidLayer,
    SHA: function () {
      return addEffectToSelection(['ADBE Drop Shadow', 'ADBE Radial Shadow']);
    },
    NUL: function (placement) {
      return createNullObject(placement);
    },
    CAM: createCamera,
    HUE: function () {
      return addEffectToSelection(['ADBE HUE SATURATION']);
    },
    FILL: function () {
      return addEffectToSelection(['ADBE Fill']);
    },
    TINT: function () {
      return addEffectToSelection(['ADBE Tint']);
    },
    BLUR: function () {
      return addEffectToSelection(['ADBE Gaussian Blur 2', 'ADBE Box Blur2', 'ADBE Fast Blur']);
    },
    LUM: function () {
      return addEffectToSelection(['ADBE Lumetri']);
    },
    CURV: function () {
      return addEffectToSelection(['ADBE CurvesCustom', 'ADBE Curves']);
    },
    TWX: function () {
      return applyEffectDefinition({
        label: 'Twixtor Pro',
        aliases: ['Twixtor Pro', 'TwixtorPro', 'RE:Vision Twixtor Pro', 'RVE Twixtor Pro'],
        terms: ['twixtor', 'pro'],
        missingMessage: 'Twixtor Pro was not found. Install or enable the Twixtor Pro plug-in, restart After Effects, and try again.'
      });
    },
    DGL: function () {
      return applyEffectDefinition({
        label: 'Deep Glow',
        aliases: ['Deep Glow 2', 'DeepGlow2', 'Deep Glow', 'DeepGlow'],
        terms: ['deep', 'glow'],
        preferVersionTwo: true,
        missingMessage: 'Deep Glow 1 or Deep Glow 2 was not found. Install or enable either version, restart After Effects, and try again.'
      });
    },
    TMR: enableTimeRemap,
    OFL: function () {
      return applyEffectDefinition({
        label: 'Optical Flares',
        aliases: ['VIDEOCOPILOT OpticalFlares', 'Video Copilot Optical Flares', 'Optical Flares', 'OpticalFlares'],
        terms: ['optical', 'flare'],
        missingMessage: 'Optical Flares was not found. Install or enable the Video Copilot plug-in, restart After Effects, and try again.'
      });
    },
    EXP: function () {
      return applyEffectDefinition({
        label: 'Exposure',
        aliases: ['ADBE Exposure2'],
        terms: ['adbe', 'exposure2'],
        missingMessage: 'The Exposure effect was not found in this After Effects installation.'
      });
    },
    HLF: function () {
      return applyEffectDefinition({
        label: 'S_Halftone',
        aliases: ['S_Halftone', 'S Halftone', 'Sapphire S_Halftone'],
        terms: ['shalftone'],
        missingMessage: 'S_Halftone was not found. Install or enable Boris FX Sapphire, restart After Effects, and try again.'
      });
    },
    GRN: function () {
      return applyEffectDefinition({
        label: 'S_Grain',
        aliases: ['S_Grain', 'S Grain', 'Sapphire S_Grain'],
        terms: ['sgrain'],
        missingMessage: 'S_Grain was not found. Install or enable Boris FX Sapphire, restart After Effects, and try again.'
      });
    },
    BNW: function () {
      return applyEffectDefinition({
        label: 'Black & White',
        aliases: ['ADBE Black&White'],
        terms: ['adbe', 'blackwhite'],
        missingMessage: 'The Black & White effect was not found in this After Effects installation.'
      });
    },
    UNM: function () {
      return applyEffectDefinition({
        label: 'Unmult',
        aliases: ['uni.Unmult', 'Universe Unmult', 'Unmult'],
        terms: ['unmult'],
        missingMessage: 'Unmult was not found. Install or enable Red Giant Universe, restart After Effects, and try again.'
      });
    },
    INV: function () {
      return applyEffectDefinition({
        label: 'Invert',
        aliases: ['ADBE Invert', 'Invert'],
        terms: ['invert'],
        missingMessage: 'The Invert effect was not found in this After Effects installation.'
      });
    },
    LKS: function () {
      return applyEffectDefinition({
        label: 'Magic Bullet Looks',
        aliases: ['Magic Bullet Looks', 'RG Magic Bullet Looks', 'Looks'],
        terms: ['magic', 'bullet', 'looks'],
        missingMessage: 'Magic Bullet Looks was not found. Install or enable Red Giant Magic Bullet, restart After Effects, and try again.'
      });
    },
    KEY: function () {
      return applyEffectDefinition({
        label: 'Keylight',
        aliases: ['Keylight 906', 'Keylight'],
        terms: ['keylight'],
        missingMessage: 'The Keylight effect was not found in this After Effects installation.'
      });
    },
    TRN: function () {
      return applyEffectDefinition({
        label: 'Transform',
        aliases: ['ADBE Geometry2', 'Transform'],
        terms: ['adbe', 'geometry2'],
        missingMessage: 'The Transform effect was not found in this After Effects installation.'
      });
    },
    BMC: function () {
      return applyEffectDefinition({
        label: 'S_BlurMoCurves',
        aliases: ['S_BlurMoCurves', 'S_BlurMoCurve', 'S BlurMoCurves', 'Sapphire S_BlurMoCurves'],
        terms: ['sblurmocurve'],
        missingMessage: 'S_BlurMoCurves was not found. Install or enable Boris FX Sapphire, restart After Effects, and try again.'
      });
    },
    TUR: function () {
      return applyEffectDefinition({
        label: 'Turbulent Displace',
        aliases: ['ADBE Turbulent Displace', 'Turbulent Displace'],
        terms: ['turbulent', 'displace'],
        missingMessage: 'The Turbulent Displace effect was not found in this After Effects installation.'
      });
    },
    FLK: function () {
      return applyEffectDefinition({
        label: 'S_Flicker',
        aliases: ['S_Flicker', 'S Flicker', 'Sapphire S_Flicker'],
        terms: ['sflicker'],
        missingMessage: 'S_Flicker was not found. Install or enable Boris FX Sapphire, restart After Effects, and try again.'
      });
    },
    RSMB: function () {
      return applyEffectDefinition({
        label: 'RSMB',
        aliases: ['RSMB', 'ReelSmart Motion Blur', 'RE:Vision RSMB'],
        terms: ['rsmb'],
        missingMessage: 'RSMB was not found. Install or enable RE:Vision Effects ReelSmart Motion Blur, restart After Effects, and try again.'
      });
    },
    HEAT: function () {
      return applyEffectDefinition({
        label: 'uni.Heatwave',
        aliases: ['uni.Heatwave', 'uni Heatwave', 'Universe Heatwave', 'Heatwave'],
        terms: ['heatwave'],
        missingMessage: 'uni.Heatwave was not found. Install or enable Red Giant Universe, restart After Effects, and try again.'
      });
    },
    BCC: function () {
      return applyEffectDefinition({
        label: 'BCC Ripple',
        aliases: ['BCC Ripple', 'BCCRipple'],
        terms: ['bcc', 'ripple'],
        missingMessage: 'BCC Ripple was not found. Install or enable Boris FX Continuum, restart After Effects, and try again.'
      });
    },
    LSW: function () {
      return applyEffectDefinition({
        label: 'CC Light Sweep',
        aliases: ['CC Light Sweep', 'CCLightSweep'],
        terms: ['cclightsweep'],
        missingMessage: 'The CC Light Sweep effect was not found in this After Effects installation.'
      });
    },
    SHK: function () {
      return applyEffectDefinition({
        label: 'S_Shake',
        aliases: ['S_Shake', 'S Shake', 'Sapphire S_Shake'],
        terms: ['sshake'],
        missingMessage: 'S_Shake was not found. Install or enable Boris FX Sapphire, restart After Effects, and try again.'
      });
    }
  };

  FlowPrimeTools.run = function (toolName, toolArgument) {
    toolName = String(toolName || '').toUpperCase();

    if (!actions[toolName]) {
      return result(false, 'Unknown tool: ' + toolName);
    }

    actionStatus = null;
    app.beginUndoGroup('PrimeTools ' + toolName);

    try {
      var applied = actions[toolName](toolArgument);

      if (actionStatus) {
        return result(actionStatus.ok, actionStatus.message, actionStatus.code);
      }

      return result(!!applied, applied ? toolName + ' applied.' : toolName + ' could not be applied to the current selection.');
    } catch (error) {
      return result(false, error.toString() + (error.line ? ' on line ' + error.line : ''));
    } finally {
      app.endUndoGroup();
    }
  };

  FlowPrimeTools.selectVectorProperties = function (mode, altPressed, shiftPressed) {
    app.beginUndoGroup('PrimeTools Select ' + mode);

    try {
      var applied = selectVectorProperties(String(mode || '').toLowerCase(), !!altPressed, !!shiftPressed);
      return result(!!applied, applied ? 'Properties selected.' : 'No matching properties were found.');
    } catch (error) {
      return result(false, error.toString() + (error.line ? ' on line ' + error.line : ''));
    } finally {
      app.endUndoGroup();
    }
  };

  FlowPrimeTools.sequenceLayers = function (num, order, step, withStep) {
    app.beginUndoGroup('PrimeTools Sequence Layers');

    try {
      var applied = sequenceSelectedLayers(num, String(order || '').toLowerCase(), step, withStep);
      return result(!!applied, applied ? 'Layers sequenced.' : 'Select at least two layers.');
    } catch (error) {
      return result(false, error.toString() + (error.line ? ' on line ' + error.line : ''));
    } finally {
      app.endUndoGroup();
    }
  };

  FlowPrimeTools.setAnchorPoint = function (pos) {
    pos = Math.round(Number(pos));

    if (pos < 1 || pos > 9) {
      return result(false, 'Anchor position must be between 1 and 9.');
    }

    app.beginUndoGroup('PrimeTools Set Anchor Point');

    try {
      var applied = setAnchorPoint(pos);
      return result(!!applied, applied ? 'Anchor point updated.' : 'Select at least one supported layer.');
    } catch (error) {
      return result(false, error.toString() + (error.line ? ' on line ' + error.line : ''));
    } finally {
      app.endUndoGroup();
    }
  };
})();
