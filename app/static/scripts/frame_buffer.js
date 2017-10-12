function FrameBuffer(sequenceId,maxLength) {
    this.maxLength = maxLength
    this.frameDelta = 1
    this.current = 0
    this.buffer = []
    this.keys = []
    this.requested = []
    this.currentKey = -1
    this.maxSortedIndex = -1
    this.full = false;
    this.sequenceId = sequenceId;
    this.incommingBuffer = [];
    this.planes = [0];

    if (typeof(Array.prototype.find) === 'undefined') {
        Array.prototype.find = function(func) {
            for (var i = 0; i < this.length; i++) {
                if (func(this[i],i,this)) {
                    return this[i];
                }
            }
        }
    }

    this.length = function() { 
        return Object.keys(this.buffer).length 
    }

    this.min = function() {
        return Math.min.apply(null, Object.keys(this.buffer));
    }

    this.max = function() {
        return Math.max.apply(null, Object.keys(this.buffer));
    }

    this.set_next = function(nextValue) {
        this.current = nextValue-this.frameDelta
    }

    this.set_frameDelta = function(aFrameDelta) {
        if (this.frameDela == aFrameDelta) {
            return
        }
        this.frameDelta = aFrameDelta
    }

    this.set_planes = function(planeList) {
        this.planes = planeList;
    }

    this.hasVolume = function() {
        var index = this.current;
        if (typeof this.buffer[index] !== "undefined") {
            return this.buffer[index].length-1 == Object.keys(this.planes).length;
        }

        return false;
    }

    this.has_next = function(plane, numFrames) {
        if (typeof(numFrames) === "undefined") {
            numFrames = 1;
        }
        var next_idx = this.current + this.frameDelta*numFrames;
        if (typeof this.buffer[next_idx] !== "undefined") {
            if (typeof this.buffer[next_idx][plane] !== "undefined") {
                return true
            }
        }

        return false
    }

    this.next = function() { 
        return Math.max(this.current + this.frameDelta,-1)
    }

    
    this.isFull = function() {
        var len = this.length()
        if (len < this.maxLength) {
            return false
        } else {
            if (typeof(this.buffer[this.current]) === "undefined") {
                return false
            }

            if ((this.current-this.min()) > (this.max()-this.min())/2.0) {
                return false
            }
        }
        
        return true
    }

    /*
    this.addFrame = function(index,frame,plane) {
        index = parseInt(index)
        if (typeof(planes) === "undefined")
        this.requested.splice(this.requested.indexOf(index),1)
        this.buffer[index][plane] = frame
        
        //var keys = this.sortKeys(g_frameViewer.getCurrentPlane());
        //var currentKey = keys.indexOf(""+this.current)
  
        //TODO:
        var len = this.length()
        while (len > this.maxLength) {
            break;
            if (currentKey > this.maxLength/3) {
                delete this.buffer[""+keys.shift()]
                currentKey--
                len--
            } else if (this.maxSortedIndex == this.keys[len-1]) {
                break
            } else {
                delete this.buffer[""+this.keys.pop()]
                len--
            }
        }
    }
    */

    this.addFrames = function(frames) {
        for (frame in frames) {
            var infoarr = frame.split('_')
            if (infoarr[0] == 'frame') {
                var index  = parseInt(infoarr[1]);
                frames[frame].index = index;
                this.requested.splice(this.requested.indexOf(index),1)
                if ((typeof this.buffer[index] === "undefined")) {
                    this.buffer[index] = [];
                }
                for (var plane in frames[frame]) {
                    this.buffer[index][plane] = frames[frame][plane]
                }
            }
        }

        var len = this.length();
        var maxval = this.max();
        var minval = this.min();
        while (len > this.maxLength) {
            if ((this.current-minval) > (maxval - minval)/3) {
                delete this.buffer[minval];
                minval = this.min();
                len--;
            } else {
                delete this.buffer[maxval];
                maxval = this.max();
                len--;
            }
        }
    }


    this.popFrame = function(index,plane) {
        if (typeof(plane) === "undefined") {
            plane = 0;
        }

        if ((typeof(this.buffer[index]) === "undefined") ||
            (typeof(this.buffer[index][plane]) === "undefined")) {

            console.log('requested to play frame doesn\'t exist');
            return false;
        }

        this.current = index;
        return this.buffer[index][plane];
    }

    this.peekFrame = function(index,plane) {
        if (typeof(plane) === "undefined") {
            plane = 0;
        }

        if ((typeof(this.buffer[index]) === "undefined") ||
            (typeof(this.buffer[index][plane]) === "undefined")) {

            console.log('requested to play frame doesn\'t exist');
            return false;
        }

        return this.buffer[index][plane];
    }

    this.next_request = function(numFrames, plane) {
        var requestQueue = [];
        var frame = this.current+this.frameDelta;
        
        while (requestQueue.length < numFrames) {
            if (frame < -1) {
                break;
            }
            if (((typeof(this.buffer[frame]) === "undefined") ||
                    (typeof(this.buffer[frame][plane]) === "undefined")) &&
                    (this.requested.indexOf(frame) == -1)) {
                requestQueue.push(frame);
                this.requested.push(frame);
            }
            frame += this.frameDelta;
        }
        return requestQueue
    }
}
