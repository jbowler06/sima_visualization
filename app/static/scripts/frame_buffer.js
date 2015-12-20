function FrameBuffer(sequenceId,maxLength) {
    this.maxLength = maxLength
    this.frameDelta = 1
    this.current = 0
    this.buffer = {}
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
            return Object.keys(this.buffer[index]).length-1 == Object.keys(this.planes).length;
        }

        return false;
    }

    this.has_next = function(plane) {
        var next_idx = this.current + this.frameDelta;
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

    /*
    this.sortKeys = function(a,b,current,delta) {
        var a_comp = (a-current)%delta
        var b_comp = (b-current)%delta

        if (!a_comp && b_comp){
            return -1
        } else if (a_comp && !b_comp){
            return 1
        } else {
            return (a-b)*Math.abs(delta)
        }
    }*/
    
    
    this.isFull = function() {
        var len = this.length()
        if (len < this.maxLength) {
            return false
        } else {
            var currentKey = this.keys.indexOf(""+this.current)
            if (currentKey == -1) {
                return false
            }

            var endKey = this.keys[this.keys.length-1]
            if ((currentKey > this.maxLength/2)||(this.maxSortedIndex != endKey)) {
                return false
            }
        }
        
        return true
    }

    this.sortKeys = function(plane) {
        var current = this.current;
        var delta = this.frameDelta;
        var buffer = this.buffer;
        
        if (typeof plane === 'undefined') {
            plane = 0;
        }

        this.keys = Object.keys(buffer)
        this.keys.sort(function(a,b) {
            var a_comp = (a-current)%delta * (typeof buffer[""+a][plane] !== "undefined");
            var b_comp = (b-current)%delta * (typeof buffer[""+b][plane] !== "undefined");

            if (!a_comp && b_comp){
                return -1;
            } else if (a_comp && !b_comp){
                return 1;
            } else {
                return (a-b)*delta;
            }
        })

        this.maxSortedIndex = this.keys.find(function(element,index,array) {
            if (index == 0) {
                return array.length == 1;
            } if (index == array.length-1) {
                return true;
            }

            return (((typeof buffer[array[index+1]][plane] === "undefined") || 
                            (array[index+1]-element != delta)) && (element > current));

        });

        return this.keys
    }

    this.addFrame = function(index,frame) {
        index = parseInt(index)
        this.requested.splice(this.requested.indexOf(index),1)
        this.buffer[parseInt(index)][0] = frame
        
        var keys = this.sortKeys(g_frameViewer.getCurrentPlane());
        var currentKey = keys.indexOf(""+this.current)

        var len = this.length()
        while (len > this.maxLength) {
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

    this.addFrames = function(frames) {
        for (frame in frames) {
            var infoarr = frame.split('_')
            if (infoarr[0] == 'frame') {
                frames[frame].index = infoarr[1]
                this.requested.splice(this.requested.indexOf(infoarr[1]),1)
                if ((typeof this.buffer[infoarr[1]] === "undefined")) {
                    this.buffer[infoarr[1]] = [];
                }
                for (var plane in frames[frame]) {
                    this.buffer[infoarr[1]][plane] = frames[frame][plane]
                }
            }
        }

        var keys = this.sortKeys(g_frameViewer.getCurrentPlane())
        var currentKey = keys.indexOf(""+this.current);

        var len = this.length()
        while (len > this.maxLength) {
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


    this.popFrame = function(index,plane) {
        if (!this.buffer[index]) {
            alert('requested to play frame doesn\'t exist');
            return false;
        }
        this.current = index;
        if (typeof plane === "undefined") {
            plane = 0;
        }
        return this.buffer[index][plane];
    }

    this.next_request = function(numFrames, plane) {
        var requestQueue = []
        var frame = this.current+this.frameDelta
        var keys = Object.keys(this.buffer)
        
        while (requestQueue.length < numFrames) {
            if (frame < -1) {
                break;
            }
            if (((!this.buffer[frame])||(!this.buffer[frame][plane])) && (this.requested.indexOf(frame) == -1)) {
                requestQueue.push(frame);
                this.requested.push(frame);
            }
            frame += this.frameDelta
        }
        return requestQueue
    }
}
