import { Mouse } from './utils.js';

/**
 * Blackboard module for drawing with holographic aesthetics.
 * Uses velocity-based styling and quadratic smoothing for a premium feel.
 */
const Blackboard = {
    canvas: null,
    ctx: null,
    lastX: 0,
    lastY: 0,
    midX: 0,
    midY: 0,
    isDrawing: false,
    dpr: window.devicePixelRatio || 1,

    // Configuration
    minDrawDistance: 3,
    baseLineWidth: 2.2,
    // Slightly higher fade alpha prevents 8-bit color "ghosting" or grayish residue
    fadeAlpha: 0.02, 
    accentColor: '0, 180, 255', 

    init: function() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'blackboard-layer';
        this.ctx = this.canvas.getContext('2d', { alpha: true });

        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '-1',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            display: 'block'
        });

        this.resize();
        document.body.appendChild(this.canvas);

        window.addEventListener('resize', () => this.resize());
    },

    resize: function() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        
        this.ctx.scale(this.dpr, this.dpr);
        this.setupContext();
    },

    setupContext: function() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    },

    /**
     * Clears alpha across the canvas. 
     * Higher alpha fill ensures pixels drop to 0 transparency quickly, avoiding gray afterimages.
     */
    applyFade: function() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.fadeAlpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    },

    /**
     * Draws a smoothed segment with a vivid core and a screen-blended glow.
     */
    drawSegment: function(x, y, dist) {
        const velocityScale = Math.max(0.3, 1.0 - (dist / 30));
        const alpha = 0.9;//Math.max(0.2, 0.9 - (dist / 50));
        
        const currentMidX = (x + this.lastX) / 2;
        const currentMidY = (y + this.lastY) / 2;

        // Pass 1: Outer Glow (Screen mode for holographic additive effect)
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.beginPath();
        this.ctx.moveTo(this.midX, this.midY);
        this.ctx.quadraticCurveTo(this.lastX, this.lastY, currentMidX, currentMidY);
        this.ctx.strokeStyle = `rgba(${this.accentColor}, ${alpha * 0.4})`;
        this.ctx.lineWidth = this.baseLineWidth * velocityScale * 3;
        this.ctx.stroke();

        // Pass 2: Vivid Core (Source-over to maintain color saturation)
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.beginPath();
        this.ctx.moveTo(this.midX, this.midY);
        this.ctx.quadraticCurveTo(this.lastX, this.lastY, currentMidX, currentMidY);
        this.ctx.strokeStyle = `rgba(${this.accentColor}, ${alpha})`;
        this.ctx.lineWidth = this.baseLineWidth * velocityScale;
        this.ctx.stroke();

        this.lastX = x;
        this.lastY = y;
        this.midX = currentMidX;
        this.midY = currentMidY;
    },

    update: function() {
        this.applyFade();

        if (Mouse.isClicked) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.lastX = Mouse.x;
                this.lastY = Mouse.y;
                this.midX = Mouse.x;
                this.midY = Mouse.y;
                return;
            }

            const dist = Math.hypot(Mouse.x - this.lastX, Mouse.y - this.lastY);

            if (dist > this.minDrawDistance) {
                this.drawSegment(Mouse.x, Mouse.y, dist);
            }
        } else {
            this.isDrawing = false;
        }
    },

    clear: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
};

export { Blackboard };