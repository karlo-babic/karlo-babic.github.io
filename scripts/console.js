const Console = {
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
                e.preventDefault(); // Prevent any default 'enter' behavior
                this.runProgramFromInput();
                // Clear the input to ready it for the next command, but keep it focused.
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

    loadProgram: function(programName) {
        if (this.activeProgram && typeof this.activeProgram.unload === 'function') {
            this.activeProgram.unload();
        }
        this.activeProgram = null;
        this.screenEl.innerHTML = '';

        const script = document.createElement('script');
        script.src = `scripts/programs/${programName}.js`;
        script.id = `program-script-${programName}`;
        script.onerror = () => console.error(`Failed to load script for program: ${programName}`);
        document.head.appendChild(script);
        
        this.updateDisplays();
    },

    runProgram: function(programName, programObject) {
        if (programObject && typeof programObject.init === 'function') {
            this.activeProgram = programObject;
            this.activeProgram.init(this.screenEl);
        } else {
            console.error(`Program "${programName}" tried to run but is invalid.`);
        }
    },
    
    toggleFullscreen: function() {
        this.windowEl.classList.toggle('fullscreen');
        if (this.activeProgram && typeof this.activeProgram.onResize === 'function') {
            setTimeout(() => this.activeProgram.onResize(), 150);
        }
    },
    
    updateDisplays: function() {
        // Only update if the input is not currently focused by the user
        if (document.activeElement !== this.inputEl) {
            const currentProgramName = this.availablePrograms[this.currentProgramIndex];
            this.inputEl.value = `...`;
        }
        this.dropdownBtn.textContent = this.availablePrograms[this.currentProgramIndex];
    }
};