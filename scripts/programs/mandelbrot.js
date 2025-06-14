import { ShaderProgram } from './shader-program-base.js';

// A helper function for vector math, kept internal to this module.
function vec2(x, y) { return {x, y}; }

class MandelbrotProgram extends ShaderProgram {
    constructor(screenEl) {
        super(screenEl);

        this.vertexShader = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
        this.fragmentShader = `
            precision highp float;
            uniform vec2 u_resolution; uniform float u_zoom; uniform vec2 u_offset;
            const int MAX_ITER = 128;
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }
            void main() {
                vec2 z = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y / u_zoom + u_offset;
                vec2 c = z; float iter = 0.0;
                for (int i = 0; i < MAX_ITER; i++) {
                    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                    if (dot(z, z) > 4.0) { iter = float(i); break; }
                }
                if (iter == 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); } 
                else { gl_FragColor = vec4(hsv2rgb(vec3(mod(iter / 20.0, 1.0), 0.8, 1.0)), 1.0); }
            }
        `;
        
        // --- Interaction State ---
        this.zoom = 0.4;
        this.offset = vec2(-0.5, 0.0);
        this.isPanning = false;
        this.lastPanPos = vec2(0.0, 0.0);
        this.lastPinchDist = 0;

        // Bind all event handlers
        ['handleMouseDown', 'handleMouseUp', 'handleMouseMove', 'handleWheel', 
         'handleTouchStart', 'handleTouchEnd', 'handleTouchMove'].forEach(handler => {
            this[handler] = this[handler].bind(this);
        });
        this.attachEventListeners();
    }

    attachEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('wheel', this.handleWheel);
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchend', this.handleTouchEnd);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
    }
    
    removeEventListeners() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('wheel', this.handleWheel);

        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    }

    // --- Mouse Handlers ---
    handleMouseDown(e) {
        this.isPanning = true;
        this.lastPanPos = vec2(e.clientX, e.clientY);
    }

    handleMouseUp() {
        this.isPanning = false;
    }

    handleMouseMove(e) {
        if (!this.isPanning) return;
        const dx = e.clientX - this.lastPanPos.x;
        const dy = e.clientY - this.lastPanPos.y;
        this._pan(dx, dy);
        this.lastPanPos = vec2(e.clientX, e.clientY);
    }
    
    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
        this._zoom(zoomFactor, vec2(e.clientX, e.clientY));
    }
    
    // --- Touch Handlers ---
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.isPanning = true;
            this.lastPanPos = vec2(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
            this.isPanning = false; // Stop panning if a second finger is added
            this.lastPinchDist = this._getPinchDist(e);
        }
    }

    handleTouchEnd(e) {
        this.isPanning = false;
        this.lastPinchDist = 0;
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isPanning) {
            const dx = e.touches[0].clientX - this.lastPanPos.x;
            const dy = e.touches[0].clientY - this.lastPanPos.y;
            this._pan(dx, dy);
            this.lastPanPos = vec2(e.touches[0].clientX, e.touches[0].clientY);
        }
        else if (e.touches.length === 2) {
            const newPinchDist = this._getPinchDist(e);
            if (this.lastPinchDist > 0) {
                const zoomFactor = newPinchDist / this.lastPinchDist;
                const pinchCenter = this._getPinchCenter(e);
                this._zoom(zoomFactor, pinchCenter);
            }
            this.lastPinchDist = newPinchDist;
        }
    }
    
    // --- Interaction Logic ---
    _pan(dx, dy) {
        this.offset.x -= dx / this.canvas.height / this.zoom;
        this.offset.y += dy / this.canvas.height / this.zoom;
    }

    _zoom(factor, screenPos) {
        const rect = this.canvas.getBoundingClientRect();
        // Convert screen coordinates to fractal coordinates
        const mousePos = vec2(screenPos.x - rect.left, this.canvas.height - (screenPos.y - rect.top));
        const mouseCoord = vec2(
            (mousePos.x - 0.5 * this.canvas.width) / this.canvas.height / this.zoom + this.offset.x,
            (mousePos.y - 0.5 * this.canvas.height) / this.canvas.height / this.zoom + this.offset.y
        );
        
        // Apply the zoom
        this.zoom *= factor;

        // Calculate the new offset to keep the point under the cursor stationary
        this.offset.x = mouseCoord.x - (mousePos.x - 0.5 * this.canvas.width) / this.canvas.height / this.zoom;
        this.offset.y = mouseCoord.y - (mousePos.y - 0.5 * this.canvas.height) / this.canvas.height / this.zoom;
    }

    _getPinchDist(e) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
    
    _getPinchCenter(e) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return vec2((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
    }

    render(timestamp) {
        this.gl.useProgram(this.glProgram);
        
        const resolutionLocation = this.gl.getUniformLocation(this.glProgram, "u_resolution");
        this.gl.uniform2f(resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);
        
        const zoomLocation = this.gl.getUniformLocation(this.glProgram, "u_zoom");
        this.gl.uniform1f(zoomLocation, this.zoom);

        const offsetLocation = this.gl.getUniformLocation(this.glProgram, "u_offset");
        this.gl.uniform2f(offsetLocation, this.offset.x, this.offset.y);

        super.render(timestamp);
    }

    unload() {
        this.removeEventListeners();
        super.unload();
    }
}

// This is the public interface for the Console.
const Mandelbrot = {
    instance: null,

    init: function(screenEl) {
        this.instance = new MandelbrotProgram(screenEl);
        // The base class is now initialized inside the MandelbrotProgram constructor
        // But the init call now needs to pass the shaders.
        this.instance.init(this.instance.vertexShader, this.instance.fragmentShader);
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

export default Mandelbrot;