var Roi;
var LinearRoi;

Roi = function (roi_id) {

    // field declaration
    var id,
        label,
        list_label,
        color,
        isMarked,
        mask,
        infoTab,
        display,
        polys,          // store the polygons of the roi
        bboxes,         // roi bounding boxes
        widthScale,
        widthConst,
        heightScale,
        heightConst,
        segments,
        points;

    // method declarations
    var init,
        setListLabel,
        getListLabel,
        calculateBbox,
        isPointInPolygon,
        isPointInRoi,
        assign_color,
        setMarked,
        getMarked,
        createRoiTab,
        setPoints,
        addPoint,
        getSegments,
        setMask;

    init = function (roi_id) {
        id = String(roi_id);
        label = String(roi_id);
        color = {};
        isMarked = false;
        mask = {};
        infoTab = {};
        display = true;
        polys = [];
        bboxes= [];
        segments = [];
        points = [];
        list_label = null;

        //TODO: remove theis global reference
        widthScale = g_frameViewer.mainProjectionWidth/g_frameViewer.width;
        widthConst = g_frameViewer.mainProjectionWidth/2;

        //TODO: remove theis global reference
        heightScale = g_frameViewer.mainProjectionHeight/g_frameViewer.height;
        heightConst = g_frameViewer.mainProjectionHeight -
                      g_frameViewer.mainProjectionHeight/2;
        assign_color();
        infoTab = createRoiTab();
    }

    setListLabel = function(roilist_label) {
        list_label = String(roilist_label);
    }

    getListLabel = function() {
        return String(list_label);
    }

    // TODO consider updating a bbox field whenever the points are updated
    calculateBbox = function(polygon) {

        var minX = polygon[0][0], maxX = polygon[0][0];
        var minY = polygon[0][1], maxY = polygon[0][1];

        for (var n = 1; n < polygon.length; n++) {
            var q = polygon[n];
            minX = Math.min(q[0], minX);
            maxX = Math.max(q[0], maxX);
            minY = Math.min(q[1], minY);
            maxY = Math.max(q[1], maxY);
        }

        return [minX, minY, maxX, maxY];
    }

    isPointInPolygon = function(x, y, polygon) {
        var isInside = false;
        var bbox = calculateBbox(polygon);

        // if pt isn't in the bbox return false
        if (x < bbox[0] || y < bbox[1] || x > bbox[2] || y > bbox[3]) {
            return isInside;
        }

        var i = 0, j = polygon.length-1;
        var x0, y0, x1, y1;
        for (i, j; i < polygon.length; j = i++) {

            x0 = polygon[i][0], x1 = polygon[j][0];
            y0 = polygon[i][1], y1 = polygon[j][1];

            if ( (polygon[i][1] > y) != (polygon[j][1] > y) &&
                  x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) /
                  (polygon[j][1] - polygon[i][1]) + polygon[i][0]) {
                isInside = !isInside;
            }
        }
        return isInside;
    };


    isPointInRoi = function(x, y, z) {
        for (var i = 0; i < points[z].length; i++) {
            if (isPointInPolygon(x, y, points[z][i].slice(0))) return true;
        }

        return false;

    };


    assign_color = function() {
        var color_code = id.split('').map(
            function(e,a,i) {
                return Number(String(e.charCodeAt(0)) + '359359')
            }).reduce(function(a,b) {return a+b}) / 100.0 % 360;
        color = tinycolor({h:color_code, s:65, v:50}).toRgb();
        color.r /= 255;
        color.g /= 255;
        color.b /= 255;

    };


    setMarked = function(markVal) {
        isMarked = markVal;
    };


    getMarked = function() {
        return isMarked;
    };


    createRoiTab = function() {
        var thisId = 'roi_tab_' + id;
        var infoTab = $('#roi_tab_template').clone(true)
            .attr('id',thisId)
            .removeClass('hidden')
            .addClass('activeRoiTab')
            .appendTo('#roi_tab_container');
        infoTab.find('.roiNumberSpan').text('');
        infoTab.find('.roiIdSpan').text(id);
        return infoTab;
    };

    getPoints = function() {
        return points;
    }

    setPoints = function(gl, roiPoints) {
        points = roiPoints;
        type = 'polygons';
        for (var plane in roiPoints) {

            segments[parseInt(plane)] = [];
            for (var seg = 0;
                 ((typeof(roiPoints[plane]) !== "undefined") &&
                   (seg < roiPoints[plane].length)); seg++) {
                var segment = {}
                segment.polyBuffer = gl.createBuffer();
                segment.polyBuffer.points = [];

                var ec = earcut([roiPoints[plane][seg]],true);
                var tris = ec.vertices;
                for (var i=0; i < tris.length; i++) {
                    if (i%2 == 0) {
                        segment.polyBuffer.points.push(tris[i]*widthScale-widthConst)
                    } else {
                        segment.polyBuffer.points.push(
                            g_frameViewer.mainProjectionHeight*(
                                1/2-tris[i]/g_frameViewer.height));
                        segment.polyBuffer.points.push(0);
                    }
                }

                segment.boundaryBuffer = gl.createBuffer();
                segment.boundaryBuffer.points = [];
                for (var i=0; i < roiPoints[plane][seg].length; i++) {
                    segment.boundaryBuffer.points.push(
                        roiPoints[plane][seg][i][0]*widthScale-widthConst)
                    segment.boundaryBuffer.points.push(
                        g_frameViewer.mainProjectionHeight *
                        (1/2-roiPoints[plane][seg][i][1]/g_frameViewer.height));
                    segment.boundaryBuffer.points.push(0);
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, segment.boundaryBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
                    segment.boundaryBuffer.points), gl.STATIC_DRAW);
                segment.boundaryBuffer.itemSize = 3;
                segment.boundaryBuffer.numItems =
                    segment.boundaryBuffer.points.length/3;

                gl.bindBuffer(gl.ARRAY_BUFFER, segment.polyBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
                    segment.polyBuffer.points), gl.STATIC_DRAW);
                segment.polyBuffer.itemSize = 3;
                segment.polyBuffer.numItems =
                    segment.polyBuffer.points.length/3;

                segment.indicesBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, segment.indicesBuffer);
                gl.bufferData(
                    gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ec.indices),
                    gl.STATIC_DRAW);
                segment.indicesBuffer.itemSize = 1;
                segment.indicesBuffer.numItems = ec.indices.length;

                segments[parseInt(plane)].push(segment);
            }
        }
    };

    addPoint = function(gl,plane,segment,point) {
        if (typeof(points[plane]) === "undefined") {
            points[plane] = [];
        }

        if (typeof(points[plane][segment]) === "undefined") {
            points[plane][segment] = [];
        }

        points[plane][segment].push(point);
        setPoints(gl, points);
    };

    getSegments = function(plane) {
        if (typeof segments[plane] == 'undefined') {
            return [];
        }

        return segments[plane]
    };

    setMask = function (projections) {
        type = 'mask'
        mask = projections
    };

    init(roi_id);

    return {
        id: id,
        setPoints: setPoints,
        infoTab: infoTab,
        addPoint: addPoint,
        points: points,
        getPoints: getPoints,
        getSegments: getSegments,
        isPointInRoi: isPointInRoi,
        display: display,
        color: color,
        getMarked: getMarked,
        setMarked: setMarked,
        setListLabel: setListLabel,
        getListLabel: getListLabel
    }
}

diffPts = function(a, b) {
    return [a[0]-b[0], a[1]-b[1]];
}

angle = function(pt) {
    if (pt[1] === 0) {
        if (pt[0] > 0) {
            theta = Math.PI/2;
        } else {
            theta = 3*Math.PI/2;
        }
    } else if (pt[0] == 0) {
        if (pt[1] > 0) {
            theta = 0;
        } else {
            theta = Math.PI;
        }
    } else {
        theta = Math.atan(pt[0]/pt[1])
    }

    theta = Math.abs(theta);
    if ((pt[1] < 0) && (pt[0] < 0)) {
        theta = Math.PI + theta
    } else if ((pt[1] < 0) && (pt[0] > 0)) {
        theta = Math.PI - theta;
    } else if ((pt[1] > 0) && (pt[0] < 0 )) {
        theta = 2*Math.PI - theta;
    }

    return theta
}

distance = function(a, b) {
    return Math.sqrt(Math.pow((a[0]-b[0]),2) + Math.pow((a[1]-b[1]), 2));
}

Roi2 = function(id) {

    // field declaration
    var roi,
        linear_points,
        radius,
        radiuses,
        min_distance,
        points;

    // method declarations
    var init,
        addPoint;

    init = function(roi_id) {
        roi = new Roi2(roi_id);
        linear_points = [];
        points = [];
        radiuses = [];
        radius = 1;
        min_distance = radius;
    }

    getPoints = function() {
        return points;
    }

    setRadius = function(gl, plane, segment, new_radius) {
        radiuses[radiuses.length-1] = new_radius;
        radius = new_radius;
        if (plane == -1) {
            linear_points.map(function(e, i) {
                addPoint(gl, i, segment);
            });
        } else {
            addPoint(gl, plane, segment);
        }
    }

    addPoint = function(gl,plane,segment,point) {
        if (typeof(point) !== "undefined") {
            if (typeof(linear_points[plane]) === "undefined") {
                linear_points[plane] = [];
            }

            if (typeof(linear_points[plane][segment]) === "undefined") {
                linear_points[plane][segment] = [];
            }

            if (linear_points[plane][segment].length > 0) {
                if (distance(point, linear_points[plane][segment].slice(-1)[0]) < min_distance) {
                    return;
                }
            }

            linear_points[plane][segment].push(point);
            radiuses.push(radius);
        }

        var planes_left = [];
        /*
        linear_points.forEach(function(plane) {
            var segments_left = []
            plane.forEach(function(segment) {
                if (segment.length < 2) {
                    segments_left.push(segment);
                } else {
                    var points_left = [];
                    var points_right = [];
                    segment.forEach(function(point, index, array) {
       */
        var segments_left = []
        var points_left = [];
        var points_right = [];
        var segment = linear_points[plane][segment];
        if (segment.length >= 2) {
            segment.forEach(function(point, index, array) {
                radius = radiuses[index];
                        if (index === 0) {
                            var next = array[1];
                            next = diffPts(next, point);

                            theta3 = angle(next);

                            points_right.push(
                                [point[0]-radius*Math.cos(theta3),
                                point[1]+radius*Math.sin(theta3)]);
                            points_left.push(
                                [point[0]+radius*Math.cos(theta3),
                                point[1]-radius*Math.sin(theta3)]);

                        } else if (index == array.length-1) {
                            var prev = array[index-1];
                            prev = diffPts(prev, point);
                            theta3 = angle(prev);

                            points_right.push(
                                [point[0]+radius*Math.cos(theta3),
                                point[1]-radius*Math.sin(theta3)]);
                            points_left.push(
                                [point[0]-radius*Math.cos(theta3),
                                point[1]+radius*Math.sin(theta3)]);
                        } else {
                            var prev = array[index-1];
                            prev = diffPts(prev, point);
                            theta1 = angle(prev);

                            var next = array[index+1];
                            next = diffPts(next, point);
                            theta2 = angle(next);

                            theta3 = (theta2 + theta1)/2;

                            var h = Math.abs(radius/Math.sin(theta1 - theta3));
                            if (theta1 < theta2) {
                                theta3 += Math.PI;
                            }
                            points_right.push(
                                [point[0]-h*Math.sin(theta3),
                                point[1]-h*Math.cos(theta3)]);

                                points_left.push(
                                    [point[0]+h*Math.sin(theta3),
                                    point[1]+h*Math.cos(theta3)]);
                        }
                    });
                    segments_left.push(points_left.concat(points_right.reverse()));
                } else {
                    segments_left.push(segment);
                }
            //});
            planes_left.push(segments_left);
        //});
        roi.points = planes_left;
        roi.setPoints(gl, planes_left);
        points = planes_left;
    };


    init(id);

    return {
        id: roi.id,
        setPoints: roi.setPoints,
        infoTab: roi.infoTab,
        addPoint: addPoint,
        getSegments: roi.getSegments,
        isPointInRoi: roi.isPointInRoi,
        display: roi.display,
        color: roi.color,
        getMarked: roi.getMarked,
        setMarked: roi.setMarked,
        getPoints: getPoints,
        setRadius: setRadius
    }
}

