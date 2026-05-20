/**
 * Parameters (pass as named args, e.g. `evoltree -n 200 -f -400`):
 * n  - initial population size
 * f  - fecundity, average offspring per mating pair
 *      (negative = dynamic: fecundity = abs(f / population size))
 * m  - mutation scale per offspring
 * r  - mating range: max y-distance between two organisms to mate
 * dr - density radius: y-radius within which organisms compete for the same niche
 * s  - pixels per generation (visual only)
 */
class EvolTreeProgram {
    constructor(screenEl, args = { positional: [], named: {} }) {
        this.screenEl = screenEl;
        this.args = args;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.screenEl.appendChild(this.canvas);

        this.isRunning = true;
        this.generation = 0;
        this.population = [];

        this.config = this._parseArgs(args);

        this.handleBackspace = this.handleBackspace.bind(this);
        this.run = this.run.bind(this);
    }

    _parseArgs(args) {
        const n = args.named;
        return {
            initialSize:   parseInt(n.n   ?? 300),
            fecundity:     parseFloat(n.f  ?? -5000),
            mutationScale: parseFloat(n.m  ?? 5.0),
            matingRange:   parseFloat(n.r  ?? 5),
            densityRadius: parseFloat(n.dr ?? 4),
            step:          parseInt(n.s   ?? 2),
        };
    }

    init() {
        this.canvas.width = this.screenEl.getBoundingClientRect().width;
        this.canvas.height = this.screenEl.getBoundingClientRect().height;

        this._initializePopulation();

        document.addEventListener('keydown', this.handleBackspace);
        requestAnimationFrame(this.run);
    }

    _initializePopulation() {
        const midY = this.canvas.height / 2;
        const spread = this.canvas.height * 0.5;
        for (let i = 0; i < this.config.initialSize; i++) {
            const y = midY + (Math.random() - 0.5) * spread;
            this.population.push({ x: 0, y, birthY: y });
        }
    }

    run() {
        if (!this.isRunning) return;

        this._updateAndRender();

        if (this.population.length === 0) {
            this._initializePopulation();
        }

        this.generation++;
        requestAnimationFrame(this.run);
    }

    // Draws a traitgram segment from (x, birthY) to (x+step, y), splitting into two
    // pieces if the shortest path in wrapped y-space crosses the canvas boundary.
    _drawSegment(x, birthY, y) {
        const H = this.canvas.height;
        const step = this.config.step;

        let dy = y - birthY;
        if (dy >  H / 2) dy -= H;
        if (dy < -H / 2) dy += H;
        const endY = birthY + dy;

        this.ctx.beginPath();
        if (endY >= 0 && endY <= H) {
            this.ctx.moveTo(x, birthY);
            this.ctx.lineTo(x + step, endY);
        } else if (endY < 0) {
            const t = birthY / (birthY - endY);
            this.ctx.moveTo(x, birthY);
            this.ctx.lineTo(x + t * step, 0);
            this.ctx.moveTo(x + t * step, H);
            this.ctx.lineTo(x + step, endY + H);
        } else {
            const t = (H - birthY) / (endY - birthY);
            this.ctx.moveTo(x, birthY);
            this.ctx.lineTo(x + t * step, H);
            this.ctx.moveTo(x + t * step, 0);
            this.ctx.lineTo(x + step, endY - H);
        }
        this.ctx.stroke();
    }

    _updateAndRender() {
        const { step, matingRange, mutationScale, fecundity, densityRadius } = this.config;
        const W = this.canvas.width;
        const H = this.canvas.height;

        this.ctx.clearRect((this.generation * step) % W, 0, step, H);

        this.population.sort((a, b) => a.y - b.y);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 0.5;
        for (const org of this.population) {
            this._drawSegment(org.x, org.birthY, org.y);
        }

        const n = this.population.length;
        const currentFecundity = fecundity < 0 ? Math.abs(fecundity / n) : fecundity;
        const nextX = ((this.generation + 1) * step) % W;
        const nextGeneration = [];

        let firstConsumed = false;
        let lastConsumed = false;

        // Alternate scan direction each generation to avoid systematic y-bias:
        // left-to-right leaves the highest-y odd-one-out unpaired; right-to-left leaves lowest-y.
        const dir = Math.random() < 0.5 ? 1 : -1;
        let i = dir === 1 ? 0 : n - 2;

        while (i >= 0 && i < n - 1) {
            const a = this.population[i];
            const b = this.population[i + 1];

            if (b.y - a.y > matingRange) {
                i += dir;
                continue;
            }

            const pairIdx = i;
            i += dir * 2;
            if (pairIdx === 0)     firstConsumed = true;
            if (pairIdx === n - 2) lastConsumed = true;

            const midY = (a.y + b.y) / 2;

            let localCount = 0;
            for (let k = pairIdx;     k >= 0 && midY - this.population[k].y <= densityRadius; k--) localCount++;
            for (let k = pairIdx + 1; k < n  && this.population[k].y - midY <= densityRadius; k++) localCount++;

            const effectiveFecundity = currentFecundity / (1 + localCount*localCount);
            const offspringCount = Math.floor(Math.random() * (effectiveFecundity + 1)) + 1;

            for (let j = 0; j < offspringCount; j++) {
                const y = ((midY + (Math.random() - 0.5) * mutationScale) % H + H) % H;
                nextGeneration.push({ x: nextX, y, birthY: midY });
            }
        }

        // Wrap-around pair: last organism mates with first across the y boundary
        if (n >= 2 && !firstConsumed && !lastConsumed) {
            const first = this.population[0];
            const last  = this.population[n - 1];
            const wrapDist = H - last.y + first.y;
            if (wrapDist <= matingRange) {
                const midY = (last.y + wrapDist / 2) % H;

                let localCount = 0;
                for (const org of this.population) {
                    const d = Math.abs(org.y - midY);
                    if (Math.min(d, H - d) <= densityRadius) localCount++;
                }

                const effectiveFecundity = currentFecundity / (1 + localCount*localCount);
                const offspringCount = Math.floor(Math.random() * (effectiveFecundity + 1)) + 1;
                for (let j = 0; j < offspringCount; j++) {
                    const y = ((midY + (Math.random() - 0.5) * mutationScale) % H + H) % H;
                    nextGeneration.push({ x: nextX, y, birthY: midY });
                }
            }
        }

        this.population = nextGeneration;
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

// The public interface for the Console.
const EvolTree = {
    instance: null,

    init: function(screenEl, args) {
        this.instance = new EvolTreeProgram(screenEl, args);
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
            const screenEl = this.instance.screenEl;
            const args = this.instance.args;
            this.instance.unload();
            this.init(screenEl, args);
        }
    }
};

export default EvolTree;
