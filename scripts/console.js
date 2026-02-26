export const Console = {
    // --- Configuration ---
    availablePrograms: ['help', 'gameoflife', 'evoltree', 'mandelbrot', 'boids', 'gravitysim', 'glideroflife', 'eliza', 'img', 'sun', 'read', 'txt'],
    // A list of programs to hide from UI elements like the dropdown, suggest-complete, and "next program".
    hiddenPrograms: ['read', 'txt'],

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

      
    init: function(initialProgramName = null) {
        this.windowEl = document.getElementById('console-window');
        this.screenEl = document.getElementById('console-screen');
        this.inputEl = document.getElementById('program-input');
        this.suggestionEl = document.getElementById('console-suggestion');
        this.dropdownBtn = document.getElementById('current-program-btn');
        this.programListEl = document.getElementById('program-list');

        // Find each button element.
        const restartBtn = document.getElementById('restart-program');
        const nextBtn = document.getElementById('next-program');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const viewOnlyBtn = document.getElementById('view-only-btn');

        // Only add listeners if the element was found.
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartCurrentProgram());
        }
        if (this.dropdownBtn) {
            this.dropdownBtn.addEventListener('click', () => this.toggleDropdown());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.browse(1));
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.openInNewTab());
        }
        if (viewOnlyBtn) {
            viewOnlyBtn.addEventListener('click', () => this.openViewOnly());
        }

        this.inputEl.addEventListener('input', () => {
            this.inputEl.style.height = 'auto';
            
            // Only apply explicit height if content wraps to multiple lines
            if (this.inputEl.scrollHeight > 24) {
                this.inputEl.style.height = this.inputEl.scrollHeight + 'px';
            }
            
            this.updateSuggestion();
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.runProgramFromInput();
                this.inputEl.value = '';
                this.inputEl.style.height = ''; // Reset to CSS default
                this.updateSuggestion();
            }
            if (e.key === 'Tab') {
                if (this.currentSuggestion) {
                    e.preventDefault();
                    this.inputEl.value = this.currentSuggestion;
                    this.updateSuggestion();
                }
            }
        });

        this.inputEl.addEventListener('blur', () => {
            this.clearSuggestion();
        });

        window.addEventListener('click', (e) => {
            if (this.dropdownBtn && !e.target.matches('.dropdown-btn')) {
                this.programListEl.classList.remove('show');
            }
        });
        
        this.populateDropdown();

        // --- LOGIC FOR INITIAL PROGRAM ---
        let programToLoad = this.availablePrograms[0]; // Default to the first program
        
        if (initialProgramName) {
            const requestedIndex = this.availablePrograms.indexOf(initialProgramName);
            // Check if the requested program exists in the list.
            if (requestedIndex !== -1) {
                programToLoad = initialProgramName;
                this.currentProgramIndex = requestedIndex;
            } else {
                console.warn(`Initial program "${initialProgramName}" not found. Defaulting to first program.`);
            }
        }
        
        // Load the determined program.
        this.loadProgram(programToLoad);

        // Automatically focus the input only on larger (desktop) screens.
        const isDesktop = window.innerWidth > 768;
        if (isDesktop) {
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

        // Only suggest programs that are not hidden.
        const visiblePrograms = this.availablePrograms.filter(p => !this.hiddenPrograms.includes(p));
        const match = visiblePrograms.find(prog => prog.startsWith(inputText));

        if (match && match !== inputText) {
            this.currentSuggestion = match;
            this.suggestionEl.textContent = match;
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

    populateDropdown: function() {
        if (!this.programListEl) return;
        this.programListEl.innerHTML = '';
        // Filter out hidden programs before populating the list.
        const visiblePrograms = this.availablePrograms.filter(p => !this.hiddenPrograms.includes(p));

        visiblePrograms.forEach(programName => {
            const item = document.createElement('a');
            item.href = '#';
            item.textContent = programName;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Find the original index in the complete list.
                this.currentProgramIndex = this.availablePrograms.indexOf(programName);
                this.loadProgram(programName);
                this.programListEl.classList.remove('show');
            });
            this.programListEl.appendChild(item);
        });
    },

    toggleDropdown: function() {
        if (this.programListEl) {
            this.programListEl.classList.toggle('show');
        }
    },

    browse: function(direction) {
        // This loop ensures the next/prev buttons skip over any hidden programs.
        do {
            this.currentProgramIndex = (this.currentProgramIndex + direction + this.availablePrograms.length) % this.availablePrograms.length;
        } while (this.hiddenPrograms.includes(this.availablePrograms[this.currentProgramIndex]));

        this.loadProgram(this.availablePrograms[this.currentProgramIndex]);
    },

    runProgramFromInput: function() {
        const inputString = this.inputEl.value;
        const { command, args } = this._parseCommand(inputString);

        this.addToHistory(inputString.trim());
        this.historyIndex = -1;

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
        this.screenEl.innerHTML = '';
        
        // Update the current program index to match the program being loaded.
        // This ensures the dropdown UI stays in sync.
        const programIndex = this.availablePrograms.indexOf(programName);
        if (programIndex !== -1) {
            this.currentProgramIndex = programIndex;
        }

        // Store the arguments used to launch this program instance.
        this.currentProgramArgs = args;

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
    
    openInNewTab: function() {
        window.open('console', '_blank');
    },

    openViewOnly: function() {
        const programName = this.availablePrograms[this.currentProgramIndex];
        if (!programName || !this.currentProgramArgs) return;

        const params = new URLSearchParams();
        params.set('run', programName);

        // Copy named arguments directly from the current program's arguments.
        for (const [key, value] of Object.entries(this.currentProgramArgs.named)) {
            params.set(key, String(value));
        }

        // Convert positional arguments to named parameters for URL sharing.
        // This section contains program-specific logic.
        if (programName === 'read' && this.currentProgramArgs.positional.length > 0) {
            // For 'read', the first positional arg is the filename. Map it to 'file'.
            params.set('file', this.currentProgramArgs.positional[0]);
        }
        // Add other `else if` blocks here for other programs with positional args.

        const url = `/console?${params.toString()}`;
        window.open(url, '_blank');
    },

    updateDisplays: function() {
        // Only update the dropdown button's text if the button element exists.
        if (this.dropdownBtn) {
            this.dropdownBtn.textContent = this.availablePrograms[this.currentProgramIndex];
        }
    }
};