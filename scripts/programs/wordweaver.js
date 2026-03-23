/**
 * WordWeaver.js
 * A deterministic, seeded N-gram typing game utilizing Dual-Track NLP architecture.
 * 
 * Architecture & Gameplay:
 * - Employs a Stateless Deterministic model seeded by user input or random generation.
 * - Utilizes an Ensemble Text Generation system identical to Stream.js:
 *   1. Grammar Engine (v, g, s): Deep Katz Backoff Trie ensuring local syntax.
 *   2. Theme Engine (t, ts): Macro Trie governing long-term topic progression.
 *   3. Gravity Map (w): Intersects the two engines by applying vocabulary weight multipliers.
 * - Player traverses the latent space by typing words, restricted to the top 10% of 
 *   weighted grammatical candidates, aiming to organically construct a target sequence.
 */

const WordWeaver = {
    DATA_PATH: './data/ngrams.json',
    SEQUENCE_LENGTH: 3,
    GRAVITY_MULTIPLIER: 2.5,
    
    container: null,
    data: null,
    rng: null,
    currentSeedStr: "",
    
    startSeq: [],
    goalSeq: [],
    currentWordContext: [],
    currentThemeContext: [],
    activeThemeID: null,
    capitalizeNext: true,
    
    validCandidatesWords: [],
    currentTyping: "",
    lastTokens: [],
    appendedSpans: [],
    
    gameState: 'MENU', 
    audioCtx: null,
    ui: {},

    /**
     * Seeds the deterministic random number generator.
     * Hashes a string seed to an integer, then applies a deterministic sequence.
     */
    seededRandom: function(seedStr) {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
        }
        return function() {
            let t = hash += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    initAudio: function() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    playSound: function(type) {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        if (type === 'type') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            osc.start(t);
            osc.stop(t + 0.05);
        } else if (type === 'complete') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, t); 
            osc.frequency.setValueAtTime(659.25, t + 0.05); 
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        } else if (type === 'win') {
            osc.type = 'sine';
            const notes = [261.63, 329.63, 392.00, 523.25]; 
            notes.forEach((freq, i) => {
                const time = t + (i * 0.1);
                osc.frequency.setValueAtTime(freq, time);
            });
            gain.gain.setValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
            gain.gain.linearRampToValueAtTime(0.0, t + 0.6);
            osc.start(t);
            osc.stop(t + 0.6);
        }
    },

    init: async function(containerEl) {
        this.container = containerEl;
        
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.backgroundColor = '#111';
        this.container.style.color = '#eee';
        this.container.style.fontFamily = 'monospace';
        this.container.style.boxSizing = 'border-box';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';

        this.container.innerHTML = `<div style="padding: 20px; color:#aaa;">Establishing Uplink to Network Data...</div>`;

        try {
            const response = await fetch(this.DATA_PATH);
            this.data = await response.json();
            this.bindEvents();
            this.showMenu();
        } catch (err) {
            this.container.innerHTML = `<p style="padding: 20px; color:red">Broadcast Offline: Data missing.</p>`;
        }
    },

    showMenu: function() {
        this.gameState = 'MENU';
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.margin = 'auto';
        wrapper.style.textAlign = 'center';
        wrapper.style.padding = '20px';

        const title = document.createElement('h1');
        title.textContent = 'WordWeaver';
        title.style.letterSpacing = '2px';
        title.style.color = '#4CAF50';

        const desc = document.createElement('p');
        desc.textContent = 'Navigate the latent space from start to goal sequence.';
        desc.style.color = '#888';
        desc.style.marginBottom = '30px';

        const inputGroup = document.createElement('div');
        
        const seedInput = document.createElement('input');
        seedInput.type = 'text';
        seedInput.placeholder = 'Leave blank for random seed';
        seedInput.value = this.currentSeedStr;
        seedInput.style.padding = '10px';
        seedInput.style.background = '#222';
        seedInput.style.border = '1px solid #444';
        seedInput.style.color = '#eee';
        seedInput.style.fontFamily = 'monospace';
        seedInput.style.width = '250px';
        seedInput.style.marginRight = '10px';
        this.ui.seedInput = seedInput;

        const startBtn = document.createElement('button');
        startBtn.textContent = 'INITIALIZE';
        startBtn.style.padding = '10px 20px';
        startBtn.style.background = '#4CAF50';
        startBtn.style.border = 'none';
        startBtn.style.color = '#000';
        startBtn.style.fontWeight = 'bold';
        startBtn.style.cursor = 'pointer';
        startBtn.style.fontFamily = 'monospace';

        startBtn.addEventListener('click', () => {
            this.initAudio();
            let seed = seedInput.value.trim();
            if (!seed) seed = Math.random().toString(36).substring(2, 8).toUpperCase();
            this.startGame(seed);
        });

        inputGroup.appendChild(seedInput);
        inputGroup.appendChild(startBtn);

        wrapper.appendChild(title);
        wrapper.appendChild(desc);
        wrapper.appendChild(inputGroup);
        this.container.appendChild(wrapper);
    },

    /**
     * Identifies a valid starting point and a high-frequency target sequence.
     * Goal sequences are selected from the top 20% of the starters array, 
     * which represents the most statistically significant latent paths.
     */
    startGame: function(seedStr) {
        this.currentSeedStr = seedStr;
        this.rng = this.seededRandom(seedStr);
        this.gameState = 'PLAYING';
        this.currentTyping = "";
        this.appendedSpans = [];
        this.lastTokens = [];
        this.capitalizeNext = true;
        this.currentWordContext = [];

        const { s: starters, v: vocab, g: grammarModel } = this.data;

        const getFixedLenSequence = (baseSeq) => {
            let seq = [...baseSeq];
            while (seq.length < this.SEQUENCE_LENGTH) {
                const predictions = this.getPredictions(grammarModel, seq);
                const keys = Object.keys(predictions);
                if (keys.length === 0) break;
                keys.sort((a, b) => predictions[b] - predictions[a]);
                seq.push(parseInt(keys[0]));
            }
            return seq.slice(0, this.SEQUENCE_LENGTH);
        };

        const idx1 = Math.floor(this.rng() * starters.length);
        this.startSeq = getFixedLenSequence(starters[idx1]);

        // Select goal from the top 20% of frequency-weighted starters
        const popularThreshold = Math.max(1, Math.floor(starters.length * 0.2));
        let idx2 = Math.floor(this.rng() * popularThreshold);
        this.goalSeq = getFixedLenSequence(starters[idx2]);
        
        let safety = 0;
        while (this.startSeq.join(',') === this.goalSeq.join(',') && safety < 20) {
            idx2 = Math.floor(this.rng() * popularThreshold);
            this.goalSeq = getFixedLenSequence(starters[idx2]);
            safety++;
        }

        this.buildGameUI();
        this.resetThemeContext(this.rng);

        this.startSeq.forEach((wordId, index) => {
            const token = vocab[wordId];
            this.currentWordContext.push(wordId);
            this.lastTokens.push(wordId);
            this.appendToken(token, index === 0);
            if (token === '.') this.advanceTheme(this.rng);
        });
        
        this.updateCandidates();
        this.renderActiveState();
    },

    /**
     * Initializes the UI with a hidden input field to facilitate mobile keyboard
     * interaction and ensures the candidate list is interactive for touch users.
     */
    buildGameUI: function() {
        this.container.innerHTML = '';
        
        const header = document.createElement('div');
        header.style.padding = '10px 10px 10px 10px';
        header.style.borderBottom = '1px solid #333';
        header.style.backgroundColor = '#1a1a1a';
        
        const infoStr = document.createElement('div');
        infoStr.innerHTML = `Seed: <span style="color:#4CAF50">${this.currentSeedStr}</span>`;
        
        const goalStrEl = document.createElement('div');
        goalStrEl.style.fontSize = '0.9rem';
        goalStrEl.style.marginTop = '10px';
        const goalWords = this.goalSeq.map(id => this.data.v[id]).join(' ');
        goalStrEl.innerHTML = `TARGET SEQUENCE: <span style="color:#FFC107; font-weight:bold;">[ ${goalWords} ]</span>`;
        
        header.appendChild(infoStr);
        header.appendChild(goalStrEl);

        this.ui.screenEl = document.createElement('div');
        this.ui.screenEl.style.flex = '1';
        this.ui.screenEl.style.padding = '20px';
        this.ui.screenEl.style.overflowY = 'auto';
        this.ui.screenEl.style.whiteSpace = 'pre-wrap';
        this.ui.screenEl.style.wordBreak = 'break-word';
        this.ui.screenEl.style.fontSize = '0.8rem';
        this.ui.screenEl.style.lineHeight = '1.6';

        // Hidden input allows mobile devices to trigger the virtual keyboard
        this.ui.hiddenInput = document.createElement('input');
        this.ui.hiddenInput.type = "text";
        this.ui.hiddenInput.autocapitalize = "none";
        this.ui.hiddenInput.autocomplete = "off";
        this.ui.hiddenInput.spellcheck = false;
        this.ui.hiddenInput.style.position = 'absolute';
        this.ui.hiddenInput.style.opacity = '0';
        this.ui.hiddenInput.style.pointerEvents = 'none';
        this.ui.hiddenInput.style.left = '-9999px';

        this.ui.prefixSpace = document.createElement('span');
        this.ui.activeInput = document.createElement('span');
        this.ui.activeInput.style.color = '#4CAF50';
        this.ui.activeInput.style.fontWeight = 'bold';
        this.ui.activeInput.style.borderBottom = '2px solid #4CAF50';
        
        this.ui.dropdown = document.createElement('div');
        this.ui.dropdown.style.color = '#666';
        this.ui.dropdown.style.marginTop = '12px';
        this.ui.dropdown.style.minHeight = '1.2em';
        this.ui.dropdown.style.cursor = 'pointer';

        this.ui.screenEl.appendChild(this.ui.hiddenInput);
        this.ui.screenEl.appendChild(this.ui.prefixSpace);
        this.ui.screenEl.appendChild(this.ui.activeInput);
        this.ui.screenEl.appendChild(this.ui.dropdown);

        this.container.appendChild(header);
        this.container.appendChild(this.ui.screenEl);
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
        return bestPredictions || trieRoot[""] || {};
    },

    resetThemeContext: function(rng) {
        const { ts: themeStarters } = this.data;
        if (themeStarters && themeStarters.length > 0) {
            const starterSeq = themeStarters[Math.floor(rng() * themeStarters.length)];
            this.currentThemeContext = [...starterSeq];
            this.activeThemeID = this.currentThemeContext[this.currentThemeContext.length - 1];
        }
    },

    advanceTheme: function(rng) {
        const { t: themeModel } = this.data;
        const candidates = this.getPredictions(themeModel, this.currentThemeContext);
        if (!candidates) {
            this.resetThemeContext(rng);
            return;
        }

        const chosenId = parseInt(this.weightedRandomSelect(candidates, rng));
        this.currentThemeContext.push(chosenId);
        this.activeThemeID = chosenId;
        
        if (this.currentThemeContext.length > 5) {
            this.currentThemeContext.shift();
        }
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

    /**
     * Determines which grammatical candidates are valid for selection.
     * Selects the top 10% of candidates, with a hard floor of the top 5
     * most probable words to ensure player agency and flow.
     */
    updateCandidates: function() {
        const { g: grammarModel, v: vocab, w: gravityMap } = this.data;
        let candidates = this.getPredictions(grammarModel, this.currentWordContext);
        
        if (!candidates || Object.keys(candidates).length === 0) {
            this.validCandidatesWords = [];
            return;
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

        const keys = Object.keys(weightedCandidates);
        keys.sort((a, b) => weightedCandidates[b] - weightedCandidates[a]);

        // Top 10% but at least 5 words if possible
        let limit = Math.ceil(keys.length * 0.1);
        if (limit < 5) limit = 5;
        if (limit > keys.length) limit = keys.length;
        
        const topIds = keys.slice(0, limit);
        this.validCandidatesWords = topIds.map(id => vocab[parseInt(id)]);
    },
    
    /**
     * Ensures newly committed tokens are inserted logically before the input area.
     */
    appendToken: function(token, isFirstInSequence) {
        const isPunct = token === '.';
        let out = "";

        if (!isFirstInSequence && !isPunct) out += " ";

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
        
        // Insert before the prefixSpace to keep current typing at the end of the text flow
        this.ui.screenEl.insertBefore(span, this.ui.prefixSpace);
        this.appendedSpans.push(span);
        
        this.ui.screenEl.scrollTop = this.ui.screenEl.scrollHeight;
    },

    /**
     * Refreshes the display area. The prefix space is kept outside the underlined
     * activeInput span to maintain visual distinction between established text
     * and the current draft buffer.
     */
    renderActiveState: function() {
        if (this.gameState !== 'PLAYING') return;

        let prefix = "";
        if (this.currentWordContext.length > 0) {
            const lastId = this.currentWordContext[this.currentWordContext.length - 1];
            const lastToken = this.data.v[lastId];
            if (lastToken !== '.') prefix = " ";
        }

        let display = this.currentTyping;
        if (display.length > 0) {
            const shouldCap = this.capitalizeNext || /^i(m|ve|ll|d)?$/.test(display);
            if (shouldCap) display = display.charAt(0).toUpperCase() + display.slice(1);
        } else {
            display = "\u00A0";
        }

        this.ui.prefixSpace.textContent = prefix;
        this.ui.activeInput.textContent = display;
        
        const filtered = this.getFilteredCandidates();
        if (filtered.length > 0) {
            this.ui.dropdown.textContent = `[ ${filtered.join(', ')} ]`;
        } else {
            this.ui.dropdown.textContent = `[ - ]`;
        }

        this.ui.screenEl.scrollTop = this.ui.screenEl.scrollHeight;
    },

    getFilteredCandidates: function() {
        if (!this.currentTyping) return this.validCandidatesWords;
        return this.validCandidatesWords.filter(w => w.startsWith(this.currentTyping));
    },

    getCommonPrefix: function(words) {
        if (!words || words.length === 0) return "";
        let prefix = words[0];
        for (let i = 1; i < words.length; i++) {
            while (words[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === "") return "";
            }
        }
        return prefix;
    },

    /**
     * Binds input and touch events to support both desktop and mobile workflows.
     * Clicking the screen focuses the hidden input to bring up the keyboard.
     * Tapping the candidate list triggers autocomplete logic for mobile users.
     */
    bindEvents: function() {
        this._keydownHandler = this.handleKeyDown.bind(this);
        this._inputHandler = this.handleInput.bind(this);
        this._focusHandler = () => {
            if (this.gameState === 'PLAYING') this.ui.hiddenInput.focus();
        };
        this._dropdownClickHandler = (e) => {
            if (this.gameState === 'PLAYING') {
                e.preventDefault();
                this.triggerAutocomplete();
            }
        };

        document.addEventListener('keydown', this._keydownHandler);
        this.container.addEventListener('input', this._inputHandler);
        this.container.addEventListener('click', this._focusHandler);
        // Candidate list acts as a "Tab" button for mobile
        this.container.addEventListener('click', (e) => {
            if (this.ui.dropdown.contains(e.target)) this._dropdownClickHandler(e);
        });
    },

    /**
     * Synchronizes the hidden input buffer with the game state. 
     * Detects trailing spaces to trigger word commitment on mobile keyboards.
     */
    handleInput: function(e) {
        if (this.gameState !== 'PLAYING' || e.target !== this.ui.hiddenInput) return;

        let val = this.ui.hiddenInput.value.toLowerCase();
        
        // Handle spacebar commitment from mobile keyboard
        if (val.endsWith(' ')) {
            this.currentTyping = val.trim();
            this.commitWord();
            this.ui.hiddenInput.value = "";
        } else {
            this.currentTyping = val.replace(/[^a-z0-9\.\-']/g, '');
            this.ui.hiddenInput.value = this.currentTyping;
            this.playSound('type');
        }
        
        this.renderActiveState();
    },

    /**
     * Unified autocomplete logic shared between the Tab key and touch interactions.
     */
    triggerAutocomplete: function() {
        this.initAudio();
        const filtered = this.getFilteredCandidates();
        
        if (filtered.length > 0) {
            const prefix = this.getCommonPrefix(filtered);
            if (prefix.length > this.currentTyping.length) {
                this.currentTyping = prefix;
                this.ui.hiddenInput.value = prefix;
                this.playSound('type');
            } else if (this.validCandidatesWords.includes(this.currentTyping)) {
                this.commitWord();
                this.ui.hiddenInput.value = "";
            }
        }
        this.renderActiveState();
    },

    /**
     * Specialized key handler for control keys (Tab, Enter, Backspace) 
     * while character entry is handled by handleInput.
     */
    handleKeyDown: function(e) {
        if (this.gameState === 'MENU' && e.key === 'Enter') {
            this.initAudio();
            let seed = this.ui.seedInput.value.trim();
            if (!seed) seed = Math.random().toString(36).substring(2, 8).toUpperCase();
            this.startGame(seed);
            return;
        }

        if (this.gameState === 'GAMEOVER' && e.key === 'Enter') {
            this.showMenu();
            return;
        }

        if (this.gameState !== 'PLAYING' || e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Tab') {
            e.preventDefault();
            this.triggerAutocomplete();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.initAudio();
            this.commitWord();
            this.ui.hiddenInput.value = "";
        } else if (e.key === 'Backspace') {
            // hiddenInput automatically handles value sync via 'input' event, 
            // but we play the sound here for immediate feedback.
            this.playSound('type');
        }
    },

    /**
     * Cleans the input buffer upon successful word commitment.
     */
    commitWord: function() {
        if (this.validCandidatesWords.includes(this.currentTyping)) {
            const token = this.currentTyping;
            const wordId = this.data.v.indexOf(token);
            
            if (wordId !== -1) {
                this.currentTyping = "";
                this.ui.hiddenInput.value = "";
                this.appendToken(token, false);

                this.currentWordContext.push(wordId);
                if (this.currentWordContext.length > 10) this.currentWordContext.shift();

                this.lastTokens.push(wordId);
                if (this.lastTokens.length > this.SEQUENCE_LENGTH) this.lastTokens.shift();

                if (token === '.') this.advanceTheme(this.rng);
                
                if (this.checkWin()) {
                    this.triggerWin();
                } else {
                    this.playSound('complete');
                    this.updateCandidates();
                    this.renderActiveState();
                }
            }
        } else {
            this.currentTyping = "";
            this.ui.hiddenInput.value = "";
            this.playSound('error');
            this.renderActiveState();
        }
    },
    
    checkWin: function() {
        if (this.lastTokens.length < this.SEQUENCE_LENGTH) return false;
        const lastN = this.lastTokens.slice(-this.SEQUENCE_LENGTH);
        
        for (let i = 0; i < this.SEQUENCE_LENGTH; i++) {
            if (lastN[i] !== this.goalSeq[i]) return false;
        }
        return true;
    },

    triggerWin: function() {
        this.gameState = 'GAMEOVER';
        this.playSound('win');
        
        this.ui.activeInput.textContent = "";
        
        const lastSpans = this.appendedSpans.slice(-this.SEQUENCE_LENGTH);
        lastSpans.forEach(span => {
            span.style.color = '#FFC107';
            span.style.fontWeight = 'bold';
        });

        const winMsg = document.createElement('span');
        winMsg.innerHTML = `<br><br><span style="color:#4CAF50; animation: blink 1s infinite;">SEQUENCE COMPLETE. Press [ENTER] to continue.</span>`;
        this.ui.screenEl.appendChild(winMsg);
        this.ui.dropdown.textContent = '';
        this.ui.screenEl.scrollTop = this.ui.screenEl.scrollHeight;
        
        this.currentSeedStr = Math.abs(this.rng() * 0xFFFFFFFF | 0).toString(16).toUpperCase();

        if (!document.getElementById('ww-styles')) {
            const style = document.createElement('style');
            style.id = 'ww-styles';
            style.innerHTML = `@keyframes blink { 0%, 100% {opacity: 1;} 50% {opacity: 0.3;} }`;
            document.head.appendChild(style);
        }
    },

    unload: function() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.data = null;
    }
};

export default WordWeaver;