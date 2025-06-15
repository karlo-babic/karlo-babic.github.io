export const Console = {
    // --- Configuration ---
    availablePrograms: ['gameoflife', 'evoltree', 'mandelbrot', 'boids', 'gravitysim'],
    
    // --- State ---
    currentProgramIndex: 0,
    activeProgram: null,
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
    
    init: function() {
        this.windowEl = document.getElementById('console-window');
        this.screenEl = document.getElementById('console-screen');
        this.inputEl = document.getElementById('program-input');
        this.suggestionEl = document.getElementById('console-suggestion'); // Get the new element
        this.dropdownBtn = document.getElementById('current-program-btn');
        this.programListEl = document.getElementById('program-list');

        // Attach event listeners
        document.getElementById('restart-program').addEventListener('click', () => this.restartCurrentProgram());
        this.dropdownBtn.addEventListener('click', () => this.toggleDropdown());
        document.getElementById('next-program').addEventListener('click', () => this.browse(1));
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        
        this.inputEl.addEventListener('input', () => this.updateSuggestion());

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault(); // Prevent cursor from moving to the start of the line
                this.navigateHistory('up');
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent cursor from moving to the end of the line
                this.navigateHistory('down');
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.runProgramFromInput();
                this.inputEl.value = '';
                this.updateSuggestion(); // Clear suggestion after enter
            }

            // New handler for the Tab key
            if (e.key === 'Tab') {
                if (this.currentSuggestion) {
                    e.preventDefault(); // Prevent focus from moving to the next element
                    this.inputEl.value = this.currentSuggestion;
                    this.updateSuggestion(); // Clear the suggestion text
                }
            }
        });

        this.inputEl.addEventListener('blur', () => {
            this.clearSuggestion(); // Clear suggestion when input loses focus
        });
        
        window.addEventListener('click', (e) => {
            if (!e.target.matches('.dropdown-btn')) {
                this.programListEl.classList.remove('show');
            }
        });

        this.populateDropdown();
        this.loadProgram(this.availablePrograms[this.currentProgramIndex]);
    },
    
    // --- Autocomplete logic ---
    updateSuggestion: function() {
        const inputText = this.inputEl.value.trim().toLowerCase();
        
        if (!inputText) {
            this.clearSuggestion();
            return;
        }

        const match = this.availablePrograms.find(prog => prog.startsWith(inputText));

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
            return; // Don't add empty commands or consecutive duplicates
        }
        this.commandHistory.unshift(command); // Add to the beginning of the array
        
        // Optional: Limit history size
        if (this.commandHistory.length > 50) {
            this.commandHistory.pop();
        }
    },

    navigateHistory: function(direction) {
        if (direction === 'up') {
            // Go older in history (increase index)
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
            }
        } else { // 'down'
            // Go newer in history (decrease index)
            if (this.historyIndex > -1) {
                this.historyIndex--;
            }
        }

        if (this.historyIndex >= 0) {
            this.inputEl.value = this.commandHistory[this.historyIndex];
        } else {
            // If we are back at the start, clear the input
            this.inputEl.value = '';
        }
        
        // Place cursor at the end of the line
        this.inputEl.focus();
        this.inputEl.selectionStart = this.inputEl.selectionEnd = this.inputEl.value.length;
        
        this.clearSuggestion(); // Don't show a suggestion while browsing history
    },

    restartCurrentProgram: function() {
        this.loadProgram(this.availablePrograms[this.currentProgramIndex]);
    },

    populateDropdown: function() {
        this.programListEl.innerHTML = '';
        this.availablePrograms.forEach((programName, index) => {
            const item = document.createElement('a');
            item.href = '#';
            item.textContent = programName;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentProgramIndex = index;
                this.loadProgram(programName);
                this.programListEl.classList.remove('show');
            });
            this.programListEl.appendChild(item);
        });
    },

    toggleDropdown: function() {
        this.programListEl.classList.toggle('show');
    },

    browse: function(direction) {
        this.currentProgramIndex = (this.currentProgramIndex + direction + this.availablePrograms.length) % this.availablePrograms.length;
        this.loadProgram(this.availablePrograms[this.currentProgramIndex]);
    },
    
    runProgramFromInput: function() {
        const programName = this.inputEl.value.trim().toLowerCase();
        
        this.addToHistory(programName); // Add the command to history
        this.historyIndex = -1; // Reset history navigation index

        const programIndex = this.availablePrograms.indexOf(programName);

        if (programIndex !== -1) {
            this.currentProgramIndex = programIndex;
            this.loadProgram(programName);
        } else {
            if (programName) { // Don't warn for empty commands
                console.warn(`Program "${programName}" not found.`);
            }
        }
    },

    // --- REFACTORED PROGRAM LOADER ---
    loadProgram: async function(programName) {
        // Unload the previous program if it exists.
        if (this.activeProgram && typeof this.activeProgram.unload === 'function') {
            this.activeProgram.unload();
        }
        this.activeProgram = null;
        this.screenEl.innerHTML = ''; // Clear the screen.

        try {
            // Dynamically import the program's module.
            const path = `./programs/${programName}.js`;
            const programModule = await import(path);

            // The module should have a default export with an `init` method.
            if (programModule.default && typeof programModule.default.init === 'function') {
                this.activeProgram = programModule.default;
                this.activeProgram.init(this.screenEl);
            } else {
                 console.error(`Program "${programName}" does not have a valid default export.`);
            }
        } catch (error) {
            console.error(`Failed to load or run program: ${programName}`, error);
            // Optionally, display an error message on the console screen.
            this.screenEl.innerHTML = `<p style="color:red;padding:1em;">Error loading ${programName}.</p>`;
        }
        
        this.updateDisplays();
    },
    
    toggleFullscreen: function() {
        this.windowEl.classList.toggle('fullscreen');
        // Let the CSS transition finish before resizing the program's canvas.
        setTimeout(() => {
            if (this.activeProgram && typeof this.activeProgram.onResize === 'function') {
                this.activeProgram.onResize();
            }
        }, 150);
    },
    
    updateDisplays: function() {
        this.dropdownBtn.textContent = this.availablePrograms[this.currentProgramIndex];
    }
};