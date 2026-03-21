/**
 * Stream.js
 * A deterministic, synchronous generative text broadcast using Dual-Track NLP.
 * 
 * Architecture:
 * - Employs a Stateless Deterministic Time-Sync model seeded by EPOCH block IDs.
 * - Utilizes an Ensemble Text Generation system:
 *   1. Grammar Engine (v, g, s): Deep Katz Backoff Trie ensuring local syntax.
 *   2. Theme Engine (t, ts): Macro Trie governing long-term topic progression.
 *   3. Gravity Map (w): Intersects the two engines by applying vocabulary 
 *      weight multipliers to grammatical candidates based on the active theme.
 */

const Stream = {
    DATA_PATH: './data/ngrams.json',
    TICK_MS: 250,              
    STEPS_PER_BLOCK: 200,      
    EPOCH: 1709251200000,
    GRAVITY_MULTIPLIER: 100,   // Defines how heavily the active theme skews word selection

    VERBOSE: false,

    rouletteInterval: null,
    currentCandidates: ["..."],
    rouletteEl: null,
    screenEl: null,
    data: null,
    currentInterval: null,
    
    currentWordContext: [],
    currentThemeContext: [],
    activeThemeID: null,
    
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

        this.rouletteEl = document.createElement('span');
        this.rouletteEl.style.opacity = '0.4';

        const customPrompt = args.positional.length > 0 ? args.positional.join(' ').trim() : null;

        try {
            const response = await fetch(this.DATA_PATH);
            this.data = await response.json();
            
            if (customPrompt) {
                this.startLocal(customPrompt);
            } else {
                this.startGlobal();
            }
            this.startRoulette();
        } catch (err) {
            this.screenEl.innerHTML = `<p style="color:red">Broadcast Offline: Data missing.</p>`;
        }
    },

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
     * Rebuilds state instantly to match ongoing external broadcast timing.
     */
    fastForwardTo: function(targetStep) {
        const blockID = Math.floor(targetStep / this.STEPS_PER_BLOCK);
        const stepInBlock = targetStep % this.STEPS_PER_BLOCK;

        this.currentWordContext = [];
        this.currentThemeContext = [];
        this.tokenBuffer = [];
        this.capitalizeNext = true;
        
        let renderBuffer = [];
        this.rng = this.seededRandom(blockID);

        this.resetThemeContext(this.rng);

        for (let i = 0; i <= stepInBlock; i++) {
            const token = this.getNextToken(this.rng);
            renderBuffer.push({ token, isFirst: renderBuffer.length === 0 });
            
            if (token === '.') {
                this.advanceTheme(this.rng);
            }
        }

        this.screenEl.innerHTML = '';
        renderBuffer.forEach(item => this.appendToken(item.token, item.isFirst));
        this.currentGlobalStep = targetStep;
        this.currentCandidates = this.peekCandidates();
    },

    runGlobalTick: function() {
        const targetStep = Math.floor((Date.now() - this.EPOCH) / this.TICK_MS);
        
        if (targetStep - this.currentGlobalStep > 10) {
            this.fastForwardTo(targetStep);
            return;
        }

        let updated = false;
        while (this.currentGlobalStep < targetStep) {
            this.currentGlobalStep++;
            const stepInBlock = this.currentGlobalStep % this.STEPS_PER_BLOCK;

            if (stepInBlock === 0) {
                const blockID = Math.floor(this.currentGlobalStep / this.STEPS_PER_BLOCK);
                this.screenEl.innerHTML = '';
                this.currentWordContext = [];
                this.tokenBuffer = [];
                this.rng = this.seededRandom(blockID);
                this.capitalizeNext = true;
                this.resetThemeContext(this.rng);
            }

            const token = this.getNextToken(this.rng);
            const isFirst = this.screenEl.childNodes.length === 0 || 
                           (this.screenEl.childNodes.length === 1 && this.screenEl.firstChild === this.rouletteEl);
            
            this.appendToken(token, isFirst);
            updated = true;
            
            if (token === '.') {
                this.advanceTheme(this.rng);
            }
        }

        if (updated) {
            this.currentCandidates = this.peekCandidates();
        }
    },

    startLocal: function(customPrompt) {
        this.screenEl.innerHTML = '';
        this.currentWordContext = [];
        this.tokenBuffer = [];
        let localStepCount = 0;
        
        const { v: vocab } = this.data;
        const words = customPrompt.toLowerCase().match(/[a-z]+|\./g) || [];
        
        words.forEach((w, i) => {
            this.appendToken(w, i === 0);
            const id = vocab.indexOf(w);
            if (id !== -1) {
                this.currentWordContext.push(id);
                if (this.currentWordContext.length > 10) this.currentWordContext.shift();
            }
        });

        const lastWord = words[words.length - 1] || ".";
        this.capitalizeNext = lastWord === ".";
        this.rng = Math.random;
        
        this.resetThemeContext(this.rng);
        this.currentCandidates = this.peekCandidates();

        this.currentInterval = setInterval(() => {
            const token = this.getNextToken(this.rng);
            this.appendToken(token, false);
            this.currentCandidates = this.peekCandidates();
            localStepCount++;

            if (token === '.') {
                this.advanceTheme(this.rng);
            }

            if (localStepCount >= this.STEPS_PER_BLOCK) {
                clearInterval(this.currentInterval);
                if (this.rouletteInterval) clearInterval(this.rouletteInterval);
                this.currentInterval = null;
                this.rouletteEl.textContent = '';
                
                const eof = document.createElement('span');
                eof.textContent = " [EOF]";
                eof.style.opacity = "0.5";
                this.screenEl.appendChild(eof);
            }
        }, this.TICK_MS);
    },

    resetThemeContext: function(rng) {
        const { ts: themeStarters, v: vocab } = this.data;
        if (themeStarters.length > 0) {
            const starterSeq = themeStarters[Math.floor(rng() * themeStarters.length)];
            this.currentThemeContext = [...starterSeq];
            this.activeThemeID = this.currentThemeContext[this.currentThemeContext.length - 1];
            if (this.VERBOSE) console.log(`[Stream] Active Theme: ${vocab[this.activeThemeID]}`);
        }
    },

    advanceTheme: function(rng) {
        const { t: themeModel, v: vocab } = this.data;
        const candidates = this.getPredictions(themeModel, this.currentThemeContext);
        if (!candidates) {
            this.resetThemeContext(rng);
            return;
        }

        const chosenId = this.weightedRandomSelect(candidates, rng);
        this.currentThemeContext.push(parseInt(chosenId));
        this.activeThemeID = chosenId;
        if (this.VERBOSE) console.log(`[Stream] Active Theme: ${vocab[this.activeThemeID]}`);
        
        if (this.currentThemeContext.length > 5) {
            this.currentThemeContext.shift();
        }
    },

    /**
     * Traverses a reverse-context Katz Backoff Trie.
     */
    getPredictions: function(trieRoot, contextArray) {
        let node = trieRoot;
        let bestPredictions = null;

        for (let i = contextArray.length - 1; i >= 0; i--) {
            const id = contextArray[i];
            if (node[id]) {
                node = node[id];
                if (node[""]) bestPredictions = node[""];
            } else {
                break;
            }
        }
        return bestPredictions;
    },

    getNextToken: function(rng) {
        if (this.tokenBuffer.length > 0) {
            return this.tokenBuffer.shift();
        }

        const { g: grammarModel, v: vocab, s: starters, w: gravityMap } = this.data;

        if (this.currentWordContext.length === 0) {
            const starterSeq = starters[Math.floor(rng() * starters.length)];
            this.currentWordContext = [...starterSeq];
            this.tokenBuffer = this.currentWordContext.map(id => vocab[id]);
            return this.tokenBuffer.shift();
        }

        let candidates = this.getPredictions(grammarModel, this.currentWordContext);

        if (!candidates) {
            const starterSeq = starters[Math.floor(rng() * starters.length)];
            this.currentWordContext = [...starterSeq];
            this.tokenBuffer = this.currentWordContext.map(id => vocab[id]);
            return this.tokenBuffer.shift();
        }

        let weightedCandidates = Object.assign({}, candidates);
        
        if (this.activeThemeID && gravityMap[this.activeThemeID]) {
            const activeGravity = gravityMap[this.activeThemeID];
            for (let wordId in weightedCandidates) {
                if (activeGravity[wordId]) {
                    weightedCandidates[wordId] += (weightedCandidates[wordId] * activeGravity[wordId] * this.GRAVITY_MULTIPLIER);
                }
            }
        }

        const chosenId = parseInt(this.weightedRandomSelect(weightedCandidates, rng));
        this.currentWordContext.push(chosenId);
        
        if (this.currentWordContext.length > 10) {
            this.currentWordContext.shift();
        }

        return vocab[chosenId];
    },

    /**
     * Keys are sorted numerically to guarantee deterministic traversal 
     * regardless of browser engine key iteration order implementations.
     */
    weightedRandomSelect: function(predictionsMap, rng) {
        const keys = Object.keys(predictionsMap).sort((a, b) => Number(a) - Number(b));
        const weights = keys.map(k => predictionsMap[k]);
        const total = weights.reduce((a, b) => a + b, 0);
        
        let r = rng() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                return keys[i];
            }
        }
        return keys[0];
    },

    appendToken: function(token, isFirstInBlock) {
        const isPunct = token === '.';
        let out = "";

        if (!isFirstInBlock && !isPunct) {
            out += " ";
        }

        if (isPunct) {
            out += token;
            this.capitalizeNext = true;
        } else {
            const shouldCapitalize = this.capitalizeNext || /^i(m|ve|ll|d)?$/.test(token);
            out += shouldCapitalize ? token.charAt(0).toUpperCase() + token.slice(1) : token;
            this.capitalizeNext = false;
        }

        const span = document.createElement('span');
        span.textContent = out;
        
        if (this.rouletteEl && this.rouletteEl.parentNode === this.screenEl) {
            this.screenEl.insertBefore(span, this.rouletteEl);
        } else {
            this.screenEl.appendChild(span);
        }
        
        if (this.rouletteEl) {
            this.screenEl.appendChild(this.rouletteEl);
        }
        
        this.screenEl.scrollTop = this.screenEl.scrollHeight;
    },

    peekCandidates: function() {
        if (!this.data || this.currentWordContext.length === 0) return ["..."];
        
        const { g: grammarModel, v: vocab, w: gravityMap } = this.data;
        let candidates = this.getPredictions(grammarModel, this.currentWordContext);

        if (!candidates) return ["..."];

        let weightedCandidates = Object.assign({}, candidates);
        if (this.activeThemeID && gravityMap[this.activeThemeID]) {
            const activeGravity = gravityMap[this.activeThemeID];
            for (let wordId in weightedCandidates) {
                if (activeGravity[wordId]) {
                    weightedCandidates[wordId] += (weightedCandidates[wordId] * activeGravity[wordId] * this.GRAVITY_MULTIPLIER);
                }
            }
        }

        const keys = Object.keys(weightedCandidates);
        const sorted = keys.sort((a, b) => weightedCandidates[b] - weightedCandidates[a]).slice(0, 5);
        
        return sorted.map(id => vocab[parseInt(id)]);
    },

    startRoulette: function() {
        if (this.rouletteInterval) clearInterval(this.rouletteInterval);
        
        this.rouletteInterval = setInterval(() => {
            if (!this.currentCandidates || this.currentCandidates.length === 0) return;
            
            const word = this.currentCandidates[Math.floor(Math.random() * this.currentCandidates.length)];
            let out = "";
            const isPunct = word === '.';
            const isFirstInBlock = this.screenEl.firstChild === this.rouletteEl || this.screenEl.childNodes.length === 0;

            if (!isPunct && !isFirstInBlock) {
                out += " ";
            }

            if (isPunct) {
                out += word;
            } else {
                const shouldCapitalize = this.capitalizeNext || /^i(m|ve|ll|d)?$/.test(word);
                out += shouldCapitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
            }
            
            this.rouletteEl.textContent = out;
        }, 45);
    },

    unload: function() {
        if (this.currentInterval) clearInterval(this.currentInterval);
        if (this.rouletteInterval) clearInterval(this.rouletteInterval);
        this.data = null;
        this.currentWordContext = [];
        this.currentThemeContext = [];
        this.tokenBuffer = [];
        this.currentCandidates = [];
    },

    onResize: function() {
        if (this.screenEl) this.screenEl.scrollTop = this.screenEl.scrollHeight;
    }
};

export default Stream;