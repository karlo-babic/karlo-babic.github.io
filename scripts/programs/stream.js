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
    CHUNK_STEPS: 5000,         // History depth before forcing a complete PRNG reset
    EPOCH: 1709251200000,      

    // --- State ---
    screenEl: null,
    data: null,
    currentInterval: null,
    
    currentContext: [],
    tokenBuffer: [],
    capitalizeNext: true,
    visibleWords: 0,
    needsClear: false,
    rng: null,

    seededRandom: function(seed) {
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.screenEl = screenEl;
        
        this.screenEl.style.overflowY = 'auto';
        this.screenEl.style.whiteSpace = 'pre-wrap';
        this.screenEl.style.wordBreak = 'break-word';
        this.screenEl.style.fontSize = '0.88rem';
        this.screenEl.style.lineHeight = '1.3';

        const customPrompt = args.positional.length > 0 ? args.positional.join(' ').trim() : null;

        try {
            const response = await fetch(this.DATA_PATH);
            this.data = await response.json();
            
            if (customPrompt) {
                this.startLocal(customPrompt);
            } else {
                this.startGlobal();
            }
        } catch (err) {
            this.screenEl.innerHTML = `<p style="color:red">Broadcast Offline: Data missing.</p>`;
        }
    },

    // ==========================================
    // GLOBAL BROADCAST MODE
    // ==========================================

    startGlobal: function() {
        const now = Date.now();
        const targetStep = Math.floor((now - this.EPOCH) / this.TICK_MS);
        
        this.fastForwardTo(targetStep);

        const nextTick = (targetStep + 1) * this.TICK_MS + this.EPOCH;
        const delay = nextTick - Date.now();

        setTimeout(() => {
            this.runGlobalTick();
            this.currentInterval = setInterval(() => this.runGlobalTick(), this.TICK_MS);
        }, delay);
    },

    fastForwardTo: function(targetStep) {
        const chunkID = Math.floor(targetStep / this.CHUNK_STEPS);
        const stepInChunk = targetStep % this.CHUNK_STEPS;

        this.currentContext = [];
        this.tokenBuffer = [];
        this.visibleWords = 0;
        this.capitalizeNext = true;
        this.needsClear = false;
        
        let renderBuffer = [];
        this.rng = this.seededRandom(chunkID);

        for (let i = 0; i <= stepInChunk; i++) {
            if (this.needsClear) {
                renderBuffer = [];
                this.visibleWords = 0;
                this.capitalizeNext = true;
                this.needsClear = false;
            }

            const token = this.getNextToken(this.rng);
            const isPunct = /^[.,!?]$/.test(token);
            if (!isPunct) this.visibleWords++;

            renderBuffer.push({ token, isFirst: renderBuffer.length === 0 });

            if (this.visibleWords >= this.WORDS_PER_BLOCK && /^[.!?]$/.test(token)) {
                this.needsClear = true;
            }
        }

        this.screenEl.innerHTML = '';
        renderBuffer.forEach(item => this.appendToken(item.token, item.isFirst));
        this.currentGlobalStep = targetStep;
    },

    runGlobalTick: function() {
        const targetStep = Math.floor((Date.now() - this.EPOCH) / this.TICK_MS);
        
        // Handle tab backgrounding / interval drift
        if (targetStep - this.currentGlobalStep > 10) {
            this.fastForwardTo(targetStep);
            return;
        }

        while (this.currentGlobalStep < targetStep) {
            this.currentGlobalStep++;
            const stepInChunk = this.currentGlobalStep % this.CHUNK_STEPS;

            // Soft reset to prevent sequence length from drifting to infinity
            if (stepInChunk === 0) {
                const chunkID = Math.floor(this.currentGlobalStep / this.CHUNK_STEPS);
                this.screenEl.innerHTML = '';
                this.currentContext = [];
                this.tokenBuffer = [];
                this.rng = this.seededRandom(chunkID);
                this.visibleWords = 0;
                this.capitalizeNext = true;
                this.needsClear = false;
            }

            if (this.needsClear) {
                this.screenEl.innerHTML = '';
                this.visibleWords = 0;
                this.capitalizeNext = true;
                this.needsClear = false;
            }

            const token = this.getNextToken(this.rng);
            const isPunct = /^[.,!?]$/.test(token);
            if (!isPunct) this.visibleWords++;

            const isFirst = this.screenEl.childNodes.length === 0;
            this.appendToken(token, isFirst);

            if (this.visibleWords >= this.WORDS_PER_BLOCK && /^[.!?]$/.test(token)) {
                this.needsClear = true; // Clears visual state on the NEXT tick so period is seen
            }
        }
    },

    // ==========================================
    // LOCAL ONE-SHOT MODE
    // ==========================================

    startLocal: function(customPrompt) {
        this.screenEl.innerHTML = '';
        this.currentContext = [];
        this.tokenBuffer = [];
        this.visibleWords = 0;
        
        const { v: vocab } = this.data;
        const words = customPrompt.toLowerCase().match(/[\w']+|[.,!?]/g) || [];
        
        // Print and process initial prompt
        words.forEach((w, i) => {
            this.appendToken(w, i === 0);
            if (!/^[.,!?]$/.test(w)) this.visibleWords++;
            
            const id = vocab.indexOf(w);
            if (id !== -1) {
                this.currentContext.push(id);
                if (this.currentContext.length > 10) this.currentContext.shift();
            }
        });

        const lastWord = words[words.length - 1] || ".";
        this.capitalizeNext = /^[.!?]$/.test(lastWord);
        
        this.rng = Math.random;

        this.currentInterval = setInterval(() => {
            const token = this.getNextToken(this.rng);
            const isPunct = /^[.,!?]$/.test(token);
            if (!isPunct) this.visibleWords++;

            this.appendToken(token, false);

            if (this.visibleWords >= this.WORDS_PER_BLOCK && /^[.!?]$/.test(token)) {
                clearInterval(this.currentInterval);
                this.currentInterval = null;
                
                const eof = document.createElement('span');
                eof.textContent = " [EOF]";
                eof.style.opacity = "0.5";
                this.screenEl.appendChild(eof);
            }
        }, this.TICK_MS);
    },

    // ==========================================
    // N-GRAM CORE
    // ==========================================

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

        for (let i = this.currentContext.length - 1; i >= 0; i--) {
            const id = this.currentContext[i];
            
            if (node[id]) {
                node = node[id];
                if (node[""]) bestPredictions = node[""];
            } else {
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