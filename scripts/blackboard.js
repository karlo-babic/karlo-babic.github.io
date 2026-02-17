import { Mouse } from './utils.js';

/**
 * Blackboard module for drawing.
 */
const Blackboard = {
    canvas: null,
    ctx: null,
    lastX: 0,
    lastY: 0,
    isDrawing: false,
    hasMoved: false,
    minDrawDistance: 3, // Minimum drag distance to prevent single-click dots

    init: function() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'blackboard-layer';
        this.ctx = this.canvas.getContext('2d');

        // Override CSS z-index and background to ensure visibility of layers
        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '-1', 
            backgroundColor: 'transparent', // Explicitly transparent to see ECA
            pointerEvents: 'none',
            display: 'block'
        });

        this.resize();
        document.body.appendChild(this.canvas);

        window.addEventListener('resize', () => this.resize());
        this.setupContext();
    },

    setupContext: function() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = 'screen';
    },

    resize: function() {
        const tempImage = this.ctx ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height) : null;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.setupContext();
        if (tempImage) this.ctx.putImageData(tempImage, 0, 0);
    },

    update: function() {
        if (Mouse.isClicked) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.lastX = Mouse.x;
                this.lastY = Mouse.y;
                return;
            }

            const dist = Math.hypot(Mouse.x - this.lastX, Mouse.y - this.lastY);

            if (dist > this.minDrawDistance) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.lastX, this.lastY);
                this.ctx.lineTo(Mouse.x, Mouse.y);
                this.ctx.stroke();

                this.lastX = Mouse.x;
                this.lastY = Mouse.y;
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