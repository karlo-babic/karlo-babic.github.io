import { userState } from './userState.js';
import { isMobile } from './utils.js';

export const Console = {
    // --- Configuration ---
    availablePrograms: ['help', 'gameoflife', 'evoltree', 'mandelbrot', 'boids', 'gravitysim', 'glideroflife', 'gliderpong', 'wordweaver', 'bonsai', 'eliza', 'radio', 'stream', 'fractal', 'tv', 'img', 'stats', 'read', 'txt', 'sun', 'nasa', 'ip', 'radar', 'chat', 'note', 'store'],
    // Hidden from UI (dropdown, next/prev), but still discoverable via autocomplete and help.
    hiddenPrograms: ['read', 'txt', 'sun', 'nasa', 'ip', 'chat'],
    // Private programs: hidden from UI, help, AND autocomplete.
    privatePrograms: ['note', 'store', 'radar'],
    // Category groupings for the dropdown. Only visible (non-hidden) programs need to be listed here.
    programCategories: {
        'Simulations': ['boids', 'evoltree', 'gameoflife', 'gravitysim', 'mandelbrot'],
        'Games':       ['bonsai', 'glideroflife', 'gliderpong', 'wordweaver'],
        'Broadcast':   ['fractal', 'radio', 'stream', 'tv'],
        'Utilities':   ['eliza', 'help', 'img', 'stats'],
    },

    // --- State ---
    currentProgramIndex: 0,
    activeProgram: null,
    currentProgramArgs: null, // Stores the arguments for the current program
    currentSuggestion: '',
    commandHistory: [],
    historyIndex: -1,

    // --- DOM Elements ---
    windowEl: null,
    screenEl: null,
    inputEl: null,
    suggestionEl: null,
    dropdownBtn: null,
    programListEl: null,

    // --- A private helper function for parsing commands ---
    _parseCommand: function(input) {
        const parts = input.trim().split(/[ \t]+/);
        const command = parts.shift() || '';
        const args = {
            positional: [],
            named: {}
        };

        while (parts.length > 0) {
            let current = parts.shift();
            // Check for both long (--foo) and short (-f) flags
            if (current.startsWith('--') || current.startsWith('-')) {
                // Get the key, removing either '--' or '-'
                const key = current.startsWith('--') ? current.substring(2) : current.substring(1);

                // Check if the next part is a value and not another option
                if (parts.length > 0 && !parts[0].startsWith('-')) {
                    const value = parts.shift();
                    const numValue = parseFloat(value);
                    args.named[key] = isNaN(numValue) ? value : numValue;
                } else {
                    // It's a boolean flag, like -v or --verbose
                    args.named[key] = true;
                }
            } else {
                args.positional.push(current);
            }
        }
        return { command, args };
    },

      
    init: function(initialProgramName = null, initialArgs = null) {
        this.windowEl = document.getElementById('console-window');
        this.screenEl = document.getElementById('console-screen');
        this.inputEl = document.getElementById('program-input');
        this.suggestionEl = document.getElementById('console-suggestion');
        this.dropdownBtn = document.getElementById('current-program-btn');
        this.programListEl = document.getElementById('program-list');

        const restartBtn = document.getElementById('restart-program');
        const nextBtn = document.getElementById('next-program');
        const openFullscreenConsoleBtn = document.getElementById('open-fullscreen-console-btn');
        const openFullscreenProgramBtn = document.getElementById('open-fullscreen-program-btn');

        if (restartBtn) restartBtn.addEventListener('click', () => this.restartCurrentProgram());
        if (this.dropdownBtn) this.dropdownBtn.addEventListener('click', () => this.toggleDropdown());
        if (nextBtn) nextBtn.addEventListener('click', () => this.browse(1));
        if (openFullscreenConsoleBtn) openFullscreenConsoleBtn.addEventListener('click', () => this.openConsoleOnly());
        if (openFullscreenProgramBtn) openFullscreenProgramBtn.addEventListener('click', () => this.openFullscreenProgram());

        this.inputEl.addEventListener('input', () => {
            this.inputEl.style.height = 'auto';
            if (this.inputEl.scrollHeight > 24) {
                this.inputEl.style.height = this.inputEl.scrollHeight + 'px';
            }
            this.updateSuggestion();
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); this.navigateHistory('up'); }
            if (e.key === 'ArrowDown') { e.preventDefault(); this.navigateHistory('down'); }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.runProgramFromInput();
                this.inputEl.value = '';
                this.inputEl.style.height = '';
                this.updateSuggestion();
            }
            if (e.key === 'Tab' && this.currentSuggestion) {
                e.preventDefault();
                this.inputEl.value = this.currentSuggestion;
                this.updateSuggestion();
            }
        });

        this.inputEl.addEventListener('blur', () => this.clearSuggestion());

        window.addEventListener('click', (e) => {
            if (this.dropdownBtn && !e.target.matches('.dropdown-btn')) {
                this.programListEl.classList.remove('show');
            }
        });
        
        this.populateDropdown();

        // --- LOGIC FOR INITIAL PROGRAM ---
        let programToLoad = this.availablePrograms[0]; // Default to the first program
        let argsToLoad = initialArgs || { positional: [], named: {} };

        if (initialProgramName) {
            const requestedIndex = this.availablePrograms.indexOf(initialProgramName);
            if (requestedIndex !== -1) {
                programToLoad = initialProgramName;
                this.currentProgramIndex = requestedIndex;
            } else {
                console.warn(`Initial program "${initialProgramName}" not found. Defaulting to first program.`);
                argsToLoad = { positional: [], named: {} }; // Reset args if program is invalid
            }
        }
        
        // Load the determined program with its arguments in a single step.
        this.loadProgram(programToLoad, argsToLoad);

        if (!isMobile()) {
            this.inputEl.focus();
        }
    },

    // --- Autocomplete logic ---
    updateSuggestion: function() {
        const inputText = this.inputEl.value.trim().toLowerCase();

        if (!inputText) {
            this.clearSuggestion();
            return;
        }

        // Suggest all programs except private ones.
        const visiblePrograms = this.availablePrograms.filter(p => !this.privatePrograms.includes(p));
        const matches = visiblePrograms.filter(prog => prog.startsWith(inputText));

        if (matches.length === 0) {
            this.clearSuggestion();
            return;
        }

        // Find the longest common prefix across all matches.
        let common = matches[0];
        for (let i = 1; i < matches.length; i++) {
            let j = 0;
            while (j < common.length && j < matches[i].length && common[j] === matches[i][j]) j++;
            common = common.slice(0, j);
        }

        if (common && common !== inputText) {
            this.currentSuggestion = common;
            this.suggestionEl.textContent = common;
        } else {
            this.clearSuggestion();
        }
    },

    clearSuggestion: function() {
        this.currentSuggestion = '';
        this.suggestionEl.textContent = '';
    },

    addToHistory: function(command) {
        if (!command || command === this.commandHistory[0]) {
            return;
        }
        this.commandHistory.unshift(command);

        if (this.commandHistory.length > 50) {
            this.commandHistory.pop();
        }
    },

    navigateHistory: function(direction) {
        if (direction === 'up') {
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
            }
        } else {
            if (this.historyIndex > -1) {
                this.historyIndex--;
            }
        }

        if (this.historyIndex >= 0) {
            this.inputEl.value = this.commandHistory[this.historyIndex];
        } else {
            this.inputEl.value = '';
        }

        this.inputEl.focus();
        this.inputEl.selectionStart = this.inputEl.selectionEnd = this.inputEl.value.length;
        this.clearSuggestion();
    },

    restartCurrentProgram: function() {
        this.loadProgram(this.availablePrograms[this.currentProgramIndex], this.currentProgramArgs);
    },

    _createDropdownItem: function(programName) {
        const item = document.createElement('a');
        item.href = '#';
        item.textContent = programName;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            this.currentProgramIndex = this.availablePrograms.indexOf(programName);
            this.loadProgram(programName);
            this.programListEl.classList.remove('show');
        });
        return item;
    },

    _getOrderedVisiblePrograms: function() {
        const visible = new Set(this.availablePrograms.filter(p => !this.hiddenPrograms.includes(p) && !this.privatePrograms.includes(p)));
        const ordered = [];
        for (const programs of Object.values(this.programCategories)) {
            for (const p of programs) {
                if (visible.has(p)) ordered.push(p);
            }
        }
        // Uncategorized visible programs fall through at the end.
        for (const p of visible) {
            if (!ordered.includes(p)) ordered.push(p);
        }
        return ordered;
    },

    populateDropdown: function() {
        if (!this.programListEl) return;
        this.programListEl.innerHTML = '';
        const visible = new Set(this._getOrderedVisiblePrograms());

        for (const [catName, programs] of Object.entries(this.programCategories)) {
            const catPrograms = programs.filter(p => visible.has(p));
            if (catPrograms.length === 0) continue;

            const label = document.createElement('span');
            label.className = 'dropdown-category-label';
            label.textContent = catName;
            this.programListEl.appendChild(label);
            catPrograms.forEach(p => this.programListEl.appendChild(this._createDropdownItem(p)));
        }

        // Any visible program not assigned to a category falls through here.
        this._getOrderedVisiblePrograms()
            .filter(p => !Object.values(this.programCategories).flat().includes(p))
            .forEach(p => this.programListEl.appendChild(this._createDropdownItem(p)));
    },

    toggleDropdown: function() {
        if (this.programListEl) {
            this.programListEl.classList.toggle('show');
        }
    },

    browse: function(direction) {
        const ordered = this._getOrderedVisiblePrograms();
        const current = this.availablePrograms[this.currentProgramIndex];
        const idx = ordered.indexOf(current);
        const next = ordered[(idx + direction + ordered.length) % ordered.length];
        this.currentProgramIndex = this.availablePrograms.indexOf(next);
        this.loadProgram(next);
    },

    runProgramFromInput: function() {
        const inputString = this.inputEl.value.trim();
        
        if (!inputString) return;

        this.addToHistory(inputString);
        this.historyIndex = -1;

        /**
         * If the input begins with a forward slash, treat it as a local navigation command
         * and redirect the browser to the specified path.
         */
        if (inputString.startsWith('/')) {
            window.location.href = inputString;
            return;
        }

        const { command, args } = this._parseCommand(inputString);

        // We check the full list of available programs here.
        const programIndex = this.availablePrograms.indexOf(command);

        if (programIndex !== -1) {
            this.currentProgramIndex = programIndex;
            this.loadProgram(command, args);
        } else {
            if (command) {
                console.warn(`Program "${command}" not found.`);
            }
        }
    },

    loadProgram: async function(programName, args = { positional: [], named: {} }) {
        if (this.activeProgram && typeof this.activeProgram.unload === 'function') {
            this.activeProgram.unload();
        }
        this.activeProgram = null;
        this.screenEl.style.cssText = '';
        this.screenEl.innerHTML = '';
        
        // Update the current program index to match the program being loaded.
        // This ensures the dropdown UI stays in sync.
        const programIndex = this.availablePrograms.indexOf(programName);
        if (programIndex !== -1) {
            this.currentProgramIndex = programIndex;
        }

        // Store the arguments used to launch this program instance.
        this.currentProgramArgs = args;

        if (!this.privatePrograms.includes(programName)) {
            userState.set('lastProgram', programName);
            userState.set('lastProgramArgs', args);
        }

        try {
            const path = `./programs/${programName}.js`;
            const programModule = await import(path);

            if (programModule.default && typeof programModule.default.init === 'function') {
                this.activeProgram = programModule.default;
                this.activeProgram.init(this.screenEl, args);
            } else {
                 console.error(`Program "${programName}" does not have a valid default export.`);
            }
        } catch (error) {
            console.error(`Failed to load or run program: ${programName}`, error);
            this.screenEl.innerHTML = `<p style="color:red;padding:1em;">Error loading ${programName}.</p>`;
        }

        this.updateDisplays();
    },
    
    openConsoleOnly: function() {
        const url = this._buildUrl('start');
        if (url) window.location.href = url;
    },

    openFullscreenProgram: function() {
        const url = this._buildUrl('run');
        if (url) window.location.href = url;
    },

    // --- Private helper for generating console URLs ---
    _buildUrl: function(mode) {
        const programName = this.availablePrograms[this.currentProgramIndex];
        if (!programName) return '';

        const params = new URLSearchParams();
        // mode is either 'run' (view-only) or 'start' (full console)
        params.set(mode, programName);

        const args = this.currentProgramArgs || { positional: [], named: {} };

        // Copy named arguments
        for (const [key, value] of Object.entries(args.named)) {
            params.set(key, String(value));
        }

        // Map positional arguments for specific programs
        if (programName === 'read' && args.positional.length > 0) {
            params.set('file', args.positional[0]);
        }
        // Add other program-specific mappings here

        return `/console?${params.toString()}`;
    },

    updateDisplays: function() {
        // Only update the dropdown button's text if the button element exists.
        if (this.dropdownBtn) {
            this.dropdownBtn.textContent = this.availablePrograms[this.currentProgramIndex];
        }
    }
};