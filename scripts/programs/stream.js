/**
 * Stream.js
 * A deterministic, synchronous generative text broadcast.
 * Uses a Reverse Context Trie with Katz Backoff for grammatically coherent text generation.
 * 
 * Synchronization Architecture:
 * Employs a Stateless Deterministic Time-Sync model. Time is divided into fixed blocks 
 * of a predetermined number of steps. The block ID serves as the PRNG seed, ensuring that 
 * any client calculating the elapsed time since the EPOCH will predictably construct 
 * the exact same internal context and output without communicating with a server.
 */

const Stream = {
    DATA_PATH: './data/ngrams.json',
    TICK_MS: 180,              
    STEPS_PER_BLOCK: 300,      // Number of tokens before a hard visual and logical reset
    EPOCH: 1709251200000,

    screenEl: null,
    data: null,
    currentInterval: null,
    
    currentContext: [],
    tokenBuffer: [],
    capitalizeNext: true,
    rng: null,
    currentGlobalStep: 0,

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

    /**
     * Bootstraps the global broadcast loop based on time elapsed since the EPOCH.
     */
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

    /**
     * Determines the current block and fast-forwards the Markov chain internally
     * so that the visible output exactly matches the ongoing global stream.
     */
    fastForwardTo: function(targetStep) {
        const blockID = Math.floor(targetStep / this.STEPS_PER_BLOCK);
        const stepInBlock = targetStep % this.STEPS_PER_BLOCK;

        this.currentContext = [];
        this.tokenBuffer = [];
        this.capitalizeNext = true;
        
        let renderBuffer = [];
        this.rng = this.seededRandom(blockID);

        for (let i = 0; i <= stepInBlock; i++) {
            const token = this.getNextToken(this.rng);
            renderBuffer.push({ token, isFirst: renderBuffer.length === 0 });
        }

        this.screenEl.innerHTML = '';
        renderBuffer.forEach(item => this.appendToken(item.token, item.isFirst));
        this.currentGlobalStep = targetStep;
    },

    /**
     * Evaluates the active time sync and appends new tokens. Includes a drift
     * catch-up mechanic in case the browser throttles background tabs.
     */
    runGlobalTick: function() {
        const targetStep = Math.floor((Date.now() - this.EPOCH) / this.TICK_MS);
        
        if (targetStep - this.currentGlobalStep > 10) {
            this.fastForwardTo(targetStep);
            return;
        }

        while (this.currentGlobalStep < targetStep) {
            this.currentGlobalStep++;
            const stepInBlock = this.currentGlobalStep % this.STEPS_PER_BLOCK;

            // Enforce a hard checkpoint at the start of every block
            if (stepInBlock === 0) {
                const blockID = Math.floor(this.currentGlobalStep / this.STEPS_PER_BLOCK);
                this.screenEl.innerHTML = '';
                this.currentContext = [];
                this.tokenBuffer = [];
                this.rng = this.seededRandom(blockID);
                this.capitalizeNext = true;
            }

            const token = this.getNextToken(this.rng);
            const isFirst = this.screenEl.childNodes.length === 0;
            this.appendToken(token, isFirst);
        }
    },

    /**
     * Initiates an offline, isolated generation sequence utilizing user-provided context.
     */
    startLocal: function(customPrompt) {
        this.screenEl.innerHTML = '';
        this.currentContext = [];
        this.tokenBuffer = [];
        let localStepCount = 0;
        
        const { v: vocab } = this.data;
        const words = customPrompt.toLowerCase().match(/[\w']+|[.,!?]/g) || [];
        
        words.forEach((w, i) => {
            this.appendToken(w, i === 0);
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
            this.appendToken(token, false);
            localStepCount++;

            if (localStepCount >= this.STEPS_PER_BLOCK) {
                clearInterval(this.currentInterval);
                this.currentInterval = null;
            }
        }, this.TICK_MS);
    },

    /**
     * Queries the N-gram trie using the current context sequence. 
     * Applies Katz Backoff if exact history match is unavailable.
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