import { ComputeProgramBase } from './compute-program-base.js';

class BoidsProgram extends ComputeProgramBase {
    constructor(screenEl) {
        super(screenEl);

        // --- Simulation Parameters ---
        this.PARTICLE_TEXTURE_SIDE_LEN = 64; // 256; // 256x256 = 65536 particles
        this.PARTICLE_COUNT = this.PARTICLE_TEXTURE_SIDE_LEN * this.PARTICLE_TEXTURE_SIDE_LEN;

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

        // Boids parameters
        const float MAX_SPEED = 50.0;
        const float PERCEPTION_RADIUS = 20.0;
        const float AVOIDANCE_RADIUS = 10.0;

        const float SEPARATION_FORCE = 2.0;
        const float ALIGNMENT_FORCE = 0.05;
        const float COHESION_FORCE = 0.08;
        const float MOUSE_FORCE = 2.0;
        const float BORDER_MARGIN = 20.0; // How far from the edge to start turning
        const float BORDER_TURN_FORCE = 4.0;

        float rand(vec2 co){
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Since we are no longer wrapping, we don't need toroidal distance.
        // The standard distance function is fine.
        
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

                vel += separation * SEPARATION_FORCE;
                vel += alignment * ALIGNMENT_FORCE;
                vel += cohesion * COHESION_FORCE;
            }
            
            vec2 mouse_dir = vec2(0.0);
            float mouse_dist = distance(pos, u_mouse);
            if (u_mouse.x > 0.0 && mouse_dist < PERCEPTION_RADIUS * 2.0) {
                mouse_dir = normalize(pos - u_mouse) / mouse_dist * 100.0;
                vel += mouse_dir * MOUSE_FORCE;
            }

            // --- MODIFIED BOUNDARY LOGIC ---
            // Steer away from edges instead of hard bouncing for a smoother look.
            if (pos.x < BORDER_MARGIN) vel.x += BORDER_TURN_FORCE;
            if (pos.x > u_screenResolution.x - BORDER_MARGIN) vel.x -= BORDER_TURN_FORCE;
            if (pos.y < BORDER_MARGIN) vel.y += BORDER_TURN_FORCE;
            if (pos.y > u_screenResolution.y - BORDER_MARGIN) vel.y -= BORDER_TURN_FORCE;

            if (length(vel) > MAX_SPEED) {
                vel = normalize(vel) * MAX_SPEED;
            }

            pos += vel * u_deltaTime;

            // Add a hard clamp as a fallback to prevent any escapees.
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

        // We need the canvas dimensions to initialize particles, so call onResize first.
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
        
        // Set uniforms
        this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_deltaTime"), Math.min(deltaTime, 0.05)); // Cap delta to prevent explosions
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_textureResolution"), this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_mouse"), this.mousePos.x, this.mousePos.y);
        // --- BUG FIX: Set the new screen resolution uniform ---
        this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_screenResolution"), this.canvas.width, this.canvas.height);

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

// The main object that defines the program's interface for the console.
const Boids = {
    instance: null,

    init: function(screenEl) {
        this.instance = new BoidsProgram(screenEl);
        this.instance.init();
    },

    unload: function() {
        if (this.instance) this.instance.unload();
        this.instance = null;
    },

    onResize: function() {
        // A full restart on resize is often the easiest way to handle WebGL contexts.
        if (this.instance) {
            this.instance.unload();
            this.init(this.instance.screenEl);
        }
    }
};

// Export the Boids object as the default for this module.
export default Boids;