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
        [[1, 1, 0], [1, 0, 1], [1, 0, 0]], // Step 2
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
 * is disrupted by other "wild" cells. The player can collect food to score points.
 */
class GliderOfLifeProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, {
            ...config,
            // Visuals
            playerColor: '#AEC6CF', // Blue
            wildColor: '#b30900',   // Red
            foodColor: '#fff099',   // Gold
            // Gameplay
            foodDensity: 0.002,
            safeRadius: 15,
            wildSpawnChance: 0.04,
            // Speed progression
            initialUpdateInterval: 60,
            minUpdateInterval: 5,
            speedUpFactor: 0.05,
        });

        // Game state
        this.glider = { x: 0, y: 0, orientation: 0, step: 0 };
        this.isGameOver = false;
        this.inputThisTurn = false;
        this.score = 0;
        this.food = []; // Array of {x, y} objects

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
        // Create a "dead zone" around food before calculating the next state.
        this.clearAreaAroundFood();

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

            // 6. Check if the glider has collided with any food.
            this.checkFoodCollision();
        }
    }

    /**
     * Renders the grid with different colors for player and wild cells.
     */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const cs = this.config.cellSize;

        // Draw food first, so it appears "underneath" the cells
        this.ctx.fillStyle = this.config.foodColor;
        for (const foodItem of this.food) {
            this.ctx.fillRect(foodItem.x * cs, foodItem.y * cs, cs, cs);
        }

        // Draw Game of Life cells
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

        // Draw Score and Game Over text
        this.ctx.font = 'bold 10px "Courier New", Courier, monospace';
        this.ctx.fillStyle = 'white';
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width - 10, 10);

        if (this.isGameOver) {
            this.ctx.font = 'bold 32px "Courier New", Courier, monospace';
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
     * Calculates the target number of food items based on the grid size.
     * @returns {number}
     */
    getTargetFoodCount() {
        const foodCount = Math.floor(this.rows * this.cols * this.config.foodDensity);
        return Math.max(3, foodCount); // Ensure there are at least 3 food items
    }

    /**
     * Resets the entire game state, clearing the grid and placing the glider.
     */
    resetGame() {
        this.grid = this.createEmptyGrid();
        this.isGameOver = false;
        this.score = 0;
        this.food = [];
        this.config.updateInterval = this.config.initialUpdateInterval; // Reset speed

        // Initialize player glider state
        this.glider = {
            x: Math.floor(this.cols / 2),
            y: Math.floor(this.rows / 2),
            orientation: 0, // 0: SE
            step: 0
        };

        // Spawn initial food and wild cells
        const targetFoodCount = this.getTargetFoodCount();
        for (let i = 0; i < targetFoodCount; i++) {
            this.spawnNewFood();
        }
        this.spawnInitialWildCells();
        this.stampGlider();
    }

    /**
     * Spawns random "wild" cells on game start, avoiding the center of the grid.
     */
    spawnInitialWildCells() {
        const centerX = this.cols / 2;
        const centerY = this.rows / 2;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const distFromCenter = Math.hypot(x - centerX, y - centerY);
                if (distFromCenter > this.config.safeRadius && Math.random() > 0.93) {
                    this.grid[y][x] = 1; // Wild cell
                }
            }
        }
    }

    /**
     * Spawns a new food item at a random, valid location if below the target count.
     */
    spawnNewFood() {
        if (this.food.length >= this.getTargetFoodCount()) return;

        const minDist = this.config.safeRadius;
        let newX, newY, isValid;
        let attempts = 0;
        const maxAttempts = this.rows * this.cols;

        do {
            newX = Math.floor(Math.random() * this.cols);
            newY = Math.floor(Math.random() * this.rows);
            attempts++;

            const distToPlayer = Math.hypot(newX - this.glider.x, newY - this.glider.y);
            const isFarEnough = distToPlayer >= minDist;
            const isCellEmpty = this.grid[newY][newX] === 0;
            const isNotAlreadyFood = !this.food.some(f => f.x === newX && f.y === newY);

            isValid = isFarEnough && isCellEmpty && isNotAlreadyFood;

        } while (!isValid && attempts < maxAttempts);

        if (isValid) {
            this.food.push({ x: newX, y: newY });
        }
    }

    /**
     * Spawns a new burst of wild cells across the map after eating food.
     * New cells are spawned away from the player's current position.
     */
    spawnWildCellBurst() {
        const playerX = this.glider.x;
        const playerY = this.glider.y;
        const safeRadius = this.config.safeRadius;
        const spawnChance = this.config.wildSpawnChance;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const distFromPlayer = Math.hypot(x - playerX, y - playerY);
                // Check if outside safe radius, the cell is empty in the *next* grid, and random chance passes
                if (distFromPlayer > safeRadius && this.nextGrid[y][x] === 0 && Math.random() < spawnChance) {
                    this.nextGrid[y][x] = 1; // Add a new wild cell
                }
            }
        }
    }

    /**
     * Kills wild cells in a circular area around each food item.
     */
    clearAreaAroundFood() {
        const clearRadius = 6;
        for (const foodItem of this.food) {
            // Iterate over a bounding box around the food
            for (let i = -clearRadius; i <= clearRadius; i++) {
                for (let j = -clearRadius; j <= clearRadius; j++) {
                    // Check if the point is within the circular radius
                    if (Math.hypot(j, i) <= clearRadius) {
                        const x = foodItem.x + j;
                        const y = foodItem.y + i;
                        const col = (x + this.cols) % this.cols;
                        const row = (y + this.rows) % this.rows;

                        // Kill the cell only if it's a "wild" cell (value 1)
                        if (this.grid[row][col] === 1) {
                            this.grid[row][col] = 0;
                        }
                    }
                }
            }
        }
    }

    /**
     * Checks if the glider occupies the same cell as a food item.
     */
    checkFoodCollision() {
        const { x, y, orientation, step } = this.glider;
        const pattern = GLIDER_PATTERNS[orientation][step];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                // Check only the live cells of the glider pattern
                if (pattern[i + 1][j + 1] === 1) {
                    const cellX = (x + j + this.cols) % this.cols;
                    const cellY = (y + i + this.rows) % this.rows;

                    const foodIndex = this.food.findIndex(f => f.x === cellX && f.y === cellY);

                    if (foodIndex > -1) {
                        this.score++;
                        this.increaseSpeed();
                        this.spawnWildCellBurst();
                        this.food.splice(foodIndex, 1); // Remove eaten food
                        this.spawnNewFood(); // Spawn a new one
                    }
                }
            }
        }
    }

    /**
     * Decreases the update interval, making the game faster.
     * The speed approaches a configured minimum value asymptotically.
     */
    increaseSpeed() {
        const currentInterval = this.config.updateInterval;
        const minInterval = this.config.minUpdateInterval;
        // Reduce the interval by a fraction of the remaining distance to the minimum
        const newInterval = currentInterval - (currentInterval - minInterval) * this.config.speedUpFactor;
        this.config.updateInterval = Math.max(minInterval, newInterval);
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