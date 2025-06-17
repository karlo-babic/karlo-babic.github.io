import { BaseGridSimulation } from './engines/base_grid_simulation.js';

class GliderOfLifeProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        // Use a multi-state grid: 0=dead, 1=alive (environment), 2=alive (player)
        const extendedConfig = {
            ...config,
            playerColor: '#a0c4ff',    // Pastel Blue
            environmentColor: '#ffadad', // Pastel Red
        };
        super(screenEl, extendedConfig);

        // Pre-calculated, stable glider patterns for the four cardinal directions.
        // Each pattern represents the "Phase 0" of a glider's 4-generation cycle.
        // Each is defined within a 3x3 box relative to the player's anchor (top-left).
        this.gliderPatterns = [
            // 0: Pointing South-East
            // . X .
            // . . X
            // X X X
            [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],

            // 1: Pointing South-West (90 degrees CCW from SE)
            // . X .
            // X . .
            // X X X
            [[1, 0], [0, 1], [0, 2], [1, 2], [2, 2]],

            // 2: Pointing North-West (180 degrees from SE)
            // X X X
            // X . .
            // . X .
            [[0, 0], [1, 0], [2, 0], [0, 1], [1, 2]],

            // 3: Pointing North-East (270 degrees CCW from SE)
            // X X X
            // . . X
            // . X .
            [[0, 0], [1, 0], [2, 0], [2, 1], [1, 2]]
        ];

        this.playerAnchor = { x: 0, y: 0 };
        this.playerRotation = 0; // Index for gliderPatterns: 0:SE, 1:SW, 2:NW, 3:NE
        this.isGameOver = false;
        this.generationCount = 0;

        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Overrides the base init to inject custom game setup.
     */
    init() {
        this.onResize(); // Sets up canvas, grid dimensions, and initial state
        this.attachEventListeners();
        requestAnimationFrame(this.run);
    }

    /**
     * Sets up the initial state of the game: random cells and the player's glider.
     */
    setupInitialState() {
        this.isGameOver = false;
        this.isRunning = true;
        this.generationCount = 0;
        this.playerRotation = 0;

        this.randomizeGrid();

        this.playerAnchor.x = Math.floor(this.cols / 2);
        this.playerAnchor.y = Math.floor(this.rows / 2);

        // Clear a safe space for the player to spawn
        const clearRadius = 5;
        for (let y = -clearRadius; y <= clearRadius; y++) {
            for (let x = -clearRadius; x <= clearRadius; x++) {
                const gridX = this.playerAnchor.x + x;
                const gridY = this.playerAnchor.y + y;
                if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
                    this.grid[gridY][gridX] = 0;
                }
            }
        }

        this.stampPlayer(); // Stamp the initial glider onto the grid
        this.render();
    }

    /**
     * Attaches all necessary event listeners, including keyboard controls.
     */
    attachEventListeners() {
        super.attachEventListeners();
        window.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Removes all event listeners on unload.
     */
    removeEventListeners() {
        super.removeEventListeners();
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Handles keyboard input for rotating the player's glider.
     */
    handleKeyDown(e) {
        if (this.isGameOver || !['ArrowLeft', 'ArrowRight'].includes(e.key)) {
            return;
        }
        e.preventDefault();

        if (e.key === 'ArrowLeft') { // Rotate counter-clockwise
            this.playerRotation = (this.playerRotation + 1) % 4;
        } else { // Rotate clockwise
            this.playerRotation = (this.playerRotation + 3) % 4;
        }

        // Reset the generation count to resynchronize the glider's phase with the
        // simulation clock. This ensures the newly stamped pattern evolves correctly.
        this.generationCount = 0;

        this.stampPlayer(); // Stamp the new, stable rotated pattern.
        this.render(); // Re-render immediately to show the change.
    }

    /**
     * Main update loop override. Runs the simulation and checks game state.
     */
    update() {
        if (this.isGameOver) return;

        this.nextGrid = this.createEmptyGrid();
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.nextGrid[y][x] = this.computeNextState(x, y);
            }
        }
        this.grid = this.nextGrid;
        
        this.generationCount++;

        // A glider completes its cycle and moves every 4 generations.
        if (this.generationCount > 0 && this.generationCount % 4 === 0) {
            this.updatePlayerAnchor();
            if (!this.isPlayerAlive()) {
                this.gameOver();
            }
        }
    }

    /**
     * Computes the next state of a cell based on multi-state rules.
     */
    computeNextState(x, y) {
        const cellState = this.grid[y][x];
        const { total, player } = this.getNeighborInfo(x, y);

        if (cellState > 0) { // Cell is alive
            if (total < 2 || total > 3) {
                return 0; // Dies
            }
            // If a player cell's parents are not all players, it becomes environment.
            if (cellState === 2 && player < total) {
                return 1;
            }
            return cellState; // Survives with the same identity
        } else { // Cell is dead
            if (total === 3) {
                // Born as player only if all parents are players, otherwise environment
                return (player === 3) ? 2 : 1; 
            }
            return 0; // Stays dead
        }
    }

    /**
     * Gets neighbor counts, differentiating between player and environment cells.
     */
    getNeighborInfo(x, y) {
        let total = 0;
        let player = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const col = (x + j + this.cols) % this.cols;
                const row = (y + i + this.rows) % this.rows;
                const neighborState = this.grid[row][col];
                if (neighborState > 0) {
                    total++;
                    if (neighborState === 2) {
                        player++;
                    }
                }
            }
        }
        return { total, player };
    }

    /**
     * Renders the grid, coloring cells based on their state.
     */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const state = this.grid[y][x];
                if (state === 0) continue;

                this.ctx.fillStyle = (state === 2) ? this.config.playerColor : this.config.environmentColor;
                this.ctx.fillRect(x * this.config.cellSize, y * this.config.cellSize, this.config.cellSize, this.config.cellSize);
            }
        }

        if (this.isGameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '48px "Courier New", Courier, monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    /**
     * Resets the game state upon resize.
     */
    onResize() {
        super.onResize();
        this.setupInitialState();
    }
    
    /**
     * Overrides to create a less dense random grid, filling with environment cells (state 1).
     */
    randomizeGrid() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = Math.random() > 0.85 ? 1 : 0;
            }
        }
    }

    /**
     * Wipes the 3x3 area at the player's anchor and stamps the glider's
     * current base pattern. This ensures a clean, stable state after rotation or spawn.
     */
    stampPlayer() {
        const pattern = this.gliderPatterns[this.playerRotation];
        const { x: anchorX, y: anchorY } = this.playerAnchor;

        // First, clear the 3x3 bounding box to remove any old patterns or debris.
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 3; dx++) {
                const x = anchorX + dx;
                const y = anchorY + dy;
                if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                    this.grid[y][x] = 0;
                }
            }
        }

        // Then, stamp the new pattern's live cells.
        for (const [dx, dy] of pattern) {
            const x = anchorX + dx;
            const y = anchorY + dy;
            if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
                this.grid[y][x] = 2; // Set as a player cell.
            }
        }
    }
    
    /**
     * Checks if all cells of the glider's base pattern are still player cells (state 2).
     * This is only called when the glider is expected to be in its base phase.
     */
    isPlayerAlive() {
        const pattern = this.gliderPatterns[this.playerRotation];
        for (const [dx, dy] of pattern) {
            const x = (this.playerAnchor.x + dx + this.cols) % this.cols;
            const y = (this.playerAnchor.y + dy + this.rows) % this.rows;
            if (this.grid[y][x] !== 2) {
                return false; // A piece died or was corrupted
            }
        }
        return true;
    }

    /**
     * Updates the player anchor to follow the glider's natural diagonal movement.
     */
    updatePlayerAnchor() {
        switch (this.playerRotation) {
            case 0: this.playerAnchor.x++; this.playerAnchor.y++; break; // SE
            case 1: this.playerAnchor.x--; this.playerAnchor.y++; break; // SW
            case 2: this.playerAnchor.x--; this.playerAnchor.y--; break; // NW
            case 3: this.playerAnchor.x++; this.playerAnchor.y--; break; // NE
        }
    }
    
    /**
     * Handles the game over state transition.
     */
    gameOver() {
        this.isGameOver = true;
        this.isRunning = false;
        this.render();
    }
}

// The main object that defines the program's interface for the console.
const GliderOfLife = {
    instance: null,

    init: function(screenEl) {
        const config = {
            cellSize: 8,
            updateInterval: 120,
        };
        this.instance = new GliderOfLifeProgram(screenEl, config);
        this.instance.init();
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

export default GliderOfLife;