/**
 * Stream.js
 * A deterministic, synchronous generative text broadcast.
 * Uses n-gram statistics and a global temporal clock to ensure every client 
 * sees the identical word sequence at the exact same time.
 */

const Stream = {
    // --- Configuration ---
    DATA_PATH: './data/ngrams.json',
    TICK_MS: 180,              // Speed of generation
    WORDS_PER_BLOCK: 200,      // Max words before clearing paragraph
    EPOCH: 1709251200000,      // Global Start: March 1, 2024

    // --- State ---
    screenEl: null,
    data: null,
    currentInterval: null,
    
    // Logic State
    currentContext: [],
    capitalizeNext: true,

    /**
     * Mulberry32 PRNG for deterministic results across all clients.
     */
    seededRandom: function(seed) {
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    init: async function(screenEl, args) {
        this.screenEl = screenEl;
        
        // Terminal Styling
        this.screenEl.style.overflowY = 'auto';
        this.screenEl.style.whiteSpace = 'pre-wrap';
        this.screenEl.style.wordBreak = 'break-word';
        this.screenEl.style.fontSize = '0.88rem';
        this.screenEl.style.lineHeight = '1.3';

        try {
            const response = await fetch(this.DATA_PATH);
            this.data = await response.json();
            this.start();
        } catch (err) {
            this.screenEl.innerHTML = `<p style="color:red">Broadcast Offline: Data missing.</p>`;
        }
    },

    /**
     * Synchronizes local state with global time and begins the generation loop.
     */
    start: function() {
        const now = Date.now();
        const totalSteps = Math.floor((now - this.EPOCH) / this.TICK_MS);
        const blockID = Math.floor(totalSteps / this.WORDS_PER_BLOCK);
        const stepInBlock = totalSteps % this.WORDS_PER_BLOCK;

        // "Catch up" logic: Deterministically recreate the block history
        // so a joining client has the exact same context as a persistent client.
        this.screenEl.innerHTML = '';
        this.currentContext = [];
        this.capitalizeNext = true;

        const rng = this.seededRandom(blockID);
        for (let i = 0; i <= stepInBlock; i++) {
            const token = this.getNextToken(rng);
            this.appendToken(token, i === 0);
        }

        // Precise alignment with the next global tick
        const nextTick = (totalSteps + 1) * this.TICK_MS + this.EPOCH;
        const delay = nextTick - Date.now();

        setTimeout(() => {
            this.runTick();
            this.currentInterval = setInterval(() => this.runTick(), this.TICK_MS);
        }, delay);
    },

    /**
     * Advances the generator by one step.
     */
    runTick: function() {
        const totalSteps = Math.floor((Date.now() - this.EPOCH) / this.TICK_MS);
        const blockID = Math.floor(totalSteps / this.WORDS_PER_BLOCK);
        const stepInBlock = totalSteps % this.WORDS_PER_BLOCK;

        // Reset paragraph on block boundaries
        if (stepInBlock === 0) {
            this.screenEl.innerHTML = '';
            this.currentContext = [];
            this.capitalizeNext = true;
        }

        // Re-simulate from block start to ensure context is perfectly synced
        const rng = this.seededRandom(blockID);
        let token = "";
        for (let i = 0; i <= stepInBlock; i++) {
            token = this.getNextToken(rng);
        }

        this.appendToken(token, stepInBlock === 0);
    },

    /**
     * Deterministic n-gram selection.
     */
    getNextToken: function(rng) {
        const { m: model, v: vocab, s: starters } = this.data;
        let predictions = model;

        // Drill down into nested map based on current context
        for (const id of this.currentContext) {
            if (predictions && predictions[id]) {
                predictions = predictions[id];
            } else {
                predictions = null;
                break;
            }
        }

        let chosenId;

        // Use PRNG to handle branching paths or dead ends
        if (!predictions || typeof predictions !== 'object' || Array.isArray(predictions)) {
            const starterSeq = starters[Math.floor(rng() * starters.length)];
            chosenId = starterSeq[0];
            this.currentContext = [chosenId];
        } else {
            const keys = Object.keys(predictions);
            const weights = Object.values(predictions);
            const total = weights.reduce((a, b) => a + b, 0);
            
            let r = rng() * total;
            let idx = 0;
            for (let i = 0; i < weights.length; i++) {
                r -= weights[i];
                if (r <= 0) {
                    idx = i;
                    break;
                }
            }
            chosenId = parseInt(keys[idx]);
            
            // Slide window context
            const maxContext = starters[0].length;
            this.currentContext.push(chosenId);
            if (this.currentContext.length > maxContext) this.currentContext.shift();
        }

        return vocab[chosenId];
    },

    /**
     * Renders token to the screen with grammar and terminal scrolling.
     */
    appendToken: function(token, isFirstInBlock) {
        const isPunct = /^[.,!?]$/.test(token);
        let out = "";

        if (isPunct) {
            out = token;
            this.capitalizeNext = (/[.!?]/.test(token));
        } else {
            if (!isFirstInBlock) out += " ";
            
            // Capitalize if it's the start of a sentence or the pronoun "i"
            let word = (this.capitalizeNext || token === 'i') 
                ? token.charAt(0).toUpperCase() + token.slice(1) 
                : token;
            
            out += word;
            this.capitalizeNext = false;
        }

        const span = document.createElement('span');
        span.textContent = out;
        this.screenEl.appendChild(span);
        this.screenEl.scrollTop = this.screenEl.scrollHeight;
    },

    unload: function() {
        if (this.currentInterval) clearInterval(this.currentInterval);
        this.data = null;
        this.currentContext = [];
    },

    onResize: function() {
        if (this.screenEl) this.screenEl.scrollTop = this.screenEl.scrollHeight;
    }
};

export default Stream;