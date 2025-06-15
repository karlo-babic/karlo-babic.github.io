/**
 * A base class for WebGL shader programs that render to a full-screen quad.
 * Handles the boilerplate of setting up a WebGL context, compiling shaders,
 * creating buffers, and managing the render loop.
 */
export class BaseShader {
    constructor(screenEl) {
        this.screenEl = screenEl;
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl', { antialias: false });
        this.screenEl.appendChild(this.canvas);
        
        this.glProgram = null;
        this.isRunning = true;

        this.run = this.run.bind(this);
    }

    /**
     * Initializes the WebGL program with vertex and fragment shaders.
     * This must be called by the child class.
     * @param {string} vertexSrc - The source code for the vertex shader.
     * @param {string} fragmentSrc - The source code for the fragment shader.
     */
    init(vertexSrc, fragmentSrc) {
        const vertexShader = this._createShader(this.gl.VERTEX_SHADER, vertexSrc);
        const fragmentShader = this._createShader(this.gl.FRAGMENT_SHADER, fragmentSrc);
        this.glProgram = this._createProgram(vertexShader, fragmentShader);

        this._setupQuad();
        this.onResize();
        requestAnimationFrame(this.run);
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vertexShader, fragmentShader) {
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
     * Sets up a simple quad (two triangles) that fills the entire canvas.
     */
    _setupQuad() {
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        const positionAttributeLocation = this.gl.getAttribLocation(this.glProgram, "a_position");
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    /**
     * Main render loop.
     */
    run(timestamp) {
        if (!this.isRunning) return;
        this.render(timestamp);
        requestAnimationFrame(this.run);
    }

    /**
     * The main render call. Child classes should override this to set uniforms
     * before calling the parent method.
     */
    render(timestamp) {
        this.gl.useProgram(this.glProgram);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    /**
     * Handles resizing of the container.
     */
    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    /**
     * Stops the animation loop and cleans up WebGL resources.
     */
    unload() {
        this.isRunning = false;
        if (this.glProgram) {
            this.gl.deleteProgram(this.glProgram);
        }
        if (this.screenEl.contains(this.canvas)) {
            this.screenEl.removeChild(this.canvas);
        }
    }
}