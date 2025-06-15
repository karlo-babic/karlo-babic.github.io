/**
 * A base class for WebGL programs that use fragment shaders for GPU computation.
 * Handles the boilerplate of setting up a WebGL context, compiling shaders,
 * creating floating-point textures and framebuffers for ping-ponging,
 * and managing the render loop.
 */
export class BaseComputeShader {
    constructor(screenEl) {
        this.screenEl = screenEl;
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl', { alpha: true });
        if (!this.gl) {
            throw new Error('WebGL is not supported.');
        }
        // This extension is crucial for storing high-precision data like positions and velocities in textures.
        const floatTextures = this.gl.getExtension('OES_texture_float');
        if (!floatTextures) {
            throw new Error('WebGL extension OES_texture_float is not supported.');
        }

        // This extension allows rendering to a floating-point framebuffer.
        const floatBuffer = this.gl.getExtension('WEBGL_color_buffer_float');
        if (!floatBuffer) {
            throw new Error('WebGL extension WEBGL_color_buffer_float is not supported.');
        }

        this.screenEl.appendChild(this.canvas);

        this.isRunning = true;
        this.lastTimestamp = 0;
        
        // Bind the main run loop to this instance.
        this.run = this.run.bind(this);
    }

    /**
     * Creates and compiles a shader from source code.
     * @param {number} type - The shader type (e.g., gl.VERTEX_SHADER).
     * @param {string} source - The GLSL source code.
     * @returns {WebGLShader} The compiled shader.
     */
    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling a shader:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * Creates and links a WebGL program from vertex and fragment shaders.
     * @param {string} vertexSrc - The vertex shader source.
     * @param {string} fragmentSrc - The fragment shader source.
     * @returns {WebGLProgram} The linked program.
     */
    _createProgram(vertexSrc, fragmentSrc) {
        const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vertexSrc);
        const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fragmentSrc);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program:', this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    /**
     * Creates a texture to store floating-point data.
     * @param {number} width - The width of the texture.
     * @param {number} height - The height of the texture.
     * @param {Float32Array | null} data - The initial data for the texture.
     * @returns {WebGLTexture} The created texture.
     */
    _createFloatTexture(width, height, data) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        // Use NEAREST filtering as we are reading/writing precise data, not interpolating colors.
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        // Prevent wrapping, although our logic should keep particles on screen.
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.FLOAT, data);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        return texture;
    }

    /**
     * Creates a framebuffer and attaches a texture to it.
     * @param {WebGLTexture} texture - The texture to attach.
     * @returns {WebGLFramebuffer} The created framebuffer.
     */
    _createFramebuffer(texture) {
        const fb = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
        return fb;
    }

    /**
     * Main animation loop.
     */
    run(timestamp) {
        if (!this.isRunning) return;
        
        const deltaTime = (timestamp - this.lastTimestamp) / 1000.0;
        this.lastTimestamp = timestamp;
        
        this.render(deltaTime); // Pass delta time to the render function.
        requestAnimationFrame(this.run);
    }
    
    /**
     * Abstract render method. Child classes must implement this.
     * @param {number} deltaTime - Time in seconds since the last frame.
     */
    render(deltaTime) {
        throw new Error('Render method must be implemented by child class.');
    }

    /**
     * Handles resizing of the container.
     */
    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Starts the program. Must be called by the child class after initialization.
     */
    start() {
        this.onResize();
        this.lastTimestamp = performance.now();
        requestAnimationFrame(this.run);
    }

    /**
     * Stops the animation loop and cleans up resources.
     */
    unload() {
        this.isRunning = false;
        if (this.screenEl.contains(this.canvas)) {
            this.screenEl.removeChild(this.canvas);
        }
    }
}