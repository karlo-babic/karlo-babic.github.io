import { BaseComputeShader } from './engines/base_compute_shader.js';

class BoidsProgram extends BaseComputeShader {
    /**
     * @param {HTMLElement} screenEl The element to render the canvas into.
     * @param {object} options An object containing boids parameters.
     * @param {number} options.separation The strength of the separation force.
     * @param {number} options.alignment The strength of the alignment force.
     * @param {number} options.cohesion The strength of the cohesion force.
     */
    constructor(screenEl, options = {}) {
        super(screenEl);

        // --- Boids Simulation Parameters ---
        const defaults = {
            boids: 1024,
            separation: 0.01,
            alignment: 0.015,
            cohesion: 0.6,
        };
        // Merge user-provided options with defaults.
        this.params = { ...defaults, ...options };

        // --- WebGL Particle Simulation Parameters ---
        // Helper function to find the next power of 2
        const _nextPowerOf2 = (n) => {
            if (n === 0) return 1;
            // If n is already a power of 2, return it.
            if ((n & (n - 1)) === 0) return n;
            return Math.pow(2, Math.ceil(Math.log2(n)));
        };
        // Calculate texture size based on the desired number of boids
        const desiredBoids = this.params.boids;
        const requiredSide = Math.ceil(Math.sqrt(desiredBoids));

        // Find the powers of two on either side of the required side length.
        const lowerPowerOf2 = Math.pow(2, Math.floor(Math.log2(requiredSide)));
        const upperPowerOf2 = _nextPowerOf2(requiredSide);

        // Determine which of the two is closer to the required side length.
        if (requiredSide - lowerPowerOf2 <= upperPowerOf2 - requiredSide) {
            this.PARTICLE_TEXTURE_SIDE_LEN = lowerPowerOf2;
        } else {
            this.PARTICLE_TEXTURE_SIDE_LEN = upperPowerOf2;
        }
        // Ensure the texture is at least 1x1.
        if (this.PARTICLE_TEXTURE_SIDE_LEN < 1) {
            this.PARTICLE_TEXTURE_SIDE_LEN = 1;
        }

        this.PARTICLE_COUNT = this.PARTICLE_TEXTURE_SIDE_LEN * this.PARTICLE_TEXTURE_SIDE_LEN;
        // Log the actual number of boids being simulated for clarity
        console.log(`Desired boids: ${desiredBoids}. Simulating: ${this.PARTICLE_COUNT} (${this.PARTICLE_TEXTURE_SIDE_LEN}x${this.PARTICLE_TEXTURE_SIDE_LEN} texture).`);
        if (this.PARTICLE_COUNT < desiredBoids) {
            console.warn(`Warning: The chosen texture size results in fewer boids than requested.`);
        }

        // --- GLSL Shaders ---
        this.computeVertexShader = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        this.computeFragmentShader = `
        precision highp float;
        uniform sampler2D u_particles;
        uniform vec2 u_textureResolution;
        uniform vec2 u_screenResolution;
        uniform vec2 u_mouse;
        uniform float u_deltaTime;

        // Boids force parameters passed from JavaScript as uniforms
        uniform float u_separationForce;
        uniform float u_alignmentForce;
        uniform float u_cohesionForce;

        // Boids simulation constants
        const float MAX_SPEED = 50.0;
        const float PERCEPTION_RADIUS = 15.0;
        const float AVOIDANCE_RADIUS = 5.0;
        const float MOUSE_FORCE = 0.6;
        const float BORDER_MARGIN = 20.0;
        const float BORDER_TURN_FORCE = 2.0;

        float rand(vec2 co){
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
            vec2 uv = gl_FragCoord.xy / u_textureResolution;
            vec4 currentState = texture2D(u_particles, uv);
            vec2 pos = currentState.xy;
            vec2 vel = currentState.zw;

            vec2 separation = vec2(0.0);
            vec2 alignment = vec2(0.0);
            vec2 cohesionCenter = vec2(0.0);
            int perceptionCount = 0;

            const int NUM_SAMPLES = 40;
            for (int i = 0; i < NUM_SAMPLES; i++) {
                vec2 neighbor_uv = vec2(
                    rand(uv + float(i) * 0.1),
                    rand(uv + float(i) * 0.2)
                );
                vec4 neighborState = texture2D(u_particles, neighbor_uv);
                vec2 neighborPos = neighborState.xy;
                
                vec2 delta = neighborPos - pos;
                float dist = length(delta);

                if (dist > 0.0 && dist < PERCEPTION_RADIUS) {
                    cohesionCenter += neighborPos;
                    alignment += neighborState.zw;
                    if (dist < AVOIDANCE_RADIUS) {
                        separation -= delta / (dist * dist);
                    }
                    perceptionCount++;
                }
            }

            if (perceptionCount > 0) {
                cohesionCenter /= float(perceptionCount);
                vec2 cohesion = cohesionCenter - pos;
                alignment /= float(perceptionCount);
                separation /= float(perceptionCount);

                // Apply the forces using the values from the uniforms
                vel += separation * u_separationForce;
                vel += alignment * u_alignmentForce;
                vel += cohesion * u_cohesionForce;
            }
            
            vec2 mouse_dir = vec2(0.0);
            float mouse_dist = distance(pos, u_mouse);
            if (u_mouse.x > 0.0 && mouse_dist < PERCEPTION_RADIUS * 2.0) {
                mouse_dir = normalize(pos - u_mouse) / mouse_dist * 100.0;
                vel += mouse_dir * MOUSE_FORCE;
            }

            // Steer away from edges for a smoother look.
            if (pos.x < BORDER_MARGIN) vel.x += BORDER_TURN_FORCE;
            if (pos.x > u_screenResolution.x - BORDER_MARGIN) vel.x -= BORDER_TURN_FORCE;
            if (pos.y < BORDER_MARGIN) vel.y += BORDER_TURN_FORCE;
            if (pos.y > u_screenResolution.y - BORDER_MARGIN) vel.y -= BORDER_TURN_FORCE;

            if (length(vel) > MAX_SPEED) {
                vel = normalize(vel) * MAX_SPEED;
            }

            pos += vel * u_deltaTime;

            // Clamp positions to screen as a fallback.
            pos = clamp(pos, vec2(0.0), u_screenResolution);
            
            gl_FragColor = vec4(pos, vel);
        }
        `;

        this.renderVertexShader = `
            attribute float a_particle_index;
            uniform sampler2D u_particles;
            uniform vec2 u_textureResolution;
            uniform vec2 u_screenResolution;

            void main() {
                float y = floor(a_particle_index / u_textureResolution.x);
                float x = mod(a_particle_index, u_textureResolution.x);
                vec2 uv = (vec2(x, y) + 0.5) / u_textureResolution;
                
                vec4 particleData = texture2D(u_particles, uv);
                vec2 pos = particleData.xy;

                vec2 zero_to_one = pos / u_screenResolution;
                vec2 zero_to_two = zero_to_one * 2.0;
                vec2 clip_space = zero_to_two - 1.0;

                gl_Position = vec4(clip_space * vec2(1.0, -1.0), 0.0, 1.0);
                gl_PointSize = 1.5;
            }
        `;

        this.renderFragmentShader = `
            precision mediump float;
            void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, 0.8);
            }
        `;

        this.mousePos = { x: -1, y: -1 };
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
    }
    
    init() {
        this.computeProgram = this._createProgram(this.computeVertexShader, this.computeFragmentShader);
        this.renderProgram = this._createProgram(this.renderVertexShader, this.renderFragmentShader);

        super.onResize();

        const initialParticleData = new Float32Array(this.PARTICLE_COUNT * 4);
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            initialParticleData[i * 4 + 0] = Math.random() * this.canvas.width;
            initialParticleData[i * 4 + 1] = Math.random() * this.canvas.height;
            initialParticleData[i * 4 + 2] = (Math.random() - 0.5) * 50;
            initialParticleData[i * 4 + 3] = (Math.random() - 0.5) * 50;
        }

        const side = this.PARTICLE_TEXTURE_SIDE_LEN;
        const textureA = this._createFloatTexture(side, side, initialParticleData);
        const textureB = this._createFloatTexture(side, side, null);
        const framebufferA = this._createFramebuffer(textureA);
        const framebufferB = this._createFramebuffer(textureB);
        
        this.particleState = [
            { texture: textureA, framebuffer: framebufferA },
            { texture: textureB, framebuffer: framebufferB }
        ];
        this.currentStateIndex = 0;

        const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        this.quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
        
        const particleIndices = new Float32Array(this.PARTICLE_COUNT);
        for (let i = 0; i < this.PARTICLE_COUNT; i++) particleIndices[i] = i;
        this.particleIndexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleIndexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, particleIndices, this.gl.STATIC_DRAW);

        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        super.start();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top; 
    }

    handleMouseLeave() {
        this.mousePos.x = -1;
        this.mousePos.y = -1;
    }

    render(deltaTime) {
        const readState = this.particleState[this.currentStateIndex];
        const writeState = this.particleState[(this.currentStateIndex + 1) % 2];
        
        // --- 1. COMPUTE PASS ---
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, writeState.framebuffer);
        this.gl.useProgram(this.computeProgram);
        this.gl.viewport(0, 0, this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        const posAttrib = this.gl.getAttribLocation(this.computeProgram, "a_position");
        this.gl.enableVertexAttribArray(posAttrib);
        this.gl.vertexAttribPointer(posAttrib, 2, this.gl.FLOAT, false, 0, 0);
        
        // Set uniforms for time, resolution, and mouse
        this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_deltaTime"), Math.min(deltaTime, 0.05));
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_textureResolution"), this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_mouse"), this.mousePos.x, this.mousePos.y);
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_screenResolution"), this.canvas.width, this.canvas.height);

        // Set the force uniforms using the values from the constructor
        this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_separationForce"), this.params.separation);
        this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_alignmentForce"), this.params.alignment);
        this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_cohesionForce"), this.params.cohesion);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, readState.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.computeProgram, "u_particles"), 0);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        // --- 2. RENDER PASS ---
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.useProgram(this.renderProgram);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleIndexBuffer);
        const idxAttrib = this.gl.getAttribLocation(this.renderProgram, "a_particle_index");
        this.gl.enableVertexAttribArray(idxAttrib);
        this.gl.vertexAttribPointer(idxAttrib, 1, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform2f(this.gl.getUniformLocation(this.renderProgram, "u_textureResolution"), this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
        this.gl.uniform2f(this.gl.getUniformLocation(this.renderProgram, "u_screenResolution"), this.canvas.width, this.canvas.height);
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, writeState.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.renderProgram, "u_particles"), 0);
        
        this.gl.drawArrays(this.gl.POINTS, 0, this.PARTICLE_COUNT);

        // --- 3. SWAP STATES ---
        this.currentStateIndex = (this.currentStateIndex + 1) % 2;
    }

    unload() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

        this.gl.deleteProgram(this.computeProgram);
        this.gl.deleteProgram(this.renderProgram);
        this.gl.deleteBuffer(this.quadBuffer);
        this.gl.deleteBuffer(this.particleIndexBuffer);
        this.particleState.forEach(state => {
            this.gl.deleteTexture(state.texture);
            this.gl.deleteFramebuffer(state.framebuffer);
        });

        super.unload();
    }
}


// --- Alias map for command-line arguments ---
// Maps short-form flags (e.g., '-c') to their long-form names.
const ALIAS_MAP = {
    b: 'boids',
    s: 'separation',
    a: 'alignment',
    c: 'cohesion'
};

// The main object that defines the program's interface for the console.
const Boids = {
    instance: null,
    // Capture the full original arguments to reuse on resize
    _lastArgs: null,

    init: function(screenEl, args = { positional: [], named: {} }) {
        // Store args for re-initialization on resize
        this._lastArgs = args
        // Create a clean options object to pass to the program.
        const options = {};
        
        // Process all named arguments provided by the user.
        for (const key in args.named) {
            // Parse value as a float, since all args are numbers
            const value = parseFloat(args.named[key]);
            
            // Check if the key is a short-form alias (e.g., 'c').
            if (ALIAS_MAP[key]) {
                // If it is, use its long-form name (e.g., 'cohesion').
                options[ALIAS_MAP[key]] = value;
            } else {
                // Otherwise, use the key as is (e.g., 'separation').
                options[key] = value;
            }
        }
        
        // Pass the processed options object to the BoidsProgram constructor.
        this.instance = new BoidsProgram(screenEl, options);
        this.instance.init();
    },

    unload: function() {
        if (this.instance) {
            this.instance.unload();
            this.instance = null;
        }
    },

    onResize: function() {
        // A full restart on resize is the easiest way to handle WebGL contexts.
        if (this.instance) {
            this.instance.unload();
            // Re-init with the original arguments
            this.init(this.instance.screenEl, this._lastArgs);
        }
    }
};

export default Boids;