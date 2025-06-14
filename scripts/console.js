export const Console = {
    // --- Configuration ---
    availablePrograms: ['gameoflife', 'evoltree', 'mandelbrot', 'boids', 'gravitysim'],
    
    // --- State ---
    currentProgramIndex: 0,
    activeProgram: null,
    
    // --- DOM Elements ---
    windowEl: null,
    screenEl: null,
    inputEl: null,
    dropdownBtn: null,
    programListEl: null,
    
    init: function() {
        this.windowEl = document.getElementById('console-window');
        this.screenEl = document.getElementById('console-screen');
        this.inputEl = document.getElementById('program-input');
        this.dropdownBtn = document.getElementById('current-program-btn');
        this.programListEl = document.getElementById('program-list');

        // Attach event listeners
        document.getElementById('restart-program').addEventListener('click', () => this.restartCurrentProgram());
        this.dropdownBtn.addEventListener('click', () => this.toggleDropdown());
        document.getElementById('next-program').addEventListener('click', () => this.browse(1));
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.runProgramFromInput();
                this.inputEl.value = '';
            }
        });

        this.inputEl.addEventListener('focus', () => { this.inputEl.value = ''; });
        this.inputEl.addEventListener('blur', () => { this.updateDisplays(); });
        
        window.addEventListener('click', (e) => {
            if (!e.target.matches('.dropdown-btn')) {
                this.programListEl.classList.remove('show');
            }
        });

        this.populateDropdown();
        this.loadProgram(this.availablePrograms[this.currentProgramIndex]);
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
        const programIndex = this.availablePrograms.indexOf(programName);

        if (programIndex !== -1) {
            this.currentProgramIndex = programIndex;
            this.loadProgram(programName);
        } else {
            console.warn(`Program "${programName}" not found.`);
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
        if (document.activeElement !== this.inputEl) {
            this.inputEl.value = `...`;
        }
        this.dropdownBtn.textContent = this.availablePrograms[this.currentProgramIndex];
    }
};