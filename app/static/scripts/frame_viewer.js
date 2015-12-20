function FrameViewer(gl) {
    this.glContext = gl;
    this.playing = false;
    this.frameDelay = 166.66;
    this.dragScale = 400;
    this.allowDrag = true;
    this.current = 0;

    this.zoomLevel = -3.5;
    this.mainProjectionHeight = 2;
    this.mainProjectionWidth = 2;
    this.planeSelect = $('#plane_select');

    this.offset = { x:0, y:0 };
    this.frameShape = { width:0, height:0 };
    this.channel = 0;
    this.cycle = 0;
    this.roiViewers = [];
    this.nChannels = 1;

    this.length = 0;

    this.mouseState = {
        mouseDown: false
    }

    this.isPlaying = function() {
        return this.playing;
    }

    this.getCurrentPlane = function() {
        return parseInt(this.planeSelect.val());
    };

    this.setCurrentPlane = function(plane) {
        if (typeof(plane) === "undefined") {
            plane = this.planeSelect.val();
        }

        plane = Math.min(Math.max(0,plane),this.planeSelect.attr('max'));
        if (plane != this.getCurrentPlane()) {
            this.planeSelect.val(plane);
            this.planeSelect.trigger('change');
            this.roiViewers.map(function(viewer){viewer.render()});
        }
    }

    this.setOffset = function(x,y) {
        this.offset.x = x;
        this.offset.y = y;

        if (!this.playing) {
            this.glContext.render();
        }

        this.roiViewers.map(function(viewer){viewer.render()});
    }


    // TODO: update this!
    this.numPlanes = function() {
        return Math.max(1,this.planeSelect.find('option').length-1);
    }

    this.setPlaying = function(state) {
        this.playing = state;
    }

    this.getFrameRate = function() {
        return 1000/this.frameDelay;
    }

    this.setFrameRate = function(rate) {
        this.frameDelay = 1000/rate;
    }

    this.createTextureBuffers = function(nChannels) {
        if (typeof(nChannels) !== 'undefined') {
            this.nChannels = nChannels;
        }
        var glContext = this.glContext;

        if (this.nChannels == 2) {
            Object.keys(this.glContext.projections).map(function(val,idx,arr) {
                glContext.projections[val].textureCoordBuffer = 
                        createTextureCoordBuffer(glContext,2)
            });
        } else {
            Object.keys(this.glContext.projections).map(function(val,idx,arr) {
                glContext.projections[val].textureCoordBuffer = 
                        createTextureCoordBuffer(glContext)
            });
        }
    }

    this.initMouse = function(gl_canvas) {
        var mouseState = this.mouseState;
        var play = this.playing;
        var thisViewer = this;
        gl_canvas.bind('DOMMouseScroll mousewheel', function(event) {
            if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
                if ($('#volume_button').hasClass('selected')) {
                    thisViewer.setCurrentPlane(thisViewer.getCurrentPlane()+1);
                } else {
                    thisViewer.zoomLevel = Math.min(thisViewer.zoomLevel+0.1,-0.1);
                }
            } else {
                if ($('#volume_button').hasClass('selected')) {
                    $('#plane_select').val();
                    thisViewer.setCurrentPlane(Math.max(1,thisViewer.getCurrentPlane()-1));
                } else {
                    thisViewer.zoomLevel -= 0.1;
                }
            }
            if (!play) {
                thisViewer.glContext.render();
            }
            thisViewer.roiViewers.map(function(viewer){viewer.render()});
        });

        gl_canvas.bind('mousedown',function(){
            mouseState.mouseDown = true;
        });

        gl_canvas.bind('mouseup',function(){
            mouseState.mouseDown = false;
        });

        var dragScale = this.dragScale;
        var frameViewer = this;
        gl_canvas.mousemove(function(event) {
            if (mouseState.mouseDown && frameViewer.allowDrag) {
                var dx = event.clientX - mouseState.lastMouseX;
                var dy = event.clientY - mouseState.lastMouseY;
                
                var x = thisViewer.offset.x += dx/dragScale;
                var y = thisViewer.offset.y -= dy/dragScale;
                thisViewer.setOffset(x,y);
            }
            mouseState.lastMouseX = event.clientX;
            mouseState.lastMouseY = event.clientY;
        });
    }

    this.setFrame = function(aFrame) {
        var projections = this.glContext.projections;
        projections.xProjection.texture.image.src = aFrame.x;
        projections.yProjection.texture.image.src = aFrame.y;
        projections.zProjection.texture.image.src = aFrame.z;
    }
};
