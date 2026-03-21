import { BaseShader } from './engines/base_shader.js';

/**
 * Procedural Synchronized Fractal Visualizer
 * Generates evolving, high-dimensional fractal morphs synchronized across instances.
 * 
 * Features:
 * - Kinetic Formula Morphing: Seamlessly blends Mandelbrot, Burning Ship, and Higher-Order power fractals.
 * - Multi-Stage Orbit Trapping: High-fidelity interior detail using geometric distance-to-axes and points.
 * - Temporal Color Shifts: Palettes mutate based on a combination of global seed and escape-velocity.
 * - Interior Nebula: Complex color layering for pixels that never escape (the "set" interior).
 */
class FractalProgram extends BaseShader {
    constructor(screenEl) {
        super(screenEl);

        this.EPOCH = 1709251200000; 
        
        this.vertexShader = `
            attribute vec2 a_position; 
            void main() { 
                gl_Position = vec4(a_position, 0.0, 1.0); 
            }
        `;
        
        this.fragmentShader = `
            precision highp float;
            
            uniform vec2 u_resolution; 
            uniform float u_time; 
            uniform float u_seed;
            
            const int MAX_ITER = 128;

            float hash(float n) { 
                return fract(sin(n) * 43758.5453123); 
            }

            vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                return a + b * cos(6.28318 * (c * t + d));
            }

            // Complex multiplication helper
            vec2 cMul(vec2 a, vec2 b) {
                return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
                
                // Seed-based randomization
                float r1 = hash(u_seed);
                float r2 = hash(u_seed + 15.7);
                float r3 = hash(u_seed + 84.2);
                
                // View transforms: Pulsing zoom and slow drift
                float zoom = 3.0 + 2.0 * sin(u_time * 0.1);
                float angle = u_time * 0.04 + (r1 * 6.28);
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                
                // Map UV to complex plane
                vec2 p = rot * uv * zoom;
                
                // Shift focus based on seed
                p += vec2(sin(u_seed * 0.4), cos(u_seed * 0.7)) * 0.4;
                
                // Evolutionary parameters
                float morph1 = 0.5 + 0.5 * sin(u_time * 0.2 + r1); // Blend between standard and abs()
                float morph2 = 0.5 + 0.5 * cos(u_time * 0.15 + r2); // Higher order power blend
                
                // Julia transition: morphing from Mandelbrot to Julia
                float juliaFactor = smoothstep(0.3, 0.7, sin(u_time * 0.1 + r3));
                vec2 julia_c = vec2(
                    sin(u_time * 0.08 + r1 * 5.0) * 0.38,
                    cos(u_time * 0.12 + r2 * 5.0) * 0.38
                );
                vec2 c = mix(p, julia_c, juliaFactor);
                
                vec2 z = p;
                float iter = 0.0;
                
                // Orbit Traps: Captures minimum distance to features
                float trapDist = 1e10;
                float trapCross = 1e10;
                vec2 trapSpace = vec2(1e10);

                // Per-iteration rotation (Topological Twist)
                float twist = sin(u_time * 0.05) * 0.03;
                mat2 tRot = mat2(cos(twist), -sin(twist), sin(twist), cos(twist));

                for (int i = 0; i < MAX_ITER; i++) {
                    z = tRot * z;
                    
                    // The Mutation: Blend between z^2 and z^3/Burning Ship variants
                    vec2 z2 = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y);
                    vec2 z3 = cMul(z2, z);
                    
                    // Abs folding (Burning Ship logic)
                    vec2 zFold = mix(z2, vec2(z.x*z.x - z.y*z.y, -abs(2.0*z.x*z.y)), morph1);
                    
                    // Power evolution
                    z = mix(zFold, z3, morph2 * 0.5) + c;
                    
                    // Update traps for interior visualization
                    trapDist = min(trapDist, dot(z, z));
                    trapCross = min(trapCross, min(abs(z.x), abs(z.y)));
                    trapSpace = min(trapSpace, abs(z));

                    if (dot(z, z) > 100.0) break;
                    iter++;
                }

                // Smooth Coloring Logic
                float smooth_iter = iter;
                if (iter < float(MAX_ITER)) {
                    float log_zn = log(dot(z, z)) / 2.0;
                    float nu = log(log_zn / log(2.0)) / log(2.0);
                    smooth_iter = iter + 1.0 - nu;
                }

                // Palette configuration
                vec3 pal_a = vec3(0.5, 0.5, 0.5);
                vec3 pal_b = vec3(0.5, 0.5, 0.5);
                vec3 pal_c = vec3(1.0, 1.0, 1.0);
                vec3 pal_d = vec3(r1, r2, r3) + (u_time * 0.05);

                vec3 col;
                if (iter < float(MAX_ITER)) {
                    // EXTERIOR: Flowing escape gradients
                    float t = smooth_iter * 0.025 + u_time * 0.1;
                    col = palette(t, pal_a, pal_b, pal_c, pal_d);
                    
                    // Electric filament highlights based on the cross-trap
                    float filament = 0.01 / (trapCross + 0.01);
                    col += filament * palette(t + 0.5, pal_a, pal_b, pal_c, pal_d + 0.2);
                } else {
                    // INTERIOR: The "Soul" of the fractal
                    // Uses orbit trap data to create nebula/tissue-like structures
                    float tInner = log(trapDist + 1.0) * 1.5 + u_time * 0.1;
                    vec3 col1 = palette(tInner, pal_a * 0.4, pal_b, pal_c, pal_d + 0.5);
                    
                    // Layer in the "Grid" logic from the trapSpace
                    float grid = sin(trapSpace.x * 20.0) * sin(trapSpace.y * 20.0);
                    vec3 col2 = palette(grid, pal_a, pal_b * 0.3, pal_c, pal_d + 0.8);
                    
                    col = mix(col1, col2, 0.5 + 0.5 * sin(u_time * 0.3));
                    col *= 0.8 + 0.2 * sin(trapCross * 100.0 + u_time);
                }
                
                // Dynamic contrast and lighting
                float lum = dot(col, vec3(0.299, 0.587, 0.114));
                col = mix(col, col * col * 1.5, lum); // Contrast boost
                
                // Vignette
                float vgn = smoothstep(1.3, 0.4, length(uv));
                col *= vgn;
                
                gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;
        
        this.uniformLocations = {};
        this.init(this.vertexShader, this.fragmentShader);
    }

    init(vertexSrc, fragmentSrc) {
        super.init(vertexSrc, fragmentSrc);
        this.cacheUniformLocations();
    }

    cacheUniformLocations() {
        this.uniformLocations.resolution = this.gl.getUniformLocation(this.glProgram, "u_resolution");
        this.uniformLocations.time = this.gl.getUniformLocation(this.glProgram, "u_time");
        this.uniformLocations.seed = this.gl.getUniformLocation(this.glProgram, "u_seed");
    }

    setUniforms() {
        const now = Date.now();
        const globalSeconds = (now - this.EPOCH) / 1000.0;
        
        // Fractal morphs every 60 seconds
        const currentBlock = Math.floor(globalSeconds / 60.0);

        this.gl.uniform2f(this.uniformLocations.resolution, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.uniform1f(this.uniformLocations.time, globalSeconds % 3600.0);
        this.gl.uniform1f(this.uniformLocations.seed, currentBlock);
    }
}

const Fractal = {
    instance: null,

    init: function(screenEl) {
        this.instance = new FractalProgram(screenEl);
    },

    unload: function() {
        if (this.instance) {
            this.instance.unload();
            this.instance = null;
        }
    },

    onResize: function() {
        if (this.instance) {
            this.instance.onResize();
        }
    }
};

export default Fractal;