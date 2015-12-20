function ROIViewer(canvas, frameViewer, slider) {
    var self = this;
    this.defaultTransparency = 25

    this.canvas = canvas;
    this.frameViewer = frameViewer;
    frameViewer.roiViewers.push(this);
    this.transparencyAdjuster = slider;
    this.gl = initGL(this.canvas[0]);
    this.rois = [];
    this.needsRender = false;
    this.drawing = false;
    this.drawingInfo = {};

    this.createContext = function() {
        this.transparencyAdjuster.val(this.defaultTransparency);
        this.initShaders();
        this.gl.enable(this.gl.GL_BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    this.clear = function() {
        this.rois = [];
        //TODO: organize link to DOM elements
        $('#roi_mode_button').removeClass('selected');
        $('#roi_mode_button').addClass('hidden');
        $('.activeRoiTab').remove();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT) ;
    }

    this.initShaders = function() {
        var fragmentShader = getShader(this.gl, 'shape-shader-fs');
        var vertexShader = getShader(this.gl, "shape-shader-vs");

        var shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
        }

        this.gl.useProgram(shaderProgram);

        shaderProgram.vertexPositionAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
        shaderProgram.colorUniform = this.gl.getUniformLocation(shaderProgram, "uColor");
        shaderProgram.opacityUniform = this.gl.getUniformLocation(shaderProgram, "uOpacity");
        this.gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

        shaderProgram.pMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uPMatrix");
        shaderProgram.mvMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uMVMatrix");
        this.gl.shaderProgram = shaderProgram;
    }


    this.storePolygonRoi = function(response, roiLabels, i) {
        setRoiLoaded(i);
        setRoiViewing(i);

        var color = tinycolor({h:Math.random()*360.0, s:65, v:50}).toRgb();
        color.r /= 255;
        color.g /= 255;
        color.b /= 255;

        var newRoi = new roi(roiLabels[i],color);
        newRoi.label = response[roiLabels[i]].label;
        newRoi.setPoints(this.gl,response[roiLabels[i]].points);
        this.rois[i] = newRoi;

        $('#roi_control_heading roiPolygonsButton').addClass('on');
        if (i < roiLabels.length -1) {
            setTimeout(this.storePolygonRoi(response, roiLabels, ++i), 5);
        } else {
            this.render();
        }
    }


    this.render = function() {
        if (!this.rois.length) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT) ;
            return;
        }

        this.gl.viewport(0, 0, this.gl.viewportWidth, this.gl.viewportHeight);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0)
        
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        var offset = this.frameViewer.offset;
        mat4.perspective(45, this.gl.viewportWidth / this.gl.viewportHeight, 0.1, 100.0, pMatrix);
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [-0.25+offset.x, 0.25+offset.y, this.frameViewer.zoomLevel])
        setMatrixUniforms(this.gl);

        var currentPlane = [this.frameViewer.getCurrentPlane()-1];
        if (currentPlane[0] == -1) {
            currentPlane = Array.apply(null, {length: g_frameViewer.numPlanes()}).map(Number.call, Number);
            currentPlane.reverse();
        }

        this.drawingInfo = {
            planes: currentPlane,
            planeIndex: 0,
            roiIndex: 0,
            opacity: this.transparencyAdjuster.val()/100.0
        }

        if (!this.gl.drawing) {
            this.drawing = true;
            this.drawPolygonRois();
        }
    }

    this.drawSegmentSurface = function(segment) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, segment.polyBuffer);
        this.gl.vertexAttribPointer(
                this.gl.shaderProgram.vertexPositionAttribute, 
                segment.polyBuffer.itemSize, this.gl.FLOAT, false, 0, 0);
        this.gl.uniform1f(this.gl.shaderProgram.opacityUniform,this.drawingInfo.opacity);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, segment.indicesBuffer);
        this.gl.drawElements(
                this.gl.TRIANGLES, segment.indicesBuffer.numItems, 
                this.gl.UNSIGNED_SHORT, 0);
    }


    this.drawSegmentBoundary = function(segment) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, segment.boundaryBuffer);
        this.gl.uniform1f(this.gl.shaderProgram.opacityUniform,1.0);
        this.gl.vertexAttribPointer(
            this.gl.shaderProgram.vertexPositionAttribute, 
            segment.boundaryBuffer.itemSize, this.gl.FLOAT, 
                false, 0, 0);
        this.gl.drawArrays(
                this.gl.LINE_LOOP, 0, segment.boundaryBuffer.numItems);
    }

    this.drawSegmentBoundaryPoints = function(segment) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, segment.boundaryBuffer);
        this.gl.uniform1f(this.gl.shaderProgram.opacityUniform,1.0);
        this.gl.vertexAttribPointer(
            this.gl.shaderProgram.vertexPositionAttribute, 
            segment.boundaryBuffer.itemSize, this.gl.FLOAT, 
                false, 0, 0);
        this.gl.drawArrays(
                this.gl.LINE_LOOP, 0, segment.boundaryBuffer.numItems);
        this.gl.drawArrays(
                this.gl.POINTS, 0, segment.boundaryBuffer.numItems);
    }

    this.drawPolygonRois = function(count) {
        var thisRoi = this.rois[this.drawingInfo.roiIndex];
        if (typeof(thisRoi) === 'undefined') { return };

        if (this.drawingInfo.roiIndex == 0 && this.drawingInfo.planeIndex == 0) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        }

        if (thisRoi.display) {
            var segments = thisRoi.getSegments(this.drawingInfo.planes[this.drawingInfo.planeIndex]);
            var color = thisRoi.color;

            this.gl.uniform3f(this.gl.shaderProgram.colorUniform,color.r,color.g,color.b);
            for (var i = 0; i < segments.length; i++) {
                var segment = segments[i];
                this.drawSegmentSurface(segment);
                this.drawSegmentBoundary(segment);
                //this.drawSegmentBoundaryPoints(segment);
            }
        }

        if (this.drawingInfo.roiIndex < this.rois.length-1) {
            this.drawingInfo.roiIndex++;
            if (count = 0) {
                setTimeout(this.drawPolygonRois(250), 1);
            } else {
                this.drawPolygonRois(--count);
            }
        } else if (this.drawingInfo.planeIndex < this.drawingInfo.planes.length) {
            this.drawingInfo.roiIndex = 0;
            this.drawingInfo.planeIndex++;
            setTimeout(this.drawPolygonRois(250), 1);
        } else {
            this.drawing = false;
        }
    }
    
    this.roi = function(id) {
        return this.rois.find(function(element, array, index) {
            if (element.id == id) {
                index_found = index;
                return true;
            }
            return false;
        });
    }

    this.popRoi = function(id) {
        if (typeof(id) == 'undefined') {
            id = this.rois[0].id;
        }

        var roi = this.roi(id);
        if (typeof(roi) !== "undefined") {
            this.rois.splice(this.rois.indexOf(roi),1);
            self.render();
            return roi;
        }
    }

    this.addRoi = function(roi) {
        var oldRoi = this.roi(roi.id);
        if (oldRoi !== "undefined") {
            this.rois.push(roi);
            roi.setPoints(this.gl, roi.points);
        } else {
            oldRoi.setPoints(this.gl, roi.points);
        }

        self.render();
    }
    
    this.transparencyAdjuster.on('input',function() {
        self.render();
    });
};
