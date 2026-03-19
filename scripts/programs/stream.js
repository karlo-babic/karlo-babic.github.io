// stream.js
/**
 * Stream.js
 * A deterministic, synchronous generative text broadcast.
 * Uses a Reverse Context Trie with Katz Backoff to ensure high grammatical accuracy 
 * while maintaining absolute resilience against dead ends.
 */

const Stream = {
    // --- Configuration ---
    DATA_PATH: './data/ngrams.json',
    TICK_MS: 180,              
    WORDS_PER_BLOCK: 200,      
    EPOCH: 1709251200000,      

    // --- State ---
    screenEl: null,
    data: null,
    currentInterval: null,
    
    currentContext: [],
    tokenBuffer: [],
    capitalizeNext: true,

    seededRandom: function(seed) {
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    init: async function(screenEl) {
        this.screenEl = screenEl;
        
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

    start: function() {
        const now = Date.now();
        const totalSteps = Math.floor((now - this.EPOCH) / this.TICK_MS);
        const blockID = Math.floor(totalSteps / this.WORDS_PER_BLOCK);
        const stepInBlock = totalSteps % this.WORDS_PER_BLOCK;

        this.screenEl.innerHTML = '';
        this.capitalizeNext = true;
        this.currentContext = []; 
        this.tokenBuffer = [];
        
        const rng = this.seededRandom(blockID);

        for (let i = 0; i <= stepInBlock; i++) {
            const token = this.getNextToken(rng);
            this.appendToken(token, i === 0);
        }

        const nextTick = (totalSteps + 1) * this.TICK_MS + this.EPOCH;
        const delay = nextTick - Date.now();

        setTimeout(() => {
            this.runTick();
            this.currentInterval = setInterval(() => this.runTick(), this.TICK_MS);
        }, delay);
    },

    runTick: function() {
        const totalSteps = Math.floor((Date.now() - this.EPOCH) / this.TICK_MS);
        const blockID = Math.floor(totalSteps / this.WORDS_PER_BLOCK);
        const stepInBlock = totalSteps % this.WORDS_PER_BLOCK;

        if (stepInBlock === 0) {
            this.screenEl.innerHTML = '';
            this.capitalizeNext = true;
        }

        this.currentContext = []; 
        this.tokenBuffer = [];
        const rng = this.seededRandom(blockID);
        
        let token = "";
        for (let i = 0; i <= stepInBlock; i++) {
            token = this.getNextToken(rng);
        }

        this.appendToken(token, stepInBlock === 0);
    },

    /**
     * Traverses the reverse context Trie. If a specific high-order N-gram does 
     * not exist, it automatically falls back to lower-order combinations until 
     * it finds valid predictions (Stupid Backoff).
     */
    getNextToken: function(rng) {
        if (this.tokenBuffer.length > 0) {
            return this.tokenBuffer.shift();
        }

        const { m: model, v: vocab, s: starters } = this.data;

        const resetContext = () => {
            const starterSeq = starters[Math.floor(rng() * starters.length)];
            this.currentContext = [...starterSeq];
            this.tokenBuffer = this.currentContext.map(id => vocab[id]);
            return this.tokenBuffer.shift();
        };

        if (this.currentContext.length === 0) {
            return resetContext();
        }

        let node = model;
        let bestPredictions = null;

        // Iterate context backwards to dive down the Trie
        for (let i = this.currentContext.length - 1; i >= 0; i--) {
            const id = this.currentContext[i];
            
            if (node[id]) {
                node = node[id];
                // "" is the spatial key for leaf node predictions
                if (node[""]) {
                    bestPredictions = node[""];
                }
            } else {
                // Highest order n-gram branch broken, rely on last saved bestPredictions
                break;
            }
        }

        if (!bestPredictions) {
            return resetContext();
        }

        const keys = Object.keys(bestPredictions);
        const weights = Object.values(bestPredictions);
        const total = weights.reduce((a, b) => a + b, 0);
        
        let r = rng() * total;
        let chosenId = keys[0];
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                chosenId = keys[i];
                break;
            }
        }

        const finalId = parseInt(chosenId);
        this.currentContext.push(finalId);
        
        // Prevent array bloating, bounded by practical N-gram depth max
        if (this.currentContext.length > 10) {
            this.currentContext.shift();
        }

        return vocab[finalId];
    },

    appendToken: function(token, isFirstInBlock) {
        const isPunct = /^[.,!?]$/.test(token);
        let out = "";

        if (!isFirstInBlock && !isPunct) {
            out += " ";
        }

        if (isPunct) {
            out += token;
            this.capitalizeNext = /^[.!?]$/.test(token);
        } else {
            out += (this.capitalizeNext || token === 'i') 
                ? token.charAt(0).toUpperCase() + token.slice(1) 
                : token;
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
        this.tokenBuffer = [];
    },

    onResize: function() {
        if (this.screenEl) this.screenEl.scrollTop = this.screenEl.scrollHeight;
    }
};

export default Stream;