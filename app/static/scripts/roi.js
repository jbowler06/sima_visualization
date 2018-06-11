function roi(id) {


    this.id = String(id);
    this.label = String(id);
    this.color = {};
    this.isMarked = false;
    this.mask = {};
    this.infoTab = {};
    this.display = true;

    // stores the polygons of the roi & their bounding boxes
    this.polys = []
    this.bboxes = []

    //TODO: remove theis global reference
    this.widthScale = g_frameViewer.mainProjectionWidth/g_frameViewer.width;
    this.widthConst = g_frameViewer.mainProjectionWidth/2;

    //TODO: remove theis global reference
    this.heightScale = g_frameViewer.mainProjectionHeight/g_frameViewer.height;
    this.heightConst = g_frameViewer.mainProjectionHeight - g_frameViewer.mainProjectionHeight/2;

    this.segments = [];
    this.points = [];

    this.init = function(id) {
        this.assign_color();
        this.infoTab = this.createRoiTab();
    }

    // TODO consider updating a bbox field whenever the points are updated
    this.calculateBbox = function(polygon) {

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

    this.isPointInPolygon = function(x, y, polygon) {
        var isInside = false;
        var bbox = this.calculateBbox(polygon);

        // if pt isn't in the bbox return false
        if (x < bbox[0] || y < bbox[1] || x > bbox[2] || y > bbox[3]) {
            return isInside;
        }

        var i = 0, j = polygon.length-1;
        var x0, y0, x1, y1;
        for (i, j; i < polygon.length; j = i++) {

            x0 = polygon[i][0], x1 = polygon[j][0];
            y0 = polygon[i][1], y1 = polygon[j][1];

            if ( (polygon[i][1] > y) != (polygon[j][1] > y) && x < (polygon[j][0] - polygon[i][0]) * (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0]) {
                isInside = !isInside;
            }
        }
        return isInside;
    };

    this.isPointInRoi = function(x, y, z) {

        for (var i = 0; i < this.points[z].length; i++) {
            if (this.isPointInPolygon(x, y, this.points[z][i].slice(0))) return true;
        }

        return false;

    };


    this.assign_color = function() {
        var color_code = this.id.split('').map(
            function(e,a,i) {
                return Number(String(e.charCodeAt(0)) + '359359')
            }).reduce(function(a,b) {return a+b}) / 100.0 % 360;
        var color = tinycolor({h:color_code, s:65, v:50}).toRgb();
        color.r /= 255;
        color.g /= 255;
        color.b /= 255;

        this.color = color;
    };

    this.setMarked = function(markVal) {
        this.isMarked = markVal;
    };

    this.getMarked = function() {
        return this.isMarked;
    };


    this.createRoiTab = function() {
        var thisId = 'roi_tab_' + this.id;
        var infoTab = $('#roi_tab_template').clone(true)
            .attr('id',thisId)
            .removeClass('hidden')
            .addClass('activeRoiTab')
            .appendTo('#roi_tab_container');
        infoTab.find('.roiNumberSpan').text('');
        infoTab.find('.roiIdSpan').text(id);
        return infoTab;
    };


    this.setPoints = function(gl,roiPoints) {
        this.points = roiPoints;
        this.type = 'polygons';
        for (var plane in roiPoints) {

            this.segments[parseInt(plane)] = [];
            for (var seg = 0; ((typeof(roiPoints[plane]) !== "undefined") && (seg < roiPoints[plane].length)); seg++) {
                var segment = {}
                segment.polyBuffer = gl.createBuffer();
                segment.polyBuffer.points = [];

                var ec = earcut([roiPoints[plane][seg]],true);
                var tris = ec.vertices;
                for (var i=0; i < tris.length; i++) {
                    if (i%2 == 0) {
                        segment.polyBuffer.points.push(tris[i]*this.widthScale-this.widthConst)
                    } else {
                        segment.polyBuffer.points.push(
                            g_frameViewer.mainProjectionHeight*(1/2-tris[i]/g_frameViewer.height));
                        segment.polyBuffer.points.push(0);
                    }
                }

                segment.boundaryBuffer = gl.createBuffer();
                segment.boundaryBuffer.points = [];
                for (var i=0; i < roiPoints[plane][seg].length; i++) {
                    segment.boundaryBuffer.points.push(roiPoints[plane][seg][i][0]*this.widthScale-this.widthConst)
                    segment.boundaryBuffer.points.push(
                        g_frameViewer.mainProjectionHeight*(1/2-roiPoints[plane][seg][i][1]/g_frameViewer.height));
                    segment.boundaryBuffer.points.push(0);
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, segment.boundaryBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segment.boundaryBuffer.points), gl.STATIC_DRAW);
                segment.boundaryBuffer.itemSize = 3;
                segment.boundaryBuffer.numItems = segment.boundaryBuffer.points.length/3;

                gl.bindBuffer(gl.ARRAY_BUFFER, segment.polyBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segment.polyBuffer.points), gl.STATIC_DRAW);
                segment.polyBuffer.itemSize = 3;
                segment.polyBuffer.numItems = segment.polyBuffer.points.length/3;

                segment.indicesBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, segment.indicesBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ec.indices), gl.STATIC_DRAW);
                segment.indicesBuffer.itemSize = 1;
                segment.indicesBuffer.numItems = ec.indices.length;

                this.segments[parseInt(plane)].push(segment);
            }
        }
    };

    this.addPoint = function(gl,plane,segment,point) {
        if (typeof(this.points[plane]) === "undefined") {
            this.points[plane] = [];
        }

        if (typeof(this.points[plane][segment]) === "undefined") {
            this.points[plane][segment] = [];
        }

        this.points[plane][segment].push(point);
        this.setPoints(gl,this.points);
    };

    this.getSegments = function(plane) {
        if (typeof this.segments[plane] == 'undefined') {
            return [];
        }

        return this.segments[plane]
    };

    this.setMask = function (projections) {
        this.type = 'mask'
        this.mask = projections
    };


    /*
    this.setPointsBin = function(roiInfo) {
        var roiObj = this;
        var context =
                $('<canvas width="'+roiInfo.length+'" height="1" style="display:none">',
                    {'class':roiInfo.label+'_buffer',
                     'id':'myId'})
                        .appendTo('body')[0]
                        .getContext("2d");
        var buffer = new Image();
        buffer.src = roiInfo.points
        buffer.onload = function() {
            context.drawImage(this,0,0);
            var contextData = context.getImageData(0,0,roiInfo.length,1).data;
            var count = 0;
            for (var i=0; i < contextData.length; i+=8) {
                var val = contextData[i]*256+contextData[i+4] + roiInfo.min_val
                roiObj.points.push(val);
                if (count%2 == 0) {
                    roiObj.pointsGl.push(val*roiObj.widthScale-roiObj.widthConst)
                } else {
                    val = g_sequenceInfo.height-val;
                    val *= g_frameViewer.mainProjectionHeight/g_sequenceInfo.height;
                    val -= g_frameViewer.mainProjectionHeight/2;
                    roiObj.pointsGl.push(val);
                    roiObj.pointsGl.push(0.0);
                }
                count++;
            }
            roiContext.bindBuffer(roiContext.ARRAY_BUFFER, roiObj.glBuffer);
            roiContext.bufferData(roiContext.ARRAY_BUFFER, new Float32Array(roiObj.pointsGl), roiContext.STATIC_DRAW);
            roiObj.glBuffer.itemSize = 3;
            roiObj.glBuffer.numItems = roiObj.pointsGl.length/3;
            buffer = null;
            $('.'+roiInfo.label+'_buffer').remove();
            drawShapes(roiContext);
        }
    }*/

    this.init();
}
