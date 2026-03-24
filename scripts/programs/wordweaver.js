/**
 * WordWeaver.js
 * A deterministic, seeded N-gram typing game utilizing a single-track NLP architecture.
 * 
 * Architecture & Gameplay:
 * - Employs a Stateless Deterministic model seeded by user input or random generation.
 * - Utilizes a Grammar Engine (v, g, s): Deep Katz Backoff Trie ensuring local syntax.
 * - Player traverses the latent space by typing words, restricted to the top 10% of 
 *   grammatical candidates, aiming to organically construct a target sequence.
 * - Target sequences are generated deterministically via a random walk of hidden steps
 *   from the starting sequence.
 * - Words typed that belong to the hidden path are highlighted to guide the player.
 */

// Encapsulated path state prevents exposing the target walk to the client console.
let currentTargetPath = [];

const WordWeaver = {
    DATA_PATH: './data/ngrams.json',
    SEQUENCE_LENGTH: 3,
    WALK_STEPS: 10,
    
    container: null,
    data: null,
    rng: null,
    currentSeedStr: "",
    
    startSeq: [],
    goalSeq: [],
    currentWordContext: [],
    history: [],
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
        wrapper.style.padding = '0px';

        const title = document.createElement('h2');
        title.textContent = 'WordWeaver';
        title.style.letterSpacing = '2px';
        title.style.color = '#4CAF50';

        const desc = document.createElement('div');
        desc.style.color = '#888';
        desc.style.fontSize = '0.6rem';
        desc.style.lineHeight = '1.3';
        desc.style.maxWidth = '650px';
        desc.style.margin = '0 auto 0px auto';
        desc.style.textAlign = 'left';
        desc.style.padding = '5px';
        desc.innerHTML = `<ul style="padding-left: 5px; margin-bottom: 0; margin-top: 0;">
                <li>Traverse the latent space by typing words to build a sentence.</li>
                <li>Your goal is to organically reach the <span style="color:#FFC107; font-weight:bold;">TARGET SEQUENCE</span> at the end of your path.</li>
                <li>You are restricted to typing the top predicted grammatical candidates shown in brackets at the bottom.</li>
                <li>Words highlighted in <span style="color:#00BCD4; text-shadow:0 0 4px rgba(0,188,212,0.3); font-weight:bold;">BLUE</span> indicate you are walking the hidden optimal path.</li>
                <li>Use <strong>Tab</strong> to autocomplete and <strong>Ctrl+Backspace</strong> to undo your last word.</li>
            </ul>`;

        const inputGroup = document.createElement('div');
        inputGroup.style.display = 'flex';
        inputGroup.style.justifyContent = 'center';
        inputGroup.style.gap = '10px';
        inputGroup.style.flexWrap = 'wrap';
        
        const seedInput = document.createElement('input');
        seedInput.type = 'text';
        seedInput.placeholder = 'Seed (blank for random)';
        seedInput.value = this.currentSeedStr;
        seedInput.style.padding = '10px';
        seedInput.style.background = '#222';
        seedInput.style.border = '1px solid #444';
        seedInput.style.color = '#eee';
        seedInput.style.fontFamily = 'monospace';
        seedInput.style.width = '220px';
        this.ui.seedInput = seedInput;

        const stepsLabel = document.createElement('div');
        stepsLabel.style.display = 'flex';
        stepsLabel.style.alignItems = 'center';
        stepsLabel.style.background = '#222';
        stepsLabel.style.border = '1px solid #444';
        stepsLabel.style.padding = '0 10px';
        stepsLabel.style.color = '#888';

        const stepsText = document.createElement('span');
        stepsText.textContent = 'STEPS:';
        stepsText.style.marginRight = '5px';
        stepsText.style.fontFamily = 'monospace';

        const walkStepsInput = document.createElement('input');
        walkStepsInput.type = 'number';
        walkStepsInput.min = '4';
        walkStepsInput.value = this.WALK_STEPS;
        walkStepsInput.style.background = 'transparent';
        walkStepsInput.style.border = 'none';
        walkStepsInput.style.color = '#eee';
        walkStepsInput.style.fontFamily = 'monospace';
        walkStepsInput.style.width = '50px';
        walkStepsInput.style.outline = 'none';
        this.ui.walkStepsInput = walkStepsInput;

        stepsLabel.appendChild(stepsText);
        stepsLabel.appendChild(walkStepsInput);

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
            
            let steps = parseInt(walkStepsInput.value, 10);
            if (isNaN(steps) || steps < 4) steps = 4;
            this.WALK_STEPS = steps;

            this.startGame(seed);
        });

        inputGroup.appendChild(seedInput);
        inputGroup.appendChild(stepsLabel);
        inputGroup.appendChild(startBtn);

        wrapper.appendChild(title);
        wrapper.appendChild(desc);
        wrapper.appendChild(inputGroup);
        this.container.appendChild(wrapper);
    },

    /**
     * Identifies a valid starting point and simulates a random walk through 
     * valid player states to determine the target goal sequence.
     */
    startGame: function(seedStr) {
        this.currentSeedStr = seedStr;
        this.rng = this.seededRandom(seedStr);
        this.gameState = 'PLAYING';
        this.currentTyping = "";
        this.appendedSpans = [];
        this.lastTokens = [];
        this.currentWordContext = [];
        this.history = [];
        this.capitalizeNext = true;

        const { s: starters, v: vocab, g: grammarModel } = this.data;

        let pathFound = false;
        let generationAttempts = 0;
        
        while (!pathFound && generationAttempts < 100) {
            generationAttempts++;
            const idx = Math.floor(this.rng() * starters.length);
            this.startSeq = [...starters[idx]];
            
            currentTargetPath = [];
            let tempContext = [...this.startSeq];
            let walkDeadEnd = false;
            
            for (let i = 0; i < this.WALK_STEPS; i++) {
                let candidates = this.getPredictions(grammarModel, tempContext);
                let keys = Object.keys(candidates);
                
                if (keys.length === 0) {
                    walkDeadEnd = true;
                    break;
                }
                
                keys.sort((a, b) => candidates[b] - candidates[a]);
                
                let limit = Math.ceil(keys.length * 0.1);
                if (limit < 5) limit = 5;
                if (limit > keys.length) limit = keys.length;
                
                const validIds = keys.slice(0, limit);
                const chosenId = parseInt(validIds[Math.floor(this.rng() * validIds.length)]);
                
                currentTargetPath.push(chosenId);
                tempContext.push(chosenId);
                if (tempContext.length > 10) tempContext.shift();
            }
            
            if (!walkDeadEnd && currentTargetPath.length === this.WALK_STEPS) {
                this.goalSeq = tempContext.slice(-this.SEQUENCE_LENGTH);
                const startTail = this.startSeq.slice(-this.SEQUENCE_LENGTH).join(',');
                if (this.goalSeq.join(',') !== startTail) {
                    pathFound = true;
                }
            }
        }

        if (!pathFound) {
            this.startSeq = [...starters[0]];
            this.goalSeq = [...starters[1]];
            currentTargetPath = [...this.goalSeq];
        }

        this.buildGameUI();

        this.startSeq.forEach((wordId, index) => {
            const token = vocab[wordId];
            this.history.push(wordId);
            this.currentWordContext.push(wordId);
            this.lastTokens.push(wordId);
            this.appendToken(token, index === 0, wordId);
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
        goalStrEl.innerHTML = `TARGET SEQUENCE: <span style="color:#FFC107; font-weight:bold;">${goalWords}</span>`;
        
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

    /**
     * Determines which grammatical candidates are valid for selection.
     * Selects the top 10% of candidates, with a hard floor of the top 5
     * most probable words to ensure player agency and flow.
     */
    updateCandidates: function() {
        const { g: grammarModel, v: vocab } = this.data;
        let candidates = this.getPredictions(grammarModel, this.currentWordContext);
        
        if (!candidates || Object.keys(candidates).length === 0) {
            this.validCandidatesWords = [];
            return;
        }

        const keys = Object.keys(candidates);
        keys.sort((a, b) => candidates[b] - candidates[a]);

        let limit = Math.ceil(keys.length * 0.1);
        if (limit < 5) limit = 5;
        if (limit > keys.length) limit = keys.length;
        
        const topIds = keys.slice(0, limit);
        this.validCandidatesWords = topIds.map(id => vocab[parseInt(id)]);
    },
    
    /**
     * Ensures newly committed tokens are inserted logically before the input area.
     * Analyzes if the token belongs to the hidden target walk and applies a highlight.
     */
    appendToken: function(token, isFirstInSequence, wordId = null) {
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
        
        if (wordId !== null && currentTargetPath.includes(wordId)) {
            span.style.color = '#00BCD4';
            span.style.textShadow = '0 0 4px rgba(0, 188, 212, 0.3)';
        }
        
        this.ui.screenEl.insertBefore(span, this.ui.prefixSpace);
        this.appendedSpans.push(span);
        
        this.ui.screenEl.scrollTop = this.ui.screenEl.scrollHeight;
    },

    /**
     * Refreshes the display area. A space is now consistently applied before 
     * the active typing area if any tokens have been committed.
     */
    renderActiveState: function() {
        if (this.gameState !== 'PLAYING') return;

        let prefix = (this.currentWordContext.length > 0) ? " " : "";

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
            this.ui.dropdown.textContent = `[ ]`;
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

    handleKeyDown: function(e) {
        if (this.gameState === 'MENU' && e.key === 'Enter') {
            this.initAudio();
            let seed = this.ui.seedInput.value.trim();
            if (!seed) seed = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            let steps = parseInt(this.ui.walkStepsInput.value, 10);
            if (isNaN(steps) || steps < 4) steps = 4;
            this.WALK_STEPS = steps;

            this.startGame(seed);
            return;
        }

        if (this.gameState === 'GAMEOVER' && e.key === 'Enter') {
            this.showMenu();
            return;
        }

        if (this.gameState !== 'PLAYING' || e.altKey) return;
        if ((e.ctrlKey || e.metaKey) && e.key !== 'Backspace') return;

        if (e.key === 'Tab') {
            e.preventDefault();
            this.triggerAutocomplete();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.initAudio();
            this.commitWord();
            this.ui.hiddenInput.value = "";
        } else if (e.key === 'Backspace') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (this.currentTyping.length > 0) {
                    this.currentTyping = "";
                    this.ui.hiddenInput.value = "";
                    this.playSound('type');
                    this.renderActiveState();
                } else {
                    this.undoLastWord();
                }
            } else {
                this.playSound('type');
            }
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
                this.appendToken(token, false, wordId);

                this.history.push(wordId);

                this.currentWordContext.push(wordId);
                if (this.currentWordContext.length > 10) this.currentWordContext.shift();

                this.lastTokens.push(wordId);
                if (this.lastTokens.length > this.SEQUENCE_LENGTH) this.lastTokens.shift();
                
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

    /**
     * Reverts the last committed word, restoring the previous game state.
     * Prevents deletion of the initial starting sequence.
     */
    undoLastWord: function() {
        if (this.history.length <= this.startSeq.length) {
            this.playSound('error');
            return;
        }

        this.history.pop();
        
        const span = this.appendedSpans.pop();
        if (span) {
            span.remove();
        }

        this.currentWordContext = this.history.slice(-10);
        this.lastTokens = this.history.slice(-this.SEQUENCE_LENGTH);

        if (this.history.length > 0) {
            const lastWordId = this.history[this.history.length - 1];
            const lastWord = this.data.v[lastWordId];
            this.capitalizeNext = (lastWord === '.');
        } else {
            this.capitalizeNext = true;
        }

        this.playSound('type');
        this.updateCandidates();
        this.renderActiveState();
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
            span.style.textShadow = 'none';
        });

        const winMsg = document.createElement('span');
        winMsg.innerHTML = `<br><span style="color:#4CAF50; animation: blink 1s infinite;">SEQUENCE COMPLETE. Press [ENTER] to continue.</span>`;
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
        this.history = [];
        currentTargetPath = [];
    }
};

export default WordWeaver;