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
            foodDensity: 0.0015,
            safeRadius: 15,
            wildSpawnChance: 0.04,
            // Speed progression
            initialUpdateInterval: 60,
            minUpdateInterval: 5,
            speedUpFactor: 0.05,
        });

        // Game state
        this.gameState = 'startScreen'; // 'startScreen', 'playing', 'gameOver'
        this.glider = { x: 0, y: 0, orientation: 0, step: 0 };
        this.inputThisTurn = false;
        this.score = 0;
        this.food = []; // Array of {x, y} objects

        // Audio
        this.audioCtx = null;

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
    }

    /**
     * Overrides the base init to set up game-specific logic and event listeners.
     */
    init() {
        this.onResize(); // Sets up grid and calls setupStartScreen
        this.attachEventListeners();
        requestAnimationFrame(this.run);
    }

    /**
     * Attaches all necessary event listeners for game interaction.
     */
    attachEventListeners() {
        window.addEventListener('keydown', this.handleKeyDown);
        // Add touch listener for mobile controls. passive:false allows preventDefault.
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
    }

    /**
     * Removes all event listeners on unload.
     */
    removeEventListeners() {
        window.removeEventListener('keydown', this.handleKeyDown);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    }

    /**
     * Overrides onResize to set up the start screen.
     */
    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.rows = Math.floor(this.canvas.height / this.config.cellSize);
        this.cols = Math.floor(this.canvas.width / this.config.cellSize);
        this.setupStartScreen();
        this.render();
    }

    /**
     * Main update loop, called at a fixed interval.
     * Its behavior changes based on the current gameState.
     */
    update() {
        // Run the standard simulation logic regardless of game state for the background.
        this.nextGrid = this.createEmptyGrid();
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // computeNextState returns 1 for alive, 0 for dead.
                // It treats player (2) and wild (1) cells the same.
                this.nextGrid[y][x] = this.computeNextState(x, y);
            }
        }

        // If not playing, just update the background simulation and exit.
        if (this.gameState !== 'playing') {
            this.grid = this.nextGrid;
            return;
        }

        // --- Gameplay-specific logic ---
        this.clearAreaAroundFood();

        const proximityInfo = this.getNearbyWildCellInfo();
        if (proximityInfo.count > 0) {
            this.playProximitySound(proximityInfo);
        }

        this.inputThisTurn = false; // Allow player input for the next cycle.
        this.checkGliderSurvival();
        this.grid = this.nextGrid;
    }

    /**
     * Renders the grid and UI elements, which vary based on the gameState.
     */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Game of Life cells (player and wild)
        this.drawGridCells();

        // Draw UI overlays based on game state
        switch (this.gameState) {
            case 'startScreen':
                this.drawTextOverlay('Glider of Life', "Click or press Space/Enter to begin");
                break;
            case 'playing':
                this.drawScore();
                break;
            case 'gameOver':
                this.drawTextOverlay('End of Life', "Click or press Space/Enter to restart");
                break;
        }
    }

    /**
     * Starts a new game. This is called by user input from the start or game over screens.
     */
    startGame() {
        this.initAudio(); // Crucially, this unlocks audio on the first user gesture.
        this.resetGame();
    }

    /**
     * Sets up the start screen with a background simulation.
     */
    setupStartScreen() {
        this.gameState = 'startScreen';
        this.grid = this.createEmptyGrid();
        this.food = [];
        this.score = 0;
        this.spawnInitialWildCells();
    }

    /**
     * Resets the entire game state to a playable configuration.
     */
    resetGame() {
        this.gameState = 'playing';
        this.grid = this.createEmptyGrid();
        this.score = 0;
        this.food = [];
        this.config.updateInterval = this.config.initialUpdateInterval; // Reset speed

        this.glider = {
            x: Math.floor(this.cols / 2),
            y: Math.floor(this.rows / 2),
            orientation: 0, // 0: SE
            step: 0
        };

        const targetFoodCount = this.getTargetFoodCount();
        for (let i = 0; i < targetFoodCount; i++) {
            this.spawnNewFood();
        }
        this.spawnInitialWildCells();
        this.stampGlider();
    }

    /**
     * Checks if the glider has survived the simulation step and updates its state.
     */
    checkGliderSurvival() {
        const { x, y, orientation, step } = this.glider;

        const delta = GLIDER_CENTER_DELTAS[orientation][step];
        const nextX = (x + delta.dx + this.cols) % this.cols;
        const nextY = (y + delta.dy + this.rows) % this.rows;
        const nextStep = (step + 1) % 4;

        const expectedPattern = GLIDER_PATTERNS[orientation][nextStep];
        const actualPatternBox = this.getBoxFromGrid(nextX, nextY, this.nextGrid);

        if (!this.arePatternsEqual(expectedPattern, actualPatternBox)) {
            this.playSound({ type: 'square', freq: 110, vol: 0.5, dur: 1.0 });
            this.gameState = 'gameOver';
        } else {
            this.glider.x = nextX;
            this.glider.y = nextY;
            this.glider.step = nextStep;

            this.stampPattern(expectedPattern, nextX, nextY, 2, this.nextGrid);
            this.checkFoodCollision();
        }
    }

    /**
     * Handles keyboard input, routing actions based on the current game state.
     */
    handleKeyDown(e) {
        if (this.gameState === 'startScreen' || this.gameState === 'gameOver') {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault(); // Prevent space from scrolling page
                this.startGame();
            }
        } else if (this.gameState === 'playing') {
            if (e.key === 'ArrowLeft') {
                this.rotateGlider('left');
            } else if (e.key === 'ArrowRight') {
                this.rotateGlider('right');
            }
        }
    }

    /**
     * Handles touch input for starting the game or controlling the glider.
     */
    handleTouchStart(e) {
        e.preventDefault();
        if (this.gameState === 'startScreen' || this.gameState === 'gameOver') {
            this.startGame();
        } else if (this.gameState === 'playing') {
            if (this.inputThisTurn) return;
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            this.rotateGlider(touchX < this.canvas.width / 2 ? 'left' : 'right');
        }
    }

    /**
     * Handles mouse input for starting the game.
     */
    handleMouseDown() {
        if (this.gameState === 'startScreen' || this.gameState === 'gameOver') {
            this.startGame();
        }
    }

    /**
     * Rotates the glider and updates the grid.
     * @param {'left' | 'right'} direction - The direction to rotate.
     */
    rotateGlider(direction) {
        if (this.inputThisTurn) return;

        if (direction === 'left') { // Counter-clockwise
            this.glider.orientation = (this.glider.orientation - 1 + 4) % 4;
        } else if (direction === 'right') { // Clockwise
            this.glider.orientation = (this.glider.orientation + 1) % 4;
        }

        this.inputThisTurn = true;
        this.clearGliderArea();
        this.stampGlider();
        this.render(); // Render immediately for responsive feedback
    }


    // --- Audio Methods ---

    /**
     * Initializes/Resumes the Web Audio API context. Must be called from a user gesture.
     */
    initAudio() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser");
            }
        }
        if (this.audioCtx?.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Plays a sound using the Web Audio API.
     */
    playSound({ type = 'sine', freq = 440, vol = 0.1, dur = 0.1 }) {
        if (!this.audioCtx || this.audioCtx.state !== 'running') return;

        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + dur);

        oscillator.start(this.audioCtx.currentTime);
        oscillator.stop(this.audioCtx.currentTime + dur);
    }

    /**
     * Plays the proximity warning sound for nearby wild cells.
     * @param {{count: number, minDistance: number}} proximityInfo
     */
    playProximitySound(proximityInfo) {
        const maxAudibleDistance = this.config.safeRadius;
        const maxVolume = 0.5;
        const volume = maxVolume * (1 - (proximityInfo.minDistance / maxAudibleDistance));

        this.playSound({
            type: 'square',
            freq: 20 + proximityInfo.count * 7,
            vol: Math.max(0, volume),
            dur: 0.2
        });
    }

    // --- Rendering Helpers ---

    /**
     * Draws all cells on the grid (food, player, wild).
     */
    drawGridCells() {
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
    }

    /**
     * Draws the score in the top-right corner.
     */
    drawScore() {
        this.ctx.font = 'bold 10px "Courier New", Courier, monospace';
        this.ctx.fillStyle = 'white';
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`Score: ${this.score}`, this.canvas.width - 10, 10);
    }

    /**
     * Draws a centered text overlay with a main title and a subtitle.
     * @param {string} title - The main text to display.
     * @param {string} subtitle - The smaller text below the title.
     */
    drawTextOverlay(title, subtitle) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Title text
        this.ctx.font = 'bold 32px "Courier New", Courier, monospace';
        this.ctx.fillText(title, centerX, centerY - 10);

        // Subtitle text
        this.ctx.font = '14px "Courier New", Courier, monospace';
        this.ctx.fillText(subtitle, centerX, centerY + 20);
    }

    // --- Game Logic Helpers ---

    /**
     * Game of Life rule implementation. Treats player (2) and wild (1) cells as "alive".
     */
    computeNextState(x, y) {
        const state = this.grid[y][x] > 0 ? 1 : 0;
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
     * Spawns random "wild" cells, avoiding the center of the grid.
     */
    spawnInitialWildCells() {
        const centerX = this.cols / 2;
        const centerY = this.rows / 2;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const distFromCenter = this.getToroidalDistance(x, y, centerX, centerY);
                if (distFromCenter > this.config.safeRadius && Math.random() > 0.93) {
                    this.grid[y][x] = 1; // Wild cell
                }
            }
        }
    }

    /**
     * Checks if the glider has collided with food. If so, updates score and state.
     */
    checkFoodCollision() {
        const { x, y, orientation, step } = this.glider;
        const pattern = GLIDER_PATTERNS[orientation][step];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (pattern[i + 1][j + 1] === 1) {
                    const cellX = (x + j + this.cols) % this.cols;
                    const cellY = (y + i + this.rows) % this.rows;
                    const foodIndex = this.food.findIndex(f => f.x === cellX && f.y === cellY);

                    if (foodIndex > -1) {
                        this.playSound({ type: 'sine', freq: 1200, vol: 1.0, dur: 0.5 });
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
     * Spawns a new burst of wild cells across the map after eating food.
     */
    spawnWildCellBurst() {
        const playerX = this.glider.x;
        const playerY = this.glider.y;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const distFromPlayer = this.getToroidalDistance(x, y, playerX, playerY);
                if (distFromPlayer > this.config.safeRadius && this.nextGrid[y][x] === 0 && Math.random() < this.config.wildSpawnChance) {
                    this.nextGrid[y][x] = 1;
                }
            }
        }
    }

    // --- Utility Methods ---

    getToroidalDistance(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        const torDx = Math.min(dx, this.cols - dx);
        const torDy = Math.min(dy, this.rows - dy);
        return Math.hypot(torDx, torDy);
    }

    stampGlider() {
        const pattern = GLIDER_PATTERNS[this.glider.orientation][this.glider.step];
        this.stampPattern(pattern, this.glider.x, this.glider.y, 2, this.grid);
    }

    clearGliderArea() {
        this.stampPattern([[0,0,0],[0,0,0],[0,0,0]], this.glider.x, this.glider.y, 0, this.grid);
    }

    stampPattern(pattern, cx, cy, cellType, targetGrid) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const row = (cy + i + this.rows) % this.rows;
                const col = (cx + j + this.cols) % this.cols;
                if (pattern[i + 1][j + 1] === 1) {
                    targetGrid[row][col] = cellType;
                } else if (cellType === 0) {
                    targetGrid[row][col] = 0;
                }
            }
        }
    }

    getBoxFromGrid(cx, cy, sourceGrid) {
        const box = [[0,0,0], [0,0,0], [0,0,0]];
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const row = (cy + i + this.rows) % this.rows;
                const col = (cx + j + this.cols) % this.cols;
                box[i + 1][j + 1] = sourceGrid[row][col] > 0 ? 1 : 0;
            }
        }
        return box;
    }

    arePatternsEqual(p1, p2) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (p1[i][j] !== p2[i][j]) return false;
            }
        }
        return true;
    }

    increaseSpeed() {
        const current = this.config.updateInterval;
        const min = this.config.minUpdateInterval;
        const newInterval = current - (current - min) * this.config.speedUpFactor;
        this.config.updateInterval = Math.max(min, newInterval);
    }

    getTargetFoodCount() {
        return Math.max(3, Math.floor(this.rows * this.cols * this.config.foodDensity));
    }

    spawnNewFood() {
        if (this.food.length >= this.getTargetFoodCount()) return;
        let newX, newY, isValid;
        let attempts = 0;
        do {
            newX = Math.floor(Math.random() * this.cols);
            newY = Math.floor(Math.random() * this.rows);
            const distToPlayer = this.getToroidalDistance(newX, newY, this.glider.x, this.glider.y);
            isValid = distToPlayer >= this.config.safeRadius &&
                      this.grid[newY][newX] === 0 &&
                      !this.food.some(f => f.x === newX && f.y === newY);
        } while (!isValid && ++attempts < 1000);
        if (isValid) this.food.push({ x: newX, y: newY });
    }

    clearAreaAroundFood() {
        const r = 6;
        for (const food of this.food) {
            for (let i = -r; i <= r; i++) {
                for (let j = -r; j <= r; j++) {
                    if (Math.hypot(j, i) <= r) {
                        const col = (food.x + j + this.cols) % this.cols;
                        const row = (food.y + i + this.rows) % this.rows;
                        if (this.grid[row][col] === 1) this.grid[row][col] = 0;
                    }
                }
            }
        }
    }

    getNearbyWildCellInfo() {
        let count = 0;
        let minDistance = Infinity;
        const { x: px, y: py } = this.glider;
        const r = this.config.safeRadius * 2;
        for (let i = -r; i <= r; i++) {
            for (let j = -r; j <= r; j++) {
                const x = px + j, y = py + i;
                const col = (x + this.cols) % this.cols, row = (y + this.rows) % this.rows;
                if (this.grid[row][col] === 1) {
                    const dist = this.getToroidalDistance(col, row, px, py);
                    if (dist <= r) {
                        count++;
                        if (dist < minDistance) minDistance = dist;
                    }
                }
            }
        }
        return { count, minDistance };
    }

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