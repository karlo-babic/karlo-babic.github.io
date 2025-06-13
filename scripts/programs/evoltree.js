// A self-executing function to manage scope and loading.
(function() {

    // This function contains all the logic for the evolution tree program.
    function initializeProgram() {
        
        const EvolTree = {
            instance: null,

            init: function(screenEl) {
                this.instance = new EvolTreeProgram(screenEl);
                this.instance.init();
            },
            unload: function() {
                if (this.instance) this.instance.unload();
                document.getElementById('program-script-evoltree')?.remove();
            },
            onResize: function() {
                // This program doesn't dynamically resize, so this can be empty.
            }
        };

        class EvolTreeProgram {
            constructor(screenEl) {
                this.screenEl = screenEl;
                this.canvas = document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.screenEl.appendChild(this.canvas);
                
                this.isRunning = true;
                this.loopCount = 0;
                this.particles = [];

                this.config = this._parseUrlParams();
                
                this.handleBackspace = this.handleBackspace.bind(this);
                this.run = this.run.bind(this);
            }

            /**
             * Parses configuration from URL or uses default values.
             */
            _parseUrlParams() {
                const params = new URLSearchParams(window.location.search);
                return {
                    n: parseInt(params.get('n') || 500),
                    fertility: parseFloat(params.get('f') || 2.28),
                    mutation: parseFloat(params.get('m') || 1),
                    step: parseInt(params.get('s') || 1),
                    reproduceDist: parseInt(params.get('r') || 2),
                    divergence: parseFloat(params.get('d') || 1),
                    divergenceSpeed: 1 / parseFloat(params.get('ds') || 1),
                };
            }

            init() {
                this.canvas.width = this.screenEl.getBoundingClientRect().width;
                this.canvas.height = this.screenEl.getBoundingClientRect().height;

                this._initializeParticles();
                
                // Prevent backspace from navigating away
                document.addEventListener('keydown', this.handleBackspace);

                requestAnimationFrame(this.run);
            }

            /**
             * Creates the initial set of particles (the first "generation").
             */
            _initializeParticles() {
                let lastY = this.canvas.height / 2 - (this.config.n * this.config.mutation) / 1.5;
                for (let i = 0; i < this.config.n; i++) {
                    if (i % 4) {
                        lastY += this.config.mutation;
                    } else {
                        lastY += this.config.mutation * 2;
                    }
                    this.particles.push({ 
                        x: 0, 
                        y: lastY, 
                        alive: true, 
                        divergence: Math.random() - 0.5 
                    });
                }
            }
            
            run() {
                if (!this.isRunning) return;

                this._updateAndRender();

                // Check stop conditions
                if (this.loopCount * this.config.step >= this.canvas.width || this.particles.length === 0) {
                    this.stop();
                    return;
                }

                this.loopCount++;
                requestAnimationFrame(this.run);
            }

            _updateAndRender() {
                const nextGeneration = [];
                const ll = this.particles.length;
                
                for (let i = 1; i < ll; i++) {
                    const currentParticle = this.particles[i];
                    const prevParticle = this.particles[i-1];
                    
                    // Render the current particle's step
                    this.ctx.beginPath();
                    this.ctx.moveTo(currentParticle.x, currentParticle.y);
                    this.ctx.lineTo(currentParticle.x + this.config.step, currentParticle.y);
                    this.ctx.strokeStyle = "white";
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();

                    // Boundary check
                    if (currentParticle.y < 0 || currentParticle.y > this.canvas.height) {
                        currentParticle.alive = false;
                    }
                    
                    // Reproduction check
                    const distance = Math.abs(prevParticle.y - currentParticle.y);
                    if (prevParticle.alive && currentParticle.alive && distance <= this.config.reproduceDist) {
                        prevParticle.alive = false;
                        currentParticle.alive = false;
                        
                        const offspringCount = Math.floor(Math.random() * (Math.abs(this.config.fertility) + 1) + 1);
                        const startY = (prevParticle.y + currentParticle.y) / 2;

                        for (let j = 0; j < offspringCount; j++) {
                            let newDivergence = (currentParticle.divergence + prevParticle.divergence) / 2 + (Math.random() - 0.5) * this.config.divergenceSpeed;
                            newDivergence = Math.max(-this.config.divergence, Math.min(this.config.divergence, newDivergence));
                            
                            nextGeneration.push({
                                x: currentParticle.x + this.config.step,
                                y: startY + newDivergence,
                                alive: true,
                                divergence: newDivergence
                            });
                        }
                    }
                }
                this.particles = nextGeneration;
            }

            stop() {
                this.isRunning = false;
            }

            unload() {
                this.stop();
                document.removeEventListener('keydown', this.handleBackspace);
                if (this.screenEl.contains(this.canvas)) {
                    this.screenEl.removeChild(this.canvas);
                }
            }
            
            handleBackspace(e) {
                if (e.key === 'Backspace' && e.target.nodeName.toLowerCase() !== 'input' && e.target.nodeName.toLowerCase() !== 'textarea') {
                    e.preventDefault();
                }
            }
        }

        // After all definitions are ready, tell the Console to run this program.
        Console.runProgram('EvolTree', EvolTree);
    }

    initializeProgram();

})();