function initGL(canvas) {
    var init_gl
    try {
        init_gl = canvas.getContext("webgl",{preserveDrawingBuffer: true, premultipledAlpha: false })
        init_gl.viewportWidth = canvas.width
        init_gl.viewportHeight = canvas.height
        return init_gl
    } catch (e) {
    }

    if (!init_gl) {
        alert("unable to initialize WebGL")
    }
    
    return null
}


function getShader(ctx, id) {
    var shaderScript = document.getElementById(id)
    if (!shaderScript) {
        return null
    }

    var str = ""
    var k = shaderScript.firstChild
    while(k) {
        if (k.nodeType == 3) {
            str += k.textContent
        }
        k = k.nextSibling
    }

    var shader
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = ctx.createShader(ctx.FRAGMENT_SHADER)
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = ctx.createShader(ctx.VERTEX_SHADER)
    } else {
        return null
    }
    ctx.shaderSource(shader, str)
    ctx.compileShader(shader)

    if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
        alert(ctx.getShaderInfoLog(shader))
        return null
    }

    return shader
}


function initShadersGen(gl,shader_fs,shader_vs) {
    var fragmentShader = getShader(gl, shader_fs);
    var vertexShader = getShader(gl, shader_vs);

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.shaderProgram = shaderProgram;
}


function updateTextureData(ctx,texture) {
    ctx.bindTexture(ctx.TEXTURE_2D, texture)
    ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)
    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, data.width, data.height-2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(data.texture) )
    //ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.LUMINANCE, ctx.LUMINANCE, ctx.UNSIGNED_BYTE, texture.image )
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGB, ctx.RGB, ctx.UNSIGNED_BYTE, texture.image )
    ctx.bindTexture(ctx.TEXTURE_2D, null)
}


function squarePositionVerticies(size_x, size_y, z) {
    if (!z) {
        z = 0.0
    }
    size_x /= 2
    size_y /= 2
    var vertices = [
         size_x,  size_y,  z,
        -size_x,  size_y,  z,
         size_x, -size_y,  z,
        -size_x, -size_y,  z
    ]
    return vertices
}


function createSquareVertexPositionBuffer(ctx, size_x, size_y) {
    var squareVertexPositionBuffer = ctx.createBuffer()
    ctx.bindBuffer(ctx.ARRAY_BUFFER, squareVertexPositionBuffer)
    var vertices = squarePositionVerticies(size_x, size_y)
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(vertices), ctx.STATIC_DRAW)
    squareVertexPositionBuffer.itemSize = 3
    squareVertexPositionBuffer.numItems = 4

    return squareVertexPositionBuffer
}


function textureVerticies(num_channels) {
    var y = 1.0
    if ((num_channels) && (num_channels == 2)) {
        y = 0.5
    }
    
    return textureCoords = [
            1.0, y,
            0.0, y,
            1.0, 0.0,
            0.0, 0.0
        ]
}

function createTextureCoordBuffer(ctx, num_channels) {
    var textureCoordBuffer = ctx.createBuffer()
    ctx.bindBuffer(ctx.ARRAY_BUFFER, textureCoordBuffer)
    var textureCoords = textureVerticies(num_channels)
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(textureCoords), ctx.STATIC_DRAW)
    textureCoordBuffer.itemSize = 2
    textureCoordBuffer.numItems = 4
    
    return textureCoordBuffer
}

/*
function updateTextureRGBA(texture) {
    alert('function called - not implemented')
    var data = new Uint8Array([100, 0, 150, 200,100,0,0,255])
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 4, 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE,data )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
}
*/
