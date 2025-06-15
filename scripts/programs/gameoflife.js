import { BaseGridSimulation } from './engines/base_grid_simulation.js';

class GameOfLifeProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, config);
    }

    computeNextState(x, y) {
        const state = this.grid[y][x];
        const neighbors = this.getNeighborCount(x, y);

        if (state === 1 && (neighbors < 2 || neighbors > 3)) {
            return 0; // Dies
        }
        if (state === 0 && neighbors === 3) {
            return 1; // Becomes alive
        }
        return state; // Stays the same
    }
}

// The main object that defines the program's interface for the console.
const GameOfLife = {
    instance: null,

    init: function(screenEl) {
        const config = {
            cellSize: 4,
            updateInterval: 120,
            aliveColor: '#50c0f0'
        };
        this.instance = new GameOfLifeProgram(screenEl, config);
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

export default GameOfLife;