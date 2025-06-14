// A self-executing function to manage scope and loading.
(function() {

    function initializeProgram() {
        
        const GravitySim = {
            instance: null,
            init: function(screenEl) {
                this.instance = new GravitySimProgram(screenEl);
                this.instance.init();
            },
            unload: function() {
                if (this.instance) this.instance.unload();
                document.getElementById('program-script-gravitysim')?.remove();
            },
            onResize: function() {
                //if (this.instance) this.instance.onResize();
                Console.restartCurrentProgram();
            }
        };

        class GravitySimProgram extends ComputeProgramBase {
            constructor(screenEl) {
                super(screenEl);

                // --- Simulation Parameters ---
                this.PARTICLE_TEXTURE_SIDE_LEN = 128; // 128x128 = 16384 particles
                this.PARTICLE_COUNT = this.PARTICLE_TEXTURE_SIDE_LEN * this.PARTICLE_TEXTURE_SIDE_LEN;

                // --- GLSL Shaders ---

                this.computeVertexShader = `
                    attribute vec2 a_position;
                    void main() {
                        gl_Position = vec4(a_position, 0.0, 1.0);
                    }
                `;

                // This shader calculates the gravitational forces on each particle.
                this.computeFragmentShader = `
                precision highp float;
                uniform sampler2D u_particles;
                uniform vec2 u_textureResolution;
                uniform vec2 u_mouse;
                uniform float u_deltaTime;

                // Simulation constants
                const float G = 30.0; 
                const float MOUSE_MASS = 300.0;
                const float PARTICLE_MASS = 5.0;
                const float SOFTENING = 2.0; // Prevents forces from becoming infinite

                float rand(vec2 co){
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec2 uv = gl_FragCoord.xy / u_textureResolution;
                    vec4 currentState = texture2D(u_particles, uv);
                    vec2 pos = currentState.xy;
                    vec2 vel = currentState.zw;

                    vec2 totalForce = vec2(0.0);
                    
                    // --- MODIFIED N-Body Logic ---
                    // We will find the center of mass of the sampled neighbors
                    // and apply a single force towards it.
                    vec2 centerOfMass = vec2(0.0);
                    float totalMass = 0.0;
                    const int NUM_SAMPLES = 60;

                    for (int i = 0; i < NUM_SAMPLES; i++) {
                        vec2 neighbor_uv = vec2(
                            rand(uv + float(i) * 0.1),
                            rand(uv + float(i) * 0.2)
                        );
                        vec4 neighborState = texture2D(u_particles, neighbor_uv);
                        
                        // Sum the positions of neighbors
                        centerOfMass += neighborState.xy;
                        totalMass += PARTICLE_MASS;
                    }

                    if (totalMass > 0.0) {
                        // Find the average position (the center of mass)
                        centerOfMass /= float(NUM_SAMPLES);
                        
                        // Now calculate a single force towards that center of mass
                        vec2 delta = centerOfMass - pos;
                        float distSq = dot(delta, delta);
                        
                        if (distSq > 0.001) {
                            float forceMag = G * (PARTICLE_MASS * totalMass) / (distSq + SOFTENING);
                            totalForce += normalize(delta) * forceMag;
                        }
                    }

                    // --- Force from Mouse "Sun" ---
                    if (u_mouse.x > 0.0) {
                        vec2 mouseDelta = u_mouse - pos;
                        float mouseDistSq = dot(mouseDelta, mouseDelta);
                        if (mouseDistSq > 0.001) {
                            float mouseForceMag = G * (PARTICLE_MASS * MOUSE_MASS) / (mouseDistSq + SOFTENING * 100.0);
                            totalForce += normalize(mouseDelta) * mouseForceMag;
                        }
                    }

                    // --- Update Physics (Integrate) ---
                    vec2 acceleration = totalForce / PARTICLE_MASS;
                    vel += acceleration * u_deltaTime;
                    pos += vel * u_deltaTime;
                    
                    gl_FragColor = vec4(pos, vel);
                }
                `;

                // This shader reads the final particle positions and renders them to the screen.
                this.renderVertexShader = `
                    attribute float a_particle_index;
                    uniform sampler2D u_particles;
                    uniform vec2 u_textureResolution;
                    uniform vec2 u_screenResolution;

                    varying float v_speed;

                    void main() {
                        // Convert the 1D particle index into 2D texture coordinates
                        float y = floor(a_particle_index / u_textureResolution.x);
                        float x = mod(a_particle_index, u_textureResolution.x);
                        vec2 uv = (vec2(x, y) + 0.5) / u_textureResolution;
                        
                        vec4 particleData = texture2D(u_particles, uv);
                        vec2 pos = particleData.xy;
                        vec2 vel = particleData.zw;

                        // Pass particle speed to the fragment shader for coloring
                        v_speed = length(vel);

                        // Convert position from simulation space to screen clip space (-1 to 1)
                        vec2 zero_to_one = pos / u_screenResolution;
                        vec2 zero_to_two = zero_to_one * 2.0;
                        vec2 clip_space = zero_to_two - 1.0;

                        gl_Position = vec4(clip_space * vec2(1.0, -1.0), 0.0, 1.0);
                        gl_PointSize = 1.5;
                    }
                `;

                // This fragment shader colors particles based on their speed.
                this.renderFragmentShader = `
                    precision mediump float;
                    varying float v_speed;

                    // Simple color ramp from blue (slow) to yellow (fast)
                    vec3 cool_to_hot(float v) {
                        float c = clamp(v * 0.04, 0.0, 1.0);
                        return vec3(c, c * c, 1.0 - c);
                    }

                    void main() {
                        gl_FragColor = vec4(cool_to_hot(v_speed), 0.8);
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

                // Create initial particle data in a swirling disc pattern
                const initialParticleData = new Float32Array(this.PARTICLE_COUNT * 4);
                const centerX = this.canvas.width / 2;
                const centerY = this.canvas.height / 2;
                const radius = Math.min(centerX, centerY) * 0.6;
                
                // --- This factor controls the overall "spin" of the galaxy ---
                const initialVelFactor = 100.0; 

                for (let i = 0; i < this.PARTICLE_COUNT; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.sqrt(Math.random()) * radius + 1.0; // Add 1.0 to avoid r=0
                    
                    const pX = centerX + Math.cos(angle) * r;
                    const pY = centerY + Math.sin(angle) * r;
                    
                    // --- Calculate orbital velocity (v ∝ 1/√r) ---
                    // This gives particles farther from the center a lower initial velocity,
                    // which is physically correct for a stable orbit.
                    const speed = initialVelFactor / Math.sqrt(r);
                    
                    // Initial velocity is perpendicular to the vector from the center
                    const vX = -Math.sin(angle) * speed;
                    const vY =  Math.cos(angle) * speed;

                    initialParticleData.set([pX, pY, vX, vY], i * 4);
                }

                // Create textures and framebuffers for ping-ponging state
                const side = this.PARTICLE_TEXTURE_SIDE_LEN;
                this.particleState = [
                    { texture: this._createFloatTexture(side, side, initialParticleData), framebuffer: null },
                    { texture: this._createFloatTexture(side, side, null), framebuffer: null }
                ];
                this.particleState[0].framebuffer = this._createFramebuffer(this.particleState[0].texture);
                this.particleState[1].framebuffer = this._createFramebuffer(this.particleState[1].texture);
                this.currentStateIndex = 0;

                // Setup buffers for rendering
                const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
                this.quadBuffer = this.gl.createBuffer();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
                this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
                
                const particleIndices = new Float32Array(this.PARTICLE_COUNT);
                for (let i = 0; i < this.PARTICLE_COUNT; i++) particleIndices[i] = i;
                this.particleIndexBuffer = this.gl.createBuffer();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleIndexBuffer);
                this.gl.bufferData(this.gl.ARRAY_BUFFER, particleIndices, this.gl.STATIC_DRAW);

                // Attach event listeners and start the simulation
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
                
                // --- 1. COMPUTE PASS: Calculate new particle states ---
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, writeState.framebuffer);
                this.gl.useProgram(this.computeProgram);
                this.gl.viewport(0, 0, this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
                
                // Provide quad vertices for the compute shader to run over the whole texture
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
                const posAttrib = this.gl.getAttribLocation(this.computeProgram, "a_position");
                this.gl.enableVertexAttribArray(posAttrib);
                this.gl.vertexAttribPointer(posAttrib, 2, this.gl.FLOAT, false, 0, 0);
                
                // Set uniforms
                this.gl.uniform1f(this.gl.getUniformLocation(this.computeProgram, "u_deltaTime"), Math.min(deltaTime, 0.02));
                this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_textureResolution"), this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
                this.gl.uniform2f(this.gl.getUniformLocation(this.computeProgram, "u_mouse"), this.mousePos.x, this.mousePos.y);

                // Bind the "read" texture from the previous frame
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, readState.texture);
                this.gl.uniform1i(this.gl.getUniformLocation(this.computeProgram, "u_particles"), 0);

                this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

                // --- 2. RENDER PASS: Draw particles to the screen ---
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
                this.gl.useProgram(this.renderProgram);
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
                this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
                this.gl.clear(this.gl.COLOR_BUFFER_BIT);

                // Enable blending for a nicer visual effect
                this.gl.enable(this.gl.BLEND);
                this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

                // Provide the particle indices to the render shader
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.particleIndexBuffer);
                const idxAttrib = this.gl.getAttribLocation(this.renderProgram, "a_particle_index");
                this.gl.enableVertexAttribArray(idxAttrib);
                this.gl.vertexAttribPointer(idxAttrib, 1, this.gl.FLOAT, false, 0, 0);

                this.gl.uniform2f(this.gl.getUniformLocation(this.renderProgram, "u_textureResolution"), this.PARTICLE_TEXTURE_SIDE_LEN, this.PARTICLE_TEXTURE_SIDE_LEN);
                this.gl.uniform2f(this.gl.getUniformLocation(this.renderProgram, "u_screenResolution"), this.canvas.width, this.canvas.height);
                
                // Bind the newly computed "write" texture
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, writeState.texture);
                this.gl.uniform1i(this.gl.getUniformLocation(this.renderProgram, "u_particles"), 0);
                
                this.gl.drawArrays(this.gl.POINTS, 0, this.PARTICLE_COUNT);
                this.gl.disable(this.gl.BLEND);

                // --- 3. SWAP STATES for the next frame ---
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

        // The console command to run the program
        Console.runProgram('GravitySim', GravitySim);
    }

    if (typeof ComputeProgramBase === 'undefined') {
        const script = document.createElement('script');
        script.src = 'scripts/programs/compute-program-base.js';
        script.onload = initializeProgram;
        document.head.appendChild(script);
    } else {
        initializeProgram();
    }

})();