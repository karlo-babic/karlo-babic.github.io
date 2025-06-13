// A self-executing function to manage scope and loading.
(function() {

    // This function contains all the logic that depends on the GridSimulation base class.
    function initializeProgram() {
        
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
                document.getElementById('program-script-grid-simulation-base')?.remove();
                document.getElementById('program-script-gameoflife')?.remove();
            },

            onResize: function() {
                if (this.instance) {
                    this.instance.onResize();
                }
            }
        };

        class GameOfLifeProgram extends GridSimulation {
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

        // After all definitions are ready, tell the Console to run this program.
        Console.runProgram('GameOfLife', GameOfLife);
    }


    // --- Script Loading and Initialization ---
    // Check if the GridSimulation class is already loaded.
    if (typeof GridSimulation === 'undefined') {
        const script = document.createElement('script');
        script.src = 'scripts/programs/grid-simulation-base.js';
        script.onload = initializeProgram;
        document.head.appendChild(script);
    } else {
        // If it's already defined, we can initialize our program immediately.
        initializeProgram();
    }

})();