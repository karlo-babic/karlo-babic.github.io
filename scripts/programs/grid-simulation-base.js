/**
 * A base class for creating iterative, grid-based simulations on a canvas.
 * It handles the rendering loop, canvas setup, resizing, and user input for drawing.
 */
export class GridSimulation {
    constructor(screenEl, config = {}) {
        this.screenEl = screenEl;
        this.config = {
            cellSize: 10,
            updateInterval: 100,
            aliveColor: '#50c0f0',
            ...config,
        };

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.screenEl.appendChild(this.canvas);

        this.grid = [];
        this.nextGrid = [];
        this.rows = 0;
        this.cols = 0;

        this.isRunning = true;
        this.isDrawing = false; // Renamed from isMouseDown for clarity
        this.timeSinceLastUpdate = 0;
        this.lastTime = 0;

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.run = this.run.bind(this);
    }

    init() {
        this.onResize();
        this.randomizeGrid();
        this.attachEventListeners();
        requestAnimationFrame(this.run);
    }

    run(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;
        this.timeSinceLastUpdate += deltaTime;

        if (this.timeSinceLastUpdate > this.config.updateInterval) {
            this.update();
            this.render();
            this.timeSinceLastUpdate = 0;
        }
        
        requestAnimationFrame(this.run);
    }

    attachEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchend', this.handleTouchEnd);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
    }

    removeEventListeners() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);

        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    }

    // --- Event Handlers ---
    handleMouseDown(e) {
        this.isDrawing = true;
        this.drawOnGrid(e);
    }

    handleMouseUp() {
        this.isDrawing = false;
    }

    handleMouseMove(e) {
        if (this.isDrawing) {
            this.drawOnGrid(e);
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.isDrawing = true;
        this.drawOnGrid(e.touches[0]); // Use the first touch point
    }

    handleTouchEnd() {
        this.isDrawing = false;
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.isDrawing) {
            this.drawOnGrid(e.touches[0]);
        }
    }

    drawOnGrid(point) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((point.clientX - rect.left) / this.config.cellSize);
        const y = Math.floor((point.clientY - rect.top) / this.config.cellSize);
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.grid[y][x] = 1;
            this.render();
        }
    }
    
    // --- Simulation Logic (to be implemented by child) ---
    update() {
        this.nextGrid = this.createEmptyGrid();
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.nextGrid[y][x] = this.computeNextState(x, y);
            }
        }
        this.grid = this.nextGrid;
    }

    computeNextState(x, y) {
        return this.grid[y][x];
    }
    
    getNeighborCount(x, y) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const col = (x + j + this.cols) % this.cols;
                const row = (y + i + this.rows) % this.rows;
                count += this.grid[row][col];
            }
        }
        return count;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.config.aliveColor;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === 1) {
                    this.ctx.fillRect(x * this.config.cellSize, y * this.config.cellSize, this.config.cellSize, this.config.cellSize);
                }
            }
        }
    }

    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.rows = Math.floor(this.canvas.height / this.config.cellSize);
        this.cols = Math.floor(this.canvas.width / this.config.cellSize);
        this.grid = this.createEmptyGrid();
        this.randomizeGrid();
        this.render();
    }

    unload() {
        this.isRunning = false;
        this.removeEventListeners();
        if (this.screenEl.contains(this.canvas)) {
            this.screenEl.removeChild(this.canvas);
        }
    }
    
    createEmptyGrid() {
        return Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    }

    randomizeGrid() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = Math.random() > 0.95 ? 1 : 0;
            }
        }
    }
}