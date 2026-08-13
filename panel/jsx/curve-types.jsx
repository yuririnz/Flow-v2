var FlowCurveTypes = FlowCurveTypes || {};

(function (api) {
    function result(ok, message, count) {
        return JSON.stringify({
            ok: ok,
            message: message || "",
            count: count || 0
        });
    }

    api.apply = function (mode, jsonParams) {
        var params = {};

        try {
            params = JSON.parse(jsonParams || "{}");
        } catch (parseError) {
            return result(false, "Invalid curve parameters.", 0);
        }

        app.beginUndoGroup("Flow: Apply " + mode + " Curve");

        try {
            var count = 0;

            if (mode === "fourkey") {
                count = applyFourKey(params);
            } else if (mode === "steps") {
                count = applySteps(params);
            } else {
                count = applyExpressionCurve(mode, params);
            }

            app.endUndoGroup();

            if (count < 1) {
                return result(false, mode === "fourkey"
                    ? "Select at least three consecutive keyframes."
                    : "Select a property with at least two keyframes.", 0);
            }

            return result(true, "Applied " + mode + " curve.", count);
        } catch (error) {
            app.endUndoGroup();
            return result(false, error.toString(), 0);
        }
    };

    api.applyExpression = function (mode, jsonParams) {
        var params = {};

        try {
            params = JSON.parse(jsonParams || "{}");
        } catch (parseError) {
            return result(false, "Invalid expression parameters.", 0);
        }

        app.beginUndoGroup("Flow: Apply " + mode + " Expression");

        try {
            var count = applyExpressionCurve(mode, params);

            app.endUndoGroup();

            if (count < 1) {
                return result(false, "Select a property with at least two keyframes.", 0);
            }

            return result(true, "Applied " + mode + " expression.", count);
        } catch (error) {
            app.endUndoGroup();
            return result(false, error.toString(), 0);
        }
    };

    api.readFourKey = function () {
        try {
            var params = readFourKeySelection();

            if (!params) {
                return JSON.stringify({
                    ok: false,
                    message: "Select four consecutive keyframes.",
                    count: 0
                });
            }

            return JSON.stringify({
                ok: true,
                message: "Read 4-Key values.",
                count: 1,
                params: params
            });
        } catch (error) {
            return result(false, error.toString(), 0);
        }
    };

    function getComp() {
        var comp = app.project.activeItem;

        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("No active composition.");
        }

        return comp;
    }

    function collectTargets() {
        var comp = getComp();
        var targets = [];
        var selectedProps = comp.selectedProperties;

        if (selectedProps && selectedProps.length > 0) {
            for (var i = 0; i < selectedProps.length; i++) {
                collectFromProperty(selectedProps[i], targets, true);
            }
        } else {
            var layers = comp.selectedLayers;

            for (var j = 0; j < layers.length; j++) {
                collectFromProperty(layers[j], targets, false);
            }
        }

        return targets;
    }

    function collectFromProperty(propGroup, targets, allowAllKeys) {
        if (!propGroup) {
            return;
        }

        if (propGroup.propertyType === PropertyType.PROPERTY) {
            addTarget(propGroup, targets, allowAllKeys);
            return;
        }

        if (!propGroup.numProperties) {
            return;
        }

        for (var i = 1; i <= propGroup.numProperties; i++) {
            collectFromProperty(propGroup.property(i), targets, allowAllKeys);
        }
    }

    function addTarget(prop, targets, allowAllKeys) {
        if (!prop || !prop.numKeys || prop.numKeys < 2) {
            return;
        }

        var range = getKeyRange(prop, allowAllKeys);

        if (!range) {
            return;
        }

        targets.push({
            prop: prop,
            start: range.start,
            end: range.end
        });
    }

    function getKeyRange(prop, allowAllKeys) {
        var first = -1;
        var last = -1;

        for (var i = 1; i <= prop.numKeys; i++) {
            if (prop.keySelected(i)) {
                if (first === -1) {
                    first = i;
                }

                last = i;
            }
        }

        if (first !== -1 && first !== last) {
            return {
                start: first,
                end: last
            };
        }

        if (first !== -1) {
            if (first < prop.numKeys) {
                return {
                    start: first,
                    end: first + 1
                };
            }

            return {
                start: first - 1,
                end: first
            };
        }

        if (allowAllKeys) {
            return {
                start: 1,
                end: prop.numKeys
            };
        }

        return null;
    }

    function applyFourKey(params) {
        var targets = collectFourKeyTargets(3);
        var segmentA = getFourKeyEase(params.segmentA, false);
        var segmentB = getFourKeyEase(params.segmentB, true);
        var count = 0;

        for (var i = 0; i < targets.length; i++) {
            var run = targets[i].keys;
            var segmentCount = run.length - 1;
            var splitIndex = Math.max(1, Math.floor(segmentCount / 2));

            for (var segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                applyFourKeyEaseToPair(
                    targets[i].prop,
                    run[segmentIndex],
                    run[segmentIndex + 1],
                    segmentIndex < splitIndex ? segmentA : segmentB
                );
            }

            count++;
        }

        return count;
    }

    function collectFourKeyTargets(minimumKeys) {
        var comp = getComp();
        var targets = [];
        var selectedProps = comp.selectedProperties;
        var i;

        if (selectedProps && selectedProps.length) {
            for (i = 0; i < selectedProps.length; i++) {
                collectFourKeyFromProperty(selectedProps[i], targets, minimumKeys);
            }
            return targets;
        }

        var layers = comp.selectedLayers;

        for (i = 0; i < layers.length; i++) {
            var layerProps = layers[i].selectedProperties;

            for (var j = 0; layerProps && j < layerProps.length; j++) {
                collectFourKeyFromProperty(layerProps[j], targets, minimumKeys);
            }
        }

        return targets;
    }

    function collectFourKeyFromProperty(prop, targets, minimumKeys) {
        if (!prop) {
            return;
        }

        if (prop.propertyType !== PropertyType.PROPERTY) {
            for (var i = 1; i <= (prop.numProperties || 0); i++) {
                collectFourKeyFromProperty(prop.property(i), targets, minimumKeys);
            }
            return;
        }

        if (!prop.numKeys || prop.numKeys < minimumKeys ||
            prop.propertyValueType === PropertyValueType.CUSTOM_VALUE) {
            return;
        }

        var run = getSelectedConsecutiveRun(prop);

        if (run.length < minimumKeys) {
            return;
        }

        for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
            if (targets[targetIndex].prop === prop) {
                return;
            }
        }

        targets.push({
            prop: prop,
            keys: run
        });
    }

    function getSelectedConsecutiveRun(prop) {
        var keys = [];

        for (var i = 1; i <= prop.numKeys; i++) {
            try {
                if (prop.keySelected(i)) {
                    keys.push(i);
                }
            } catch (error) {}
        }

        if (!keys.length) {
            return [];
        }

        var bestStart = 0;
        var bestLength = 1;
        var currentStart = 0;
        var currentLength = 1;

        for (i = 1; i < keys.length; i++) {
            if (keys[i] === keys[i - 1] + 1) {
                currentLength++;
            } else {
                if (currentLength > bestLength) {
                    bestStart = currentStart;
                    bestLength = currentLength;
                }
                currentStart = i;
                currentLength = 1;
            }
        }

        if (currentLength > bestLength) {
            bestStart = currentStart;
            bestLength = currentLength;
        }

        return keys.slice(bestStart, bestStart + bestLength);
    }

    function getFourKeyEase(segment, descending) {
        segment = segment || {};
        var p1 = segment.p1 || {};
        var p2 = segment.p2 || {};
        var x1 = clampNumber(Number(p1.x), 0, 1, 0.42);
        var x2 = clampNumber(Number(p2.x), 0, 1, 0.58);
        var y1 = numberOr(Number(p1.y), descending ? 1 : 0);
        var y2 = numberOr(Number(p2.y), descending ? 0 : 1);

        if (descending) {
            y1 = 1 - y1;
            y2 = 1 - y2;
        }

        var outgoingX = Math.max(x1, 0.01);
        var incomingX = Math.max(1 - x2, 0.01);

        return {
            influenceIn: clampNumber(incomingX * 100, 1, 100, 42),
            speedIn: clampSignedSlope((1 - y2) / incomingX),
            influenceOut: clampNumber(outgoingX * 100, 1, 100, 42),
            speedOut: clampSignedSlope(y1 / outgoingX)
        };
    }

    function numberOr(value, fallback) {
        return isNaN(value) ? fallback : value;
    }

    function clampNumber(value, min, max, fallback) {
        value = numberOr(value, fallback);
        return Math.max(min, Math.min(max, value));
    }

    function clampSignedSlope(value) {
        var sign = value < 0 ? -1 : 1;
        return sign * Math.min(95, Math.max(0.001, Math.abs(value)));
    }

    function applyFourKeyEaseToPair(prop, leftIndex, rightIndex, ease) {
        var leftInCurrent = prop.keyInTemporalEase(leftIndex);
        var leftOutCurrent = prop.keyOutTemporalEase(leftIndex);
        var rightInCurrent = prop.keyInTemporalEase(rightIndex);
        var rightOutCurrent = prop.keyOutTemporalEase(rightIndex);
        var dimensions = Math.max(
            leftInCurrent ? leftInCurrent.length : 0,
            leftOutCurrent ? leftOutCurrent.length : 0,
            rightInCurrent ? rightInCurrent.length : 0,
            rightOutCurrent ? rightOutCurrent.length : 0
        );

        if (dimensions < 1) {
            var leftValue = prop.keyValue(leftIndex);
            dimensions = leftValue instanceof Array ? leftValue.length : 1;
        }

        var leftEaseIn = [];
        var leftEaseOut = [];
        var rightEaseIn = [];
        var rightEaseOut = [];

        for (var dimension = 0; dimension < dimensions; dimension++) {
            var leftIn = getExistingFourKeyEase(leftInCurrent, dimension, ease.influenceIn);
            var rightOut = getExistingFourKeyEase(rightOutCurrent, dimension, ease.influenceOut);

            leftEaseIn.push(new KeyframeEase(leftIn.speed, leftIn.influence));
            leftEaseOut.push(new KeyframeEase(
                getFourKeySegmentSpeed(prop, leftIndex, rightIndex, dimension, ease.speedOut),
                ease.influenceOut
            ));
            rightEaseIn.push(new KeyframeEase(
                getFourKeySegmentSpeed(prop, leftIndex, rightIndex, dimension, ease.speedIn),
                ease.influenceIn
            ));
            rightEaseOut.push(new KeyframeEase(rightOut.speed, rightOut.influence));
        }

        try { prop.setTemporalAutoBezierAtKey(leftIndex, false); } catch (autoLeftError) {}
        try { prop.setTemporalContinuousAtKey(leftIndex, false); } catch (continuousLeftError) {}
        try { prop.setTemporalAutoBezierAtKey(rightIndex, false); } catch (autoRightError) {}
        try { prop.setTemporalContinuousAtKey(rightIndex, false); } catch (continuousRightError) {}

        prop.setTemporalEaseAtKey(leftIndex, leftEaseIn, leftEaseOut);
        prop.setTemporalEaseAtKey(rightIndex, rightEaseIn, rightEaseOut);
        prop.setInterpolationTypeAtKey(leftIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        prop.setInterpolationTypeAtKey(rightIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    }

    function getExistingFourKeyEase(eases, dimension, fallbackInfluence) {
        if (eases && eases.length > dimension) {
            return {
                speed: eases[dimension].speed,
                influence: eases[dimension].influence
            };
        }

        return {
            speed: 0.001,
            influence: fallbackInfluence
        };
    }

    function getFourKeySegmentSpeed(prop, fromIndex, toIndex, dimension, normalizedSlope) {
        var duration = Math.max(0.0001, Math.abs(prop.keyTime(toIndex) - prop.keyTime(fromIndex)));
        var fromValue = prop.keyValue(fromIndex);
        var toValue = prop.keyValue(toIndex);
        var a = fromValue instanceof Array ? fromValue[dimension] : fromValue;
        var b = toValue instanceof Array ? toValue[dimension] : toValue;
        var speed = ((b - a) / duration) * clampSignedSlope(normalizedSlope);

        if (Math.abs(speed) < 0.001) {
            return speed < 0 ? -0.001 : 0.001;
        }

        return speed;
    }

    function readFourKeySelection() {
        var targets = collectFourKeyTargets(4);

        for (var i = 0; i < targets.length; i++) {
            var run = targets[i].keys;
            var segmentA = readFourKeySegment(targets[i].prop, run[0], run[1]);
            var segmentB = readFourKeySegment(targets[i].prop, run[2], run[3]);

            if (!segmentA || !segmentB) {
                continue;
            }

            segmentB.p1.y = 1 - segmentB.p1.y;
            segmentB.p2.y = 1 - segmentB.p2.y;

            return {
                segmentA: segmentA,
                segmentB: segmentB
            };
        }

        return null;
    }

    function readFourKeySegment(prop, leftIndex, rightIndex) {
        try {
            var outgoing = prop.keyOutTemporalEase(leftIndex);
            var incoming = prop.keyInTemporalEase(rightIndex);

            if (!outgoing || !outgoing.length || !incoming || !incoming.length) {
                return null;
            }

            var x1 = clampNumber(outgoing[0].influence / 100, 0, 1, 0.42);
            var x2 = 1 - clampNumber(incoming[0].influence / 100, 0, 1, 0.42);
            var duration = Math.max(0.0001, Math.abs(prop.keyTime(rightIndex) - prop.keyTime(leftIndex)));
            var leftValue = prop.keyValue(leftIndex);
            var rightValue = prop.keyValue(rightIndex);
            var a = leftValue instanceof Array ? leftValue[0] : leftValue;
            var b = rightValue instanceof Array ? rightValue[0] : rightValue;
            var linearSpeed = Math.abs(b - a) < 0.000001 ? 0 : (b - a) / duration;
            var outgoingSlope = linearSpeed === 0 ? 1 : outgoing[0].speed / linearSpeed;
            var incomingSlope = linearSpeed === 0 ? 1 : incoming[0].speed / linearSpeed;

            outgoingSlope = ensureSignedMinimum(outgoingSlope, 0.01);
            incomingSlope = ensureSignedMinimum(incomingSlope, 0.01);

            return {
                p1: { x: x1, y: outgoingSlope * x1 },
                p2: { x: x2, y: 1 - incomingSlope * (1 - x2) }
            };
        } catch (error) {
            return null;
        }
    }

    function ensureSignedMinimum(value, minimum) {
        if (Math.abs(value) >= minimum) {
            return value;
        }

        return value < 0 ? -minimum : minimum;
    }

    function applyExpressionCurve(mode, params) {
        var targets = collectTargets();
        var count = 0;

        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];
            var prop = target.prop;

            if (!prop.canSetExpression) {
                continue;
            }

            if (prop.propertyValueType === PropertyValueType.CUSTOM_VALUE) {
                continue;
            }

            prop.expression = buildExpression(mode, params, target.start, target.end);
            count++;
        }

        return count;
    }

    function applySteps(params) {
        var targets = collectTargets();
        var count = 0;
        var steps = Math.max(2, Math.round(Number(params.count) || 6));
        var position = params.position || "end";

        for (var i = 0; i < targets.length; i++) {
            count += applyStepsToProperty(targets[i].prop, targets[i].start, targets[i].end, steps, position);
        }

        return count;
    }

    function applyStepsToProperty(prop, startIndex, endIndex, steps, position) {
        if (prop.propertyValueType === PropertyValueType.CUSTOM_VALUE || startIndex >= endIndex) {
            return 0;
        }

        var t1 = prop.keyTime(startIndex);
        var t2 = prop.keyTime(endIndex);
        var v1 = prop.keyValue(startIndex);
        var v2 = prop.keyValue(endIndex);
        var duration = t2 - t1;

        if (duration <= 0) {
            return 0;
        }

        for (var k = endIndex - 1; k > startIndex; k--) {
            prop.removeKey(k);
        }

        prop.setInterpolationTypeAtKey(startIndex, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);

        for (var s = 1; s < steps; s++) {
            var fraction;
            var valFraction = s / steps;

            if (position === "both") {
                fraction = (s - 0.5) / steps;
            } else {
                fraction = s / steps;
            }

            var keyIndex = prop.addKey(t1 + duration * fraction);
            prop.setValueAtKey(keyIndex, blendValue(v1, v2, valFraction));
            prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }

        var finalIndex = startIndex + steps;

        if (finalIndex <= prop.numKeys) {
            prop.setInterpolationTypeAtKey(finalIndex, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }

        return steps - 1;
    }

    function blendValue(v1, v2, amount) {
        if (v1 instanceof Array && v2 instanceof Array) {
            var out = [];

            for (var i = 0; i < v1.length; i++) {
                out.push(v1[i] + (v2[i] - v1[i]) * amount);
            }

            return out;
        }

        if (typeof v1 === "number" && typeof v2 === "number") {
            return v1 + (v2 - v1) * amount;
        }

        return amount < 1 ? v1 : v2;
    }

    function num(value, fallback) {
        var parsed = Number(value);

        if (isNaN(parsed)) {
            parsed = fallback || 0;
        }

        return parsed.toFixed(4);
    }

    function buildExpression(mode, params, startIndex, endIndex) {
        return [
            "// Flow curve type: " + mode,
            "var i1 = " + startIndex + ";",
            "var i2 = " + endIndex + ";",
            buildCurveFunction(mode, params),
            "function mix(a, b, k) {",
            "  if (a instanceof Array && b instanceof Array) {",
            "    var r = [];",
            "    for (var i = 0; i < a.length; i++) r.push(a[i] + (b[i] - a[i]) * k);",
            "    return r;",
            "  }",
            "  return a + (b - a) * k;",
            "}",
            "if (numKeys < i2) {",
            "  value;",
            "} else {",
            "  var t1 = key(i1).time;",
            "  var t2 = key(i2).time;",
            "  if (time < t1 || time > t2 || t2 <= t1) {",
            "    value;",
            "  } else {",
            "    var t = Math.max(0, Math.min(1, (time - t1) / (t2 - t1)));",
            "    var e = curveEase(t);",
            "    try {",
            "      mix(key(i1).value, key(i2).value, e);",
            "    } catch (err) {",
            "      valueAtTime(t1 + (t2 - t1) * e);",
            "    }",
            "  }",
            "}"
        ].join("\n");
    }

    function buildCurveFunction(mode, params) {
        if (mode === "bezier") {
            var values = params.values || [0, 0, 1, 1];

            return [
                "var p1x = " + num(values[0], 0) + ";",
                "var p1y = " + num(values[1], 0) + ";",
                "var p2x = " + num(values[2], 1) + ";",
                "var p2y = " + num(values[3], 1) + ";",
                "// cubic-bezier(" + num(values[0], 0) + ", " + num(values[1], 0) + ", " + num(values[2], 1) + ", " + num(values[3], 1) + ")",
                "function solveBezierT(x, a, b) {",
                "  if (x <= 0) return 0;",
                "  if (x >= 1) return 1;",
                "  var low = 0, high = 1, t = x;",
                "  for (var i = 0; i < 14; i++) {",
                "    var mt = 1 - t;",
                "    var bx = 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;",
                "    if (Math.abs(bx - x) < 0.0005) break;",
                "    if (bx < x) low = t; else high = t;",
                "    t = (low + high) / 2;",
                "  }",
                "  return t;",
                "}",
                "function curveEase(x) {",
                "  var t = solveBezierT(x, p1x, p2x);",
                "  var mt = 1 - t;",
                "  return mt*mt*mt*0 + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t;",
                "}"
            ].join("\n");
        }

        if (mode === "custom") {
            var points = params.points || [
                { x: 0, y: 0, cx1: 0, cy1: 0, cx2: 0.33, cy2: 0 },
                { x: 1, y: 1, cx1: 0.67, cy1: 1, cx2: 1, cy2: 1 }
            ];
            var literal = "[";

            for (var i = 0; i < points.length; i++) {
                var point = points[i];
                literal += "[" +
                    num(point.x, 0) + "," +
                    num(point.y, 0) + "," +
                    num(point.cx1, point.x || 0) + "," +
                    num(point.cy1, point.y || 0) + "," +
                    num(point.cx2, point.x || 0) + "," +
                    num(point.cy2, point.y || 0) +
                    "]";

                if (i < points.length - 1) {
                    literal += ",";
                }
            }

            literal += "]";

            return [
                "var pts = " + literal + ";",
                "function solveBezierT(x, p1x, p2x) {",
                "  if (x <= 0) return 0;",
                "  if (x >= 1) return 1;",
                "  var low = 0, high = 1, t = x;",
                "  for (var i = 0; i < 14; i++) {",
                "    var mt = 1 - t;",
                "    var bx = 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t;",
                "    if (Math.abs(bx - x) < 0.0005) break;",
                "    if (bx < x) low = t; else high = t;",
                "    t = (low + high) / 2;",
                "  }",
                "  return t;",
                "}",
                "function curveEase(x) {",
                "  var seg = 0;",
                "  while (seg < pts.length - 2 && x > pts[seg + 1][0]) seg++;",
                "  var p0 = pts[seg];",
                "  var p3 = pts[seg + 1];",
                "  var width = p3[0] - p0[0];",
                "  if (width <= 0.000001) return p3[1];",
                "  var localX = (x - p0[0]) / width;",
                "  var nx1 = (p0[4] - p0[0]) / width;",
                "  var nx2 = (p3[2] - p0[0]) / width;",
                "  var t = solveBezierT(localX, nx1, nx2);",
                "  var mt = 1 - t;",
                "  return mt*mt*mt*p0[1] + 3*mt*mt*t*p0[5] + 3*mt*t*t*p3[3] + t*t*t*p3[1];",
                "  }",
            ].join("\n");
        }

        if (mode === "elastic") {
            return [
                "function curveEase(t) {",
                "  var amp = " + num(params.amplitude, 1) + ";",
                "  var freq = " + num(params.frequency, 3) + ";",
                "  var decay = " + num(params.decay, 4) + ";",
                "  var err0 = 1 - amp;",
                "  var err1 = -amp * Math.exp(-decay) * Math.cos(freq * Math.PI * 2);",
                "  var raw = 1 - amp * Math.exp(-decay * t) * Math.cos(freq * Math.PI * 2 * t);",
                "  return raw - (err0 * (1 - t) + err1 * t);",
                "}"
            ].join("\n");
        }

        if (mode === "bounce") {
            return [
                "function curveEase(t) {",
                "  var bounces = Math.max(1, Math.round(" + num(params.bounces, 3) + "));",
                "  var stiffness = Math.max(0.1, Math.min(0.95, " + num(params.stiffness, 0.6) + "));",
                "  var segs = bounces + 1;",
                "  var seg = Math.min(Math.floor(t * segs), segs - 1);",
                "  if (seg === 0) {",
                "    var localLead = t * segs;",
                "    return localLead * localLead;",
                "  }",
                "  var mid = (seg + 0.5) / segs;",
                "  var halfWidth = 0.5 / segs;",
                "  var normalized = (t - mid) / halfWidth;",
                "  return 1 - Math.pow(stiffness, seg) * (1 - normalized * normalized);",
                "}"
            ].join("\n");
        }

        if (mode === "wave") {
            return [
                "function curveEase(t) {",
                "  var amp = " + num(params.amplitude, 1) + ";",
                "  var freq = " + num(params.frequency, 2.5) + ";",
                "  var decay = " + num(params.decay, 0) + ";",
                "  var sharpness = " + num(params.sharpness, 0) + ";",
                "  var phase = t * freq;",
                "  var sig = Math.sin(phase * Math.PI * 2 - Math.PI / 2);",
                "  var sine = 0.5 + 0.5 * sig;",
                "  var triangle = Math.abs(((phase + 0.5) % 1) * 2 - 1);",
                "  var oscillator;",
                "  if (sharpness > 0) {",
                "    oscillator = sine + (triangle - sine) * sharpness;",
                "  } else {",
                "    var exponent = 1 / (1 + Math.abs(sharpness));",
                "    oscillator = 0.5 + 0.5 * ((sig < 0 ? -1 : 1) * Math.pow(Math.abs(sig), exponent));",
                "  }",
                "  return 0.5 + (oscillator - 0.5) * amp * Math.exp(-decay * t);",
                "}"
            ].join("\n");
        }

        if (mode === "steps") {
            return [
                "function curveEase(t) {",
                "  var count = Math.max(2, Math.round(" + num(params.count, 6) + "));",
                "  var position = \"" + String(params.position || "end").replace(/"/g, "") + "\";",
                "  if (t >= 1) return 1;",
                "  if (position === \"start\") return Math.ceil(t * count) / count;",
                "  if (position === \"both\") return Math.round(t * count) / count;",
                "  return Math.floor(t * count) / count;",
                "}"
            ].join("\n");
        }

        return [
            "function curveEase(t) {",
            "  return t;",
            "}"
        ].join("\n");
    }
})(FlowCurveTypes);
