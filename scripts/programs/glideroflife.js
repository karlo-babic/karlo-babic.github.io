import { BaseGridSimulation } from './engines/base_grid_simulation.js';

// --- Constants for Glider Patterns and Movement ---

// Glider patterns for each orientation and step in their 4-step cycle.
// Orientations: 0:SE, 1:SW, 2:NW, 3:NE
const GLIDER_PATTERNS = [
    // 0: South-East
    [
        [[0, 1, 0], [0, 0, 1], [1, 1, 1]], // Step 0
        [[1, 0, 1], [0, 1, 1], [0, 1, 0]], // Step 1
        [[0, 0, 1], [1, 0, 1], [0, 1, 1]], // Step 2
        [[1, 0, 0], [0, 1, 1], [1, 1, 0]]  // Step 3
    ],
    // 1: South-West (CCW from SE)
    [
        [[0, 1, 0], [1, 0, 0], [1, 1, 1]], // Step 0
        [[1, 0, 1], [1, 1, 0], [0, 1, 0]], // Step 1
        [[1, 0, 0], [1, 0, 1], [1, 1, 0]], // Step 2
        [[0, 0, 1], [1, 1, 0], [0, 1, 1]]  // Step 3
    ],
    // 2: North-West (CCW from SW)
    [
        [[1, 1, 1], [1, 0, 0], [0, 1, 0]], // Step 0
        [[0, 1, 0], [1, 1, 0], [1, 0, 1]], // Step 1
        [[1, 1, 0], [1, 0, 1], [1, 0, 0]], // Step 2 - CORRECTED
        [[0, 1, 1], [1, 1, 0], [0, 0, 1]]  // Step 3
    ],
    // 3: North-East (CCW from NW)
    [
        [[1, 1, 1], [0, 0, 1], [0, 1, 0]], // Step 0
        [[0, 1, 0], [0, 1, 1], [1, 0, 1]], // Step 1
        [[0, 1, 1], [1, 0, 1], [0, 0, 1]], // Step 2
        [[1, 1, 0], [0, 1, 1], [1, 0, 0]]  // Step 3
    ]
];

// The change in the glider's center point coordinates (dx, dy) for each step.
const GLIDER_CENTER_DELTAS = [
    // 0: SE
    [{dx: 0, dy: 1}, {dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: 0}],
    // 1: SW
    [{dx: 0, dy: 1}, {dx: 0, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 0}],
    // 2: NW
    [{dx: 0, dy: -1}, {dx: 0, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 0}],
    // 3: NE
    [{dx: 0, dy: -1}, {dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: 0}],
];


/**
 * Implements a "Glider of Life" game where the player controls a single
 * glider that they can rotate. The game ends if the glider's pattern
 * is disrupted by other "wild" cells.
 */
class GliderOfLifeProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, {
            ...config,
            playerColor: '#AEC6CF', // Pastel Blue
            wildColor: '#FF6961',   // Pastel Red
        });
        
        // Game state
        this.glider = { x: 0, y: 0, orientation: 0, step: 0 };
        this.isGameOver = false;
        this.inputThisTurn = false;

        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Overrides the base init to set up game-specific logic and event listeners.
     */
    init() {
        this.onResize(); // Sets up grid and calls resetGame
        this.attachEventListeners();
        requestAnimationFrame(this.run);
    }
    
    /**
     * Attaches all necessary event listeners, including keyboard input.
     */
    attachEventListeners() {
        super.attachEventListeners(); // For mouse/touch drawing
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
     * Overrides onResize to reset the game state completely.
     */
    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.rows = Math.floor(this.canvas.height / this.config.cellSize);
        this.cols = Math.floor(this.canvas.width / this.config.cellSize);
        this.resetGame();
        this.render();
    }
    
    /**
     * Main update loop, called at a fixed interval.
     */
    update() {
        // Run the standard simulation logic regardless of game over state.
        this.nextGrid = this.createEmptyGrid();
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // computeNextState returns 1 for alive, 0 for dead.
                // It treats player (2) and wild (1) cells the same.
                this.nextGrid[y][x] = this.computeNextState(x, y);
            }
        }
        
        // If the game is already over, just update the grid and exit.
        if (this.isGameOver) {
            this.grid = this.nextGrid;
            return;
        }

        this.inputThisTurn = false; // Allow player input for the next cycle.
        this.checkGliderSurvival();
        this.grid = this.nextGrid;
    }

    /**
     * Checks if the glider has survived the simulation step and updates its state.
     */
    checkGliderSurvival() {
        const { x, y, orientation, step } = this.glider;
        
        // 1. Calculate the glider's next theoretical position and state.
        const delta = GLIDER_CENTER_DELTAS[orientation][step];
        const nextX = (x + delta.dx + this.cols) % this.cols;
        const nextY = (y + delta.dy + this.rows) % this.rows;
        const nextStep = (step + 1) % 4;

        // 2. Get the expected pattern for the next state.
        const expectedPattern = GLIDER_PATTERNS[orientation][nextStep];
        
        // 3. Get the actual 3x3 box from the newly computed grid.
        const actualPatternBox = this.getBoxFromGrid(nextX, nextY, this.nextGrid);

        // 4. Compare the actual result with the expected pattern.
        if (!this.arePatternsEqual(expectedPattern, actualPatternBox)) {
            this.isGameOver = true; // The glider collapsed!
        } else {
            // The glider survived. Update its state for the next frame.
            this.glider.x = nextX;
            this.glider.y = nextY;
            this.glider.step = nextStep;

            // 5. Re-stamp the glider's cells as 'player' type (2) in the next grid.
            this.stampPattern(expectedPattern, nextX, nextY, 2, this.nextGrid);
        }
    }

    /**
     * Renders the grid with different colors for player and wild cells.
     */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const cs = this.config.cellSize;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === 2) { // Player glider cell
                    this.ctx.fillStyle = this.config.playerColor;
                    this.ctx.fillRect(x * cs, y * cs, cs, cs);
                } else if (this.grid[y][x] === 1) { // Wild cell
                    this.ctx.fillStyle = this.config.wildColor;
                    this.ctx.fillRect(x * cs, y * cs, cs, cs);
                }
            }
        }

        if (this.isGameOver) {
            this.ctx.font = 'bold 48px "Courier New", Courier, monospace';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('End of Life', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    /**
     * Game of Life rule implementation. Treats player (2) and wild (1) cells as "alive".
     */
    computeNextState(x, y) {
        const state = this.grid[y][x] > 0 ? 1 : 0; // Normalize state to 1 if alive
        const neighbors = this.getNeighborCount(x, y);

        if (state === 1 && (neighbors < 2 || neighbors > 3)) return 0; // Dies
        if (state === 0 && neighbors === 3) return 1; // Becomes alive
        return state; // Stays the same
    }

    /**
     * Counts neighbors, treating both player (2) and wild (1) cells as alive.
     */
    getNeighborCount(x, y) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const col = (x + j + this.cols) % this.cols;
                const row = (y + i + this.rows) % this.rows;
                if (this.grid[row][col] > 0) {
                    count++;
                }
            }
        }
        return count;
    }

    /**
     * Handles keyboard input for rotating the glider.
     */
    handleKeyDown(e) {
        if (this.isGameOver || this.inputThisTurn) return;

        let rotated = false;
        if (e.key === 'ArrowLeft') { // Counter-clockwise
            this.glider.orientation = (this.glider.orientation - 1 + 4) % 4;
            rotated = true;
        } else if (e.key === 'ArrowRight') { // Clockwise
            this.glider.orientation = (this.glider.orientation + 1) % 4;
            rotated = true;
        }

        if (rotated) {
            this.inputThisTurn = true;
            this.clearGliderArea();
            this.stampGlider();
            this.render(); // Render immediately for responsive feedback
        }
    }

    // --- Helper Methods ---

    /**
     * Resets the entire game state, clearing the grid and placing the glider.
     */
    resetGame() {
        this.grid = this.createEmptyGrid();
        this.isGameOver = false;
        
        // Spawn some random "wild" cells, but leave a clear radius around the center.
        const centerX = this.cols / 2;
        const centerY = this.rows / 2;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const distFromCenter = Math.hypot(x - centerX, y - centerY);
                if (distFromCenter > 15 && Math.random() > 0.85) {
                    this.grid[y][x] = 1; // Wild cell
                }
            }
        }
        
        // Initialize player glider state
        this.glider = {
            x: Math.floor(centerX),
            y: Math.floor(centerY),
            orientation: 0, // 0: SE
            step: 0
        };

        this.stampGlider();
    }
    
    /**
     * Stamps the current glider pattern onto the main grid.
     */
    stampGlider() {
        const pattern = GLIDER_PATTERNS[this.glider.orientation][this.glider.step];
        this.stampPattern(pattern, this.glider.x, this.glider.y, 2, this.grid);
    }
    
    /**
     * Clears the 3x3 area around the glider's center point.
     */
    clearGliderArea() {
        this.stampPattern([[0,0,0],[0,0,0],[0,0,0]], this.glider.x, this.glider.y, 0, this.grid);
    }

    /**
     * A generic function to stamp a 3x3 pattern onto a target grid.
     * @param {number[][]} pattern - The 3x3 pattern to stamp.
     * @param {number} cx - The center x-coordinate.
     * @param {number} cy - The center y-coordinate.
     * @param {number} cellType - The value to write (0, 1, or 2).
     * @param {number[][]} targetGrid - The grid to modify.
     */
    stampPattern(pattern, cx, cy, cellType, targetGrid) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const row = (cy + i + this.rows) % this.rows;
                const col = (cx + j + this.cols) % this.cols;
                if (pattern[i + 1][j + 1] === 1) {
                    targetGrid[row][col] = cellType;
                } else if (cellType === 0) { // Also clear non-pattern cells if erasing
                    targetGrid[row][col] = 0;
                }
            }
        }
    }
    
    /**
     * Extracts a 3x3 box of cell values from a specified grid.
     * @returns {number[][]} A 3x3 array of cell states (0 or 1).
     */
    getBoxFromGrid(cx, cy, sourceGrid) {
        const box = [[0,0,0], [0,0,0], [0,0,0]];
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const row = (cy + i + this.rows) % this.rows;
                const col = (cx + j + this.cols) % this.cols;
                // Normalize to 0 or 1 for comparison
                box[i + 1][j + 1] = sourceGrid[row][col] > 0 ? 1 : 0;
            }
        }
        return box;
    }

    /**
     * Compares two 3x3 patterns for equality.
     */
    arePatternsEqual(p1, p2) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (p1[i][j] !== p2[i][j]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Replaces the base class's randomizeGrid with our game setup.
     */
    randomizeGrid() {
        this.resetGame();
    }
}

// The main object that defines the program's interface for the console.
const GliderOfLife = {
    instance: null,

    init: function(screenEl) {
        const config = {
            cellSize: 4,
            updateInterval: 80,
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